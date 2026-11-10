import 'server-only';
import {
  HybridRenderRequestSchema,
  assertJobTransition,
  createHybridJobId,
  runHybridPipeline,
  runHybridPipelineV2,
  runRenderPipelineV3,
  LongFormRenderCoordinatorV3,
  generateSrtFromStoryboardV3,
  type HybridRenderRequest,
  type JobState,
  LocalJobRepository
} from '@luminalearn/hybrid-renderer';
import {
  ApprovedRenderArtifactV2Schema,
  ApprovedRenderArtifactV3Schema,
  LessonRequestV2Schema,
  isLongFormDuration,
  type ApprovedRenderArtifactV2,
  type ApprovedRenderArtifactV3,
  type LessonRequestV2,
  type ExternalApiConsentRecordV3
} from '@luminalearn/scene-schema';
import { verifyArtifactIntegrity, verifyArtifactIntegrityV3, LongFormSegmentPlannerV3 } from '@luminalearn/agent';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { documentStore } from './v2-services';
import { assertOwnerMatch, getMaxPendingJobs, SecurityError } from './security';

export interface JobRecord {
  jobId: string;
  ownerId?: string;
  status: JobState;
  progress: number;
  message: string;
  renderMode: 'mock' | 'live';
  createdAt: string;
  updatedAt: string;
  error?: string;
  videoUrl?: string;
  outputPath?: string;
  voiceoverMode: 'none' | 'provided_audio' | 'google_cloud_tts' | 'gemini_tts';
  visualStyleId?: 'math_chalkboard' | 'clean_educational_infographic';
  subtitlesEnabled: boolean;
  failureType?: 'ai' | 'tts' | 'validation' | 'render' | 'interrupted';
  artifactId?: string;
  artifactContentHash?: string;
  draftId?: string;
}

const progressByState: Record<JobState, number> = {
  queued: 0, planning: 10, validating: 30, rendering_manim: 45,
  narrating: 62, synthesizing_audio: 70, rendering_remotion: 78,
  completed: 100, failed: 0, interrupted: 0
};

const messageByState: Record<JobState, string> = {
  queued: 'Đang chờ render', planning: 'Đang lập kế hoạch bài học', validating: 'Đang xác minh toán học',
  rendering_manim: 'Đang render trực quan Manim', rendering_remotion: 'Đang tổng hợp video Remotion',
  narrating: 'Đang tạo và rà soát lời dẫn', synthesizing_audio: 'Đang tổng hợp và kiểm tra giọng đọc',
  completed: 'Video đã hoàn tất', failed: 'Tạo video thất bại', interrupted: 'Job bị gián đoạn khi server dừng'
};

interface QueuedJob {
  jobId: string;
  request?: HybridRenderRequest;
  v2Request?: LessonRequestV2;
  v2Artifact?: ApprovedRenderArtifactV2;
  v3Artifact?: ApprovedRenderArtifactV3;
  authorizeArtifact?: (artifact: ApprovedRenderArtifactV2) => boolean | Promise<boolean>;
  authorizeV3Artifact?: (artifact: ApprovedRenderArtifactV3) => boolean | Promise<boolean>;
  consentRecord?: ExternalApiConsentRecordV3;
}
interface Store { jobs: Map<string, JobRecord>; queue: QueuedJob[]; active: number; }

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const repository = new LocalJobRepository<JobRecord>(resolve(repositoryRoot, 'outputs/.jobs'));
const recoveredJobs = repository.loadAndRecover();
const globalStore = globalThis as typeof globalThis & { __luminaJobStore?: Store };
const store: Store = globalStore.__luminaJobStore ?? { jobs: new Map(recoveredJobs.map((job) => [job.jobId, job])), queue: [], active: 0 };
globalStore.__luminaJobStore = store;

function publicJob(job: JobRecord): Omit<JobRecord, 'outputPath'> {
  const { outputPath: _privatePath, ...safe } = job;
  return safe;
}

function transition(jobId: string, next: JobState, details: Partial<JobRecord> = {}): void {
  const current = store.jobs.get(jobId);
  if (!current) throw new Error('Job not found');
  assertJobTransition(current.status, next);
  const updated = {
    ...current, ...details, status: next, progress: progressByState[next],
    message: details.message ?? messageByState[next], updatedAt: new Date().toISOString()
  };
  store.jobs.set(jobId, updated);
  repository.save(updated);
}

function failureType(error: unknown): JobRecord['failureType'] {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes('tts') || message.includes('audio')) return 'tts';
  if (message.includes('gemini') || message.includes('lesson') || message.includes('unsupported_topic')) return 'ai';
  if (message.includes('valid') || message.includes('sympy') || message.includes('claim')) return 'validation';
  return 'render';
}

async function runEntry(entry: QueuedJob): Promise<void> {
  try {
    let result: { outputPath: string };

    if (entry.v3Artifact) {
      if (!entry.authorizeV3Artifact) throw new Error('v3_authorization_callback_missing');

      if (isLongFormDuration(entry.v3Artifact.request.targetDurationSeconds)) {
        // CHECKPOINT 0.C: Reject unsupported narration modes for long-form rendering
        if (entry.v3Artifact.request.narrationMode !== 'none') {
          throw new SecurityError(
            400,
            'unsupported_longform_narration_mode',
            `Long-form rendering (>= 60s) currently only supports narrationMode='none'. Mode '${entry.v3Artifact.request.narrationMode}' is not supported.`
          );
        }

        // CHECKPOINT 0.A: Correct state transitions: queued -> planning -> validating -> rendering_remotion -> completed
        transition(entry.jobId, 'planning', { message: 'Đang lập kế hoạch phân đoạn bài giảng dài' });
        const planner = new LongFormSegmentPlannerV3();
        const manifest = planner.planSegments({
          artifactId: entry.v3Artifact.artifactId,
          storyboard: entry.v3Artifact.lessonPlan.storyboard!,
          targetSegmentDurationSeconds: 30,
          fps: entry.v3Artifact.request.fps,
          width: entry.v3Artifact.request.width,
          height: entry.v3Artifact.request.height
        });

        transition(entry.jobId, 'validating', { message: 'Đang xác minh hash, quyền và Visual DSL V3' });
        if (!verifyArtifactIntegrityV3(entry.v3Artifact)) {
          throw new Error('artifact_tampered: V3 content hash mismatch');
        }
        if (!(await entry.authorizeV3Artifact(entry.v3Artifact))) {
          throw new Error('artifact_revoked: V3 artifact is no longer authorized for rendering');
        }

        // CHECKPOINT 0.B: Generate SubRip (.srt) subtitles automatically from approved storyboard
        let subtitlesSrtContent: string | undefined;
        if (entry.v3Artifact.request.subtitlesEnabled) {
          subtitlesSrtContent = generateSrtFromStoryboardV3(
            entry.v3Artifact.lessonPlan.storyboard!,
            entry.v3Artifact.request.fps
          );
        }

        transition(entry.jobId, 'rendering_remotion', { message: 'Đang render phân đoạn Remotion' });
        const coordinator = new LongFormRenderCoordinatorV3();
        const res = await coordinator.render({
          manifest,
          artifact: entry.v3Artifact,
          authorizeArtifact: entry.authorizeV3Artifact,
          jobId: entry.jobId,
          subtitlesSrtContent,
          onProgress: (renderJob) => {
            const current = store.jobs.get(entry.jobId);
            if (current && current.status !== 'completed' && current.status !== 'failed') {
              const progress = Math.min(
                95,
                Math.round((renderJob.completedSegments / Math.max(1, renderJob.totalSegments)) * 80) + 15
              );
              const updatedJob: JobRecord = {
                ...current,
                progress,
                message: `Đang render phân đoạn ${renderJob.completedSegments}/${renderJob.totalSegments}`,
                updatedAt: new Date().toISOString()
              };
              store.jobs.set(entry.jobId, updatedJob);
              repository.save(updatedJob);
            }
          }
        });
        result = { outputPath: res.finalMp4Path };
      } else {
        transition(entry.jobId, 'planning', { message: 'Đang nạp immutable V3 artifact' });
        transition(entry.jobId, 'validating', { message: 'Đang xác minh hash, quyền và Visual DSL V3' });
        result = await runRenderPipelineV3(entry.v3Artifact, {
          jobId: entry.jobId,
          authorizeArtifact: entry.authorizeV3Artifact,
          consentRecord: entry.consentRecord,
          onStage: (stage) => transition(entry.jobId, stage === 'merging_media' ? 'rendering_remotion' : stage)
        });
      }
    } else if (entry.v2Artifact) {
      if (entry.authorizeArtifact && !(await entry.authorizeArtifact(entry.v2Artifact))) {
        throw new Error('artifact_revoked: Approved artifact is no longer authorized for rendering');
      }
      result = await runHybridPipelineV2(entry.v2Artifact, {
        jobId: entry.jobId,
        documentStore,
        authorizeArtifact: entry.authorizeArtifact,
        onStage: (stage) => {
          if (stage !== 'completed') transition(entry.jobId, stage);
        }
      });
    } else if (entry.v2Request) {
      result = await runHybridPipelineV2(entry.v2Request, {
        jobId: entry.jobId,
        documentStore,
        onStage: (stage) => {
          if (stage !== 'completed') transition(entry.jobId, stage);
        }
      });
    } else if (entry.request) {
      const isRiemann = /tích phân|tich phan|riemann|integral/i.test(entry.request.topic);
      if (isRiemann) {
        result = await runHybridPipelineV2(
          {
            requestId: `req_${entry.jobId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
            inputMode: 'topic_prompt',
            topic: entry.request.topic,
            audience: 'Học sinh phổ thông',
            language: 'vi',
            targetDurationSeconds: 40,
            renderMode: entry.request.renderMode,
            narrationMode: entry.request.voiceoverMode,
            aspectRatio: '9:16',
            sourceDocumentIds: []
          },
          {
            jobId: entry.jobId,
            documentStore,
            onStage: (stage) => {
              if (stage !== 'completed') transition(entry.jobId, stage);
            }
          }
        );
      } else {
        result = await runHybridPipeline(entry.request, {
          jobId: entry.jobId,
          onStage: (stage) => {
            if (stage !== 'completed') transition(entry.jobId, stage);
          }
        });
      }
    } else {
      throw new Error('invalid_queue_entry: neither request nor v2Request provided');
    }

    transition(entry.jobId, 'completed', { outputPath: result.outputPath, videoUrl: `/api/jobs/${entry.jobId}/video` });
  } catch (error) {
    const current = store.jobs.get(entry.jobId);
    if (current && current.status !== 'completed' && current.status !== 'failed') {
      transition(entry.jobId, 'failed', {
        error: error instanceof Error ? error.message : String(error),
        failureType: failureType(error)
      });
    }
  }
}

// Checkpoint F & G: Atomic enqueue mutex per artifact for safe concurrency, idempotency, and leak-free cleanup
const artifactEnqueueLocks = new Map<string, Promise<unknown>>();
const artifactStore = new Map<string, ApprovedRenderArtifactV3>();

export function getArtifactEnqueueLockCount(): number {
  return artifactEnqueueLocks.size;
}

export async function withArtifactEnqueueLock<T>(artifactId: string, action: () => Promise<T>): Promise<T> {
  const previousLock = artifactEnqueueLocks.get(artifactId) ?? Promise.resolve();
  let release: () => void;
  const operationLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  const nextChain = previousLock
    .catch(() => undefined)
    .then(() => operationLock);

  artifactEnqueueLocks.set(artifactId, nextChain);

  try {
    await previousLock.catch(() => undefined);
    return await action();
  } finally {
    release!();
    if (artifactEnqueueLocks.get(artifactId) === nextChain) {
      artifactEnqueueLocks.delete(artifactId);
    }
  }
}

export async function createV3JobFromArtifact(
  input: unknown,
  authorizeArtifact: (artifact: ApprovedRenderArtifactV3) => boolean | Promise<boolean>,
  ownerId: string,
  consentRecord?: ExternalApiConsentRecordV3
): Promise<Omit<JobRecord, 'outputPath'>> {
  const artifact = ApprovedRenderArtifactV3Schema.parse(input);

  // CHECKPOINT 0.C: Explicitly reject unsupported long-form narration modes prior to enqueue
  if (isLongFormDuration(artifact.request.targetDurationSeconds) && artifact.request.narrationMode !== 'none') {
    throw new SecurityError(
      400,
      'unsupported_longform_narration_mode',
      `Long-form rendering (>= 60s) currently only supports narrationMode='none'. Voiceover mode '${artifact.request.narrationMode}' is not supported.`
    );
  }

  if (!verifyArtifactIntegrityV3(artifact)) throw new Error('artifact_tampered: V3 content hash mismatch');
  if (artifact.ownerId !== ownerId || !(await authorizeArtifact(artifact))) {
    throw new SecurityError(403, 'artifact_unauthorized', 'V3 artifact is not authorized for scheduling');
  }

  artifactStore.set(artifact.artifactId, artifact);

  return withArtifactEnqueueLock(artifact.artifactId, async () => {
    // 1. Check existing job within atomic lock
    const existing = Array.from(store.jobs.values()).find((job) =>
      job.artifactId === artifact.artifactId && job.ownerId === ownerId &&
      job.status !== 'failed' && job.status !== 'interrupted');
    if (existing) return publicJob(existing);

    // 2. Assert queue capacity before creating/persisting
    assertQueueCapacity();

    // 3. Create, persist, and queue
    const jobId = createHybridJobId();
    const now = new Date().toISOString();
    const job: JobRecord = {
      jobId,
      ownerId,
      status: 'queued',
      progress: 0,
      message: messageByState.queued,
      renderMode: artifact.request.generationMode,
      voiceoverMode: artifact.request.narrationMode,
      visualStyleId: 'clean_educational_infographic',
      subtitlesEnabled: artifact.request.subtitlesEnabled,
      artifactId: artifact.artifactId,
      artifactContentHash: artifact.contentHash,
      draftId: artifact.draftId,
      createdAt: now,
      updatedAt: now
    };
    store.jobs.set(jobId, job);
    repository.save(job);
    store.queue.push({
      jobId,
      v3Artifact: artifact,
      authorizeV3Artifact: authorizeArtifact,
      consentRecord
    });
    pump();
    return publicJob(job);
  });
}

/**
 * CHECKPOINT 0.E: Resumes an existing failed or interrupted V3 job from its persistent checkpoint.
 * Preserves the exact jobId so LongFormRenderCoordinator loads prior completed segments without restarting.
 */
export async function resumeV3Job(
  jobId: string,
  ownerId: string,
  authorizeArtifact: (artifact: ApprovedRenderArtifactV3) => boolean | Promise<boolean>,
  artifactOverride: ApprovedRenderArtifactV3,
  expected: { artifactId: string; contentHash: string }
): Promise<Omit<JobRecord, 'outputPath'>> {
  const job = store.jobs.get(jobId);
  if (!job) throw new SecurityError(404, 'job_not_found', `Job '${jobId}' not found`);
  if (job.ownerId && job.ownerId !== ownerId) {
    throw new SecurityError(403, 'job_unauthorized', 'Cannot resume job owned by another teacher');
  }
  if (job.status !== 'failed' && job.status !== 'interrupted') {
    throw new SecurityError(
      409,
      'job_not_resumable',
      `Job in status '${job.status}' cannot be resumed (must be failed or interrupted)`
    );
  }

  const artifactId = job.artifactId;
  if (!artifactId) {
    throw new Error('job_missing_artifact_id: Cannot resume job without associated artifactId');
  }

  if (expected.artifactId !== artifactId || expected.contentHash !== job.artifactContentHash) {
    throw new SecurityError(409, 'resume_artifact_mismatch', 'Resume identifiers do not match the original job');
  }
  const artifact = artifactOverride;
  if (artifact.artifactId !== artifactId || artifact.contentHash !== expected.contentHash || artifact.draftId !== job.draftId) {
    throw new SecurityError(409, 'resume_artifact_mismatch', 'Persisted approved artifact does not match the original job');
  }

  if (!verifyArtifactIntegrityV3(artifact)) {
    throw new Error('artifact_tampered: V3 content hash mismatch');
  }
  if (!(await authorizeArtifact(artifact))) {
    throw new SecurityError(403, 'artifact_unauthorized', 'Artifact is no longer authorized for rendering');
  }

  return withArtifactEnqueueLock(artifactId, async () => {
    const latest = store.jobs.get(jobId);
    if (!latest || (latest.status !== 'failed' && latest.status !== 'interrupted')) {
      throw new SecurityError(409, 'job_not_resumable', 'Job was already resumed or is no longer resumable');
    }
    assertQueueCapacity();
    const resumedJob: JobRecord = {
      ...latest,
      status: 'queued',
      progress: job.progress || 0,
      message: 'Đang xếp hàng tiếp tục kết xuất từ Checkpoint',
      error: undefined,
      failureType: undefined,
      updatedAt: new Date().toISOString()
    };

    store.jobs.set(jobId, resumedJob);
    repository.save(resumedJob);

    store.queue.push({
      jobId,
      v3Artifact: artifact,
      authorizeV3Artifact: authorizeArtifact
    });
    pump();
    return publicJob(resumedJob);
  });
}

function pump(): void {
  while (store.active < 1 && store.queue.length > 0) {
    const entry = store.queue.shift()!;
    store.active += 1;
    void runEntry(entry).finally(() => { store.active -= 1; pump(); });
  }
}

function assertQueueCapacity(): void {
  const maxPending = getMaxPendingJobs();
  if (store.active + store.queue.length >= maxPending) {
    throw new SecurityError(
      429,
      'queue_full',
      `Render queue is full (${store.active + store.queue.length}/${maxPending} active or pending jobs). Please wait for current jobs to finish.`
    );
  }
}

export function createJob(input: unknown, ownerId = 'local-default'): Omit<JobRecord, 'outputPath'> {
  assertQueueCapacity();
  const request = HybridRenderRequestSchema.parse(input);
  if (request.renderMode === 'live' && !process.env.GEMINI_API_KEY) throw new Error('live_mode_unavailable: GEMINI_API_KEY is not configured');
  if (request.voiceoverMode === 'provided_audio') throw new Error('provided_audio_web_unavailable: use the trusted local CLI with --provided-audio');
  if (request.voiceoverMode === 'google_cloud_tts' && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_TTS_ENABLED !== 'true') throw new Error('tts_unavailable: Google Cloud authentication is not configured');
  if (request.voiceoverMode === 'gemini_tts' && !process.env.GEMINI_API_KEY) throw new Error('tts_api_key_missing: GEMINI_API_KEY is required for Gemini TTS');
  const jobId = createHybridJobId();
  const now = new Date().toISOString();
  const job: JobRecord = { jobId, ownerId, status: 'queued', progress: 0, message: messageByState.queued, renderMode: request.renderMode, voiceoverMode: request.voiceoverMode, subtitlesEnabled: request.subtitlesEnabled, createdAt: now, updatedAt: now };
  store.jobs.set(jobId, job);
  repository.save(job);
  store.queue.push({ jobId, request });
  pump();
  return publicJob(job);
}

export function createV2Job(input: unknown, ownerId = 'local-default'): Omit<JobRecord, 'outputPath'> {
  assertQueueCapacity();
  const v2Request = LessonRequestV2Schema.parse(input);
  if (v2Request.renderMode === 'live' && !process.env.GEMINI_API_KEY) {
    throw new Error('live_mode_unavailable: GEMINI_API_KEY is not configured');
  }
  if (v2Request.narrationMode === 'gemini_tts' && !process.env.GEMINI_API_KEY) {
    throw new Error('tts_api_key_missing: GEMINI_API_KEY is required for Gemini TTS');
  }
  const jobId = createHybridJobId();
  const now = new Date().toISOString();
  const job: JobRecord = {
    jobId,
    ownerId,
    status: 'queued',
    progress: 0,
    message: messageByState.queued,
    renderMode: v2Request.renderMode,
    voiceoverMode: v2Request.narrationMode,
    visualStyleId: v2Request.visualStyleId ?? 'clean_educational_infographic',
    subtitlesEnabled: v2Request.subtitlesEnabled ?? true,
    createdAt: now,
    updatedAt: now
  };
  store.jobs.set(jobId, job);
  repository.save(job);
  store.queue.push({ jobId, v2Request });
  pump();
  return publicJob(job);
}

export function createV2JobFromArtifact(
  input: unknown,
  authorizeArtifact?: (artifact: ApprovedRenderArtifactV2) => boolean | Promise<boolean>,
  ownerId = 'local-default'
): Omit<JobRecord, 'outputPath'> {
  const artifact = ApprovedRenderArtifactV2Schema.parse(input);
  if (!verifyArtifactIntegrity(artifact)) {
    throw new Error('artifact_tampered: Approved render artifact content hash does not match canonical payload');
  }
  if (authorizeArtifact) {
    const isAuthorized = authorizeArtifact(artifact);
    if (isAuthorized === false) {
      throw new SecurityError(403, 'artifact_unauthorized', 'Approved render artifact is not authorized for scheduling');
    }
  }
  if (artifact.renderConfig.renderMode === 'live' && !process.env.GEMINI_API_KEY) {
    throw new Error('live_mode_unavailable: GEMINI_API_KEY is not configured');
  }
  if (artifact.renderConfig.narrationMode === 'gemini_tts' && !process.env.GEMINI_API_KEY) {
    throw new Error('tts_api_key_missing: GEMINI_API_KEY is required for Gemini TTS');
  }
  const existing = Array.from(store.jobs.values()).find((job) =>
    job.artifactId === artifact.artifactId &&
    job.ownerId === ownerId &&
    job.status !== 'failed' &&
    job.status !== 'interrupted'
  );
  if (existing) return publicJob(existing);
  assertQueueCapacity();
  const jobId = createHybridJobId();
  const now = new Date().toISOString();
  const job: JobRecord = {
    jobId,
    ownerId,
    status: 'queued',
    progress: 0,
    message: messageByState.queued,
    renderMode: artifact.renderConfig.renderMode,
    voiceoverMode: artifact.renderConfig.narrationMode,
    visualStyleId: artifact.renderConfig.visualStyleId ?? 'clean_educational_infographic',
    subtitlesEnabled: artifact.renderConfig.subtitlesEnabled ?? true,
    artifactId: artifact.artifactId,
    createdAt: now,
    updatedAt: now
  };
  store.jobs.set(jobId, job);
  repository.save(job);
  store.queue.push({ jobId, v2Artifact: artifact, authorizeArtifact });
  pump();
  return publicJob(job);
}

export function getQueueStatus(): { active: number; queueLength: number; maxPending: number; isFull: boolean } {
  const maxPending = getMaxPendingJobs();
  return {
    active: store.active,
    queueLength: store.queue.length,
    maxPending,
    isFull: store.active + store.queue.length >= maxPending
  };
}

export function getJob(jobId: string, callerOwnerId?: string): Omit<JobRecord, 'outputPath'> | undefined {
  const job = store.jobs.get(jobId);
  if (!job) return undefined;
  if (callerOwnerId) {
    assertOwnerMatch(job.ownerId, callerOwnerId, `job '${jobId}'`);
  }
  return publicJob(job);
}

export function getJobOutputPath(jobId: string, callerOwnerId?: string): string | undefined {
  const job = store.jobs.get(jobId);
  if (!job) return undefined;
  if (callerOwnerId) {
    assertOwnerMatch(job.ownerId, callerOwnerId, `job '${jobId}'`);
  }
  return job.status === 'completed' ? job.outputPath : undefined;
}

export function listJobsForOwner(ownerId: string): Array<Omit<JobRecord, 'outputPath'>> {
  return Array.from(store.jobs.values())
    .filter((job) => job.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(publicJob);
}

