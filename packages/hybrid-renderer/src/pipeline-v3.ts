import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, writeFile, stat, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ApprovedRenderArtifactV3Schema,
  verifyExternalApiConsentV3,
  type ApprovedRenderArtifactV3,
  type ExternalApiConsentRecordV3,
  type EducationalStoryboardV3
} from '@luminalearn/scene-schema';
import { GoogleCloudTtsProvider, isTrustedOfflineTtsFixture, probeAudio, probeAudioSignal, type TtsProvider } from './audio';
import { GeminiTtsProvider } from './gemini-tts';
import { defaultSceneAudioSynchronizer } from './scene-audio-synchronizer';
import type { SynchronizedStoryboardAudio } from './scene-audio-synchronizer';
import { srtTimestamp } from './subtitles';

export interface SubtitleCueV3 {
  cueId?: string;
  sceneId: string;
  text: string;
  startFrame: number;
  endFrame: number;
}

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

export interface TrustedProofContextV3 {
  artifactIntegrityVerified: true;
  approvedDraftVersion: number;
  verifiedBindingFingerprints: readonly string[];
}

export function deriveTrustedProofContextV3(artifact: ApprovedRenderArtifactV3): TrustedProofContextV3 {
  return {
    artifactIntegrityVerified: true,
    approvedDraftVersion: artifact.approvedVersion,
    verifiedBindingFingerprints: artifact.lessonPlan.storyboard?.scenes.flatMap(
      (scene) => scene.visualDefinition?.trustedMathBindings.map(
        (binding) => binding.normalizedExpressionFingerprint
      ) ?? []
    ) ?? []
  };
}

export function resolvePresentationStoryboardV3(
  source: EducationalStoryboardV3,
  synchronization: Pick<SynchronizedStoryboardAudio, 'fps' | 'totalFrames' | 'sceneTimings'>
): EducationalStoryboardV3 {
  const timingsByScene = new Map(synchronization.sceneTimings.map((timing) => [timing.sceneId, timing]));
  if (timingsByScene.size !== source.scenes.length) throw new Error('resolved_timeline_scene_count_mismatch');
  return {
    ...structuredClone(source),
    scenes: source.scenes.map((scene) => {
      const timing = timingsByScene.get(scene.sceneId);
      if (!timing) throw new Error(`resolved_timeline_scene_missing: ${scene.sceneId}`);
      return { ...structuredClone(scene), durationSeconds: timing.durationFrames / synchronization.fps };
    }),
    totalDurationSeconds: synchronization.totalFrames / synchronization.fps
  };
}

export async function runRenderPipelineV3(
  artifactInput: unknown,
  options: RenderPipelineV3Options
): Promise<{ outputPath: string }> {
  const artifact = ApprovedRenderArtifactV3Schema.parse(artifactInput);
  if (!verifyV3ArtifactIntegrity(artifact)) throw new Error('artifact_tampered: V3 content hash mismatch');
  if (!(await options.authorizeArtifact(artifact))) throw new Error('artifact_revoked: V3 artifact is no longer authorized');
  if (!artifact.lessonPlan.storyboard) throw new Error('v3_storyboard_missing');
  const approvedStoryboard = artifact.lessonPlan.storyboard;

  const outputDir = resolve(repositoryRoot, 'outputs', options.jobId);
  await mkdir(outputDir, { recursive: true });
  const propsPath = resolve(outputDir, 'v3-input-props.json');
  const outputPath = resolve(outputDir, 'final.mp4');
  const rawVideoPath = resolve(outputDir, 'raw-video.mp4');

  const trustedProofContext = deriveTrustedProofContextV3(artifact);
  let resolvedStoryboard: EducationalStoryboardV3 = structuredClone(approvedStoryboard);
  let resolvedTimelineAudit: Record<string, unknown> | undefined;
  let subtitleCues: SubtitleCueV3[] = [];

  // Audio handling
  let audioTrackPath: string | undefined;
  if (artifact.request.narrationMode === 'provided_audio') {
    if (!options.providedAudioPath) {
      throw new Error('v3_audio_missing: providedAudioPath is required when narrationMode is provided_audio');
    }
    // Checkpoint E/F: Strict path traversal and asset security
    if (options.providedAudioPath.includes('..')) {
      throw new Error('v3_audio_path_traversal: providedAudioPath contains illegal path traversal');
    }
    const resolvedPath = resolve(options.providedAudioPath);
    let realAudioPath: string;
    try {
      realAudioPath = await realpath(resolvedPath);
    } catch {
      throw new Error(`v3_audio_not_found: no such file or directory, cannot read audio file at '${options.providedAudioPath}'`);
    }

    const fileStat = await stat(realAudioPath);
    if (!fileStat.isFile() || fileStat.size <= 0) {
      throw new Error('v3_audio_invalid: provided audio must be a non-empty regular file');
    }
    if (fileStat.size > 50 * 1024 * 1024) {
      throw new Error('v3_audio_oversized: provided audio file exceeds 50MB limit');
    }

    const audioMeta = await probeAudio(realAudioPath, 600);
    if (audioMeta.durationSeconds <= 0) {
      throw new Error('v3_audio_invalid: provided audio has zero or negative duration');
    }
    // Fail-closed signal probe
    const signal = await probeAudioSignal(realAudioPath);
    if (signal.isSilent) {
      throw new Error('v3_audio_silent: provided audio is completely silent');
    }
    audioTrackPath = realAudioPath;
  } else if (artifact.request.narrationMode === 'gemini_tts' || artifact.request.narrationMode === 'google_cloud_tts') {
    options.onStage?.('synthesizing_audio');
    const isGemini = artifact.request.narrationMode === 'gemini_tts';
    const providerId = isGemini ? 'gemini_tts' : 'google_cloud_tts';

    const suppliedProvider = options.ttsProvider;
    const isOfflineFixture = isTrustedOfflineTtsFixture(suppliedProvider);
    // Consent is mandatory for every real/custom external provider, including injected providers.
    if (!isOfflineFixture) {
      if (!options.consentRecord) {
        throw new Error(`external_api_consent_required: Live narration mode '${artifact.request.narrationMode}' requires a valid signed consentRecord`);
      }
      const check = verifyExternalApiConsentV3({
        consent: options.consentRecord,
        ownerId: artifact.ownerId,
        expectedProvider: providerId,
        expectedOperation: 'narration',
        expectedArtifactId: artifact.artifactId,
        expectedContentHash: artifact.contentHash,
        isLiveOperation: true
      });
      if (!check.valid) {
        throw new Error(`external_api_consent_rejected: ${check.reason || 'TTS requires valid matching consent'}`);
      }
    }

    const provider: TtsProvider = suppliedProvider ?? (
      isGemini ? new GeminiTtsProvider() : new GoogleCloudTtsProvider()
    );

    const syncResult = await defaultSceneAudioSynchronizer.synchronizeStoryboard(
      approvedStoryboard.scenes.map((s) => ({
        id: s.sceneId,
        durationSeconds: s.durationSeconds,
        narration: s.narration
      })),
      {
        ttsProvider: provider,
        fps: artifact.request.fps,
        ownerId: artifact.ownerId,
        outputDir
      }
    );

    // Verify synthesized audio is valid and audible (fail closed for non-silent fixtures)
    if (!provider.isSilentFixture) {
      const ttsSignal = await probeAudioSignal(syncResult.masterAudioPath);
      if (ttsSignal.isSilent) {
        throw new Error('tts_audio_silent: Synthesized TTS audio returned silent audio payload');
      }
    }
    audioTrackPath = syncResult.masterAudioPath;

    resolvedStoryboard = resolvePresentationStoryboardV3(approvedStoryboard, syncResult);
    resolvedTimelineAudit = {
      schemaVersion: 'resolved-presentation-timeline-v1',
      sourceArtifactId: artifact.artifactId,
      sourceContentHash: artifact.contentHash,
      approvedDraftVersion: artifact.approvedVersion,
      fps: syncResult.fps,
      totalFrames: syncResult.totalFrames,
      audioProvenance: {
        providerId: provider.id,
        model: 'model' in provider && typeof provider.model === 'string' ? provider.model : undefined,
        voice: 'voice' in provider && typeof provider.voice === 'string' ? provider.voice : undefined,
        language: 'languageCode' in provider && typeof provider.languageCode === 'string' ? provider.languageCode : 'vi-VN',
        audioClassification: provider.isSilentFixture ? 'silent_fixture' : 'audible_non_silent'
      },
      scenes: syncResult.sceneTimings.map(({ audioPath: _audioPath, ...timing }) => timing),
      createdAt: new Date().toISOString()
    };
    await writeFile(resolve(outputDir, 'resolved-presentation-timeline.json'), JSON.stringify(resolvedTimelineAudit, null, 2), 'utf8');

    // Build frame-accurate speech cues matching audio timing
    subtitleCues = syncResult.sceneTimings
      .filter((timing) => timing.speechEndFrame > timing.speechStartFrame)
      .map((timing, idx) => {
        const scene = approvedStoryboard.scenes.find((s) => s.sceneId === timing.sceneId);
        const text = (scene?.narration?.subtitleVietnamese || scene?.narration?.vietnamese || timing.normalizedText || '').trim();
        return {
          cueId: `cue_${idx + 1}`,
          sceneId: timing.sceneId,
          text,
          startFrame: timing.speechStartFrame,
          endFrame: timing.speechEndFrame
        };
      })
      .filter((cue) => cue.text.length > 0);
  }

  // Fallback: build contiguous scene cues if not derived from audio synchronization
  if (subtitleCues.length === 0 && artifact.request.subtitlesEnabled) {
    let currentFrame = 0;
    subtitleCues = resolvedStoryboard.scenes.map((scene, idx) => {
      const durationFrames = Math.max(1, Math.round(scene.durationSeconds * artifact.request.fps));
      const startFrame = currentFrame;
      const endFrame = startFrame + durationFrames;
      currentFrame = endFrame;
      const text = (scene.narration?.subtitleVietnamese || scene.narration?.vietnamese || '').trim();
      return {
        cueId: `cue_${idx + 1}`,
        sceneId: scene.sceneId,
        text,
        startFrame,
        endFrame
      };
    }).filter((cue) => cue.text.length > 0);
  }

  // Remotion, subtitles and muxing consume the same derived integer-frame timeline.
  await writeFile(propsPath, JSON.stringify({
    storyboard: resolvedStoryboard,
    subtitlesEnabled: artifact.request.subtitlesEnabled,
    trustedProofContext,
    subtitleCues
  }), 'utf8');

  // Authoritative dual subtitle export (burned-in and independent SRT share exact cues)
  if (artifact.request.subtitlesEnabled && subtitleCues.length > 0) {
    const srt = subtitleCues.map((cue, index) => [
      String(index + 1),
      `${srtTimestamp(cue.startFrame, artifact.request.fps)} --> ${srtTimestamp(cue.endFrame, artifact.request.fps)}`,
      cue.text,
      ''
    ].join('\n')).join('\n') + '\n';
    await writeFile(resolve(outputDir, 'subtitles.srt'), srt, 'utf8');
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

    // Checkpoint E: If audio exceeds video timeline by > 0.05s, FAIL CLOSED rather than truncating speech with FFmpeg -t
    const durationDelta = audioMeta.durationSeconds - videoDuration;
    if (durationDelta > 0.05) {
      throw new Error(`audio_duration_overflow: Narration speech duration (${audioMeta.durationSeconds.toFixed(2)}s) exceeds approved video timeline (${videoDuration.toFixed(2)}s) by ${durationDelta.toFixed(2)}s. Increase scene duration or shorten narration text.`);
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

