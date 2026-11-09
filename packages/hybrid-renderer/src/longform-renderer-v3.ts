import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, writeFile, readFile, rename, stat, rm, copyFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type SegmentManifestV3,
  type RenderSegmentV3,
  type LongFormRenderJobV3,
  type ApprovedRenderArtifactV3,
  type EducationalSceneV3,
  type EducationalStoryboardV3,
  LongFormRenderJobV3Schema,
  framesToSeconds
} from '@luminalearn/scene-schema';
import { LongFormMediaAssemblerV3, probeMediaWithFFprobe, computeFileSha256 } from './longform-assembler-v3';
import { verifyV3ArtifactIntegrity } from './pipeline-v3';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// ============================================================================
// CHECKPOINT A: Segment Render Context & Worker Contracts
// ============================================================================
export interface SegmentRenderContextV3 {
  approvedArtifact: ApprovedRenderArtifactV3;
  manifest: SegmentManifestV3;
  segment: RenderSegmentV3;
  orderedScenes: EducationalSceneV3[];
  rendererVersion: string;
  fps: number;
  width: number;
  height: number;
  segmentStartFrame: number;
  segmentDurationFrames: number;
  subtitlesEnabled?: boolean;
}

export interface ISegmentRenderWorkerV3 {
  renderSegment(
    segment: RenderSegmentV3,
    manifest: SegmentManifestV3,
    outputDir: string,
    context?: SegmentRenderContextV3
  ): Promise<{ outputPath: string }>;
}

// ============================================================================
// CHECKPOINT F: Content-Addressable Segment Cache with Sidecar Fingerprinting
// ============================================================================
export interface SegmentCacheSidecarV3 {
  cacheKey: string;
  inputFingerprint: string;
  fileSHA256: string;
  fileSizeBytes: number;
  expectedFrameCount: number;
  durationSeconds: number;
  fps: number;
  width: number;
  height: number;
  rendererVersion: string;
  createdAt: string;
}

export class SegmentCacheV3 {
  private readonly cacheDir: string;

  constructor(options?: { cacheDir?: string }) {
    this.cacheDir = options?.cacheDir ?? resolve(repositoryRoot, 'outputs/.segment-cache-v3');
  }

  public async init(): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
  }

  public computeCacheKey(
    segment: RenderSegmentV3,
    fps: number = 24,
    width: number = 720,
    height: number = 1280,
    rendererVersion: string = '3.1.0'
  ): string {
    const raw = `${segment.inputContentHash}:${fps}:${width}:${height}:${rendererVersion}`;
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  /**
   * Retrieves a cached segment. Validates:
   * 1. MP4 file presence and non-zero size
   * 2. Sidecar metadata presence and integrity
   * 3. Input fingerprint match
   * 4. Full MP4 SHA-256 byte hash verification
   * 5. FFprobe stream parameter verification (fps, dimensions, frames)
   * Fails closed by invalidating corrupted cache entries.
   */
  public async get(cacheKey: string, expectedFingerprint?: string): Promise<string | undefined> {
    const targetPath = join(this.cacheDir, `${cacheKey}.mp4`);
    const sidecarPath = join(this.cacheDir, `${cacheKey}.sidecar.json`);

    try {
      const s = await stat(targetPath);
      if (!s.isFile() || s.size <= 0) return undefined;

      // 1. Read sidecar
      const sidecarContent = await readFile(sidecarPath, 'utf8').catch(() => null);
      if (!sidecarContent) {
        await this.invalidate(cacheKey);
        return undefined;
      }

      const sidecar = JSON.parse(sidecarContent) as SegmentCacheSidecarV3;

      // 2. Validate input fingerprint
      if (expectedFingerprint && sidecar.inputFingerprint !== expectedFingerprint) {
        return undefined;
      }

      // 3. Verify MP4 byte hash
      const actualHash = await computeFileSha256(targetPath);
      if (actualHash !== sidecar.fileSHA256) {
        await this.invalidate(cacheKey);
        return undefined;
      }

      // 4. Verify FFprobe metadata
      const probe = await probeMediaWithFFprobe(targetPath);
      if (
        probe.durationSeconds <= 0 ||
        probe.width !== sidecar.width ||
        probe.height !== sidecar.height ||
        probe.fps !== sidecar.fps
      ) {
        await this.invalidate(cacheKey);
        return undefined;
      }

      return targetPath;
    } catch {
      await this.invalidate(cacheKey).catch(() => {});
      return undefined;
    }
  }

  public async set(
    cacheKey: string,
    sourcePath: string,
    inputFingerprint?: string,
    metadata?: { fps?: number; width?: number; height?: number; durationSeconds?: number; rendererVersion?: string }
  ): Promise<string> {
    await this.init();
    const targetPath = join(this.cacheDir, `${cacheKey}.mp4`);
    const sidecarPath = join(this.cacheDir, `${cacheKey}.sidecar.json`);
    const tempPath = join(this.cacheDir, `${cacheKey}.${randomUUID()}.tmp.mp4`);

    await copyFile(sourcePath, tempPath);
    await rename(tempPath, targetPath);

    // Compute sidecar metadata
    const statResult = await stat(targetPath);
    const fileSHA256 = await computeFileSha256(targetPath);
    const probe = await probeMediaWithFFprobe(targetPath);

    const sidecar: SegmentCacheSidecarV3 = {
      cacheKey,
      inputFingerprint: inputFingerprint ?? cacheKey,
      fileSHA256,
      fileSizeBytes: statResult.size,
      expectedFrameCount: probe.totalFrames,
      durationSeconds: probe.durationSeconds,
      fps: metadata?.fps ?? probe.fps,
      width: metadata?.width ?? probe.width,
      height: metadata?.height ?? probe.height,
      rendererVersion: metadata?.rendererVersion ?? '3.1.0',
      createdAt: new Date().toISOString()
    };

    const tempSidecar = join(this.cacheDir, `${cacheKey}.${randomUUID()}.tmp.json`);
    await writeFile(tempSidecar, JSON.stringify(sidecar, null, 2), 'utf8');
    await rename(tempSidecar, sidecarPath);

    return targetPath;
  }

  public async invalidate(cacheKey: string): Promise<void> {
    const targetPath = join(this.cacheDir, `${cacheKey}.mp4`);
    const sidecarPath = join(this.cacheDir, `${cacheKey}.sidecar.json`);
    await rm(targetPath, { force: true }).catch(() => {});
    await rm(sidecarPath, { force: true }).catch(() => {});
  }
}

// ============================================================================
// CHECKPOINT G: Persistent Render Checkpoint Repository (RenderCheckpointRepositoryV3)
// ============================================================================
export interface PersistentCheckpointV3 {
  jobId: string;
  artifactId: string;
  manifestId: string;
  manifestFingerprint: string;
  status: LongFormRenderJobV3['status'];
  totalSegments: number;
  completedSegments: number;
  completedSegmentRecords: Record<
    string,
    {
      segmentId: string;
      outputPath: string;
      fileSHA256: string;
      completedAt: string;
    }
  >;
  attemptCount: number;
  updatedAt: string;
}

export class RenderCheckpointRepositoryV3 {
  private readonly storageDir: string;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir ?? resolve(repositoryRoot, 'outputs/.render-checkpoints-v3');
  }

  public async init(): Promise<void> {
    await mkdir(this.storageDir, { recursive: true });
  }

  public async save(job: LongFormRenderJobV3, persistentMeta?: Partial<PersistentCheckpointV3>): Promise<void> {
    await this.init();
    const targetPath = join(this.storageDir, `${job.jobId}.json`);
    const tempPath = join(this.storageDir, `${job.jobId}.${randomUUID()}.tmp.json`);

    const dataToSave = {
      ...job,
      ...persistentMeta,
      updatedAt: new Date().toISOString()
    };

    await writeFile(tempPath, JSON.stringify(dataToSave, null, 2), 'utf8');
    await rename(tempPath, targetPath);
  }

  public async load(jobId: string): Promise<(LongFormRenderJobV3 & Partial<PersistentCheckpointV3>) | undefined> {
    const targetPath = join(this.storageDir, `${jobId}.json`);
    try {
      const content = await readFile(targetPath, 'utf8');
      const parsed = JSON.parse(content);
      const validatedJob = LongFormRenderJobV3Schema.passthrough().parse(parsed);
      return {
        ...validatedJob,
        ...parsed
      };
    } catch {
      return undefined;
    }
  }
}

// ============================================================================
// CHECKPOINT A: Synthetic Media Fixture Worker (Test-Only, Explicitly Named)
// ============================================================================
/**
 * @internal SyntheticMediaFixtureWorkerV3
 * Explicit test-only worker generating compliant synthetic solid-color MP4 frames.
 * Never invoked from production Web queue routing.
 */
export class SyntheticMediaFixtureWorkerV3 implements ISegmentRenderWorkerV3 {
  public async renderSegment(
    segment: RenderSegmentV3,
    manifest: SegmentManifestV3,
    outputDir: string
  ): Promise<{ outputPath: string }> {
    await mkdir(outputDir, { recursive: true });
    const targetPath = join(outputDir, `${segment.segmentId}.mp4`);
    const tempPath = join(outputDir, `${segment.segmentId}.${randomUUID()}.tmp.mp4`);

    const durationSeconds = framesToSeconds(segment.durationFrames, manifest.fps);

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
      execFile('ffmpeg', ffmpegArgs, { windowsHide: true, timeout: 60_000 }, (err, _stdout, stderr) => {
        if (err) return reject(new Error(`synthetic_segment_render_failed: ${stderr || err.message}`));
        resolvePromise();
      });
    });

    const probe = await probeMediaWithFFprobe(tempPath);
    if (Math.abs(probe.durationSeconds - durationSeconds) > 0.5) {
      await rm(tempPath, { force: true });
      throw new Error(`segment_duration_mismatch: Expected ${durationSeconds}s, produced ${probe.durationSeconds}s`);
    }

    await rename(tempPath, targetPath);
    return { outputPath: targetPath };
  }
}

// ============================================================================
// CHECKPOINT A: Real Remotion Segment Render Worker (Production-Grade)
// ============================================================================
export class SegmentRenderWorkerV3 implements ISegmentRenderWorkerV3 {
  /**
   * Renders a real educational segment using Remotion and approved scene components.
   * Dispatches actual scene types (Algebra, Neural Network, Loss Landscape, Attention, etc.)
   */
  public async renderSegment(
    segment: RenderSegmentV3,
    manifest: SegmentManifestV3,
    outputDir: string,
    context?: SegmentRenderContextV3
  ): Promise<{ outputPath: string }> {
    if (!context) {
      throw new Error(
        'segment_render_context_required: SegmentRenderWorkerV3 requires a valid SegmentRenderContextV3 with approved artifact and scenes'
      );
    }

    // 1. Verify artifact integrity and authenticity
    if (!verifyV3ArtifactIntegrity(context.approvedArtifact)) {
      throw new Error('artifact_tampered: V3 content hash mismatch in segment render context');
    }

    // 2. Validate scene presence
    if (!context.orderedScenes || context.orderedScenes.length === 0) {
      throw new Error(`segment_no_scenes: Segment '${segment.segmentId}' contains no scenes`);
    }

    for (const sceneId of segment.sceneIds) {
      if (!context.orderedScenes.some((s) => s.sceneId === sceneId)) {
        throw new Error(`segment_missing_scene: Scene '${sceneId}' is not found in ordered scenes`);
      }
    }

    await mkdir(outputDir, { recursive: true });
    const targetPath = join(outputDir, `${segment.segmentId}.mp4`);
    const tempPath = join(outputDir, `${segment.segmentId}.${randomUUID()}.tmp.mp4`);
    const propsPath = join(outputDir, `${segment.segmentId}.props.json`);

    const segmentDurationSeconds = framesToSeconds(segment.durationFrames, manifest.fps);
    const segmentStoryboard: EducationalStoryboardV3 = {
      storyboardId: `${context.approvedArtifact.lessonPlan.storyboard!.storyboardId}_${segment.segmentId}`,
      lessonId: context.approvedArtifact.lessonPlan.storyboard!.lessonId,
      scenes: context.orderedScenes,
      totalDurationSeconds: segmentDurationSeconds
    };

    await writeFile(
      propsPath,
      JSON.stringify({
        storyboard: segmentStoryboard,
        subtitlesEnabled: context.subtitlesEnabled ?? true
      }),
      'utf8'
    );

    // 3. Execute Remotion CLI
    const workerDir = resolve(repositoryRoot, 'apps/worker');
    const command = process.execPath;
    const args = [
      resolve(workerDir, 'node_modules/@remotion/cli/remotion-cli.js'),
      'render',
      'src/index.ts',
      'LuminaSceneV3',
      tempPath,
      '--props',
      propsPath,
      '--codec',
      'h264'
    ];
    const chrome = process.env.REMOTION_BROWSER_EXECUTABLE;
    if (chrome) args.push('--browser-executable', chrome);

    await new Promise<void>((resolvePromise, reject) => {
      execFile(
        command,
        args,
        { cwd: workerDir, windowsHide: true, timeout: 5 * 60_000, maxBuffer: 16 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) return reject(new Error(`remotion_segment_render_failed: ${stderr || stdout || err.message}`));
          resolvePromise();
        }
      );
    });

    // 4. Verify output with FFprobe before promotion
    const probe = await probeMediaWithFFprobe(tempPath);
    if (Math.abs(probe.durationSeconds - segmentDurationSeconds) > 0.5) {
      await rm(tempPath, { force: true });
      throw new Error(
        `segment_duration_mismatch: Expected ${segmentDurationSeconds}s, produced ${probe.durationSeconds}s`
      );
    }

    // 5. Atomic promotion
    await rename(tempPath, targetPath);
    return { outputPath: targetPath };
  }
}

// In-memory active locks to prevent simultaneous execution of the same job
const activeJobLocks = new Set<string>();

// ============================================================================
// CHECKPOINT G: Resumable Long-Form Render Coordinator (LongFormRenderCoordinatorV3)
// ============================================================================
export interface CoordinatorRenderOptions {
  manifest: SegmentManifestV3;
  artifact?: ApprovedRenderArtifactV3;
  authorizeArtifact?: (artifact: ApprovedRenderArtifactV3) => boolean | Promise<boolean>;
  jobId?: string;
  outputDir?: string;
  onProgress?: (job: LongFormRenderJobV3) => void;
  simulateFailureAtSegment?: number; // For test testing interruption/resume
  subtitlesSrtContent?: string;
}

export class LongFormRenderCoordinatorV3 {
  private readonly cache: SegmentCacheV3;
  private readonly checkpointRepo: RenderCheckpointRepositoryV3;
  private readonly worker: ISegmentRenderWorkerV3;
  private readonly assembler: LongFormMediaAssemblerV3;

  constructor(options?: {
    cache?: SegmentCacheV3;
    checkpointRepo?: RenderCheckpointRepositoryV3;
    worker?: ISegmentRenderWorkerV3;
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
    const { manifest, artifact, authorizeArtifact, subtitlesSrtContent } = options;
    const jobId = options.jobId ?? `job_longform_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

    // CHECKPOINT G: Prevent concurrent execution of the same job
    if (activeJobLocks.has(jobId)) {
      throw new Error(`job_concurrent_execution: Another worker is currently processing job '${jobId}'`);
    }
    activeJobLocks.add(jobId);

    try {
      // CHECKPOINT 0.F: Enforce approval, integrity, and authorization trust boundaries
      if (!artifact) {
        throw new Error('render_artifact_missing: Approved artifact is required for production render coordinator');
      }
      if (!authorizeArtifact) {
        throw new Error('authorization_callback_missing: Authorization callback is required for production render coordinator');
      }
      if (!verifyV3ArtifactIntegrity(artifact)) {
        throw new Error('artifact_tampered: V3 content hash mismatch');
      }
      const authorized = await authorizeArtifact(artifact);
      if (!authorized) {
        throw new Error('artifact_revoked: V3 artifact is no longer authorized for rendering');
      }
      if (manifest.artifactId !== artifact.artifactId) {
        throw new Error(`manifest_artifact_mismatch: Manifest artifactId '${manifest.artifactId}' does not match approved artifact '${artifact.artifactId}'`);
      }

      const storyboardSceneIds = new Set((artifact.lessonPlan.storyboard?.scenes ?? []).map((s) => s.sceneId));
      for (const seg of manifest.segments) {
        for (const scId of seg.sceneIds) {
          if (!storyboardSceneIds.has(scId)) {
            throw new Error(`manifest_scene_missing: Manifest references unknown scene '${scId}' not found in approved storyboard`);
          }
        }
      }

      const outputDir = options.outputDir ?? resolve(repositoryRoot, 'outputs', jobId);
      await mkdir(outputDir, { recursive: true });

      // Check for existing checkpoint (Resumable Rendering)
      const existing = await this.checkpointRepo.load(jobId);
      let job: LongFormRenderJobV3;
      let completedMap: Record<string, { segmentId: string; outputPath: string; fileSHA256: string; completedAt: string }> = {};

      if (existing) {
        // Assert checkpoint consistency with current manifest & artifact
        if (existing.artifactId !== manifest.artifactId) {
          throw new Error(`checkpoint_artifact_mismatch: Checkpoint artifactId '${existing.artifactId}' does not match '${manifest.artifactId}'`);
        }
        if (existing.manifestId !== manifest.manifestId) {
          throw new Error(`checkpoint_manifest_mismatch: Checkpoint manifestId '${existing.manifestId}' does not match '${manifest.manifestId}'`);
        }
        if (existing.manifestFingerprint && existing.manifestFingerprint !== manifest.contentFingerprint) {
          throw new Error('checkpoint_fingerprint_mismatch: Checkpoint manifest fingerprint does not match current manifest');
        }

        job = {
          jobId: existing.jobId,
          artifactId: existing.artifactId,
          manifestId: existing.manifestId,
          status: 'rendering_segments',
          totalSegments: manifest.segments.length,
          completedSegments: existing.completedSegments ?? 0,
          progress: existing.progress ?? 0,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString()
        };
        completedMap = existing.completedSegmentRecords || {};
      } else {
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
        await this.checkpointRepo.save(job, {
          manifestFingerprint: manifest.contentFingerprint,
          completedSegmentRecords: {}
        });
      }

      options.onProgress?.(job);
      const segmentPaths: string[] = [];

      // Render segments sequentially with cache and resume
      for (let i = 0; i < manifest.segments.length; i++) {
        const segment = manifest.segments[i];
        const cacheKey =
          segment.cacheKey ??
          this.cache.computeCacheKey(segment, manifest.fps, manifest.width, manifest.height);

        // Simulated failure for interruption tests
        if (options.simulateFailureAtSegment !== undefined && i === options.simulateFailureAtSegment) {
          job = {
            ...job,
            status: 'interrupted',
            error: `simulated_render_interruption_at_segment_${i}`,
            updatedAt: new Date().toISOString()
          };
          await this.checkpointRepo.save(job, {
            manifestFingerprint: manifest.contentFingerprint,
            completedSegmentRecords: completedMap
          });
          options.onProgress?.(job);
          throw new Error(`simulated_render_interruption_at_segment_${i}`);
        }

        let segmentOutputPath: string | undefined;
        let reusedCheckpointRecord = false;

        // 1. Check if already completed in checkpoint
        const priorCompleted = completedMap[segment.segmentId];
        if (priorCompleted) {
          // Verify prior file still exists and hash matches
          try {
            const actualHash = await computeFileSha256(priorCompleted.outputPath);
            if (actualHash === priorCompleted.fileSHA256) {
              const probe = await probeMediaWithFFprobe(priorCompleted.outputPath);
              const expectedDuration = framesToSeconds(segment.durationFrames, manifest.fps);
              if (probe.width === manifest.width && probe.height === manifest.height && probe.fps === manifest.fps &&
                  Math.abs(probe.durationSeconds - expectedDuration) <= 0.5) {
                segmentOutputPath = priorCompleted.outputPath;
                segment.status = 'cached';
                reusedCheckpointRecord = true;
              }
            }
          } catch {
            // File missing or unreadable - must re-render
            segmentOutputPath = undefined;
          }
          if (!reusedCheckpointRecord) delete completedMap[segment.segmentId];
        }

        // 2. Check content-addressable cache if not resumed from checkpoint
        if (!segmentOutputPath) {
          const cachedPath = await this.cache.get(cacheKey, segment.inputContentHash);
          if (cachedPath) {
            segment.status = 'cached';
            const segDest = join(outputDir, `${segment.segmentId}.mp4`);
            await copyFile(cachedPath, segDest);
            segmentOutputPath = segDest;
          }
        }

        // 3. Render segment via worker
        if (!segmentOutputPath) {
          segment.status = 'rendering';

          // Build render context if artifact is available
          let renderContext: SegmentRenderContextV3 | undefined;
          if (artifact?.lessonPlan?.storyboard?.scenes) {
            const orderedScenes = segment.sceneIds.map((scId) => {
              const sc = artifact.lessonPlan.storyboard?.scenes.find((s) => s.sceneId === scId);
              if (!sc) throw new Error(`segment_missing_scene: Scene '${scId}' not found in approved storyboard`);
              return sc;
            });

            renderContext = {
              approvedArtifact: artifact,
              manifest,
              segment,
              orderedScenes,
              rendererVersion: '3.1.0',
              fps: manifest.fps,
              width: manifest.width,
              height: manifest.height,
              segmentStartFrame: segment.startFrame,
              segmentDurationFrames: segment.durationFrames,
              subtitlesEnabled: artifact.request.subtitlesEnabled
            };
          }

          const rendered = await this.worker.renderSegment(segment, manifest, outputDir, renderContext);
          await this.cache.set(cacheKey, rendered.outputPath, segment.inputContentHash, {
            fps: manifest.fps,
            width: manifest.width,
            height: manifest.height,
            durationSeconds: framesToSeconds(segment.durationFrames, manifest.fps)
          });
          segment.status = 'validated';
          segmentOutputPath = rendered.outputPath;
        }

        segment.outputPath = segmentOutputPath;
        segmentPaths.push(segmentOutputPath);

        // Record completed segment in checkpoint
        if (!reusedCheckpointRecord) {
          const fileSHA256 = await computeFileSha256(segmentOutputPath);
          completedMap[segment.segmentId] = {
            segmentId: segment.segmentId,
            outputPath: segmentOutputPath,
            fileSHA256,
            completedAt: new Date().toISOString()
          };
        }

        job = {
          ...job,
          status: 'rendering_segments',
          completedSegments: i + 1,
          progress: Math.round(((i + 1) / manifest.segments.length) * 85),
          updatedAt: new Date().toISOString()
        };
        await this.checkpointRepo.save(job, {
          manifestFingerprint: manifest.contentFingerprint,
          completedSegmentRecords: completedMap
        });
        options.onProgress?.(job);
      }

      // Merge media
      job = {
        ...job,
        status: 'merging',
        progress: 90,
        updatedAt: new Date().toISOString()
      };
      await this.checkpointRepo.save(job, {
        manifestFingerprint: manifest.contentFingerprint,
        completedSegmentRecords: completedMap
      });
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
      await this.checkpointRepo.save(job, {
        manifestFingerprint: manifest.contentFingerprint,
        completedSegmentRecords: completedMap
      });
      options.onProgress?.(job);

      return {
        job,
        finalMp4Path: assembled.outputPath,
        mediaReportPath: assembled.reportPath
      };
    } finally {
      activeJobLocks.delete(jobId);
    }
  }
}
