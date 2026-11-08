import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ApprovedRenderArtifactV3Schema,
  type ApprovedRenderArtifactV3
} from '@luminalearn/scene-schema';
import { GoogleCloudTtsProvider, probeAudio, type TtsProvider } from './audio.js';
import { GeminiTtsProvider } from './gemini-tts.js';

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

export interface RenderPipelineV3Options {
  jobId: string;
  authorizeArtifact: (artifact: ApprovedRenderArtifactV3) => boolean | Promise<boolean>;
  providedAudioPath?: string;
  ttsProvider?: TtsProvider;
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
    const audioMeta = await probeAudio(options.providedAudioPath, 600);
    if (audioMeta.durationSeconds <= 0) {
      throw new Error('v3_audio_invalid: provided audio has zero or negative duration');
    }
    audioTrackPath = options.providedAudioPath;
  } else if (artifact.request.narrationMode === 'gemini_tts' || artifact.request.narrationMode === 'google_cloud_tts') {
    options.onStage?.('synthesizing_audio');
    const provider: TtsProvider = options.ttsProvider ?? (
      artifact.request.narrationMode === 'gemini_tts'
        ? new GeminiTtsProvider()
        : new GoogleCloudTtsProvider()
    );
    const audioPath = resolve(outputDir, 'narration.mp3');
    const fullText = artifact.lessonPlan.storyboard.scenes
      .map((s) => s.narration.vietnamese)
      .filter(Boolean)
      .join(' ');
    await provider.synthesize(fullText, audioPath);
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

  // If audio is enabled, merge audio stream into final MP4 using FFmpeg
  if (audioTrackPath) {
    options.onStage?.('merging_media');
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
      '-shortest',
      outputPath
    ];
    await execute('ffmpeg', ffmpegArgs);
  }

  return { outputPath };
}

