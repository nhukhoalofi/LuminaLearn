import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, writeFile, readFile, rename, stat, rm, copyFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type SegmentManifestV3,
  type RenderSegmentV3,
  type LongFormRenderJobV3,
  LongFormRenderJobV3Schema,
  framesToSeconds
} from '@luminalearn/scene-schema';
import { LongFormMediaAssemblerV3, probeMediaWithFFprobe } from './longform-assembler-v3';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// ============================================================================
// CHECKPOINT E: Content-Addressable Segment Cache (SegmentCacheV3)
// ============================================================================
export class SegmentCacheV3 {
  private readonly cacheDir: string;

  constructor(options?: { cacheDir?: string }) {
    this.cacheDir = options?.cacheDir ?? resolve(repositoryRoot, 'outputs/.segment-cache-v3');
  }

  public async init(): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
  }

  public computeCacheKey(segment: RenderSegmentV3, fps: number = 24, width: number = 720, height: number = 1280): string {
    const raw = `${segment.inputContentHash}:${fps}:${width}:${height}:v3.0.0`;
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  public async get(cacheKey: string): Promise<string | undefined> {
    const targetPath = join(this.cacheDir, `${cacheKey}.mp4`);
    try {
      const s = await stat(targetPath);
      if (!s.isFile() || s.size <= 0) return undefined;
      // Probe to guarantee it's not a corrupt partial MP4
      const probe = await probeMediaWithFFprobe(targetPath);
      if (probe.durationSeconds <= 0) return undefined;
      return targetPath;
    } catch {
      return undefined;
    }
  }

  public async set(cacheKey: string, sourcePath: string): Promise<string> {
    await this.init();
    const targetPath = join(this.cacheDir, `${cacheKey}.mp4`);
    const tempPath = join(this.cacheDir, `${cacheKey}.${randomUUID()}.tmp.mp4`);
    await copyFile(sourcePath, tempPath);
    await rename(tempPath, targetPath);
    return targetPath;
  }

  public async invalidate(cacheKey: string): Promise<void> {
    const targetPath = join(this.cacheDir, `${cacheKey}.mp4`);
    await rm(targetPath, { force: true });
  }
}

// ============================================================================
// CHECKPOINT H: Persistent Render Checkpoint Repository (RenderCheckpointRepositoryV3)
// ============================================================================
export class RenderCheckpointRepositoryV3 {
  private readonly storageDir: string;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir ?? resolve(repositoryRoot, 'outputs/.render-checkpoints-v3');
  }

  public async init(): Promise<void> {
    await mkdir(this.storageDir, { recursive: true });
  }

  public async save(job: LongFormRenderJobV3): Promise<void> {
    await this.init();
    const targetPath = join(this.storageDir, `${job.jobId}.json`);
    const tempPath = join(this.storageDir, `${job.jobId}.${randomUUID()}.tmp.json`);
    await writeFile(tempPath, JSON.stringify(job, null, 2), 'utf8');
    await rename(tempPath, targetPath);
  }

  public async load(jobId: string): Promise<LongFormRenderJobV3 | undefined> {
    const targetPath = join(this.storageDir, `${jobId}.json`);
    try {
      const content = await readFile(targetPath, 'utf8');
      return LongFormRenderJobV3Schema.parse(JSON.parse(content));
    } catch {
      return undefined;
    }
  }
}

// ============================================================================
// CHECKPOINT D: Segment Render Worker (SegmentRenderWorkerV3)
// ============================================================================
export class SegmentRenderWorkerV3 {
  /**
   * Renders a single segment into a valid H.264 MP4 with compliant frame timing.
   * Atomically writes to temporary output before promoting.
   */
  public async renderSegment(
    segment: RenderSegmentV3,
    manifest: SegmentManifestV3,
    outputDir: string
  ): Promise<{ outputPath: string }> {
    await mkdir(outputDir, { recursive: true });
    const targetPath = join(outputDir, `${segment.segmentId}.mp4`);
    const tempPath = join(outputDir, `${segment.segmentId}.${randomUUID()}.tmp.mp4`);

    const durationSeconds = framesToSeconds(segment.durationFrames, manifest.fps);

    // Render deterministic compliant MP4 segment
    // Using FFmpeg color background with exact duration and fps
    const ffmpegArgs = [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=0x0b1329:s=${manifest.width}x${manifest.height}:r=${manifest.fps}`,
      '-t',
      String(durationSeconds),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-r',
      String(manifest.fps),
      tempPath
    ];

    await new Promise<void>((resolvePromise, reject) => {
      execFile('ffmpeg', ffmpegArgs, { windowsHide: true, timeout: 60_000 }, (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(`segment_render_failed: ${stderr || err.message}`));
        }
        resolvePromise();
      });
    });

    // Verify temp output before promotion
    const probe = await probeMediaWithFFprobe(tempPath);
    if (Math.abs(probe.durationSeconds - durationSeconds) > 0.5) {
      await rm(tempPath, { force: true });
      throw new Error(
        `segment_duration_mismatch: Expected ${durationSeconds}s, produced ${probe.durationSeconds}s`
      );
    }

    // Atomic promotion
    await rename(tempPath, targetPath);

    return { outputPath: targetPath };
  }
}

// ============================================================================
// CHECKPOINT D & H: Resumable Long-Form Render Coordinator (LongFormRenderCoordinatorV3)
// ============================================================================
export interface CoordinatorRenderOptions {
  manifest: SegmentManifestV3;
  jobId?: string;
  outputDir?: string;
  onProgress?: (job: LongFormRenderJobV3) => void;
  simulateFailureAtSegment?: number; // For test testing interruption/resume
  subtitlesSrtContent?: string;
}

export class LongFormRenderCoordinatorV3 {
  private readonly cache: SegmentCacheV3;
  private readonly checkpointRepo: RenderCheckpointRepositoryV3;
  private readonly worker: SegmentRenderWorkerV3;
  private readonly assembler: LongFormMediaAssemblerV3;

  constructor(options?: {
    cache?: SegmentCacheV3;
    checkpointRepo?: RenderCheckpointRepositoryV3;
    worker?: SegmentRenderWorkerV3;
    assembler?: LongFormMediaAssemblerV3;
  }) {
    this.cache = options?.cache ?? new SegmentCacheV3();
    this.checkpointRepo = options?.checkpointRepo ?? new RenderCheckpointRepositoryV3();
    this.worker = options?.worker ?? new SegmentRenderWorkerV3();
    this.assembler = options?.assembler ?? new LongFormMediaAssemblerV3();
  }

  public async render(options: CoordinatorRenderOptions): Promise<{
    job: LongFormRenderJobV3;
    finalMp4Path: string;
    mediaReportPath: string;
  }> {
    const { manifest, subtitlesSrtContent } = options;
    const jobId = options.jobId ?? `job_longform_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const outputDir = options.outputDir ?? resolve(repositoryRoot, 'outputs', jobId);
    await mkdir(outputDir, { recursive: true });

    // Check for existing checkpoint (Resumable Rendering)
    let job = await this.checkpointRepo.load(jobId);
    if (!job) {
      job = {
        jobId,
        artifactId: manifest.artifactId,
        manifestId: manifest.manifestId,
        status: 'planned',
        totalSegments: manifest.segments.length,
        completedSegments: 0,
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await this.checkpointRepo.save(job);
    }

    options.onProgress?.(job);

    const segmentPaths: string[] = [];

    // Render segments sequentially to avoid memory exhaustion
    for (let i = 0; i < manifest.segments.length; i++) {
      const segment = manifest.segments[i];
      const cacheKey = segment.cacheKey ?? this.cache.computeCacheKey(segment, manifest.fps, manifest.width, manifest.height);

      // Simulated failure for interruption tests
      if (options.simulateFailureAtSegment !== undefined && i === options.simulateFailureAtSegment) {
        job = {
          ...job,
          status: 'interrupted',
          error: `simulated_render_interruption_at_segment_${i}`,
          updatedAt: new Date().toISOString()
        };
        await this.checkpointRepo.save(job);
        options.onProgress?.(job);
        throw new Error(`simulated_render_interruption_at_segment_${i}`);
      }

      // Check Cache
      const cachedPath = await this.cache.get(cacheKey);
      if (cachedPath) {
        segment.status = 'cached';
        segment.outputPath = cachedPath;
        segmentPaths.push(cachedPath);
      } else {
        segment.status = 'rendering';
        const rendered = await this.worker.renderSegment(segment, manifest, outputDir);
        await this.cache.set(cacheKey, rendered.outputPath);
        segment.status = 'validated';
        segment.outputPath = rendered.outputPath;
        segmentPaths.push(rendered.outputPath);
      }

      job = {
        ...job,
        status: 'rendering_segments',
        completedSegments: i + 1,
        progress: Math.round(((i + 1) / manifest.segments.length) * 85),
        updatedAt: new Date().toISOString()
      };
      await this.checkpointRepo.save(job);
      options.onProgress?.(job);
    }

    // Merge media
    job = {
      ...job,
      status: 'merging',
      progress: 90,
      updatedAt: new Date().toISOString()
    };
    await this.checkpointRepo.save(job);
    options.onProgress?.(job);

    const assembled = await this.assembler.assemble({
      manifest,
      segmentPaths,
      outputDir,
      subtitlesSrtContent
    });

    job = {
      ...job,
      status: 'completed',
      completedSegments: manifest.segments.length,
      progress: 100,
      outputPath: assembled.outputPath,
      updatedAt: new Date().toISOString()
    };
    await this.checkpointRepo.save(job);
    options.onProgress?.(job);

    return {
      job,
      finalMp4Path: assembled.outputPath,
      mediaReportPath: assembled.reportPath
    };
  }
}

