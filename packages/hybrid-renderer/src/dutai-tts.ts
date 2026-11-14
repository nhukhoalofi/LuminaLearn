import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { TtsProvider, TtsSynthesisSettings } from './audio';
import { probeAudio, probeAudioSignal } from './audio';

export interface DutaiTtsOptions {
  endpoint?: string;
  apiKey?: string;
  defaultVoice?: string;
  defaultModel?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class DutaiTtsProvider implements TtsProvider {
  readonly id = 'dutai_tts';
  readonly isSilentFixture = false;
  readonly requiresExternalConsent = true;

  private readonly endpoint: string;
  private readonly apiKey?: string;
  private readonly defaultVoice: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: DutaiTtsOptions = {}) {
    this.endpoint = options.endpoint ?? process.env.DUTAI_TTS_ENDPOINT ?? 'https://tts.dutai.io.vn/v1/audio/speech';
    this.apiKey = options.apiKey ?? process.env.DUTAI_TTS_API_KEY ?? process.env.DUTAI_API_KEY;
    this.defaultVoice = options.defaultVoice ?? process.env.DUTAI_TTS_VOICE ?? 'baotrang';
    this.defaultModel = options.defaultModel ?? process.env.DUTAI_TTS_MODEL ?? 'zerotts';
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  async synthesize(text: string, outputPath: string, settings?: TtsSynthesisSettings): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('dutai_tts_failed: text to synthesize cannot be empty');
    }

    const voice = settings?.voice || this.defaultVoice;
    const model = settings?.model || this.defaultModel;
    const speed = settings?.speakingRate ?? 1.0;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const payload = {
      model,
      input: trimmed,
      voice,
      response_format: 'wav',
      speed,
      stream: false,
      normalize_text: true
    };

    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timer);

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          throw new Error('DUTAI TTS returned empty audio payload');
        }

        const buffer = Buffer.from(arrayBuffer);
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, buffer);

        // Probe via ffprobe to guarantee valid audio and fail-closed against corruption
        const metadata = await probeAudio(outputPath, 120);
        if (metadata.durationSeconds <= 0) {
          throw new Error('DUTAI TTS produced audio with zero or negative duration');
        }

        // Check for silence to fail-closed against silent audio
        const signal = await probeAudioSignal(outputPath);
        if (signal.isSilent) {
          throw new Error(
            `dutai_tts_silent_audio: synthesized audio is completely silent (max=${signal.maxVolumeDb}dB)`
          );
        }

        return;
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        }
      }
    }

    throw new Error(
      `dutai_tts_failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
  }
}

