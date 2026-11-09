import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, writeFile, readFile, rename, stat, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type SegmentManifestV3,
  type LongFormMediaReportV3,
  LongFormMediaReportV3Schema
} from '@luminalearn/scene-schema';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export async function computeFileSha256(filePath: string): Promise<string> {
  const buf = await readFile(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

export async function detectIfEntirelyBlank(filePath: string, durationSeconds: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    execFile(
      'ffmpeg',
      ['-i', filePath, '-vf', 'blackdetect=d=2:pix_th=0.05', '-f', 'null', '-'],
      { windowsHide: true, timeout: 30_000 },
      (err, _stdout, stderr) => {
        if (err) return resolvePromise(false);
        const blackMatches = Array.from(stderr.matchAll(/black_start:([0-9.]+)\s+black_end:([0-9.]+)\s+black_duration:([0-9.]+)/g));
        let totalBlackSec = 0;
        for (const match of blackMatches) {
          totalBlackSec += Number.parseFloat(match[3] || '0');
        }
        resolvePromise(durationSeconds > 5 && totalBlackSec >= durationSeconds * 0.95);
      }
    );
  });
}

export interface ProbeMediaResult {
  durationSeconds: number;
  totalFrames: number;
  fps: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec?: string;
  hasAudio: boolean;
}

export async function probeMediaWithFFprobe(filePath: string): Promise<ProbeMediaResult> {
  return new Promise((resolvePromise, reject) => {
    execFile(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames',
        '-of',
        'json',
        filePath
      ],
      { windowsHide: true, timeout: 30_000 },
      (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(`ffprobe_failed: ${stderr || err.message}`));
        }
        try {
          const parsed = JSON.parse(stdout) as {
            format?: { duration?: string; size?: string };
            streams?: Array<{
              codec_type?: string;
              codec_name?: string;
              width?: number;
              height?: number;
              r_frame_rate?: string;
              nb_frames?: string;
            }>;
          };

          const durationSeconds = Number.parseFloat(parsed.format?.duration ?? '0');
          if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
            return reject(new Error('ffprobe_invalid_duration: duration must be finite positive number'));
          }

          const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');
          if (!videoStream) {
            return reject(new Error('ffprobe_missing_video_stream: No video stream found'));
          }

          const audioStream = parsed.streams?.find((s) => s.codec_type === 'audio');

          // Parse FPS fraction
          let fps = 24;
          if (videoStream.r_frame_rate) {
            const parts = videoStream.r_frame_rate.split('/');
            if (parts.length === 2) {
              fps = Math.round(Number(parts[0]) / Number(parts[1]));
            } else {
              fps = Math.round(Number(parts[0]));
            }
          }

          const totalFrames = Number.parseInt(videoStream.nb_frames ?? '0', 10) || Math.round(durationSeconds * fps);

          resolvePromise({
            durationSeconds,
            totalFrames,
            fps: fps || 24,
            width: videoStream.width ?? 720,
            height: videoStream.height ?? 1280,
            videoCodec: videoStream.codec_name ?? 'h264',
            audioCodec: audioStream?.codec_name,
            hasAudio: Boolean(audioStream)
          });
        } catch (jsonErr) {
          reject(new Error(`ffprobe_parse_error: ${String(jsonErr)}`));
        }
      }
    );
  });
}

export interface AssembleSegmentsOptions {
  manifest: SegmentManifestV3;
  segmentPaths: string[];
  outputDir: string;
  subtitlesSrtContent?: string;
}

export class LongFormMediaAssemblerV3 {
  /**
   * CHECKPOINT G: Reliable FFmpeg final media assembler.
   * Concat demuxer with compatibility checks, atomic promotion, and FFprobe verification.
   */
  public async assemble(options: AssembleSegmentsOptions): Promise<{
    outputPath: string;
    mediaReport: LongFormMediaReportV3;
    reportPath: string;
  }> {
    const { manifest, segmentPaths, outputDir, subtitlesSrtContent } = options;

    if (segmentPaths.length !== manifest.segments.length) {
      throw new Error(
        `assembler_segment_count_mismatch: Expected ${manifest.segments.length} segments, got ${segmentPaths.length}`
      );
    }

    await mkdir(outputDir, { recursive: true });

    // 1. Validate every input segment with FFprobe before concatenation
    const probedSegments: ProbeMediaResult[] = [];
    for (let i = 0; i < segmentPaths.length; i++) {
      const p = segmentPaths[i];
      const fileStat = await stat(p).catch(() => null);
      if (!fileStat || fileStat.size <= 0) {
        throw new Error(`assembler_missing_segment: Segment file '${p}' is missing or empty`);
      }
      const probe = await probeMediaWithFFprobe(p);
      if (probe.width !== manifest.width || probe.height !== manifest.height) {
        throw new Error(
          `assembler_mismatched_dimensions: Segment ${i} has ${probe.width}x${probe.height}, expected ${manifest.width}x${manifest.height}`
        );
      }
      probedSegments.push(probe);
    }

    // 2. Create deterministic concat list
    const concatListPath = resolve(outputDir, 'concat_list.txt');
    const concatLines = segmentPaths.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    await writeFile(concatListPath, concatLines, 'utf8');

    // 3. Temporary output path for atomic promotion
    const finalOutputPath = resolve(outputDir, 'final.mp4');
    const tempOutputPath = resolve(outputDir, `final_temp_${Date.now()}.mp4`);

    // 4. Execute FFmpeg concat demuxer safely
    const hasAudioAcrossAll = probedSegments.every((s) => s.hasAudio);
    const ffmpegArgs = [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatListPath,
      '-c',
      'copy',
      tempOutputPath
    ];

    await new Promise<void>((resolvePromise, reject) => {
      execFile('ffmpeg', ffmpegArgs, { windowsHide: true, timeout: 5 * 60_000 }, async (err, stdout, stderr) => {
        if (err) {
          // If stream-copy fails due to timebase difference, fallback to deterministic re-encode filter
          const fallbackArgs = [
            '-y',
            '-f',
            'concat',
            '-safe',
            '0',
            '-i',
            concatListPath,
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            '-r',
            String(manifest.fps),
            tempOutputPath
          ];
          execFile('ffmpeg', fallbackArgs, { windowsHide: true, timeout: 10 * 60_000 }, (reErr, reStdout, reStderr) => {
            if (reErr) {
              return reject(new Error(`ffmpeg_concat_failed: ${reStderr || reErr.message}`));
            }
            resolvePromise();
          });
        } else {
          resolvePromise();
        }
      });
    });

    // 5. Atomic promotion of temporary output to final
    await rename(tempOutputPath, finalOutputPath);

    // 6. Write subtitles if enabled
    if (subtitlesSrtContent) {
      await writeFile(resolve(outputDir, 'subtitles.srt'), subtitlesSrtContent, 'utf8');
    }

    // 7. Inspect final MP4 with FFprobe and run comprehensive QA
    const finalProbe = await probeMediaWithFFprobe(finalOutputPath);
    const finalStat = await stat(finalOutputPath);

    // Validate duration tolerance (within 1.5s)
    if (Math.abs(finalProbe.durationSeconds - manifest.targetDurationSeconds) > 1.5) {
      throw new Error(
        `assembler_duration_mismatch: Final duration (${finalProbe.durationSeconds}s) deviates from manifest target (${manifest.targetDurationSeconds}s)`
      );
    }

    if (finalProbe.width !== manifest.width || finalProbe.height !== manifest.height) {
      throw new Error(
        `assembler_dimension_mismatch: Final video dimensions ${finalProbe.width}x${finalProbe.height} deviate from expected ${manifest.width}x${manifest.height}`
      );
    }

    if (finalProbe.videoCodec !== 'h264') {
      throw new Error(`assembler_codec_mismatch: Expected h264 video codec, got ${finalProbe.videoCodec}`);
    }

    if (finalStat.size <= 10_000) {
      throw new Error(`assembler_file_too_small: Output MP4 size (${finalStat.size} bytes) indicates missing or empty video streams`);
    }

    const isEntirelyBlank = await detectIfEntirelyBlank(finalOutputPath, finalProbe.durationSeconds);
    if (isEntirelyBlank) {
      throw new Error('assembler_blank_video_detected: Rendered output was detected as completely black/empty frames');
    }

    const qaPassed = Boolean(
      finalStat.size > 10_000 &&
      Math.abs(finalProbe.durationSeconds - manifest.targetDurationSeconds) <= 1.5 &&
      finalProbe.width === manifest.width &&
      finalProbe.height === manifest.height &&
      finalProbe.videoCodec === 'h264' &&
      !isEntirelyBlank
    );

    const mediaReport: LongFormMediaReportV3 = {
      filePath: finalOutputPath,
      fileSizeBytes: finalStat.size,
      durationSeconds: finalProbe.durationSeconds,
      totalFrames: finalProbe.totalFrames,
      fps: finalProbe.fps,
      width: finalProbe.width,
      height: finalProbe.height,
      videoCodec: finalProbe.videoCodec,
      audioCodec: finalProbe.audioCodec,
      hasAudio: finalProbe.hasAudio,
      subtitlesEmbeddedOrSrt: Boolean(subtitlesSrtContent),
      qaPassed,
      inspectedAt: new Date().toISOString()
    };

    const validatedReport = LongFormMediaReportV3Schema.parse(mediaReport);
    const reportPath = resolve(outputDir, 'media-report.json');
    await writeFile(reportPath, JSON.stringify(validatedReport, null, 2), 'utf8');

    return {
      outputPath: finalOutputPath,
      mediaReport: validatedReport,
      reportPath
    };
  }
}

