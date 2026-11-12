import { execFile } from 'node:child_process';
import { access, copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';
import {
  LessonOrchestrator,
  DocumentStore,
  verifyArtifactIntegrity,
  TopicRouter
} from '@luminalearn/agent';
import {
  ApprovedRenderArtifactV2Schema,
  compileStoryboardV2,
  GeminiRequestBudget,
  LessonRequestV2Schema,
  RenderManifestV2Schema,
  type ApprovedRenderArtifactV2,
  type LessonPlanV2,
  type LessonRequestV2,
  type MathVisualizationSpecV2,
  type NarrationPlanV2,
  type RenderManifestV2,
  type SourceReference,
  type StoryboardV2,
  type SubtitleCueV2,
  type VerifiedClaim,
  type VisualStyleId
} from '@luminalearn/scene-schema';
import { loadEnvironmentConfig } from './config';
import { probeAndVerifyVideoAsset, probeFinalVideo, type VerifiedVideoMetadata } from './ffprobe';
import { assertValidJobId, resolveInside } from './paths';
import { createHybridJobId, isGoogleTtsConfigured, type HybridPipelineStage } from './pipeline';
import {
  GoogleCloudTtsProvider,
  prepareProvidedAudio,
  synthesizeNarrationV2,
  type TtsProvider
} from './audio';
import { GeminiTtsProvider, isGeminiTtsConfigured } from './gemini-tts';
import { createVisualQaReport } from './visual-qa';

export interface HybridPipelineV2Options {
  jobId?: string;
  onStage?: (stage: HybridPipelineStage) => void | Promise<void>;
  documentStore?: DocumentStore;
  ttsProvider?: TtsProvider;
  authorizeArtifact?: (artifact: ApprovedRenderArtifactV2) => boolean | Promise<boolean>;
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
  input: LessonRequestV2 | ApprovedRenderArtifactV2 | Record<string, unknown>,
  options: HybridPipelineV2Options = {}
): Promise<HybridPipelineV2Result> {
  // Check if input is an ApprovedRenderArtifactV2 or a LessonRequestV2
  const isArtifact =
    typeof input === 'object' &&
    input !== null &&
    ('artifactId' in input || ('schemaVersion' in input && (input as { schemaVersion: string }).schemaVersion === 'artifact-v2'));

  let artifact: ApprovedRenderArtifactV2 | undefined;
  let request: LessonRequestV2 | undefined;
  let lessonPlan!: LessonPlanV2;
  let storyboard!: StoryboardV2;
  let narrationPlan!: NarrationPlanV2;
  let verifiedClaims!: VerifiedClaim[];
  let mathSpec!: MathVisualizationSpecV2;
  let topicId!: string;
  let renderMode: 'mock' | 'live';
  let narrationMode: 'none' | 'provided_audio' | 'google_cloud_tts' | 'gemini_tts';
  let aspectRatio: '9:16' | '16:9' | '1:1';
  let visualStyleId: VisualStyleId = 'clean_educational_infographic';
  let subtitlesEnabled = true;
  let providedAudioPath: string | undefined;
  let sourceReferences: SourceReference[] = [];
  const jobBudget = new GeminiRequestBudget();

  const assertArtifactAuthorized = async (): Promise<void> => {
    if (artifact && options.authorizeArtifact && !(await options.authorizeArtifact(artifact))) {
      throw new Error('artifact_revoked: Approved artifact is no longer authorized for rendering');
    }
  };

  if (isArtifact) {
    artifact = ApprovedRenderArtifactV2Schema.parse(input);
    if (!verifyArtifactIntegrity(artifact)) {
      throw new Error('artifact_tampered: Approved render artifact content hash mismatch');
    }
    await assertArtifactAuthorized();
    lessonPlan = structuredClone(artifact.lessonPlan);
    storyboard = structuredClone(artifact.storyboard);
    narrationPlan = structuredClone(artifact.narrationPlan);
    verifiedClaims = structuredClone(artifact.verifiedClaims);
    mathSpec = structuredClone(artifact.mathSpec);
    sourceReferences = structuredClone(artifact.sourceReferences);
    topicId = artifact.lessonPlan.topicId;
    if (topicId === 'algebra.identities.seven' || topicId.startsWith('algebra.')) {
      throw new Error(`v2_unsupported_algebra_topic: Topic '${topicId}' is not supported by the V2 Manim/Remotion pipeline. Use LuminaLearn V3 Multi-Topic Studio (pipeline-v3) instead.`);
    }
    renderMode = artifact.renderConfig.renderMode;
    narrationMode = artifact.renderConfig.narrationMode;
    aspectRatio = artifact.renderConfig.aspectRatio;
    visualStyleId = artifact.renderConfig.visualStyleId ?? 'clean_educational_infographic';
    subtitlesEnabled = artifact.renderConfig.subtitlesEnabled ?? true;
    providedAudioPath = artifact.renderConfig.providedAudioPath;
  } else {
    request = LessonRequestV2Schema.parse(input);
    const routeDecision = new TopicRouter().route(request);
    if (!routeDecision.isSupported && routeDecision.v3Only) {
      throw new Error(routeDecision.unsupportedReason ?? 'v2_unsupported_topic: Use LuminaLearn V3 Multi-Topic Studio');
    }
    renderMode = request.renderMode;
    narrationMode = request.narrationMode;
    aspectRatio = request.aspectRatio;
    visualStyleId = request.visualStyleId ?? 'clean_educational_infographic';
    subtitlesEnabled = request.subtitlesEnabled ?? true;
    providedAudioPath = request.providedAudioPath;
  }

  if (renderMode === 'live' && !process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required for live mode');
  }
  if (narrationMode === 'google_cloud_tts' && !isGoogleTtsConfigured()) {
    throw new Error('tts_unavailable: Google Cloud authentication is not configured');
  }
  if (narrationMode === 'gemini_tts' && !options.ttsProvider && !isGeminiTtsConfigured()) {
    throw new Error('tts_api_key_missing: GEMINI_API_KEY is required for Gemini TTS');
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
    if (isArtifact && artifact) {
      await writeJson(resolve(jobDirectory, 'approved-artifact.json'), artifact);
    } else if (request) {
      await writeJson(resolve(jobDirectory, 'request.json'), request);
    }

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

    if (isArtifact && artifact) {
      // DRAFT INTEGRITY: Directly use approved plan, storyboard and narration without re-orchestration!
      logs.push(`${new Date().toISOString()} Using approved render artifact '${artifact.artifactId}' v${artifact.version}`);
      await writeJson(resolve(jobDirectory, 'lesson-plan.json'), lessonPlan);
      await writeJson(resolve(jobDirectory, 'storyboard.json'), storyboard);
      await writeJson(resolve(jobDirectory, 'narration-plan.json'), narrationPlan);
      await writeJson(resolve(jobDirectory, 'orchestration-context.json'), {
        mode: 'approved_artifact',
        artifactId: artifact.artifactId,
        contentHash: artifact.contentHash,
        version: artifact.version
      });
    } else if (request) {
      const orchestrator = new LessonOrchestrator({
        documentStore: options.documentStore,
        requestBudget: jobBudget
      });
      const context = await orchestrator.orchestrate(request);

      if (context.stage === 'failed' || context.stage === 'needs_review' || !context.manifest) {
        const errCode = context.error?.code || 'orchestration_failed';
        const errMsg = context.error?.message || 'Lesson orchestration could not produce a valid render manifest';
        throw new Error(`${errCode}: ${errMsg}`);
      }

      lessonPlan = context.lessonPlan!;
      storyboard = context.storyboard!;
      narrationPlan = context.narrationPlan!;
      verifiedClaims = context.lessonPlan!.mathematicalClaims;
      topicId = context.topicInfo?.topicId ?? 'calculus.derivative.intuition';
      if (topicId === 'algebra.identities.seven' || topicId.startsWith('algebra.')) {
        throw new Error(`v2_unsupported_algebra_topic: Topic '${topicId}' is not supported by the V2 Manim/Remotion pipeline. Use LuminaLearn V3 Multi-Topic Studio (pipeline-v3) instead.`);
      }
      mathSpec = context.lessonPlan!.mathSpec ?? {
        topicId,
        visualization: topicId === 'calculus.integral.riemann_sum' ? 'riemann_sum' : 'secant_to_tangent',
        function: { type: 'polynomial', coefficients: [0, 0, 1] },
        parameters: topicId === 'calculus.integral.riemann_sum'
          ? { interval: [0, 1], partitions: [4, 8, 16] }
          : { pointX: 1.0, hStart: 2.0, hEnd: 0.05 },
        boundClaimIds: verifiedClaims.map((c) => c.id)
      };

      await writeJson(resolve(jobDirectory, 'lesson-plan.json'), context.lessonPlan);
      await writeJson(resolve(jobDirectory, 'storyboard.json'), context.storyboard);
      await writeJson(resolve(jobDirectory, 'narration-plan.json'), context.narrationPlan);
      if (context.teachingTreatment) {
        await writeJson(resolve(jobDirectory, 'teaching-treatment.json'), context.teachingTreatment);
      }
      await writeJson(resolve(jobDirectory, 'orchestration-context.json'), {
        topicInfo: context.topicInfo,
        stage: context.stage,
        logs: context.logs
      });
    } else {
      throw new Error('invalid_pipeline_input: neither artifact nor request provided');
    }

    // Stage 2: Validation & Manim Rendering
    // Prepare Math Scene dynamically from MathVisualizationSpecV2
    if (mathSpec.function.type !== 'polynomial') {
      throw new Error(`unsupported_function: Only polynomial functions are supported, received '${mathSpec.function.type}'`);
    }

    let mathScene: Record<string, unknown>;
    const mathClaims: Record<string, string> = {};

    for (const claim of verifiedClaims) {
      mathClaims[claim.validatorKey] = claim.expectedExpression;
    }

    if (topicId === 'calculus.integral.riemann_sum') {
      if (mathSpec.visualization !== 'riemann_sum') {
        throw new Error(`math_spec_mismatch: Topic '${topicId}' requires 'riemann_sum' visualization, got '${mathSpec.visualization}'`);
      }
      mathScene = {
        schemaVersion: 'math-v1',
        topicId: 'calculus.integral.riemann_sum',
        visualization: 'riemann_sum',
        function: mathSpec.function,
        interval: mathSpec.parameters.interval ?? [0, 1],
        partitions: mathSpec.parameters.partitions ?? [4, 8, 16],
        durationSeconds: mathSpec.parameters.durationSeconds ?? 10.83,
        fps: 24,
        width: 720,
        height: 1280
      };
    } else if (topicId === 'calculus.derivative.intuition') {
      if (mathSpec.visualization !== 'secant_to_tangent' && mathSpec.visualization !== 'function_graph') {
        throw new Error(`math_spec_mismatch: Topic '${topicId}' requires 'secant_to_tangent' visualization, got '${mathSpec.visualization}'`);
      }
      mathScene = {
        schemaVersion: 'math-v1',
        topicId: 'calculus.derivative.intuition',
        visualization: 'secant_to_tangent',
        function: mathSpec.function,
        pointX: mathSpec.parameters.pointX ?? 1.0,
        hStart: mathSpec.parameters.hStart ?? 2.0,
        hEnd: mathSpec.parameters.hEnd ?? 0.05,
        durationSeconds: mathSpec.parameters.durationSeconds ?? 10.83,
        fps: 24,
        width: 720,
        height: 1280
      };
    } else {
      throw new Error(`unsupported_topic: LuminaLearn math engine does not support topic '${topicId}'`);
    }

    const mathScenePath = resolve(jobDirectory, 'math-scene.json');
    const mathClaimsPath = resolve(jobDirectory, 'math-claims.json');
    await writeJson(mathScenePath, mathScene);
    await writeJson(mathClaimsPath, mathClaims);

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

    // Finalize the visual timeline from measured media before audio positions are computed.
    const measuredTimeline = compileStoryboardV2(storyboard, narrationPlan, {
      jobId,
      lessonTitle: lessonPlan.title,
      topicId: lessonPlan.topicId,
      fps: 24,
      aspectRatio,
      visualStyleId,
      subtitlesEnabled,
      verifiedClaims,
      sourceReferences,
      assets: [{
        id: 'asset_manim',
        publicPath: `generated/${jobId}/math-clip.mp4`,
        durationSeconds: asset.durationSeconds,
        frameCount: asset.frameCount,
        fps: asset.fps,
        width: asset.width,
        height: asset.height,
        codec: 'h264',
        pixelFormat: 'yuv420p'
      }],
      assetAlignmentPolicy: 'adjust_timeline'
    });
    const measuredScenes = new Map(measuredTimeline.timeline.map((scene) => [scene.id, scene]));
    for (const scene of storyboard.scenes) {
      const measured = measuredScenes.get(scene.sceneId);
      if (measured) scene.durationFrames = measured.durationFrames;
    }
    storyboard.estimatedDurationFrames = storyboard.scenes.reduce((sum, scene) => sum + scene.durationFrames, 0);

    // Stage Math Clip into worker public
    await mkdir(resolve(workerPublic, 'generated'), { recursive: true });
    await mkdir(stagedDirectory, { recursive: false });
    const stagedClipName = 'math-clip.mp4';
    await copyFile(clipPath, resolve(stagedDirectory, stagedClipName));

    // Stage 3: Narration & Audio
    await stage('narrating');
    let audioAssets: Array<{ id: string; path: string; durationSeconds: number; codec: 'mp3'; startFrame?: number }> = [];
    let activeTtsProviderId: string | undefined;

    if (narrationMode === 'google_cloud_tts' || narrationMode === 'gemini_tts') {
      await stage('synthesizing_audio');
      const provider = options.ttsProvider ?? (
        narrationMode === 'gemini_tts' ? new GeminiTtsProvider({ requestBudget: jobBudget }) : new GoogleCloudTtsProvider()
      );
      activeTtsProviderId = provider.id;
      audioAssets = await synthesizeNarrationV2({
        provider,
        narrationPlan,
        storyboard,
        jobId,
        jobDirectory,
        stagedDirectory,
        fps: 24,
        alignmentPolicy: 'adjust_timeline',
        lockedSceneIds: new Set(
          measuredTimeline.timeline.filter((scene) => scene.assetId).map((scene) => scene.id)
        )
      });
    } else if (narrationMode === 'provided_audio' && providedAudioPath) {
      await stage('synthesizing_audio');
      activeTtsProviderId = 'provided_audio';
      const prepared = await prepareProvidedAudio({
        sourcePath: providedAudioPath,
        jobId,
        jobDirectory,
        stagedDirectory
      });
      audioAssets = prepared.map((a) => ({
        id: a.id,
        path: a.publicPath,
        durationSeconds: a.durationSeconds,
        codec: 'mp3',
        startFrame: a.startFrame
      }));
    }

    // Compile final RenderManifestV2 with verified video asset and audio assets
    const publicAssetPath = `generated/${jobId}/${stagedClipName}`;
    const compiledManifest = compileStoryboardV2(storyboard, narrationPlan, {
      jobId,
      lessonTitle: lessonPlan.title,
      topicId: lessonPlan.topicId,
      fps: 24,
      aspectRatio,
      visualStyleId,
      subtitlesEnabled,
      verifiedClaims: lessonPlan.mathematicalClaims,
      sourceReferences,
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
      ],
      audioAssets,
      assetAlignmentPolicy: 'strict'
    });

    // Subtitle export (only when subtitlesEnabled is true)
    if (subtitlesEnabled && compiledManifest.subtitleTrack?.cues?.length) {
      const srtContent = exportSrtFromV2Cues(compiledManifest.subtitleTrack.cues, 24);
      await writeFile(resolve(jobDirectory, 'subtitles.srt'), srtContent, 'utf8');
      await writeJson(resolve(jobDirectory, 'subtitles.json'), compiledManifest.subtitleTrack);
    }

    const manifest = RenderManifestV2Schema.parse(compiledManifest);
    await writeJson(resolve(jobDirectory, 'video-manifest.json'), manifest);

    const propsPath = resolve(jobDirectory, 'remotion-props.json');
    await writeJson(propsPath, { manifest });

    // Stage 4: Remotion Render
    await assertArtifactAuthorized();
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

    const metadata = await probeFinalVideo(outputPath, {
      timeoutMs: 30_000,
      requireAudio: hasAudio,
      expectedFrames: manifest.totalFrames,
      expectedDurationSeconds: manifest.totalFrames / manifest.fps
    });
    await writeJson(resolve(jobDirectory, 'final.mp4.metadata.json'), metadata);
    await createVisualQaReport({
      videoPath: outputPath,
      jobDirectory,
      manifest,
      metadata,
      ttsSelected: narrationMode === 'gemini_tts' || narrationMode === 'google_cloud_tts',
      ttsProviderId: activeTtsProviderId
    });

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
