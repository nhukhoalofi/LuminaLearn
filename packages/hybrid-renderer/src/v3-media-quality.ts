import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { EducationalStoryboardV3 } from '@luminalearn/scene-schema';
import { probeAudioSignal } from './audio';
import { evaluateMotionContinuity, parseFreezeSegments, type VisualQaCheck } from './visual-qa';

interface V3MediaProbe {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
}

export interface V3MediaQualityReport {
  schemaVersion: 'v3-media-quality-v1';
  inspectedMedia: string;
  contactSheet: string;
  sampledFrames: number[];
  checks: VisualQaCheck[];
  passed: boolean;
  requiresManualReview: boolean;
}

function execute(command: string, args: string[], timeoutMs = 120_000): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile(command, args, { windowsHide: true, timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(`v3_media_qa_command_failed: ${stderr || stdout || error.message}`));
      resolvePromise(`${stdout}\n${stderr}`);
    });
  });
}

function frameRate(value: string): number {
  const [numerator, denominator] = value.split('/').map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return Number.NaN;
  return numerator / denominator;
}

async function probeMedia(videoPath: string): Promise<V3MediaProbe> {
  const output = await execute('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration',
    '-of', 'json', videoPath
  ], 30_000);
  const parsed = JSON.parse(output) as {
    streams?: Array<{ codec_type?: string; width?: number; height?: number; r_frame_rate?: string }>;
    format?: { duration?: string };
  };
  const video = parsed.streams?.find((stream) => stream.codec_type === 'video');
  if (!video?.width || !video.height || !video.r_frame_rate) throw new Error('v3_media_qa_missing_video_stream');
  return {
    durationSeconds: Number(parsed.format?.duration),
    width: video.width,
    height: video.height,
    fps: frameRate(video.r_frame_rate),
    hasAudio: Boolean(parsed.streams?.some((stream) => stream.codec_type === 'audio'))
  };
}

export function evaluateV3MediaQuality(options: {
  probe: V3MediaProbe;
  expectedWidth: number;
  expectedHeight: number;
  expectedFps: number;
  expectedDurationSeconds: number;
  narrationRequired: boolean;
  trustedSilentFixture?: boolean;
  audioIsSilent?: boolean;
  blackSegments: Array<{ start: number; end: number }>;
  freezeSegments: Array<{ start: number; end: number; duration: number }>;
}): VisualQaCheck[] {
  const durationTolerance = Math.max(0.08, 1 / options.expectedFps + 0.01);
  const profileMatches = options.probe.width === options.expectedWidth
    && options.probe.height === options.expectedHeight
    && Math.abs(options.probe.fps - options.expectedFps) < 0.001;
  const durationDelta = Math.abs(options.probe.durationSeconds - options.expectedDurationSeconds);
  const narrationAudioStatus: VisualQaCheck['status'] = !options.narrationRequired
    ? 'pass'
    : !options.probe.hasAudio
      ? 'fail'
      : options.audioIsSilent === false
        ? 'pass'
        : options.trustedSilentFixture
          ? 'requires_manual_review'
          : 'fail';
  return [
    {
      id: 'dimensions_fps',
      status: profileMatches ? 'pass' : 'fail',
      evidence: `FFprobe=${options.probe.width}x${options.probe.height}@${options.probe.fps}; expected=${options.expectedWidth}x${options.expectedHeight}@${options.expectedFps}.`
    },
    {
      id: 'duration_consistency',
      status: durationDelta <= durationTolerance ? 'pass' : 'fail',
      evidence: `Rendered=${options.probe.durationSeconds.toFixed(3)}s; expected=${options.expectedDurationSeconds.toFixed(3)}s; delta=${durationDelta.toFixed(3)}s.`
    },
    {
      id: 'black_frames',
      status: options.blackSegments.length === 0 ? 'pass' : 'fail',
      evidence: options.blackSegments.length === 0 ? 'No unintended interior black segment >= 0.35s.' : `Interior black segments: ${JSON.stringify(options.blackSegments)}`
    },
    evaluateMotionContinuity(options.freezeSegments, options.probe.durationSeconds),
    {
      id: 'narration_audio',
      status: narrationAudioStatus,
      evidence: options.narrationRequired
        ? `Narration required; audio stream=${options.probe.hasAudio}; silent=${String(options.audioIsSilent ?? true)}; trusted fixture=${Boolean(options.trustedSilentFixture)}.`
        : `Narration not requested; audio stream is optional (present=${options.probe.hasAudio}).`
    }
  ];
}

function storyboardMidpoints(storyboard: EducationalStoryboardV3, fps: number): number[] {
  let cursor = 0;
  return storyboard.scenes.slice(0, 9).map((scene) => {
    const frames = Math.max(1, Math.round(scene.durationSeconds * fps));
    const midpoint = cursor + Math.floor(frames / 2);
    cursor += frames;
    return midpoint;
  });
}

export async function createV3MediaQualityReport(options: {
  videoPath: string;
  jobDirectory: string;
  storyboard: EducationalStoryboardV3;
  expectedWidth: number;
  expectedHeight: number;
  expectedFps: number;
  narrationRequired: boolean;
  trustedSilentFixture?: boolean;
}): Promise<V3MediaQualityReport> {
  const probe = await probeMedia(options.videoPath);
  const blackScan = await execute('ffmpeg', ['-hide_banner', '-i', options.videoPath, '-vf', 'blackdetect=d=0.35:pix_th=0.02', '-an', '-f', 'null', '-']);
  const blackSegments = [...blackScan.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)]
    .map((match) => ({ start: Number(match[1]), end: Number(match[2]) }))
    .filter((segment) => segment.start > 0.15 && segment.end < probe.durationSeconds - 0.15);
  const freezeScan = await execute('ffmpeg', ['-hide_banner', '-i', options.videoPath, '-vf', 'freezedetect=n=-50dB:d=1.0', '-an', '-f', 'null', '-']);
  const freezeSegments = parseFreezeSegments(freezeScan, probe.durationSeconds);
  const audioSignal = probe.hasAudio ? await probeAudioSignal(options.videoPath) : undefined;
  const checks = evaluateV3MediaQuality({
    probe,
    expectedWidth: options.expectedWidth,
    expectedHeight: options.expectedHeight,
    expectedFps: options.expectedFps,
    expectedDurationSeconds: options.storyboard.totalDurationSeconds,
    narrationRequired: options.narrationRequired,
    trustedSilentFixture: options.trustedSilentFixture,
    audioIsSilent: audioSignal?.isSilent,
    blackSegments,
    freezeSegments
  });

  const sampledFrames = storyboardMidpoints(options.storyboard, options.expectedFps);
  const contactSheetPath = resolve(options.jobDirectory, 'v3-contact-sheet.png');
  const select = sampledFrames.map((frame) => `eq(n\\,${frame})`).join('+');
  await execute('ffmpeg', [
    '-hide_banner', '-y', '-i', options.videoPath,
    '-vf', `select='${select}',scale=240:426,tile=3x3:padding=4:margin=4`,
    '-frames:v', '1', '-update', '1', contactSheetPath
  ]);

  const hasFailures = checks.some((check) => check.status === 'fail');
  const requiresManualReview = checks.some((check) => check.status === 'requires_manual_review');
  const report: V3MediaQualityReport = {
    schemaVersion: 'v3-media-quality-v1',
    inspectedMedia: basename(options.videoPath),
    contactSheet: basename(contactSheetPath),
    sampledFrames,
    checks,
    passed: !hasFailures && !requiresManualReview,
    requiresManualReview
  };
  await writeFile(resolve(options.jobDirectory, 'v3-media-quality-report.json'), JSON.stringify(report, null, 2), 'utf8');
  if (hasFailures) {
    throw new Error(`v3_media_quality_failed: ${checks.filter((check) => check.status === 'fail').map((check) => check.id).join(', ')}`);
  }
  return report;
}
