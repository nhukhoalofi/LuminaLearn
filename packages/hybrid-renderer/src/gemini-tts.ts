import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { GoogleGenAI } from '@google/genai';
import type { TtsProvider } from './audio';

export interface GeminiSpeechRequest {
  model: string;
  text: string;
  voice: string;
  languageCode: string;
  styleInstruction?: string;
  signal: AbortSignal;
}

export interface GeminiSpeechResponse {
  data: string | Uint8Array;
  mimeType?: string;
  modelVersion?: string;
  sampleRate?: number;
  channels?: number;
}

export interface GeminiAudioClient {
  assertModelAvailable(model: string, signal: AbortSignal): Promise<void>;
  generateSpeech(request: GeminiSpeechRequest): Promise<GeminiSpeechResponse>;
}

export class GoogleGenAiAudioClient implements GeminiAudioClient {
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async assertModelAvailable(model: string, signal: AbortSignal): Promise<void> {
    const metadata = await this.ai.models.get({ model, config: { abortSignal: signal } });
    if (!metadata.name) throw new Error(`tts_model_unavailable: Model '${model}' was not returned by the Gemini API`);
  }

  async generateSpeech(request: GeminiSpeechRequest): Promise<GeminiSpeechResponse> {
    if (request.model === 'gemini-3.8-flash-tts' || request.model === 'gemini-3.8-flash-lite-tts') {
      const interaction = await this.ai.interactions.create({
        model: request.model,
        input: [{
          type: 'user_input',
          content: [{
            type: 'text',
            text: request.text,
            annotations: request.styleInstruction
              ? [{ type: 'speech_metadata', style: request.styleInstruction }]
              : []
          }]
        }],
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice: request.voice }] }
      }, { fetch_options: { signal: request.signal } });
      if (!interaction.output_audio?.data) {
        throw new Error('tts_empty_audio: Gemini returned no interaction audio payload');
      }
      return {
        data: interaction.output_audio.data,
        mimeType: interaction.output_audio.mime_type,
        modelVersion: request.model,
        sampleRate: interaction.output_audio.sample_rate,
        channels: interaction.output_audio.channels
      };
    }

    // Preview/legacy Gemini TTS models use generateContent and return raw PCM.
    const response = await this.ai.models.generateContent({
      model: request.model,
      contents: [{ parts: [{ text: request.text }] }],
      config: {
        abortSignal: request.signal,
        responseModalities: ['AUDIO'],
        speechConfig: {
          languageCode: request.languageCode,
          voiceConfig: { prebuiltVoiceConfig: { voiceName: request.voice } }
        },
        systemInstruction: request.styleInstruction
      }
    });
    const inlineData = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
    if (!inlineData?.data) throw new Error('tts_empty_audio: Gemini returned no inline audio payload');
    return { data: inlineData.data, mimeType: inlineData.mimeType, modelVersion: response.modelVersion };
  }
}

export interface GeminiTtsProviderOptions {
  apiKey?: string;
  model?: string;
  voice?: string;
  language?: string;
  client?: GeminiAudioClient;
  timeoutMs?: number;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
}

const SUPPORTED_GEMINI_TTS_MODELS = new Set([
  'gemini-3.8-flash-tts',
  'gemini-3.8-flash-lite-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts'
]);

function runFfmpeg(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    execFile('ffmpeg', args, { windowsHide: true, timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, _stdout, stderr) => {
      if (error) return reject(new Error(`tts_audio_conversion_failed: ${stderr || error.message}`));
      resolvePromise();
    });
  });
}

function statusFromError(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as { status?: unknown; code?: unknown };
  const status = Number(value.status ?? value.code);
  return Number.isInteger(status) ? status : undefined;
}

function safeErrorMessage(error: unknown, apiKey?: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  return apiKey ? raw.replaceAll(apiKey, '[REDACTED]') : raw;
}

function classifyGeminiError(error: unknown, apiKey?: string): Error {
  const status = statusFromError(error);
  const message = safeErrorMessage(error, apiKey);
  if (status === 401 || status === 403) return new Error(`tts_authentication_failed: ${message}`);
  if (status === 404) return new Error(`tts_model_unavailable: ${message}`);
  if (status === 429) return new Error(`tts_quota_exceeded: ${message}`);
  if (error instanceof DOMException && error.name === 'AbortError') return new Error('tts_timeout: Gemini TTS request timed out');
  return new Error(`tts_provider_failed: ${message}`);
}

function isTransient(error: unknown): boolean {
  const status = statusFromError(error);
  if (status !== undefined) return status === 408 || status >= 500;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return /timeout|timed out|econnreset|econnrefused|socket|network|fetch failed/.test(message);
}

function decodeAudioPayload(data: string | Uint8Array): Buffer {
  const bytes = typeof data === 'string' ? Buffer.from(data, 'base64') : Buffer.from(data);
  if (bytes.length === 0) throw new Error('tts_empty_audio: Gemini returned an empty audio payload');
  return bytes;
}

function parseAudioFormat(response: GeminiSpeechResponse, bytes: Buffer): {
  extension: '.wav' | '.pcm' | '.mp3';
  inputArgs: string[];
} {
  const normalized = response.mimeType?.toLowerCase().split(';', 1)[0].trim();
  if (normalized === 'audio/wav' || normalized === 'audio/x-wav') {
    if (bytes.length < 12 || bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WAVE') {
      throw new Error('tts_invalid_audio_format: Gemini declared WAV but returned no RIFF/WAVE header');
    }
    return { extension: '.wav', inputArgs: [] };
  }
  if (normalized === 'audio/l16' || normalized === 'audio/pcm' || normalized === 'audio/raw') {
    const sampleRate = response.sampleRate ?? 24_000;
    const channels = response.channels ?? 1;
    if (!Number.isInteger(sampleRate) || sampleRate < 8_000 || sampleRate > 96_000 || channels !== 1) {
      throw new Error('tts_invalid_audio_format: Raw PCM sample rate or channel count is unsupported');
    }
    if (bytes.length < 480 || bytes.length % 2 !== 0) {
      throw new Error('tts_invalid_audio_format: Raw PCM payload is empty, truncated, or not 16-bit aligned');
    }
    return { extension: '.pcm', inputArgs: ['-f', 's16le', '-ar', String(sampleRate), '-ac', String(channels)] };
  }
  if (normalized === 'audio/mpeg' || normalized === 'audio/mp3') {
    if (bytes.length < 4 || !(bytes.subarray(0, 3).toString('ascii') === 'ID3' || bytes[0] === 0xff)) {
      throw new Error('tts_invalid_audio_format: Gemini declared MP3 but returned an invalid payload');
    }
    return { extension: '.mp3', inputArgs: [] };
  }
  throw new Error(`tts_invalid_audio_format: Unsupported Gemini audio MIME type '${response.mimeType ?? 'missing'}'`);
}

export class GeminiTtsProvider implements TtsProvider {
  readonly id = 'gemini_tts';
  readonly model: string;
  readonly voice: string;
  readonly languageCode: string;
  private readonly apiKey?: string;
  private readonly client: GeminiAudioClient;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly retryBaseDelayMs: number;
  private modelAvailability?: Promise<void>;

  constructor(options: GeminiTtsProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    this.model = options.model ?? process.env.GEMINI_TTS_MODEL ?? 'gemini-3.8-flash-lite-tts';
    this.voice = options.voice ?? process.env.GEMINI_TTS_VOICE ?? 'Kore';
    const configuredLanguage = options.language ?? process.env.GEMINI_TTS_LANGUAGE ?? 'vi';
    this.languageCode = configuredLanguage === 'vi' ? 'vi-VN' : configuredLanguage;
    this.timeoutMs = options.timeoutMs ?? 45_000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 300;

    if (!SUPPORTED_GEMINI_TTS_MODELS.has(this.model)) {
      throw new Error(`tts_model_unsupported: '${this.model}' is not an approved Gemini TTS model`);
    }
    if (!options.client && !this.apiKey) throw new Error('tts_api_key_missing: GEMINI_API_KEY is required for Gemini TTS');
    this.client = options.client ?? new GoogleGenAiAudioClient(this.apiKey!);
  }

  private async withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await operation(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  private ensureModelAvailable(): Promise<void> {
    this.modelAvailability ??= this.withTimeout((signal) => this.client.assertModelAvailable(this.model, signal));
    return this.modelAvailability;
  }

  async synthesize(text: string, outputPath: string): Promise<void> {
    const narration = text.trim();
    if (!narration || narration.length > 5_000) throw new Error('tts_invalid_text: Narration must contain 1 to 5000 characters');
    if (extname(outputPath).toLowerCase() !== '.mp3') throw new Error('tts_output_invalid: Gemini TTS output path must end in .mp3');

    try {
      await this.ensureModelAvailable();
    } catch (error) {
      throw classifyGeminiError(error, this.apiKey);
    }

    let response: GeminiSpeechResponse | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        response = await this.withTimeout((signal) => this.client.generateSpeech({
          model: this.model,
          text: narration,
          voice: this.voice,
          languageCode: this.languageCode,
          styleInstruction: 'Giọng giáo viên Việt Nam tự nhiên, rõ ràng, tốc độ vừa phải. Đọc nguyên văn nội dung.',
          signal
        }));
        break;
      } catch (error) {
        lastError = error;
        if (attempt >= this.maxAttempts || !isTransient(error)) break;
        await new Promise((done) => setTimeout(done, this.retryBaseDelayMs * 2 ** (attempt - 1)));
      }
    }
    if (!response) throw classifyGeminiError(lastError, this.apiKey);

    const bytes = decodeAudioPayload(response.data);
    const format = parseAudioFormat(response, bytes);
    const tempPath = resolve(dirname(outputPath), `.gemini-tts-${randomUUID()}${format.extension}`);
    await mkdir(dirname(outputPath), { recursive: true });
    try {
      await writeFile(tempPath, bytes, { flag: 'wx' });
      await runFfmpeg([
        '-y', ...format.inputArgs, '-i', tempPath,
        '-vn', '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '96k',
        outputPath
      ], 60_000);
    } finally {
      await rm(tempPath, { force: true }).catch(() => undefined);
    }
  }
}

export function isGeminiTtsConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
