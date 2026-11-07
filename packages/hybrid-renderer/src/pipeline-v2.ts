import { execFile } from 'node:child_process';
import { access, copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';
import {
  LessonOrchestrator,
  DocumentStore
} from '@luminalearn/agent';
import {
  compileStoryboardV2,
  LessonRequestV2Schema,
  RenderManifestV2Schema,
  type LessonRequestV2,
  type RenderManifestV2,
  type SubtitleCueV2
} from '@luminalearn/scene-schema';
import { loadEnvironmentConfig } from './config';
import { probeAndVerifyVideoAsset, probeFinalVideo, type VerifiedVideoMetadata } from './ffprobe';
import { assertValidJobId, resolveInside } from './paths';
import { createHybridJobId, isGoogleTtsConfigured, type HybridPipelineStage } from './pipeline';

export interface HybridPipelineV2Options {
  jobId?: string;
  onStage?: (stage: HybridPipelineStage) => void | Promise<void>;
  documentStore?: DocumentStore;
}

export interface HybridPipelineV2Result {
  jobId: string;
  jobDirectory: string;
  outputPath: string;
  manifest: RenderManifestV2;
  metadata: VerifiedVideoMetadata;
}

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

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2), 'utf8');
}

function formatSrtTimestamp(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function exportSrtFromV2Cues(cues: SubtitleCueV2[], fps: number): string {
  return cues
    .map((cue, index) => {
      const start = formatSrtTimestamp(cue.startFrame / fps);
      const end = formatSrtTimestamp(cue.endFrame / fps);
      return `${index + 1}\n${start} --> ${end}\n${cue.text}\n`;
    })
    .join('\n');
}

export async function runHybridPipelineV2(
  input: LessonRequestV2 | Record<string, unknown>,
  options: HybridPipelineV2Options = {}
): Promise<HybridPipelineV2Result> {
  const request = LessonRequestV2Schema.parse(input);
  if (request.renderMode === 'live' && !process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required for live mode');
  }
  if (request.narrationMode === 'google_cloud_tts' && !isGoogleTtsConfigured()) {
    throw new Error('tts_unavailable: Google Cloud authentication is not configured');
  }

  const jobId = options.jobId ?? createHybridJobId();
  assertValidJobId(jobId);

  const outputsRoot = resolve(repositoryRoot, 'outputs');
  const jobDirectory = resolveInside(outputsRoot, jobId);
  const workerPublic = resolve(repositoryRoot, 'apps/worker/public');
  const stagedDirectory = resolveInside(workerPublic, 'generated', jobId);

  await mkdir(outputsRoot, { recursive: true });
  await mkdir(jobDirectory, { recursive: false });

  const logs: string[] = [];
  const stage = async (value: HybridPipelineStage) => {
    logs.push(`${new Date().toISOString()} ${value}`);
    await options.onStage?.(value);
  };

  try {
    await writeJson(resolve(jobDirectory, 'request.json'), request);

    const envConfig = loadEnvironmentConfig(repositoryRoot);
    const python = envConfig.pythonExecutable;
    const remotionCli = envConfig.remotionCliExecutable;
    const chrome = envConfig.chromeExecutable || (
      process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : '/usr/bin/google-chrome'
    );

    await Promise.all([access(python), access(remotionCli), access(chrome)]);
    await run('ffprobe', ['-version'], { timeoutMs: 10_000 });
    await run(python, ['-m', 'manim', '--version'], { timeoutMs: 20_000 });

    // Stage 1: Planning
    await stage('planning');
    const orchestrator = new LessonOrchestrator({
      documentStore: options.documentStore
    });
    const context = await orchestrator.orchestrate(request);

    if (context.stage === 'failed' || context.stage === 'needs_review' || !context.manifest) {
      const errCode = context.error?.code || 'orchestration_failed';
      const errMsg = context.error?.message || 'Lesson orchestration could not produce a valid render manifest';
      throw new Error(`${errCode}: ${errMsg}`);
    }

    await writeJson(resolve(jobDirectory, 'lesson-plan.json'), context.lessonPlan);
    await writeJson(resolve(jobDirectory, 'storyboard.json'), context.storyboard);
    await writeJson(resolve(jobDirectory, 'narration-plan.json'), context.narrationPlan);
    await writeJson(resolve(jobDirectory, 'orchestration-context.json'), {
      topicInfo: context.topicInfo,
      stage: context.stage,
      logs: context.logs
    });

    // Prepare Math Scene based on topic
    const topicId = context.topicInfo?.topicId ?? 'calculus.derivative.intuition';
    let mathScene: Record<string, unknown>;
    let mathClaims: Record<string, string>;

    if (topicId === 'calculus.integral.riemann_sum') {
      mathScene = {
        schemaVersion: 'math-v1',
        topicId: 'calculus.integral.riemann_sum',
        visualization: 'riemann_sum',
        function: {
          type: 'polynomial',
          coefficients: [0, 0, 1]
        },
        interval: [0, 1],
        partitions: [4, 8, 16],
        durationSeconds: 10.83,
        fps: 24,
        width: 720,
        height: 1280
      };
      mathClaims = {
        riemann_sum_limit: '1/3',
        definite_integral: '1/3'
      };
    } else {
      mathScene = {
        schemaVersion: 'math-v1',
        topicId: 'calculus.derivative.intuition',
        visualization: 'secant_to_tangent',
        function: {
          type: 'polynomial',
          coefficients: [0, 0, 1]
        },
        pointX: 1.0,
        hStart: 2.0,
        hEnd: 0.05,
        durationSeconds: 10.83,
        fps: 24,
        width: 720,
        height: 1280
      };
      mathClaims = {
        polynomial_derivative: '2*x',
        secant_slope: '2 + h',
        limit_at_zero: '2',
        value_at_point: '2'
      };
    }

    const mathScenePath = resolve(jobDirectory, 'math-scene.json');
    const mathClaimsPath = resolve(jobDirectory, 'math-claims.json');
    await writeJson(mathScenePath, mathScene);
    await writeJson(mathClaimsPath, mathClaims);

    // Stage 2: Validation & Manim Rendering
    await stage('validating');
    await stage('rendering_manim');

    const pythonResult = await run(python, [
      '-m', 'luminalearn_math_engine.cli', 'pipeline', mathScenePath,
      '--claims', mathClaimsPath, '--output-dir', jobDirectory, '--timeout', '300'
    ], { cwd: repositoryRoot, timeoutMs: 330_000 });

    const rendered = JSON.parse(pythonResult.stdout) as { status: string; verification: unknown; output: string };
    if (rendered.status !== 'rendered') {
      throw new Error(`Python pipeline did not render a verified clip: ${pythonResult.stdout}`);
    }

    const verificationPath = resolve(jobDirectory, 'verification-report.json');
    await writeJson(verificationPath, rendered.verification);

    const clipPath = resolve(jobDirectory, 'manim-clip.mp4');
    if (resolve(rendered.output) !== clipPath) {
      await copyFile(rendered.output, clipPath);
    }

    const asset = await probeAndVerifyVideoAsset({
      assetPath: clipPath,
      jobDirectory,
      verificationReportPath: verificationPath
    });

    // Stage Math Clip into worker public
    await mkdir(resolve(workerPublic, 'generated'), { recursive: true });
    await mkdir(stagedDirectory, { recursive: false });
    const stagedClipName = 'math-clip.mp4';
    await copyFile(clipPath, resolve(stagedDirectory, stagedClipName));

    // Stage 3: Narration & Audio
    await stage('narrating');
    if (request.narrationMode !== 'none') {
      await stage('synthesizing_audio');
      // Audio handling can be configured if narrationMode is provided
    }

    // Compile final RenderManifestV2 with the verified video asset
    const publicAssetPath = `generated/${jobId}/${stagedClipName}`;
    const compiledManifest = compileStoryboardV2(context.storyboard!, context.narrationPlan!, {
      jobId,
      lessonTitle: context.lessonPlan!.title,
      topicId: context.lessonPlan!.topicId,
      fps: 24,
      aspectRatio: request.aspectRatio,
      verifiedClaims: context.lessonPlan!.mathematicalClaims,
      assets: [
        {
          id: 'asset_manim',
          publicPath: publicAssetPath,
          durationSeconds: asset.durationSeconds,
          frameCount: asset.frameCount,
          fps: asset.fps,
          width: asset.width,
          height: asset.height,
          codec: 'h264',
          pixelFormat: 'yuv420p'
        }
      ]
    });

    // Subtitle export
    if (compiledManifest.subtitleTrack?.cues?.length) {
      const srtContent = exportSrtFromV2Cues(compiledManifest.subtitleTrack.cues, 24);
      await writeFile(resolve(jobDirectory, 'subtitles.srt'), srtContent, 'utf8');
      await writeJson(resolve(jobDirectory, 'subtitles.json'), compiledManifest.subtitleTrack);
    }

    const manifest = RenderManifestV2Schema.parse(compiledManifest);
    await writeJson(resolve(jobDirectory, 'video-manifest.json'), manifest);

    const propsPath = resolve(jobDirectory, 'remotion-props.json');
    await writeJson(propsPath, { manifest });

    // Stage 4: Remotion Render
    await stage('rendering_remotion');
    const rawOutputPath = resolve(jobDirectory, 'remotion-raw.mp4');
    const outputPath = resolve(jobDirectory, 'final.mp4');

    const renderResult = await run(process.execPath, [
      remotionCli, 'render', resolve(repositoryRoot, 'apps/worker/src/index.ts'), 'LuminaDynamicV2', rawOutputPath,
      `--props=${propsPath}`, '--codec=h264', '--pixel-format=yuv420p', '--concurrency=2',
      `--browser-executable=${chrome}`, `--public-dir=${workerPublic}`
    ], { cwd: resolve(repositoryRoot, 'apps/worker'), timeoutMs: 900_000 });
    logs.push(renderResult.stdout, renderResult.stderr);

    const hasAudio = manifest.audioAssets.length > 0;
    const normalizeArgs = [
      '-y', '-i', rawOutputPath,
      '-map', '0:v:0',
      ...(hasAudio ? ['-map', '0:a?'] : []),
      '-vf', 'scale=in_range=full:out_range=tv',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-r', '24',
      '-frames:v', String(manifest.totalFrames),
      ...(hasAudio ? ['-c:a', 'aac', '-b:a', '160k', '-ar', '48000'] : []),
      '-movflags', '+faststart',
      outputPath
    ];

    const normalizeResult = await run('ffmpeg', normalizeArgs, { timeoutMs: 180_000 });
    logs.push(normalizeResult.stdout, normalizeResult.stderr);

    const metadata = await probeFinalVideo(outputPath, 30_000, hasAudio);
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

