import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ApprovedRenderArtifactV3Schema,
  type ApprovedRenderArtifactV3
} from '@luminalearn/scene-schema';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

export function verifyV3ArtifactIntegrity(artifact: ApprovedRenderArtifactV3): boolean {
  const parsed = ApprovedRenderArtifactV3Schema.safeParse(artifact);
  if (!parsed.success) return false;
  const { contentHash, ...core } = parsed.data;
  return createHash('sha256').update(canonical(core), 'utf8').digest('hex') === contentHash;
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

export async function runRenderPipelineV3(
  artifactInput: unknown,
  options: {
    jobId: string;
    authorizeArtifact: (artifact: ApprovedRenderArtifactV3) => boolean | Promise<boolean>;
    onStage?: (stage: 'rendering_remotion') => void;
  }
): Promise<{ outputPath: string }> {
  const artifact = ApprovedRenderArtifactV3Schema.parse(artifactInput);
  if (!verifyV3ArtifactIntegrity(artifact)) throw new Error('artifact_tampered: V3 content hash mismatch');
  if (!(await options.authorizeArtifact(artifact))) throw new Error('artifact_revoked: V3 artifact is no longer authorized');
  if (!artifact.lessonPlan.storyboard) throw new Error('v3_storyboard_missing');
  if (artifact.request.narrationMode !== 'none') throw new Error('v3_audio_not_implemented: Phase 3 offline render supports narrationMode=none');

  const outputDir = resolve(repositoryRoot, 'outputs', options.jobId);
  await mkdir(outputDir, { recursive: true });
  const propsPath = resolve(outputDir, 'v3-input-props.json');
  const outputPath = resolve(outputDir, 'final.mp4');
  await writeFile(propsPath, JSON.stringify({ storyboard: artifact.lessonPlan.storyboard }), 'utf8');
  if (artifact.request.subtitlesEnabled) {
    let start = 0;
    const srt = artifact.lessonPlan.storyboard.scenes.map((scene, index) => {
      const end = start + scene.durationSeconds;
      const cue = `${index + 1}\n${srtTimestamp(start)} --> ${srtTimestamp(end)}\n${scene.narration.subtitleVietnamese}\n`;
      start = end;
      return cue;
    }).join('\n');
    await writeFile(resolve(outputDir, 'subtitles.srt'), srt, 'utf8');
  }
  options.onStage?.('rendering_remotion');
  if (!(await options.authorizeArtifact(artifact))) throw new Error('artifact_revoked: V3 approval changed before rendering');

  const workerDir = resolve(repositoryRoot, 'apps/worker');
  const command = process.execPath;
  const args = [
    resolve(workerDir, 'node_modules/@remotion/cli/remotion-cli.js'), 'render',
    'src/index.ts', 'LuminaSceneV3', outputPath,
    '--props', propsPath,
    '--codec', 'h264'
  ];
  const chrome = process.env.REMOTION_BROWSER_EXECUTABLE;
  if (chrome) args.push('--browser-executable', chrome);
  await execute(command, args, workerDir);
  return { outputPath };
}

