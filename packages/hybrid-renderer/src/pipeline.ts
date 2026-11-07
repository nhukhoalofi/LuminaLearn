import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { access, copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';
import { LiveGeminiAdapter, MathLessonPlanner, MockGeminiAdapter, NarrationAgent, VisualStoryboardDirector } from '@luminalearn/agent';
import type { HybridVideoManifest } from '@luminalearn/scene-schema';
import { buildHybridManifest } from './manifest';
import { probeAndVerifyVideoAsset, probeFinalVideo, type VerifiedVideoMetadata } from './ffprobe';
import { assertValidJobId, resolveInside } from './paths';
import { HybridRenderRequestSchema, type HybridRenderRequest } from './request';
import { GoogleCloudTtsProvider, prepareProvidedAudio, synthesizeNarration } from './audio';
import { buildSubtitleTrack, exportSrt } from './subtitles';

export type HybridPipelineStage = 'planning' | 'validating' | 'rendering_manim' | 'narrating' | 'synthesizing_audio' | 'rendering_remotion' | 'completed';
export interface HybridPipelineResult { jobId: string; jobDirectory: string; outputPath: string; manifest: HybridVideoManifest; metadata: VerifiedVideoMetadata; }

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
loadEnvironment({ path: resolve(repositoryRoot, '.env') });

function run(command: string, args: string[], options: { cwd?: string; timeoutMs: number }): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    execFile(command, args, { cwd: options.cwd, windowsHide: true, timeout: options.timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(`${basename(command)} failed: ${stderr || stdout || error.message}`, { cause: error }));
      resolvePromise({ stdout, stderr });
    });
  });
}

export function createHybridJobId(): string {
  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return `job-${timestamp}-${randomBytes(4).toString('hex')}`;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2), 'utf8');
}

function claimExpressions(draft: { mathematicalClaims: Array<{ validatorKey: string; expectedExpression: string }> }): Record<string, string> {
  const keys: Record<string, string> = {
    polynomial_derivative: 'derivative', secant_slope: 'secantSlope', limit_at_zero: 'limitAtZero', value_at_point: 'slopeAtPoint'
  };
  return Object.fromEntries(draft.mathematicalClaims.map((claim) => [keys[claim.validatorKey], claim.expectedExpression]));
}

export async function runHybridPipeline(input: HybridRenderRequest, options: {
  jobId?: string;
  onStage?: (stage: HybridPipelineStage) => void | Promise<void>;
} = {}): Promise<HybridPipelineResult> {
  const request = HybridRenderRequestSchema.parse(input);
  if (request.renderMode === 'live' && !process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required for live mode');
  if (request.voiceoverMode === 'google_cloud_tts' && !isGoogleTtsConfigured()) throw new Error('tts_unavailable: Google Cloud authentication is not configured');
  const jobId = options.jobId ?? createHybridJobId();
  assertValidJobId(jobId);
  const outputsRoot = resolve(repositoryRoot, 'outputs');
  const jobDirectory = resolveInside(outputsRoot, jobId);
  const workerPublic = resolve(repositoryRoot, 'apps/worker/public');
  const stagedDirectory = resolveInside(workerPublic, 'generated', jobId);
  await mkdir(outputsRoot, { recursive: true });
  await mkdir(jobDirectory, { recursive: false });
  const logs: string[] = [];
  const stage = async (value: HybridPipelineStage) => { logs.push(`${new Date().toISOString()} ${value}`); await options.onStage?.(value); };

  try {
    await writeJson(resolve(jobDirectory, 'request.json'), request);
    const python = resolve(repositoryRoot, 'services/math-engine/.venv/Scripts/python.exe');
    const remotionCli = resolve(repositoryRoot, 'apps/worker/node_modules/@remotion/cli/remotion-cli.js');
    const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    await Promise.all([access(python), access(remotionCli), access(chrome)]);
    await run('ffprobe', ['-version'], { timeoutMs: 10_000 });
    await run(python, ['-m', 'manim', '--version'], { timeoutMs: 20_000 });

    await stage('planning');
    const adapter = request.renderMode === 'live' ? new LiveGeminiAdapter() : new MockGeminiAdapter();
    const planning = await new MathLessonPlanner(adapter).plan({ topic: request.topic, targetAudience: 'Học sinh lớp 11', language: 'vi', durationSeconds: 40 });
    if (planning.status !== 'ready') throw new Error(`${planning.status}: ${planning.reason}`);
    await writeJson(resolve(jobDirectory, 'lesson-draft.json'), planning.draft);
    const mathScene = await new VisualStoryboardDirector(adapter).direct(planning.draft);
    await writeJson(resolve(jobDirectory, 'math-scene.json'), mathScene);
    const claimsPath = resolve(jobDirectory, 'math-claims.json');
    await writeJson(claimsPath, claimExpressions(planning.draft));

    await stage('validating');
    await stage('rendering_manim');
    const pythonResult = await run(python, [
      '-m', 'luminalearn_math_engine.cli', 'pipeline', resolve(jobDirectory, 'math-scene.json'),
      '--claims', claimsPath, '--output-dir', jobDirectory, '--timeout', '300'
    ], { cwd: repositoryRoot, timeoutMs: 330_000 });
    const rendered = JSON.parse(pythonResult.stdout) as { status: string; verification: unknown; output: string };
    if (rendered.status !== 'rendered') throw new Error('Python pipeline did not render a verified clip');
    const verificationPath = resolve(jobDirectory, 'verification-report.json');
    await writeJson(verificationPath, rendered.verification);
    const clipPath = resolve(jobDirectory, 'manim-clip.mp4');
    if (resolve(rendered.output) !== clipPath) await copyFile(rendered.output, clipPath);
    const asset = await probeAndVerifyVideoAsset({ assetPath: clipPath, jobDirectory, verificationReportPath: verificationPath });

    await mkdir(resolve(workerPublic, 'generated'), { recursive: true });
    await mkdir(stagedDirectory, { recursive: false });
    await copyFile(clipPath, resolve(stagedDirectory, 'math-clip.mp4'));
    const baseManifest = buildHybridManifest({ jobId, renderMode: request.renderMode, draft: planning.draft, asset });
    await stage('narrating');
    const narration = new NarrationAgent().create({
      draft: planning.draft,
      verificationReport: rendered.verification as Parameters<NarrationAgent['create']>[0]['verificationReport'],
      timelineScenes: baseManifest.timelineScenes,
      audience: planning.draft.targetAudience,
      language: 'vi'
    });
    await writeJson(resolve(jobDirectory, 'narration-script.json'), narration);
    let narrationAudioAssets: HybridVideoManifest['narrationAudioAssets'] = [];
    if (request.voiceoverMode !== 'none') {
      await stage('synthesizing_audio');
      narrationAudioAssets = request.voiceoverMode === 'provided_audio'
        ? await prepareProvidedAudio({ sourcePath: request.providedAudioPath!, jobId, jobDirectory, stagedDirectory })
        : await synthesizeNarration({
            provider: new GoogleCloudTtsProvider(), narration, scenes: baseManifest.timelineScenes,
            jobId, jobDirectory, stagedDirectory
          });
    }
    const subtitles = buildSubtitleTrack({
      narration, scenes: baseManifest.timelineScenes, burnedIn: request.subtitlesEnabled,
      audioAssets: narrationAudioAssets
    });
    await writeJson(resolve(jobDirectory, 'subtitles.json'), subtitles);
    await writeFile(resolve(jobDirectory, 'subtitles.srt'), exportSrt(subtitles), 'utf8');
    const manifest = buildHybridManifest({
      jobId, renderMode: request.renderMode, draft: planning.draft, asset,
      voiceoverMode: request.voiceoverMode, narrationScript: narration,
      narrationAudioAssets, subtitles
    });
    await writeJson(resolve(jobDirectory, 'video-manifest.json'), manifest);
    const propsPath = resolve(jobDirectory, 'remotion-props.json');
    await writeJson(propsPath, { manifest });

    await stage('rendering_remotion');
    const rawOutputPath = resolve(jobDirectory, 'remotion-raw.mp4');
    const outputPath = resolve(jobDirectory, 'final.mp4');
    const renderResult = await run(process.execPath, [
      remotionCli, 'render', resolve(repositoryRoot, 'apps/worker/src/index.ts'), 'LuminaMathHybrid', rawOutputPath,
      `--props=${propsPath}`, '--codec=h264', '--pixel-format=yuv420p', '--concurrency=2',
      `--browser-executable=${chrome}`, `--public-dir=${workerPublic}`
    ], { cwd: resolve(repositoryRoot, 'apps/worker'), timeoutMs: 900_000 });
    logs.push(renderResult.stdout, renderResult.stderr);
    const normalizeResult = await run('ffmpeg', [
      '-y', '-i', rawOutputPath, '-map', '0:v:0', '-map', '0:a?',
      '-vf', 'scale=in_range=full:out_range=tv', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-r', '24', '-frames:v', '960', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
      '-movflags', '+faststart', outputPath
    ], { timeoutMs: 180_000 });
    logs.push(normalizeResult.stdout, normalizeResult.stderr);
    const metadata = await probeFinalVideo(outputPath, 30_000, request.voiceoverMode !== 'none');
    await writeJson(resolve(jobDirectory, 'final.mp4.metadata.json'), metadata);
    await stage('completed');
    await writeFile(resolve(jobDirectory, 'render-log.txt'), logs.filter(Boolean).join('\n'), 'utf8');
    return { jobId, jobDirectory, outputPath, manifest, metadata };
  } catch (error) {
    logs.push(`${new Date().toISOString()} failed ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    await writeFile(resolve(jobDirectory, 'render-log.txt'), logs.join('\n'), 'utf8').catch(() => undefined);
    await rm(stagedDirectory, { recursive: true, force: true }).catch(() => undefined);
    await rm(resolve(jobDirectory, 'remotion-raw.mp4'), { force: true }).catch(() => undefined);
    await rm(resolve(jobDirectory, 'final.mp4'), { force: true }).catch(() => undefined);
    throw error;
  }
}

export function isGoogleTtsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_TTS_ENABLED === 'true');
}

