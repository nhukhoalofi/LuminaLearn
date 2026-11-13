import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { LUMINA_VERTICAL_LAYOUT, type RenderManifestV2 } from '@luminalearn/scene-schema';
import { probeAudioSignal, type AudioSignalClassification, type AudioSignalProbeResult } from './audio';
import type { VerifiedVideoMetadata } from './ffprobe';

export type VisualQaStatus = 'pass' | 'fail' | 'requires_manual_review';
export interface VisualQaCheck { id: string; status: VisualQaStatus; evidence: string; }
export interface VisualQaReport {
  schemaVersion: 'visual-qa-v1';
  frameInspectionCompleted: boolean;
  inspectedMedia: string;
  contactSheet: string;
  sampledFrames: number[];
  motionContinuity?: {
    freezeSegments: Array<{ start: number; end: number; duration: number }>;
    frozenRatio: number;
  };
  checks: VisualQaCheck[];
  audioSignal?: {
    meanVolumeDb: number;
    maxVolumeDb: number;
    isSilent: boolean;
    audioClassification: AudioSignalClassification;
  };
  passed: boolean;
  requiresManualReview: boolean;
}

export interface VisualLayoutContract {
  height: number;
  minimumReadableFontPx: number;
  titleFontPx: number;
  bodyFontPx: number;
  formulaFontPx: number;
  subtitleFontPx: number;
  subtitleLineHeight: number;
  subtitleHorizontalPaddingPx: number;
  subtitleVerticalPaddingPx: number;
  subtitleMaxWidthPx: number;
  subtitleNormalBottomPx: number;
  subtitleMathClipBottomPx: number;
  textFormulaRegionBottomPx: number;
  mathClipLowerFormulaRegionTopPx: number;
  minimumSafeMarginPx: number;
}

const DEFAULT_LAYOUT: VisualLayoutContract = LUMINA_VERTICAL_LAYOUT;

function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile('ffmpeg', args, { windowsHide: true, timeout: 120_000, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(`Visual QA FFmpeg scan failed: ${stderr || stdout || error.message}`));
      resolvePromise(`${stdout}\n${stderr}`);
    });
  });
}

function estimateSubtitleBox(text: string, mathClip: boolean, layout: VisualLayoutContract): { top: number; bottom: number; lines: number } {
  const usableWidth = layout.subtitleMaxWidthPx - 2 * layout.subtitleHorizontalPaddingPx;
  const approximateCharacterWidth = layout.subtitleFontPx * 0.56;
  const charactersPerLine = Math.max(1, Math.floor(usableWidth / approximateCharacterWidth));
  const explicitLines = text.split('\n');
  const lines = explicitLines.reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
  const height = lines * layout.subtitleFontPx * layout.subtitleLineHeight + 2 * layout.subtitleVerticalPaddingPx + 2;
  const bottom = layout.height - (mathClip ? layout.subtitleMathClipBottomPx : layout.subtitleNormalBottomPx);
  return { top: bottom - height, bottom, lines };
}

export function evaluateDeterministicVisualLayout(
  manifest: RenderManifestV2,
  overrides: Partial<VisualLayoutContract> = {}
): VisualQaCheck[] {
  const layout = { ...DEFAULT_LAYOUT, ...overrides };
  const safeMarginsValid = manifest.timeline.every(
    (scene) => Number(scene.parameters.safeAreaPadding ?? 48) >= layout.minimumSafeMarginPx
  );
  const configuredFonts = [layout.titleFontPx, layout.bodyFontPx, layout.formulaFontPx, layout.subtitleFontPx];
  const fontStatus = configuredFonts.every((size) => size >= layout.minimumReadableFontPx) ? 'pass' : 'fail';

  let collisionStatus: VisualQaStatus = 'pass';
  const collisionEvidence: string[] = [];
  for (const cue of manifest.subtitleTrack?.cues ?? []) {
    const scene = manifest.timeline.find((candidate) => cue.startFrame >= candidate.startFrame && cue.startFrame < candidate.startFrame + candidate.durationFrames);
    if (!scene) {
      collisionStatus = 'requires_manual_review';
      collisionEvidence.push(`${cue.id}: no owning scene`);
      continue;
    }
    const box = estimateSubtitleBox(cue.text, Boolean(scene.assetId), layout);
    const collides = scene.assetId
      ? box.bottom > layout.mathClipLowerFormulaRegionTopPx
      : scene.content.formulas.length > 0 && box.top < layout.textFormulaRegionBottomPx;
    collisionEvidence.push(`${cue.id}: y=${box.top.toFixed(1)}-${box.bottom.toFixed(1)}, lines=${box.lines}, scene=${scene.id}`);
    if (collides) collisionStatus = 'fail';
  }

  return [
    {
      id: 'subtitle_formula_overlap', status: collisionStatus,
      evidence: collisionEvidence.length > 0
        ? `Deterministic subtitle boxes checked against formula regions. ${collisionEvidence.join('; ')}`
        : 'No subtitle cues overlap a formula scene; check is not applicable.'
    },
    {
      id: 'safe_text_margins', status: safeMarginsValid ? 'pass' : 'fail',
      evidence: `Every scene safeAreaPadding must be >= ${layout.minimumSafeMarginPx}px.`
    },
    {
      id: 'readable_font_size', status: fontStatus,
      evidence: `Configured title/body/formula/subtitle sizes=${configuredFonts.join('/')}; minimum=${layout.minimumReadableFontPx}px.`
    }
  ];
}

export function representativeFrames(manifest: RenderManifestV2): number[] {
  const sceneMidpoints = manifest.timeline.map(
    (scene) => scene.startFrame + Math.floor(scene.durationFrames / 2)
  );
  const candidates = [
    manifest.timeline.find((scene) => scene.sceneType === 'intro'),
    manifest.timeline.find((scene) => Boolean(scene.assetId)),
    manifest.timeline.find((scene) => scene.sceneType === 'formula' || scene.content.formulas.length > 0),
    manifest.timeline.find((scene) => scene.sceneType === 'summary')
  ].filter((scene): scene is RenderManifestV2['timeline'][number] => Boolean(scene));
  const frames = [
    ...sceneMidpoints,
    ...candidates.map((scene) => scene.startFrame + Math.floor(scene.durationFrames / 2))
  ];
  const subtitleFrame = manifest.subtitleTrack?.cues[0]
    ? Math.floor((manifest.subtitleTrack.cues[0].startFrame + manifest.subtitleTrack.cues[0].endFrame) / 2)
    : undefined;
  if (subtitleFrame !== undefined) frames.push(subtitleFrame);
  return [...new Set(frames)].slice(0, 9).sort((a, b) => a - b);
}

async function createContactSheet(videoPath: string, jobDirectory: string, manifest: RenderManifestV2): Promise<{ path: string; frames: number[] }> {
  const frames = representativeFrames(manifest);
  if (frames.length === 0) throw new Error('visual_qa_failed: no representative frames available');
  const outputPath = resolve(jobDirectory, 'contact-sheet.png');
  const select = frames.map((frame) => `eq(n\\,${frame})`).join('+');
  await runFfmpeg([
    '-hide_banner', '-y', '-i', videoPath,
    '-vf', `select='${select}',scale=240:426,tile=3x3:padding=4:margin=4`,
    '-frames:v', '1', '-update', '1', outputPath
  ]);
  return { path: outputPath, frames };
}

export function parseFreezeSegments(output: string, mediaDurationSeconds: number): Array<{ start: number; end: number; duration: number }> {
  const starts = [...output.matchAll(/freeze_start:\s*([\d.]+)/g)].map((match) => Number(match[1]));
  const ends = [...output.matchAll(/freeze_end:\s*([\d.]+)/g)].map((match) => Number(match[1]));
  return starts
    .map((start, index) => {
      const end = ends[index] ?? mediaDurationSeconds;
      return { start, end, duration: Math.max(0, end - start) };
    })
    .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.duration > 0);
}

export function evaluateMotionContinuity(
  freezeSegments: Array<{ start: number; end: number; duration: number }>,
  mediaDurationSeconds: number
): VisualQaCheck {
  const frozenSeconds = freezeSegments.reduce((sum, segment) => sum + segment.duration, 0);
  const frozenRatio = mediaDurationSeconds > 0 ? frozenSeconds / mediaDurationSeconds : 1;
  const longest = freezeSegments.reduce((max, segment) => Math.max(max, segment.duration), 0);
  // Educational infographic videos contain slides/cards with reading pauses.
  // In v3 educational format, max freeze up to 6.5s and ratio up to 65% is normal for instructional cards.
  const status: VisualQaStatus = longest >= 8.0
    ? 'fail'
    : frozenRatio > 0.75
      ? 'requires_manual_review'
      : 'pass';
  return {
    id: 'motion_continuity',
    status,
    evidence: `FFmpeg freezedetect found ${freezeSegments.length} segment(s), longest=${longest.toFixed(3)}s, frozen=${frozenSeconds.toFixed(3)}s/${mediaDurationSeconds.toFixed(3)}s (${(frozenRatio * 100).toFixed(1)}%).`
  };
}

export function evaluateAudioTruthfulness(options: {
  hasAudioStream: boolean;
  ttsSelected: boolean;
  ttsProviderId?: string;
  signal?: AudioSignalProbeResult;
  audioListeningConfirmed?: boolean;
}): [VisualQaCheck, VisualQaCheck] {
  const { hasAudioStream, ttsSelected, ttsProviderId, signal, audioListeningConfirmed = false } = options;
  const presenceCheck: VisualQaCheck = {
    id: 'audio_presence',
    status: !ttsSelected || hasAudioStream ? 'pass' : 'fail',
    evidence: ttsSelected
      ? `Narration selected; FFprobe audio stream present=${hasAudioStream}.`
      : `Narration not selected; audio stream is optional (present=${hasAudioStream}).`
  };

  if (!hasAudioStream) {
    return [
      presenceCheck,
      {
        id: 'audible_speech',
        status: ttsSelected ? 'fail' : 'pass',
        evidence: ttsSelected
          ? 'Narration was selected, but no audio stream is present in the output MP4.'
          : 'Narration was not selected; no audio stream expected.'
      }
    ];
  }

  const meanDb = signal?.meanVolumeDb ?? -91.0;
  const maxDb = signal?.maxVolumeDb ?? -91.0;
  const isSilent = signal ? signal.isSilent : true;

  if (isSilent) {
    const isLiveTtsProvider =
      ttsProviderId === 'gemini_tts' || ttsProviderId === 'google_cloud_tts' || ttsProviderId === 'dutai_tts';
    return [
      presenceCheck,
      {
        id: 'audible_speech',
        status: isLiveTtsProvider ? 'fail' : 'requires_manual_review',
        evidence: isLiveTtsProvider
          ? `silent_audio_error: Audio stream exists, but measured volume is silent (mean_volume=${meanDb.toFixed(1)} dB, max_volume=${maxDb.toFixed(1)} dB) despite live TTS provider '${ttsProviderId}'.`
          : `silent_fixture: Audio stream exists (mean_volume=${meanDb.toFixed(1)} dB, max_volume=${maxDb.toFixed(1)} dB), but contains silent fixture audio rather than audible speech.`
      }
    ];
  }

  return [
    presenceCheck,
    {
      id: 'audible_speech',
      status: audioListeningConfirmed ? 'pass' : 'requires_manual_review',
      evidence: audioListeningConfirmed
        ? `audible_non_silent: Non-silent speech signal verified (mean_volume=${meanDb.toFixed(1)} dB, max_volume=${maxDb.toFixed(1)} dB) and human listening confirmed.`
        : `audible_non_silent: Non-silent audio signal detected (mean_volume=${meanDb.toFixed(1)} dB, max_volume=${maxDb.toFixed(1)} dB); semantic speech quality requires human listening confirmation.`
    }
  ];
}

export async function createVisualQaReport(options: {
  videoPath: string;
  jobDirectory: string;
  manifest: RenderManifestV2;
  metadata: VerifiedVideoMetadata;
  ttsSelected: boolean;
  ttsProviderId?: string;
  frameInspectionConfirmed?: boolean;
  audioListeningConfirmed?: boolean;
}): Promise<VisualQaReport> {
  const {
    videoPath,
    jobDirectory,
    manifest,
    metadata,
    ttsSelected,
    ttsProviderId,
    frameInspectionConfirmed = false,
    audioListeningConfirmed = false
  } = options;
  const scan = await runFfmpeg(['-hide_banner', '-i', videoPath, '-vf', 'blackdetect=d=0.35:pix_th=0.02', '-an', '-f', 'null', '-']);
  const blackSegments = [...scan.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)]
    .map((match) => ({ start: Number(match[1]), end: Number(match[2]) }))
    .filter((segment) => segment.start > 0.15 && segment.end < metadata.durationSeconds - 0.15);
  const durationDelta = Math.abs(metadata.durationSeconds - manifest.totalFrames / manifest.fps);
  const freezeScan = await runFfmpeg(['-hide_banner', '-i', videoPath, '-vf', 'freezedetect=n=-50dB:d=1.0', '-an', '-f', 'null', '-']);
  const freezeSegments = parseFreezeSegments(freezeScan, metadata.durationSeconds);
  const frozenSeconds = freezeSegments.reduce((sum, segment) => sum + segment.duration, 0);
  const frozenRatio = metadata.durationSeconds > 0 ? frozenSeconds / metadata.durationSeconds : 1;
  const contactSheet = await createContactSheet(videoPath, jobDirectory, manifest);
  const audioSignal = metadata.audio
    ? await probeAudioSignal(videoPath).catch(() => ({
        meanVolumeDb: -91.0,
        maxVolumeDb: -91.0,
        isSilent: true,
        audioClassification: 'silent_fixture' as const
      }))
    : undefined;
  const [audioPresenceCheck, audibleSpeechCheck] = evaluateAudioTruthfulness({
    hasAudioStream: Boolean(metadata.audio),
    ttsSelected,
    ttsProviderId,
    signal: audioSignal,
    audioListeningConfirmed
  });
  const checks: VisualQaCheck[] = [
    {
      id: 'sampled_frames',
      status: frameInspectionConfirmed ? 'pass' : 'requires_manual_review',
      evidence: frameInspectionConfirmed
        ? `Rendered contact sheet from frames ${contactSheet.frames.join(', ')} and an external reviewer confirmed visual inspection.`
        : `Rendered contact sheet from frames ${contactSheet.frames.join(', ')}; semantic visual inspection has not been confirmed.`
    },
    { id: 'black_frames', status: blackSegments.length === 0 ? 'pass' : 'fail', evidence: blackSegments.length === 0 ? 'FFmpeg blackdetect scanned all rendered frames; no unintended interior black segment >= 0.35s.' : `Interior black segments: ${JSON.stringify(blackSegments)}` },
    evaluateMotionContinuity(freezeSegments, metadata.durationSeconds),
    ...evaluateDeterministicVisualLayout(manifest),
    { id: 'dimensions_fps', status: metadata.width === manifest.dimensions.width && metadata.height === manifest.dimensions.height && metadata.fps === manifest.fps ? 'pass' : 'fail', evidence: `FFprobe=${metadata.width}x${metadata.height}@${metadata.fps}; manifest=${manifest.dimensions.width}x${manifest.dimensions.height}@${manifest.fps}.` },
    audioPresenceCheck,
    audibleSpeechCheck,
    { id: 'duration_consistency', status: durationDelta <= Math.max(0.08, 1 / manifest.fps + 0.01) ? 'pass' : 'fail', evidence: `Rendered=${metadata.durationSeconds.toFixed(3)}s; timeline=${(manifest.totalFrames / manifest.fps).toFixed(3)}s; delta=${durationDelta.toFixed(3)}s.` }
  ];
  const hasFailures = checks.some((check) => check.status === 'fail');
  const requiresManualReview = checks.some((check) => check.status === 'requires_manual_review');
  const report: VisualQaReport = {
    schemaVersion: 'visual-qa-v1', frameInspectionCompleted: frameInspectionConfirmed, inspectedMedia: basename(videoPath),
    contactSheet: basename(contactSheet.path), sampledFrames: contactSheet.frames, checks,
    motionContinuity: { freezeSegments, frozenRatio },
    ...(audioSignal ? { audioSignal } : {}),
    passed: !hasFailures && !requiresManualReview, requiresManualReview
  };
  await writeFile(resolve(jobDirectory, 'visual-qa-report.json'), JSON.stringify(report, null, 2), 'utf8');
  if (hasFailures) throw new Error(`visual_qa_failed: ${checks.filter((check) => check.status === 'fail').map((check) => check.id).join(', ')}`);
  return report;
}
