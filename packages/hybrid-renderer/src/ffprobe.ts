import { execFile } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { z } from 'zod';
import { assertPathInside } from './paths';
import { probeAudio, type AudioMetadata } from './audio';

const ProbeOutputSchema = z.object({
  streams: z.array(z.object({
    codec_type: z.string().optional(),
    codec_name: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    pix_fmt: z.string(),
    r_frame_rate: z.string(),
    nb_frames: z.string().optional(),
    nb_read_frames: z.string().optional()
  }).passthrough()).min(1),
  format: z.object({ duration: z.string(), size: z.string() }).passthrough()
}).passthrough();

const DerivativeVerificationReportSchema = z.object({
  status: z.literal('verified'),
  topicId: z.literal('calculus.derivative.intuition'),
  derivative: z.string().min(1),
  secantSlope: z.string().min(1),
  limitAtZero: z.string().min(1),
  slopeAtPoint: z.number()
}).passthrough();

const RiemannVerificationReportSchema = z.object({
  status: z.literal('verified'),
  topicId: z.literal('calculus.integral.riemann_sum'),
  integral: z.string().min(1)
}).passthrough();

const VerificationReportSchema = z.discriminatedUnion('topicId', [
  DerivativeVerificationReportSchema,
  RiemannVerificationReportSchema
]);

export interface VerifiedVideoMetadata {
  status: 'verified';
  fileName: string;
  codec: 'h264';
  width: 720;
  height: 1280;
  fps: 24;
  pixelFormat: 'yuv420p';
  durationSeconds: number;
  frameCount: number;
  sizeBytes: number;
  verificationReportFile: string;
  audio?: AudioMetadata;
}

function parseFrameRate(value: string): number {
  const [numerator, denominator] = value.split('/').map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) throw new Error(`Invalid frame rate: ${value}`);
  return numerator / denominator;
}

export function validateProbeOutput(raw: unknown, verificationReportFile: string, maximumDurationSeconds = 15): VerifiedVideoMetadata {
  const parsed = ProbeOutputSchema.parse(raw);
  const stream = parsed.streams.find((candidate) => candidate.codec_type === 'video') ?? parsed.streams[0];
  const durationSeconds = Number(parsed.format.duration);
  const sizeBytes = Number(parsed.format.size);
  const fps = parseFrameRate(stream.r_frame_rate);
  const frameCount = Number(stream.nb_read_frames ?? stream.nb_frames);
  if (stream.codec_name !== 'h264') throw new Error(`Unsupported codec: ${stream.codec_name}`);
  if (stream.width !== 720 || stream.height !== 1280) throw new Error(`Expected 720x1280, received ${stream.width}x${stream.height}`);
  if (fps !== 24) throw new Error(`Expected 24 FPS, received ${fps}`);
  if (stream.pix_fmt !== 'yuv420p') throw new Error(`Expected yuv420p, received ${stream.pix_fmt}`);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > maximumDurationSeconds) throw new Error('Video duration is invalid');
  if (!Number.isInteger(frameCount) || frameCount <= 0) throw new Error('Video frame count is invalid');
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) throw new Error('Video file is empty');
  return {
    status: 'verified', fileName: '', codec: 'h264', width: 720, height: 1280, fps: 24,
    pixelFormat: 'yuv420p', durationSeconds, frameCount, sizeBytes, verificationReportFile
  };
}

function runFfprobe(filePath: string, timeoutMs: number): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    execFile('ffprobe', [
      '-v', 'error', '-count_frames', '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,nb_read_frames,pix_fmt',
      '-show_entries', 'format=duration,size', '-of', 'json', filePath
    ], { windowsHide: true, timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(`ffprobe failed: ${stderr || error.message}`));
      try { resolvePromise(JSON.parse(stdout)); } catch (parseError) { reject(new Error('ffprobe returned invalid JSON', { cause: parseError })); }
    });
  });
}

export async function probeAndVerifyVideoAsset(options: {
  assetPath: string;
  jobDirectory: string;
  verificationReportPath: string;
  timeoutMs?: number;
}): Promise<VerifiedVideoMetadata> {
  const assetPath = assertPathInside(options.jobDirectory, options.assetPath);
  const reportPath = assertPathInside(options.jobDirectory, options.verificationReportPath);
  const fileStats = await stat(assetPath);
  if (!fileStats.isFile() || fileStats.size <= 0) throw new Error('Video asset is missing or unreadable');
  VerificationReportSchema.parse(JSON.parse(await readFile(reportPath, 'utf8')));
  const metadata = validateProbeOutput(await runFfprobe(assetPath, options.timeoutMs ?? 30_000), basename(reportPath));
  metadata.fileName = basename(assetPath);
  const metadataPath = resolve(options.jobDirectory, `${basename(assetPath)}.metadata.json`);
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  return metadata;
}

export async function probeFinalVideo(filePath: string, timeoutMs = 30_000, requireAudio = false): Promise<VerifiedVideoMetadata> {
  const raw = await runFfprobe(filePath, timeoutMs);
  const metadata = validateProbeOutput(raw, 'video-manifest.json', 41);
  metadata.fileName = basename(filePath);
  if (metadata.frameCount !== 960) throw new Error(`Final video must have 960 frames; received ${metadata.frameCount}`);
  if (Math.abs(metadata.durationSeconds - 40) > 1 / 24) throw new Error(`Final video must be 40 seconds; received ${metadata.durationSeconds}`);
  try { metadata.audio = await probeAudio(filePath); } catch (error) {
    if (requireAudio) throw new Error('Final video is missing its required narration audio stream', { cause: error });
  }
  return metadata;
}

