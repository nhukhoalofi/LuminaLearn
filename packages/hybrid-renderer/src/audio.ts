import { execFile } from 'node:child_process';
import { access, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import {
  NarrationAudioAssetSchema,
  type HybridTimelineScene,
  type NarrationAudioAsset,
  type NarrationScript,
  type NarrationPlanV2,
  type PronunciationHintV2,
  type StoryboardV2
} from '@luminalearn/scene-schema';
import { assertPathInside } from './paths';

export type AudioSignalClassification = 'audible_non_silent' | 'silent_fixture';

export interface AudioSignalProbeResult {
  meanVolumeDb: number;
  maxVolumeDb: number;
  isSilent: boolean;
  audioClassification: AudioSignalClassification;
}

export interface AudioMetadata {
  codec: 'mp3' | 'pcm_s16le' | 'aac';
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  sizeBytes: number;
  meanVolumeDb?: number;
  maxVolumeDb?: number;
  isSilent?: boolean;
  audioClassification?: AudioSignalClassification;
}

export interface TtsProvider {
  readonly id: string;
  readonly isSilentFixture?: boolean;
  readonly requiresExternalConsent?: boolean;
  synthesize(text: string, outputPath: string, settings?: TtsSynthesisSettings): Promise<void>;
}

export interface TtsSynthesisSettings {
  voice: string;
  languageCode: string;
  speakingRate: number;
  pitch: number;
  model?: string;
}

const VIETNAMESE_MATH_PRONUNCIATION_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/∫₀¹\s*x²\s*dx/gu, 'tích phân từ không đến một của x bình phương theo x'],
  [/f['′] ?\(x\)/gu, 'f phẩy của x'],
  [/x²/gu, 'x bình phương'],
  [/x³/gu, 'x lập phương'],
  [/Δx/gu, 'đen-ta x'],
  [/\blim\b/giu, 'giới hạn']
];

export function buildSpokenNarrationText(
  narrationText: string,
  pronunciationHints: PronunciationHintV2[] = []
): string {
  let spoken = narrationText;
  for (const hint of pronunciationHints) {
    spoken = spoken.split(hint.written).join(hint.spoken);
  }
  for (const [pattern, replacement] of VIETNAMESE_MATH_PRONUNCIATION_RULES) {
    spoken = spoken.replace(pattern, replacement);
  }
  return spoken;
}

export class GoogleCloudTtsProvider implements TtsProvider {
  readonly id = 'google_cloud_tts';
  readonly requiresExternalConsent = true;
  private readonly client: TextToSpeechClient;
  constructor(
    private readonly voiceName = process.env.GOOGLE_TTS_VOICE ?? 'vi-VN-Neural2-A',
    client?: TextToSpeechClient
  ) { this.client = client ?? new TextToSpeechClient(); }

  async synthesize(text: string, outputPath: string, settings?: TtsSynthesisSettings): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const [response] = await this.client.synthesizeSpeech({
          input: { text }, voice: { languageCode: settings?.languageCode ?? 'vi-VN', name: settings?.voice ?? this.voiceName },
          audioConfig: { audioEncoding: 'MP3', speakingRate: settings?.speakingRate ?? 1, pitch: settings?.pitch ?? 0 }
        });
        if (!response.audioContent) throw new Error('Google Cloud TTS returned no audio content');
        const bytes = typeof response.audioContent === 'string'
          ? Buffer.from(response.audioContent, 'base64') : Buffer.from(response.audioContent);
        await writeFile(outputPath, bytes);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise((done) => setTimeout(done, attempt * 250));
      }
    }
    throw new Error(`tts_provider_failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }
}

export class MockTtsProvider implements TtsProvider {
  readonly id = 'mock_tts';
  readonly isSilentFixture = true;
  readonly requiresExternalConsent = false;
  constructor(private readonly defaultDurationSeconds?: number) {}

  async synthesize(text: string, outputPath: string): Promise<void> {
    const words = text.split(/\s+/).length;
    const duration = this.defaultDurationSeconds ?? Math.max(1, Math.min(10, Math.round(words / 3.5)));
    await new Promise<void>((resolvePromise, reject) => {
      execFile('ffmpeg', [
        '-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono',
        '-t', String(duration),
        '-c:a', 'libmp3lame',
        '-b:a', '64k',
        outputPath
      ], { windowsHide: true }, (err) => {
        if (err) return reject(new Error(`mock_tts_failed: ${err.message}`));
        resolvePromise();
      });
    });
  }
}

function runFfprobeAudio(filePath: string, timeoutMs = 30_000): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    execFile('ffprobe', [
      '-v', 'error', '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_name,sample_rate,channels', '-show_entries', 'format=duration,size', '-of', 'json', filePath
    ], { windowsHide: true, timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(`audio_validation_failed: ${stderr || error.message}`));
      try { resolvePromise(JSON.parse(stdout)); } catch (parseError) { reject(new Error('audio_validation_failed: ffprobe returned invalid JSON', { cause: parseError })); }
    });
  });
}

export function validateAudioProbe(raw: unknown, maxDurationSeconds = 40.1): AudioMetadata {
  const value = raw as { streams?: Array<{ codec_name?: string; sample_rate?: string; channels?: number }>; format?: { duration?: string; size?: string } };
  const stream = value.streams?.[0];
  const codec = stream?.codec_name;
  if (codec !== 'mp3' && codec !== 'pcm_s16le' && codec !== 'aac') throw new Error(`audio_validation_failed: unsupported codec ${codec ?? 'missing'}`);
  const durationSeconds = Number(value.format?.duration);
  const sampleRate = Number(stream?.sample_rate);
  const channels = Number(stream?.channels);
  const sizeBytes = Number(value.format?.size);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > maxDurationSeconds) throw new Error('audio_duration_invalid: expected duration between 0 and 40 seconds');
  if (!Number.isInteger(sampleRate) || sampleRate < 8_000 || sampleRate > 96_000) throw new Error('audio_validation_failed: invalid sample rate');
  if (!Number.isInteger(channels) || channels < 1 || channels > 2) throw new Error('audio_validation_failed: invalid channel count');
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) throw new Error('audio_validation_failed: empty file');
  return { codec, durationSeconds, sampleRate, channels, sizeBytes };
}

export async function probeAudioSignal(filePath: string, timeoutMs = 30_000): Promise<AudioSignalProbeResult> {
  const output = await new Promise<string>((resolvePromise, reject) => {
    execFile(
      'ffmpeg',
      ['-hide_banner', '-i', filePath, '-af', 'volumedetect', '-vn', '-f', 'null', '-'],
      { windowsHide: true, timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) return reject(new Error(`audio_signal_probe_failed: ${stderr || stdout || error.message}`));
        resolvePromise(`${stdout}\n${stderr}`);
      }
    );
  });

  const meanMatch = /mean_volume:\s*(-?[\d.]+)\s*dB/i.exec(output);
  const maxMatch = /max_volume:\s*(-?[\d.]+)\s*dB/i.exec(output);
  const meanVolumeDb = meanMatch ? Number(meanMatch[1]) : -91.0;
  const maxVolumeDb = maxMatch ? Number(maxMatch[1]) : -91.0;
  const isSilent = !Number.isFinite(maxVolumeDb) || maxVolumeDb <= -55.0;

  return {
    meanVolumeDb,
    maxVolumeDb,
    isSilent,
    audioClassification: isSilent ? 'silent_fixture' : 'audible_non_silent'
  };
}

export async function probeAudio(filePath: string, maxDurationSeconds = 40.1): Promise<AudioMetadata> {
  const file = await stat(filePath);
  if (!file.isFile() || file.size <= 0) throw new Error('audio_validation_failed: file is missing or empty');
  return validateAudioProbe(await runFfprobeAudio(filePath), maxDurationSeconds);
}

function asAsset(options: { jobId: string; fileName: string; startFrame: number; metadata: AudioMetadata; segmentId?: string; sceneId?: string }): NarrationAudioAsset {
  return NarrationAudioAssetSchema.parse({
    id: options.segmentId ? `audio_${options.segmentId.replace(/^narration_/, '')}` : 'audio_provided',
    narrationSegmentId: options.segmentId, sceneId: options.sceneId,
    publicPath: `generated/${options.jobId}/${options.fileName}`,
    startFrame: options.startFrame,
    durationFrames: Math.max(1, Math.round(options.metadata.durationSeconds * 24)),
    durationSeconds: options.metadata.durationSeconds,
    codec: options.metadata.codec, sampleRate: options.metadata.sampleRate, channels: options.metadata.channels,
    verificationStatus: 'verified'
  });
}

export async function prepareProvidedAudio(options: {
  sourcePath: string; jobId: string; jobDirectory: string; stagedDirectory: string;
}): Promise<NarrationAudioAsset[]> {
  const source = resolve(options.sourcePath);
  await access(source);
  const extension = extname(source).toLowerCase();
  if (!['.mp3', '.wav', '.m4a'].includes(extension)) throw new Error('audio_validation_failed: provided audio must be MP3, WAV, or M4A');
  const metadata = await probeAudio(source);
  const fileName = `provided-narration${extension}`;
  const jobCopy = assertPathInside(options.jobDirectory, resolve(options.jobDirectory, fileName));
  await copyFile(source, jobCopy);
  await mkdir(options.stagedDirectory, { recursive: true });
  await copyFile(jobCopy, resolve(options.stagedDirectory, fileName));
  await writeFile(resolve(options.jobDirectory, `${fileName}.metadata.json`), JSON.stringify(metadata, null, 2), 'utf8');
  return [asAsset({ jobId: options.jobId, fileName, startFrame: 0, metadata })];
}

export async function synthesizeNarration(options: {
  provider: TtsProvider; narration: NarrationScript; scenes: HybridTimelineScene[];
  jobId: string; jobDirectory: string; stagedDirectory: string;
}): Promise<NarrationAudioAsset[]> {
  if (options.narration.segments.length > 5) throw new Error('tts_call_limit_exceeded: maximum five synthesis calls per job');
  const sceneMap = new Map(options.scenes.map((scene) => [scene.id, scene]));
  const assets: NarrationAudioAsset[] = [];
  await mkdir(options.stagedDirectory, { recursive: true });
  for (const segment of options.narration.segments) {
    const scene = sceneMap.get(segment.sceneId);
    if (!scene) throw new Error(`tts_scene_missing: ${segment.sceneId}`);
    const fileName = `${segment.id}.mp3`;
    const jobPath = resolve(options.jobDirectory, fileName);
    let metadata: AudioMetadata | undefined;
    try { metadata = await probeAudio(jobPath); } catch { /* invalid cache is replaced */ }
    if (!metadata) {
      await options.provider.synthesize(buildSpokenNarrationText(segment.text, segment.pronunciationHints), jobPath);
      metadata = await probeAudio(jobPath);
    }
    const sceneSeconds = scene.durationFrames / 24;
    if (metadata.durationSeconds > sceneSeconds - 0.1) {
      throw new Error(`audio_duration_exceeds_scene: ${segment.id} is ${metadata.durationSeconds.toFixed(2)}s for a ${sceneSeconds.toFixed(2)}s scene`);
    }
    await copyFile(jobPath, resolve(options.stagedDirectory, fileName));
    await writeFile(resolve(options.jobDirectory, `${fileName}.metadata.json`), JSON.stringify(metadata, null, 2), 'utf8');
    assets.push(asAsset({ jobId: options.jobId, fileName, startFrame: scene.startFrame, metadata, segmentId: segment.id, sceneId: scene.id }));
  }
  return assets;
}

export interface V2AudioOutputAsset {
  id: string;
  path: string;
  durationSeconds: number;
  codec: 'mp3';
  startFrame: number;
  audioClassification?: AudioSignalClassification;
  meanVolumeDb?: number;
  maxVolumeDb?: number;
}

export async function synthesizeNarrationV2(options: {
  provider: TtsProvider;
  narrationPlan: NarrationPlanV2;
  storyboard: StoryboardV2;
  jobId: string;
  jobDirectory: string;
  stagedDirectory: string;
  fps?: number;
  alignmentPolicy?: 'adjust_timeline' | 'hold_last_frame' | 'strict';
  lockedSceneIds?: ReadonlySet<string>;
  rejectSilentAudio?: boolean;
}): Promise<V2AudioOutputAsset[]> {
  if (options.narrationPlan.segments.length > 5) {
    throw new Error('tts_call_limit_exceeded: maximum five synthesis calls per job');
  }
  const fps = options.fps ?? 24;
  const alignmentPolicy = options.alignmentPolicy ?? 'strict';
  await mkdir(options.jobDirectory, { recursive: true });
  await mkdir(options.stagedDirectory, { recursive: true });

  const assets: V2AudioOutputAsset[] = [];

  let currentStartFrame = 0;
  for (const scene of options.storyboard.scenes) {
    const segment = options.narrationPlan.segments.find((seg) => seg.sceneId === scene.sceneId);
    if (!segment) {
      currentStartFrame += scene.durationFrames;
      continue;
    }

    const fileName = `${segment.segmentId}.mp3`;
    const jobPath = resolve(options.jobDirectory, fileName);
    let metadata: AudioMetadata | undefined;

    try {
      metadata = await probeAudio(jobPath, 300);
    } catch {
      // synthesize if not already probed
    }

    if (!metadata) {
      await options.provider.synthesize(buildSpokenNarrationText(segment.text, segment.pronunciationHints), jobPath);
      metadata = await probeAudio(jobPath, 300);
    }

    let signal: AudioSignalProbeResult;
    try {
      signal = await probeAudioSignal(jobPath);
    } catch (probeErr) {
      if (options.rejectSilentAudio || options.provider.id !== 'mock_tts') {
        throw new Error(`audio_signal_probe_failed: ${probeErr instanceof Error ? probeErr.message : String(probeErr)}`);
      }
      signal = {
        meanVolumeDb: -91.0,
        maxVolumeDb: -91.0,
        isSilent: true,
        audioClassification: 'silent_fixture' as const
      };
    }
    metadata.meanVolumeDb = signal.meanVolumeDb;
    metadata.maxVolumeDb = signal.maxVolumeDb;
    metadata.isSilent = signal.isSilent;
    metadata.audioClassification =
      options.provider.id === 'mock_tts' || options.provider.isSilentFixture || signal.isSilent
        ? 'silent_fixture'
        : 'audible_non_silent';

    if (options.rejectSilentAudio && signal.isSilent) {
      throw new Error(
        `tts_silent_audio: Phân đoạn âm thanh ${segment.segmentId} không có tín hiệu tiếng nói (max_volume=${signal.maxVolumeDb} dB)`
      );
    }

    const sceneDurationSeconds = scene.durationFrames / fps;
    if (metadata.durationSeconds > sceneDurationSeconds) {
      if (alignmentPolicy === 'strict' || options.lockedSceneIds?.has(scene.sceneId)) {
        throw new Error(
          `audio_duration_exceeds_scene: Phân đoạn lời dẫn ${segment.segmentId} (${metadata.durationSeconds.toFixed(2)}s) vượt quá thời lượng cảnh ${scene.sceneId} (${sceneDurationSeconds.toFixed(2)}s); không thể kéo dài clip hình ảnh đã được đo`
        );
      } else if (alignmentPolicy === 'adjust_timeline') {
        // Expand scene frames to accommodate narration with small breathing room
        const neededFrames = Math.ceil((metadata.durationSeconds + 0.25) * fps);
        scene.durationFrames = Math.max(scene.durationFrames, neededFrames);
      } else {
        throw new Error(
          `audio_hold_policy_unavailable: Phân đoạn ${segment.segmentId} cần giữ khung hình cuối, nhưng chưa có xác nhận cảnh ${scene.sceneId} an toàn để hold; hãy rút ngắn lời dẫn hoặc dùng adjust_timeline cho cảnh không khóa`
        );
      }
    } else if (
      alignmentPolicy === 'adjust_timeline' &&
      !options.lockedSceneIds?.has(scene.sceneId) &&
      metadata.durationSeconds + 0.15 > sceneDurationSeconds
    ) {
      // Ensure speech has at least 0.15s breathing room at scene boundary so it is not clipped
      const neededFrames = Math.ceil((metadata.durationSeconds + 0.25) * fps);
      scene.durationFrames = Math.max(scene.durationFrames, neededFrames);
    }

    await copyFile(jobPath, resolve(options.stagedDirectory, fileName));
    await writeFile(
      resolve(options.jobDirectory, `${fileName}.metadata.json`),
      JSON.stringify(metadata, null, 2),
      'utf8'
    );

    assets.push({
      id: `audio_${segment.segmentId}`,
      path: `generated/${options.jobId}/${fileName}`,
      durationSeconds: metadata.durationSeconds,
      codec: 'mp3',
      startFrame: currentStartFrame,
      audioClassification: metadata.audioClassification,
      meanVolumeDb: metadata.meanVolumeDb,
      maxVolumeDb: metadata.maxVolumeDb
    });

    currentStartFrame += scene.durationFrames;
  }

  // Keep storyboard estimatedDurationFrames synchronized
  options.storyboard.estimatedDurationFrames = options.storyboard.scenes.reduce(
    (sum, s) => sum + s.durationFrames,
    0
  );

  return assets;
}
