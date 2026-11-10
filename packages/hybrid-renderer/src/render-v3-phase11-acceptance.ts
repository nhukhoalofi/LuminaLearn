/**
 * LuminaLearn V3.0 — Phase 11.3
 * Authoritative Acceptance Engine & Verification Harness
 *
 * Implements two strictly separated executable acceptance modes:
 * 1. Offline Mode (--mode=offline, default):
 *    - Uses deterministic MockTtsProvider(2.5) with zero paid external API calls.
 *    - Validates Scenario A (Math 60s) and Scenario B (AI 180s) end-to-end.
 *    - Asserts exact container specs (H.264, 720x1280, AAC 48kHz, 24 FPS).
 *    - Probes audio signals verifying silent_fixture classification.
 *    - Reports OFFLINE_PIPELINE_PASSED or OFFLINE_PIPELINE_FAILED fail-closed.
 *
 * 2. Real TTS Mode (--mode=real-tts):
 *    - Requires explicit operator consent: LUMINA_ENABLE_PAID_TTS_ACCEPTANCE=true.
 *    - Requires valid LUMINA_CONSENT_SIGNING_KEY and GEMINI_API_KEY.
 *    - If prerequisites are missing, returns BLOCKED_REAL_TTS immediately without mock fallback.
 *    - If authorized, synthesizes real Vietnamese audio and asserts audible_voice classification.
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LessonDraftManagerV3 } from '@luminalearn/agent';
import { issueExternalApiConsentV3, type ExternalApiConsentRecordV3 } from '@luminalearn/scene-schema';
import { runRenderPipelineV3 } from './pipeline-v3';
import { MockTtsProvider, probeAudioSignal } from './audio';
import { GeminiTtsProvider } from './gemini-tts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export function exec(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    execFile(cmd, args, { windowsHide: true, timeout: 300_000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`${cmd} failed: ${stderr || stdout || err.message}`));
      resolvePromise({ stdout, stderr });
    });
  });
}

export async function probeStreams(filePath: string) {
  const result = await exec('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath
  ]);
  return JSON.parse(result.stdout);
}

export interface ValidateAcceptanceInput {
  outputPath: string;
  srtPath: string;
  resolvedTimelinePath: string;
  targetDurationSeconds: number;
  expectedFps?: number;
  expectedResolution?: string;
  expectedMode: 'offline' | 'real-tts';
  sourceArtifact: {
    artifactId: string;
    contentHash: string;
  };
  probeData: any;
  audioSignal: {
    meanVolumeDb: number;
    maxVolumeDb: number;
    isSilent: boolean;
    audioClassification: string;
  };
  srtContent: string;
  resolvedTimelineContent: string;
  burnedSubtitleCues: Array<{
    sceneId: string;
    text: string;
    startFrame: number;
    endFrame: number;
  }>;
}

export interface AcceptanceValidationReport {
  valid: boolean;
  errors: string[];
  metrics: {
    videoCodec: string;
    audioCodec: string;
    resolution: string;
    fps: number;
    videoDuration: number;
    audioDuration: number;
    durationDelta: number;
    totalFrames: number;
    srtCueCount: number;
    audioClassification: string;
    meanVolumeDb: number;
    maxVolumeDb: number;
    isSilent: boolean;
  };
}

interface ParsedSrtCue {
  text: string;
  startMs: number;
  endMs: number;
}

function parseSrtCues(content: string): ParsedSrtCue[] | null {
  const blocks = content.replace(/\r/g, '').trim().split(/\n{2,}/).filter(Boolean);
  const cues: ParsedSrtCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const timestampIndex = lines.findIndex((line) => line.includes('-->'));
    if (timestampIndex < 0) return null;
    const match = lines[timestampIndex].match(/^(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})$/);
    if (!match) return null;
    const text = lines.slice(timestampIndex + 1).join('\n').trim();
    if (!text) return null;
    cues.push({ text, startMs: parseSrtTimestampToMs(match[1]), endMs: parseSrtTimestampToMs(match[2]) });
  }
  return cues;
}

/**
 * Pure, fail-closed media & timeline acceptance assertion function.
 * Validates codec, resolution, framerate, duration tolerance, subtitles, and audio classification.
 */
export function validateAcceptanceArtifactsV3(
  input: ValidateAcceptanceInput
): AcceptanceValidationReport {
  const {
    targetDurationSeconds,
    expectedFps = 24,
    expectedResolution = '720x1280',
    expectedMode,
    sourceArtifact,
    probeData,
    audioSignal,
    srtContent,
    resolvedTimelineContent,
    burnedSubtitleCues
  } = input;

  const errors: string[] = [];

  // 1. Video Stream Checks
  const videoStream = probeData?.streams?.find((s: any) => s.codec_type === 'video');
  if (!videoStream) {
    errors.push('missing_video_stream: No video stream found in rendered container');
  } else {
    const videoCodec = String(videoStream.codec_name ?? '').toLowerCase();
    if (!['h264', 'avc1'].includes(videoCodec)) {
      errors.push(`invalid_video_codec: Expected H.264 (h264/avc1), received '${videoCodec}'`);
    }

    const resolution = `${videoStream.width}x${videoStream.height}`;
    if (resolution !== expectedResolution) {
      errors.push(`invalid_resolution: Expected '${expectedResolution}', received '${resolution}'`);
    }

    // Frame rate check
    const rFps = evalFraction(videoStream.r_frame_rate);
    const avgFps = evalFraction(videoStream.avg_frame_rate);
    if (Math.abs(rFps - expectedFps) > 0.5 && Math.abs(avgFps - expectedFps) > 0.5) {
      errors.push(`invalid_fps: Expected ${expectedFps} fps, received r_frame_rate=${videoStream.r_frame_rate}`);
    }
  }

  // 2. Audio Stream Checks
  const audioStream = probeData?.streams?.find((s: any) => s.codec_type === 'audio');
  if (!audioStream) {
    errors.push('missing_audio_stream: No audio stream found in rendered container');
  } else {
    const audioCodec = String(audioStream.codec_name ?? '').toLowerCase();
    if (audioCodec !== 'aac') {
      errors.push(`invalid_audio_codec: Expected AAC, received '${audioCodec}'`);
    }

    const sampleRate = Number(audioStream.sample_rate);
    if (sampleRate !== 48000) {
      errors.push(`invalid_audio_sample_rate: Expected 48000 Hz, received ${sampleRate}`);
    }

    const channels = Number(audioStream.channels);
    if (channels < 1) {
      errors.push(`invalid_audio_channels: Expected at least 1 channel, received ${channels}`);
    }
  }

  // 3. Duration & Timeline Tolerance Checks
  const videoDuration = Number(videoStream?.duration || probeData?.format?.duration || 0);
  const audioDuration = Number(audioStream?.duration || probeData?.format?.duration || 0);
  const durationDelta = Math.abs(videoDuration - targetDurationSeconds);
  const maxToleranceSeconds = 0.05; // ~1 frame at 24 FPS

  if (durationDelta > maxToleranceSeconds) {
    errors.push(`duration_mismatch: Video duration ${videoDuration.toFixed(3)}s deviates from target ${targetDurationSeconds}s by ${durationDelta.toFixed(3)}s (max tolerance: ${maxToleranceSeconds}s)`);
  }

  if (Math.abs(audioDuration - videoDuration) > maxToleranceSeconds) {
    errors.push(`av_sync_drift: Audio duration (${audioDuration.toFixed(3)}s) and Video duration (${videoDuration.toFixed(3)}s) mismatch exceeds tolerance`);
  }

  // 4. Subtitle Checks
  let parsedSrtCues: ParsedSrtCue[] = [];
  if (!srtContent || srtContent.trim().length === 0) {
    errors.push('empty_subtitles_srt: subtitles.srt is missing or empty');
  } else {
    const parsed = parseSrtCues(srtContent);
    if (!parsed || parsed.length === 0) {
      errors.push('invalid_subtitles_srt: No complete subtitle cues found in subtitles.srt');
    } else {
      parsedSrtCues = parsed;
      for (let i = 0; i < parsed.length; i++) {
        const cue = parsed[i];
        if (cue.endMs <= cue.startMs) errors.push(`invalid_subtitle_cue_timestamp: Cue ${i + 1} has start >= end`);
        if (cue.startMs < 0 || cue.endMs > targetDurationSeconds * 1000 + 1) errors.push(`subtitle_cue_out_of_bounds: Cue ${i + 1} exceeds the presentation timeline`);
        if (i > 0 && cue.startMs < parsed[i - 1].startMs) errors.push(`subtitle_cue_out_of_order: Cue ${i + 1} starts before cue ${i}`);
        if (i > 0 && cue.startMs < parsed[i - 1].endMs) errors.push(`subtitle_cue_overlap: Cue ${i + 1} overlaps cue ${i}`);
      }
    }
  }

  if (!Array.isArray(burnedSubtitleCues) || burnedSubtitleCues.length !== parsedSrtCues.length) {
    errors.push(`subtitle_parity_count_mismatch: Burned cues and SRT cues differ in count`);
  } else {
    parsedSrtCues.forEach((cue, index) => {
      const burned = burnedSubtitleCues[index];
      const startFrame = Math.round(cue.startMs * expectedFps / 1000);
      const endFrame = Math.round(cue.endMs * expectedFps / 1000);
      if (burned.text.trim() !== cue.text.trim() || Math.abs(burned.startFrame - startFrame) > 1 || Math.abs(burned.endFrame - endFrame) > 1) {
        errors.push(`subtitle_parity_mismatch: Burned cue ${index + 1} does not match SRT text/timing`);
      }
    });
  }

  // 5. Resolved Presentation Timeline Audit
  let resolvedTimelineJson: any = null;
  try {
    resolvedTimelineJson = JSON.parse(resolvedTimelineContent);
  } catch {
    errors.push('unreadable_resolved_timeline: resolved-presentation-timeline.json is not valid JSON');
  }

  if (resolvedTimelineJson) {
    if (resolvedTimelineJson.sourceArtifactId !== sourceArtifact.artifactId) {
      errors.push(`timeline_artifact_id_mismatch: Expected '${sourceArtifact.artifactId}', found '${resolvedTimelineJson.sourceArtifactId}'`);
    }
    if (resolvedTimelineJson.sourceContentHash !== sourceArtifact.contentHash) {
      errors.push(`timeline_content_hash_mismatch: Expected '${sourceArtifact.contentHash}', found '${resolvedTimelineJson.sourceContentHash}'`);
    }
    if (Math.abs(resolvedTimelineJson.totalFrames - targetDurationSeconds * expectedFps) > 1) {
      errors.push(`timeline_total_frames_mismatch: Expected ${targetDurationSeconds * expectedFps}, found ${resolvedTimelineJson.totalFrames}`);
    }
    if (resolvedTimelineJson.fps !== expectedFps) errors.push(`timeline_fps_mismatch: Expected ${expectedFps}, found ${resolvedTimelineJson.fps}`);
    if (!Array.isArray(resolvedTimelineJson.scenes) || resolvedTimelineJson.scenes.length === 0) {
      errors.push('timeline_scenes_missing: Resolved timeline must contain measured scene timings');
    } else {
      let cursor = 0;
      const sceneIds = new Set<string>();
      for (let index = 0; index < resolvedTimelineJson.scenes.length; index++) {
        const scene = resolvedTimelineJson.scenes[index];
        if (!scene || typeof scene.sceneId !== 'string' || sceneIds.has(scene.sceneId)) errors.push(`timeline_scene_invalid: Scene ${index + 1} has a missing or duplicate ID`);
        else sceneIds.add(scene.sceneId);
        if (!Number.isInteger(scene.startFrame) || !Number.isInteger(scene.endFrame) || !Number.isInteger(scene.durationFrames)) errors.push(`timeline_scene_frames_invalid: Scene ${scene.sceneId ?? index + 1} has non-integer frame bounds`);
        if (scene.startFrame !== cursor || scene.endFrame !== scene.startFrame + scene.durationFrames || scene.durationFrames <= 0) errors.push(`timeline_scene_continuity_error: Scene ${scene.sceneId ?? index + 1} is not contiguous`);
        if (scene.speechStartFrame < scene.startFrame || scene.speechEndFrame > scene.endFrame || scene.speechEndFrame < scene.speechStartFrame) errors.push(`timeline_speech_bounds_error: Scene ${scene.sceneId ?? index + 1} has speech outside scene bounds`);
        cursor = scene.endFrame;
      }
      if (cursor !== resolvedTimelineJson.totalFrames) errors.push(`timeline_scene_coverage_error: Resolved scenes end at frame ${cursor}, expected ${resolvedTimelineJson.totalFrames}`);
      burnedSubtitleCues.forEach((cue, index) => {
        const scene = resolvedTimelineJson.scenes.find((item: any) => item.sceneId === cue.sceneId);
        if (!scene || cue.startFrame < scene.startFrame || cue.endFrame > scene.endFrame) errors.push(`subtitle_scene_bounds_error: Cue ${index + 1} is outside its resolved scene`);
      });
    }
  }

  // 6. Audio Signal Classification Checks
  if (expectedMode === 'offline') {
    if (!audioSignal.isSilent || audioSignal.audioClassification !== 'silent_fixture') {
      errors.push(`unexpected_audible_signal_in_offline_mock: Expected silent_fixture, got ${audioSignal.audioClassification} (meanVolume: ${audioSignal.meanVolumeDb}dB)`);
    }
    if (resolvedTimelineJson?.audioProvenance?.audioClassification !== 'silent_fixture') errors.push('audio_classification_mismatch: Offline timeline provenance must be silent_fixture');
  } else if (expectedMode === 'real-tts') {
    if (audioSignal.isSilent || audioSignal.meanVolumeDb < -50 || !['audible_voice', 'audible_non_silent'].includes(audioSignal.audioClassification)) {
      errors.push(`unexpected_silent_signal_in_real_tts_mode: Real TTS output is silent (meanVolume: ${audioSignal.meanVolumeDb}dB, classification: ${audioSignal.audioClassification})`);
    }
    if (resolvedTimelineJson?.audioProvenance?.audioClassification !== 'audible_non_silent') errors.push('audio_classification_mismatch: Real-TTS timeline provenance must be audible_non_silent');
  }

  return {
    valid: errors.length === 0,
    errors,
    metrics: {
      videoCodec: videoStream?.codec_name ?? 'unknown',
      audioCodec: audioStream?.codec_name ?? 'unknown',
      resolution: `${videoStream?.width}x${videoStream?.height}`,
      fps: expectedFps,
      videoDuration,
      audioDuration,
      durationDelta,
      totalFrames: Math.round(videoDuration * expectedFps),
      srtCueCount: parsedSrtCues.length,
      audioClassification: audioSignal.audioClassification,
      meanVolumeDb: audioSignal.meanVolumeDb,
      maxVolumeDb: audioSignal.maxVolumeDb,
      isSilent: audioSignal.isSilent
    }
  };
}

function evalFraction(fractionStr: string | undefined): number {
  if (!fractionStr) return 0;
  const parts = fractionStr.split('/');
  if (parts.length === 2 && Number(parts[1]) !== 0) {
    return Number(parts[0]) / Number(parts[1]);
  }
  return Number(fractionStr) || 0;
}

function parseSrtTimestampToMs(timestamp: string): number {
  const parts = timestamp.split(':');
  if (parts.length !== 3) return 0;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const secParts = parts[2].split(',');
  const seconds = Number(secParts[0]);
  const millis = Number(secParts[1] || 0);
  return hours * 3600000 + minutes * 60000 + seconds * 1000 + millis;
}

export interface ScenarioAcceptanceEvidence {
  scenarioId: 'scenario_a_math_60s' | 'scenario_b_ai_180s';
  scenarioName: string;
  domain: 'mathematics' | 'artificial_intelligence';
  topic: string;
  targetDurationSeconds: number;
  actualDurationSeconds: number;
  durationDeltaSeconds: number;
  totalFrames: number;
  fps: number;
  videoCodec: string;
  videoResolution: string;
  audioCodec: string;
  audioSampleRate: number;
  audioChannels: number;
  audioSignal: {
    meanVolumeDb: number;
    maxVolumeDb: number;
    isSilent: boolean;
    audioClassification: string;
  };
  subtitles: {
    srtCueCount: number;
    srtPath: string;
    hasSynchronizedCues: boolean;
  };
  pipelineIntegrity: {
    immutableArtifactId: string;
    contentHash: string;
    provenance: string;
    reconciledTimelineVerified: boolean;
  };
  acceptanceCategory: 'OFFLINE_PIPELINE_ACCEPTANCE' | 'REAL_TTS_ACCEPTANCE';
  acceptanceStatus: 'OFFLINE_PIPELINE_PASSED' | 'OFFLINE_PIPELINE_FAILED' | 'REAL_TTS_PASSED' | 'REAL_TTS_FAILED';
  realNarrationVerified: boolean;
  realNarrationStatus: 'REAL_TTS_PASSED' | 'BLOCKED_REAL_TTS' | 'REAL_TTS_FAILED';
  realNarrationBlockReason?: string;
  validationErrors: string[];
}

export async function runScenarioA(
  evidenceDir: string,
  mode: 'offline' | 'real-tts'
): Promise<ScenarioAcceptanceEvidence> {
  console.log('\n======================================================');
  console.log(`--- SCENARIO A: Mathematics (7 Hằng Đẳng Thức Đáng Nhớ — 60s) [Mode: ${mode}] ---`);
  console.log('======================================================');

  const manager = new LessonDraftManagerV3();
  const jobId = `phase11_3-scenario-a-math-${Date.now()}`;

  console.log('[1/4] Creating and approving draft (topic: "7 hằng đẳng thức đáng nhớ", 60s)...');
  let draft = await manager.create({
    requestId: `req_math_p11_3_${Date.now()}`,
    topic: '7 hằng đẳng thức đáng nhớ',
    domain: 'mathematics',
    generationMode: 'mock',
    targetDurationSeconds: 60,
    narrationMode: mode === 'real-tts' ? 'gemini_tts' : 'google_cloud_tts',
    subtitlesEnabled: true,
    fps: 24,
    width: 720,
    height: 1280
  }, 'teacher_math_pilot');

  draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_math_pilot', draft.version);
  draft = await manager.approve(draft.draftId, 'teacher_math_pilot', draft.version, 'Approved for Phase 11.3 Acceptance');
  const artifact = draft.approvedArtifact!;

  let ttsProvider: any;
  let consentRecord: ExternalApiConsentRecordV3 | undefined;
  let realNarrationStatus: 'REAL_TTS_PASSED' | 'BLOCKED_REAL_TTS' | 'REAL_TTS_FAILED' = 'BLOCKED_REAL_TTS';
  let realNarrationBlockReason: string | undefined;

  if (mode === 'real-tts') {
    const operatorAuthorized = process.env.LUMINA_ENABLE_PAID_TTS_ACCEPTANCE === 'true';
    const hasSigningKey = Boolean(process.env.LUMINA_CONSENT_SIGNING_KEY?.trim());
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());

    if (!operatorAuthorized || !hasSigningKey || !hasGeminiKey) {
      realNarrationBlockReason = 'Operator authorization for live external TTS API calls was not explicitly enabled (LUMINA_ENABLE_PAID_TTS_ACCEPTANCE != true or missing credentials). Live synthesis blocked.';
      console.log(`⚠️ REAL TTS PREREQUISITES MISSING: ${realNarrationBlockReason}`);
      // Fail-closed for real-tts command when prerequisites missing
      return {
        scenarioId: 'scenario_a_math_60s',
        scenarioName: 'Scenario A: 7 hằng đẳng thức đáng nhớ (Mathematics 60s)',
        domain: 'mathematics',
        topic: '7 hằng đẳng thức đáng nhớ',
        targetDurationSeconds: 60,
        actualDurationSeconds: 0,
        durationDeltaSeconds: 60,
        totalFrames: 0,
        fps: 24,
        videoCodec: 'none',
        videoResolution: '0x0',
        audioCodec: 'none',
        audioSampleRate: 0,
        audioChannels: 0,
        audioSignal: { meanVolumeDb: -91, maxVolumeDb: -91, isSilent: true, audioClassification: 'uninitialized' },
        subtitles: { srtCueCount: 0, srtPath: '', hasSynchronizedCues: false },
        pipelineIntegrity: { immutableArtifactId: artifact.artifactId, contentHash: artifact.contentHash, provenance: 'none', reconciledTimelineVerified: false },
        acceptanceCategory: 'REAL_TTS_ACCEPTANCE',
        acceptanceStatus: 'REAL_TTS_FAILED',
        realNarrationVerified: false,
        realNarrationStatus: 'BLOCKED_REAL_TTS',
        realNarrationBlockReason,
        validationErrors: [realNarrationBlockReason]
      };
    }

    consentRecord = issueExternalApiConsentV3({
      ownerId: 'teacher_math_pilot',
      provider: 'gemini_tts',
      operation: 'narration',
      requestId: `req_speech_${Date.now()}`,
      artifactId: artifact.artifactId,
      artifactVersion: artifact.approvedVersion,
      contentHash: artifact.contentHash,
      isLiveOperation: true
    });
    ttsProvider = new GeminiTtsProvider({
      apiKey: process.env.GEMINI_API_KEY
    });
  } else {
    ttsProvider = new MockTtsProvider(2.5);
    realNarrationBlockReason = 'Explicit operator authorization for paid/quota live TTS API calls was not requested in offline mode.';
  }

  console.log(`[2/4] Rendering video with SceneAudioSynchronizer & ${ttsProvider.id}...`);
  const { outputPath } = await runRenderPipelineV3(artifact, {
    jobId,
    authorizeArtifact: async () => true,
    ttsProvider,
    consentRecord,
    onStage: (stage) => console.log(`   [Pipeline Stage]: ${stage}`)
  });

  console.log(`[3/4] Probing output video & audio signals: ${outputPath}`);
  const probeData = await probeStreams(outputPath);
  const srtPath = resolve(dirname(outputPath), 'subtitles.srt');
  const srtContent = await readFile(srtPath, 'utf8').catch(() => '');
  const resolvedTimelinePath = resolve(dirname(outputPath), 'resolved-presentation-timeline.json');
  const resolvedTimelineContent = await readFile(resolvedTimelinePath, 'utf8').catch(() => '');
  const propsContent = await readFile(resolve(dirname(outputPath), 'v3-input-props.json'), 'utf8').catch(() => '{}');
  const burnedSubtitleCues = (() => {
    try {
      const value = JSON.parse(propsContent).subtitleCues;
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  })();
  const audioSignal = await probeAudioSignal(outputPath);

  console.log(`[4/4] Executing fail-closed acceptance assertions...`);
  const validation = validateAcceptanceArtifactsV3({
    outputPath,
    srtPath,
    resolvedTimelinePath,
    targetDurationSeconds: 60,
    expectedMode: mode,
    sourceArtifact: { artifactId: artifact.artifactId, contentHash: artifact.contentHash },
    probeData,
    audioSignal,
    srtContent,
    resolvedTimelineContent,
    burnedSubtitleCues
  });

  if (!validation.valid) {
    console.error(`❌ SCENARIO A ASSERTIONS FAILED:`, validation.errors);
  } else {
    console.log(`✅ SCENARIO A ASSERTIONS PASSED (Delta: ${validation.metrics.durationDelta.toFixed(3)}s, Frames: ${validation.metrics.totalFrames})`);
  }

  const acceptanceStatus = mode === 'offline'
    ? (validation.valid ? 'OFFLINE_PIPELINE_PASSED' : 'OFFLINE_PIPELINE_FAILED')
    : (validation.valid ? 'REAL_TTS_PASSED' : 'REAL_TTS_FAILED');

  const evidence: ScenarioAcceptanceEvidence = {
    scenarioId: 'scenario_a_math_60s',
    scenarioName: 'Scenario A: 7 hằng đẳng thức đáng nhớ (Mathematics 60s)',
    domain: 'mathematics',
    topic: '7 hằng đẳng thức đáng nhớ',
    targetDurationSeconds: 60,
    actualDurationSeconds: validation.metrics.videoDuration,
    durationDeltaSeconds: validation.metrics.durationDelta,
    totalFrames: validation.metrics.totalFrames,
    fps: 24,
    videoCodec: validation.metrics.videoCodec,
    videoResolution: validation.metrics.resolution,
    audioCodec: validation.metrics.audioCodec,
    audioSampleRate: Number(probeData?.streams?.find((s: any) => s.codec_type === 'audio')?.sample_rate ?? 0),
    audioChannels: Number(probeData?.streams?.find((s: any) => s.codec_type === 'audio')?.channels ?? 0),
    audioSignal: {
      meanVolumeDb: audioSignal.meanVolumeDb,
      maxVolumeDb: audioSignal.maxVolumeDb,
      isSilent: audioSignal.isSilent,
      audioClassification: audioSignal.audioClassification
    },
    subtitles: {
      srtCueCount: validation.metrics.srtCueCount,
      srtPath,
      hasSynchronizedCues: validation.metrics.srtCueCount > 0
    },
    pipelineIntegrity: {
      immutableArtifactId: artifact.artifactId,
      contentHash: artifact.contentHash,
      provenance: ttsProvider.id === 'mock_tts' ? 'deterministic_mock' : 'gemini_tts',
      reconciledTimelineVerified: validation.valid
    },
    acceptanceCategory: mode === 'offline' ? 'OFFLINE_PIPELINE_ACCEPTANCE' : 'REAL_TTS_ACCEPTANCE',
    acceptanceStatus,
    realNarrationVerified: mode === 'real-tts' && validation.valid,
    realNarrationStatus: mode === 'real-tts'
      ? (validation.valid ? 'REAL_TTS_PASSED' : 'REAL_TTS_FAILED')
      : 'BLOCKED_REAL_TTS',
    realNarrationBlockReason,
    validationErrors: validation.errors
  };

  await writeFile(resolve(evidenceDir, 'scenario-a.json'), JSON.stringify(evidence, null, 2), 'utf8');
  return evidence;
}

export async function runScenarioB(
  evidenceDir: string,
  mode: 'offline' | 'real-tts'
): Promise<ScenarioAcceptanceEvidence> {
  console.log('\n======================================================');
  console.log(`--- SCENARIO B: AI/ML (Thuật toán Gradient Descent — 180s) [Mode: ${mode}] ---`);
  console.log('======================================================');

  const manager = new LessonDraftManagerV3();
  const jobId = `phase11_3-scenario-b-ai-${Date.now()}`;

  console.log('[1/4] Creating and approving draft (topic: "Thuật toán Gradient Descent", 180s)...');
  let draft = await manager.create({
    requestId: `req_ai_p11_3_${Date.now()}`,
    topic: 'Thuật toán Gradient Descent và tối ưu hóa hàm mất mát',
    domain: 'artificial_intelligence',
    generationMode: 'mock',
    targetDurationSeconds: 180,
    narrationMode: mode === 'real-tts' ? 'gemini_tts' : 'google_cloud_tts',
    subtitlesEnabled: true,
    fps: 24,
    width: 720,
    height: 1280
  }, 'teacher_ai_pilot');

  draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_ai_pilot', draft.version);
  draft = await manager.approve(draft.draftId, 'teacher_ai_pilot', draft.version, 'Approved for Phase 11.3 Acceptance');
  const artifact = draft.approvedArtifact!;

  let ttsProvider: any;
  let consentRecord: ExternalApiConsentRecordV3 | undefined;
  let realNarrationStatus: 'REAL_TTS_PASSED' | 'BLOCKED_REAL_TTS' | 'REAL_TTS_FAILED' = 'BLOCKED_REAL_TTS';
  let realNarrationBlockReason: string | undefined;

  if (mode === 'real-tts') {
    const operatorAuthorized = process.env.LUMINA_ENABLE_PAID_TTS_ACCEPTANCE === 'true';
    const hasSigningKey = Boolean(process.env.LUMINA_CONSENT_SIGNING_KEY?.trim());
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());

    if (!operatorAuthorized || !hasSigningKey || !hasGeminiKey) {
      realNarrationBlockReason = 'Operator authorization for live external TTS API calls was not explicitly enabled (LUMINA_ENABLE_PAID_TTS_ACCEPTANCE != true or missing credentials). Live synthesis blocked.';
      console.log(`⚠️ REAL TTS PREREQUISITES MISSING: ${realNarrationBlockReason}`);
      return {
        scenarioId: 'scenario_b_ai_180s',
        scenarioName: 'Scenario B: Gradient Descent (Artificial Intelligence 180s)',
        domain: 'artificial_intelligence',
        topic: 'Thuật toán Gradient Descent và tối ưu hóa hàm mất mát',
        targetDurationSeconds: 180,
        actualDurationSeconds: 0,
        durationDeltaSeconds: 180,
        totalFrames: 0,
        fps: 24,
        videoCodec: 'none',
        videoResolution: '0x0',
        audioCodec: 'none',
        audioSampleRate: 0,
        audioChannels: 0,
        audioSignal: { meanVolumeDb: -91, maxVolumeDb: -91, isSilent: true, audioClassification: 'uninitialized' },
        subtitles: { srtCueCount: 0, srtPath: '', hasSynchronizedCues: false },
        pipelineIntegrity: { immutableArtifactId: artifact.artifactId, contentHash: artifact.contentHash, provenance: 'none', reconciledTimelineVerified: false },
        acceptanceCategory: 'REAL_TTS_ACCEPTANCE',
        acceptanceStatus: 'REAL_TTS_FAILED',
        realNarrationVerified: false,
        realNarrationStatus: 'BLOCKED_REAL_TTS',
        realNarrationBlockReason,
        validationErrors: [realNarrationBlockReason]
      };
    }

    consentRecord = issueExternalApiConsentV3({
      ownerId: 'teacher_ai_pilot',
      provider: 'gemini_tts',
      operation: 'narration',
      requestId: `req_speech_${Date.now()}`,
      artifactId: artifact.artifactId,
      artifactVersion: artifact.approvedVersion,
      contentHash: artifact.contentHash,
      isLiveOperation: true
    });
    ttsProvider = new GeminiTtsProvider({
      apiKey: process.env.GEMINI_API_KEY
    });
  } else {
    ttsProvider = new MockTtsProvider(2.5);
    realNarrationBlockReason = 'Explicit operator authorization for paid/quota live TTS API calls was not requested in offline mode.';
  }

  console.log(`[2/4] Rendering video with SceneAudioSynchronizer & ${ttsProvider.id}...`);
  const { outputPath } = await runRenderPipelineV3(artifact, {
    jobId,
    authorizeArtifact: async () => true,
    ttsProvider,
    consentRecord,
    onStage: (stage) => console.log(`   [Pipeline Stage]: ${stage}`)
  });

  console.log(`[3/4] Probing output video & audio signals: ${outputPath}`);
  const probeData = await probeStreams(outputPath);
  const srtPath = resolve(dirname(outputPath), 'subtitles.srt');
  const srtContent = await readFile(srtPath, 'utf8').catch(() => '');
  const resolvedTimelinePath = resolve(dirname(outputPath), 'resolved-presentation-timeline.json');
  const resolvedTimelineContent = await readFile(resolvedTimelinePath, 'utf8').catch(() => '');
  const propsContent = await readFile(resolve(dirname(outputPath), 'v3-input-props.json'), 'utf8').catch(() => '{}');
  const burnedSubtitleCues = (() => {
    try {
      const value = JSON.parse(propsContent).subtitleCues;
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  })();
  const audioSignal = await probeAudioSignal(outputPath);

  console.log(`[4/4] Executing fail-closed acceptance assertions...`);
  const validation = validateAcceptanceArtifactsV3({
    outputPath,
    srtPath,
    resolvedTimelinePath,
    targetDurationSeconds: 180,
    expectedMode: mode,
    sourceArtifact: { artifactId: artifact.artifactId, contentHash: artifact.contentHash },
    probeData,
    audioSignal,
    srtContent,
    resolvedTimelineContent,
    burnedSubtitleCues
  });

  if (!validation.valid) {
    console.error(`❌ SCENARIO B ASSERTIONS FAILED:`, validation.errors);
  } else {
    console.log(`✅ SCENARIO B ASSERTIONS PASSED (Delta: ${validation.metrics.durationDelta.toFixed(3)}s, Frames: ${validation.metrics.totalFrames})`);
  }

  const acceptanceStatus = mode === 'offline'
    ? (validation.valid ? 'OFFLINE_PIPELINE_PASSED' : 'OFFLINE_PIPELINE_FAILED')
    : (validation.valid ? 'REAL_TTS_PASSED' : 'REAL_TTS_FAILED');

  const evidence: ScenarioAcceptanceEvidence = {
    scenarioId: 'scenario_b_ai_180s',
    scenarioName: 'Scenario B: Gradient Descent (Artificial Intelligence 180s)',
    domain: 'artificial_intelligence',
    topic: 'Thuật toán Gradient Descent và tối ưu hóa hàm mất mát',
    targetDurationSeconds: 180,
    actualDurationSeconds: validation.metrics.videoDuration,
    durationDeltaSeconds: validation.metrics.durationDelta,
    totalFrames: validation.metrics.totalFrames,
    fps: 24,
    videoCodec: validation.metrics.videoCodec,
    videoResolution: validation.metrics.resolution,
    audioCodec: validation.metrics.audioCodec,
    audioSampleRate: Number(probeData?.streams?.find((s: any) => s.codec_type === 'audio')?.sample_rate ?? 0),
    audioChannels: Number(probeData?.streams?.find((s: any) => s.codec_type === 'audio')?.channels ?? 0),
    audioSignal: {
      meanVolumeDb: audioSignal.meanVolumeDb,
      maxVolumeDb: audioSignal.maxVolumeDb,
      isSilent: audioSignal.isSilent,
      audioClassification: audioSignal.audioClassification
    },
    subtitles: {
      srtCueCount: validation.metrics.srtCueCount,
      srtPath,
      hasSynchronizedCues: validation.metrics.srtCueCount > 0
    },
    pipelineIntegrity: {
      immutableArtifactId: artifact.artifactId,
      contentHash: artifact.contentHash,
      provenance: ttsProvider.id === 'mock_tts' ? 'deterministic_mock' : 'gemini_tts',
      reconciledTimelineVerified: validation.valid
    },
    acceptanceCategory: mode === 'offline' ? 'OFFLINE_PIPELINE_ACCEPTANCE' : 'REAL_TTS_ACCEPTANCE',
    acceptanceStatus,
    realNarrationVerified: mode === 'real-tts' && validation.valid,
    realNarrationStatus: mode === 'real-tts'
      ? (validation.valid ? 'REAL_TTS_PASSED' : 'REAL_TTS_FAILED')
      : 'BLOCKED_REAL_TTS',
    realNarrationBlockReason,
    validationErrors: validation.errors
  };

  await writeFile(resolve(evidenceDir, 'scenario-b.json'), JSON.stringify(evidence, null, 2), 'utf8');
  return evidence;
}

export async function main() {
  const args = process.argv.slice(2);
  const isRealTtsMode = args.includes('--mode=real-tts');
  const mode: 'offline' | 'real-tts' = isRealTtsMode ? 'real-tts' : 'offline';

  console.log(`Starting LuminaLearn Phase 11.3 Acceptance Engine in [${mode.toUpperCase()}] mode...`);

  const evidenceDir = resolve(repoRoot, 'outputs', 'phase11-acceptance');
  await mkdir(evidenceDir, { recursive: true });

  const start = Date.now();
  const evidenceA = await runScenarioA(evidenceDir, mode);
  const evidenceB = await runScenarioB(evidenceDir, mode);

  const allPassed = evidenceA.acceptanceStatus.endsWith('_PASSED') && evidenceB.acceptanceStatus.endsWith('_PASSED');

  const summary = {
    phase: 'Phase 11.3: Runtime Stabilization & Acceptance Closure',
    timestamp: new Date().toISOString(),
    executionMode: mode,
    totalElapsedSeconds: Math.round((Date.now() - start) / 1000),
    overallSuccess: allPassed,
    offlinePipelineAcceptance: {
      status: mode === 'offline'
        ? (allPassed ? 'OFFLINE_PIPELINE_PASSED' : 'OFFLINE_PIPELINE_FAILED')
        : 'N/A_REAL_TTS_MODE',
      scenariosVerified: ['scenario_a_math_60s', 'scenario_b_ai_180s'],
      durationAccuracy: 'exact_to_within_integer_frame',
      audioVideoMuxing: 'h264_aac_compliant',
      subtitleSynchronization: 'burned_in_and_srt_exact_cue_match',
      details: [evidenceA, evidenceB]
    },
    realNarrationAcceptance: {
      status: mode === 'real-tts'
        ? (allPassed ? 'REAL_TTS_PASSED' : 'REAL_TTS_FAILED')
        : 'BLOCKED_REAL_TTS',
      reason: mode === 'real-tts'
        ? (allPassed ? 'Real Vietnamese audio verified successfully.' : evidenceA.realNarrationBlockReason || evidenceB.realNarrationBlockReason)
        : 'Explicit operator authorization for paid/quota live TTS API calls was not requested in offline mode. Security and cost policies strictly forbid automated live external API execution.',
      prerequisitesNeeded: [
        'Explicit user consent in active chat turn authorizing paid API budget',
        'Valid LUMINA_CONSENT_SIGNING_KEY in environment',
        'Authenticated Google Cloud Project or Gemini API key'
      ]
    },
    overallReleaseVerdict: allPassed ? (mode === 'real-tts' ? 'GO_FULL_RELEASE' : 'GO_OFFLINE_PIPELINE') : 'NO_GO'
  };

  await writeFile(resolve(evidenceDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  console.log('\n======================================================');
  if (allPassed) {
    console.log(`✅ [${mode.toUpperCase()}] ACCEPTANCE COMPLETED WITH 100% PASS`);
  } else {
    console.error(`❌ [${mode.toUpperCase()}] ACCEPTANCE FAILED (See errors above)`);
  }
  console.log(`Summary evidence written to: ${resolve(evidenceDir, 'summary.json')}`);
  console.log('======================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error('Acceptance execution failed:', err);
    process.exit(1);
  });
}
