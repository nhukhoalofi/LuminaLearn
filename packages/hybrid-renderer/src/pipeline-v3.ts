import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ApprovedRenderArtifactV3Schema,
  verifyExternalApiConsentV3,
  type ApprovedRenderArtifactV3,
  type ExternalApiConsentRecordV3
} from '@luminalearn/scene-schema';
import { GoogleCloudTtsProvider, probeAudio, probeAudioSignal, type TtsProvider } from './audio';
import { GeminiTtsProvider } from './gemini-tts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

export function computeV3ContentHash(core: unknown): string {
  return createHash('sha256').update(canonical(core), 'utf8').digest('hex');
}

export function verifyV3ArtifactIntegrity(artifact: ApprovedRenderArtifactV3): boolean {
  const parsed = ApprovedRenderArtifactV3Schema.safeParse(artifact);
  if (!parsed.success) return false;
  const { contentHash, ...core } = parsed.data;
  return computeV3ContentHash(core) === contentHash;
}

function execute(command: string, args: string[], cwd = repositoryRoot): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    execFile(command, args, { cwd, windowsHide: true, timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => error
        ? reject(new Error(`v3_remotion_render_failed: ${stderr || stdout || error.message}`, { cause: error }))
        : resolvePromise());
  });
}

function srtTimestamp(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

async function probeVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    execFile(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath],
      { windowsHide: true, timeout: 30_000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(`ffprobe_failed: ${stderr || err.message}`));
        const dur = Number.parseFloat(stdout.trim());
        if (!Number.isFinite(dur) || dur <= 0) return reject(new Error('ffprobe_invalid_duration'));
        resolvePromise(dur);
      }
    );
  });
}

export interface RenderPipelineV3Options {
  jobId: string;
  authorizeArtifact: (artifact: ApprovedRenderArtifactV3) => boolean | Promise<boolean>;
  providedAudioPath?: string;
  ttsProvider?: TtsProvider;
  consentRecord?: ExternalApiConsentRecordV3;
  confirmExternalApi?: boolean;
  onStage?: (stage: 'rendering_remotion' | 'synthesizing_audio' | 'merging_media') => void;
}

export async function runRenderPipelineV3(
  artifactInput: unknown,
  options: RenderPipelineV3Options
): Promise<{ outputPath: string }> {
  const artifact = ApprovedRenderArtifactV3Schema.parse(artifactInput);
  if (!verifyV3ArtifactIntegrity(artifact)) throw new Error('artifact_tampered: V3 content hash mismatch');
  if (!(await options.authorizeArtifact(artifact))) throw new Error('artifact_revoked: V3 artifact is no longer authorized');
  if (!artifact.lessonPlan.storyboard) throw new Error('v3_storyboard_missing');

  const outputDir = resolve(repositoryRoot, 'outputs', options.jobId);
  await mkdir(outputDir, { recursive: true });
  const propsPath = resolve(outputDir, 'v3-input-props.json');
  const outputPath = resolve(outputDir, 'final.mp4');
  const rawVideoPath = resolve(outputDir, 'raw-video.mp4');

  await writeFile(propsPath, JSON.stringify({ storyboard: artifact.lessonPlan.storyboard, subtitlesEnabled: artifact.request.subtitlesEnabled }), 'utf8');

  if (artifact.request.subtitlesEnabled) {
    let startFrame = 0;
    const srt = artifact.lessonPlan.storyboard.scenes.map((scene, index) => {
      const endFrame = Math.round(artifact.lessonPlan.storyboard!.scenes.slice(0, index + 1).reduce((sum, item) => sum + item.durationSeconds, 0) * artifact.request.fps);
      const cue = `${index + 1}\n${srtTimestamp(startFrame / artifact.request.fps)} --> ${srtTimestamp(endFrame / artifact.request.fps)}\n${scene.narration.subtitleVietnamese}\n`;
      startFrame = endFrame;
      return cue;
    }).join('\n');
    await writeFile(resolve(outputDir, 'subtitles.srt'), srt, 'utf8');
  }

  // Audio handling
  let audioTrackPath: string | undefined;
  if (artifact.request.narrationMode === 'provided_audio') {
    if (!options.providedAudioPath) {
      throw new Error('v3_audio_missing: providedAudioPath is required when narrationMode is provided_audio');
    }
    // Checkpoint E: Path traversal check
    if (options.providedAudioPath.includes('..')) {
      throw new Error('v3_audio_path_traversal: providedAudioPath contains illegal path traversal');
    }
    const resolvedPath = resolve(options.providedAudioPath);
    const audioMeta = await probeAudio(resolvedPath, 600);
    if (audioMeta.durationSeconds <= 0) {
      throw new Error('v3_audio_invalid: provided audio has zero or negative duration');
    }
    const signal = await probeAudioSignal(resolvedPath).catch(() => ({ isSilent: false }));
    if (signal.isSilent) {
      throw new Error('v3_audio_silent: provided audio is completely silent');
    }
    audioTrackPath = resolvedPath;
  } else if (artifact.request.narrationMode === 'gemini_tts' || artifact.request.narrationMode === 'google_cloud_tts') {
    options.onStage?.('synthesizing_audio');
    const isGemini = artifact.request.narrationMode === 'gemini_tts';
    const providerId = isGemini ? 'gemini_tts' : 'google_cloud_tts';

    // Checkpoint A: Enforce consent before live provider invocation
    if (!options.ttsProvider) {
      if (options.consentRecord) {
        const check = verifyExternalApiConsentV3({
          consent: options.consentRecord,
          ownerId: artifact.ownerId,
          expectedProvider: providerId,
          expectedOperation: 'narration',
          expectedArtifactId: artifact.artifactId,
          expectedContentHash: artifact.contentHash
        });
        if (!check.valid) {
          throw new Error(`external_api_consent_rejected: ${check.reason || 'TTS requires valid matching consent'}`);
        }
      } else if (options.confirmExternalApi !== true) {
        throw new Error(`external_api_consent_required: Narration mode '${artifact.request.narrationMode}' requires explicit user consent`);
      }
    }

    const provider: TtsProvider = options.ttsProvider ?? (
      isGemini ? new GeminiTtsProvider() : new GoogleCloudTtsProvider()
    );
    const audioPath = resolve(outputDir, 'narration.mp3');
    const fullText = artifact.lessonPlan.storyboard.scenes
      .map((s) => s.narration.vietnamese)
      .filter(Boolean)
      .join(' ');
    await provider.synthesize(fullText, audioPath);

    // Verify synthesized audio is valid and audible
    const ttsSignal = await probeAudioSignal(audioPath).catch(() => ({ isSilent: false }));
    if (ttsSignal.isSilent) {
      throw new Error('tts_audio_silent: Synthesized TTS audio returned silent audio payload');
    }
    audioTrackPath = audioPath;
  }

  options.onStage?.('rendering_remotion');
  if (!(await options.authorizeArtifact(artifact))) throw new Error('artifact_revoked: V3 approval changed before rendering');

  const workerDir = resolve(repositoryRoot, 'apps/worker');
  const command = process.execPath;
  const remotionTarget = audioTrackPath ? rawVideoPath : outputPath;
  const args = [
    resolve(workerDir, 'node_modules/@remotion/cli/remotion-cli.js'), 'render',
    'src/index.ts', 'LuminaSceneV3', remotionTarget,
    '--props', propsPath,
    '--codec', 'h264'
  ];
  const chrome = process.env.REMOTION_BROWSER_EXECUTABLE;
  if (chrome) args.push('--browser-executable', chrome);
  await execute(command, args, workerDir);

  // CHECKPOINT D: Hardened duration reconciliation & FFmpeg multiplexing without -shortest
  if (audioTrackPath) {
    options.onStage?.('merging_media');
    const videoDuration = await probeVideoDuration(remotionTarget);
    const audioMeta = await probeAudio(audioTrackPath, 600);

    // If audio is significantly longer than video, do NOT silently truncate speech!
    if (audioMeta.durationSeconds > videoDuration + 0.5) {
      throw new Error(`audio_duration_overflow: Narration speech duration (${audioMeta.durationSeconds.toFixed(2)}s) exceeds approved video timeline (${videoDuration.toFixed(2)}s). Increase scene duration or shorten narration text.`);
    }

    // Pad audio with silence up to videoDuration so speech is never truncated and video is never shortened
    const ffmpegArgs = [
      '-y',
      '-i', remotionTarget,
      '-i', audioTrackPath,
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '160k',
      '-ar', '48000',
      '-af', `apad=whole_dur=${videoDuration.toFixed(3)}`,
      '-t', videoDuration.toFixed(3),
      outputPath
    ];
    await execute('ffmpeg', ffmpegArgs);

    // Validate merged media with FFprobe
    const finalAudioMeta = await probeAudio(outputPath, 600);
    if (finalAudioMeta.codec !== 'aac') {
      throw new Error(`muxing_verification_failed: Expected AAC audio in output container, got ${finalAudioMeta.codec}`);
    }
  }

  return { outputPath };
}

