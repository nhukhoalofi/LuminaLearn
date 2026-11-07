import 'server-only';
import {
  HybridRenderRequestSchema,
  assertJobTransition,
  createHybridJobId,
  runHybridPipeline,
  runHybridPipelineV2,
  type HybridRenderRequest,
  type JobState,
  LocalJobRepository
} from '@luminalearn/hybrid-renderer';
import {
  ApprovedRenderArtifactV2Schema,
  LessonRequestV2Schema,
  type ApprovedRenderArtifactV2,
  type LessonRequestV2
} from '@luminalearn/scene-schema';
import { verifyArtifactIntegrity } from '@luminalearn/agent';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { documentStore } from './v2-services';

export interface JobRecord {
  jobId: string;
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
  subtitlesEnabled: boolean;
  failureType?: 'ai' | 'tts' | 'validation' | 'render' | 'interrupted';
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
  authorizeArtifact?: (artifact: ApprovedRenderArtifactV2) => boolean | Promise<boolean>;
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

    if (entry.v2Artifact) {
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

function pump(): void {
  while (store.active < 1 && store.queue.length > 0) {
    const entry = store.queue.shift()!;
    store.active += 1;
    void runEntry(entry).finally(() => { store.active -= 1; pump(); });
  }
}

export function createJob(input: unknown): Omit<JobRecord, 'outputPath'> {
  const request = HybridRenderRequestSchema.parse(input);
  if (request.renderMode === 'live' && !process.env.GEMINI_API_KEY) throw new Error('live_mode_unavailable: GEMINI_API_KEY is not configured');
  if (request.voiceoverMode === 'provided_audio') throw new Error('provided_audio_web_unavailable: use the trusted local CLI with --provided-audio');
  if (request.voiceoverMode === 'google_cloud_tts' && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_TTS_ENABLED !== 'true') throw new Error('tts_unavailable: Google Cloud authentication is not configured');
  if (request.voiceoverMode === 'gemini_tts' && !process.env.GEMINI_API_KEY) throw new Error('tts_api_key_missing: GEMINI_API_KEY is required for Gemini TTS');
  const jobId = createHybridJobId();
  const now = new Date().toISOString();
  const job: JobRecord = { jobId, status: 'queued', progress: 0, message: messageByState.queued, renderMode: request.renderMode, voiceoverMode: request.voiceoverMode, subtitlesEnabled: request.subtitlesEnabled, createdAt: now, updatedAt: now };
  store.jobs.set(jobId, job);
  repository.save(job);
  store.queue.push({ jobId, request });
  pump();
  return publicJob(job);
}

export function createV2Job(input: unknown): Omit<JobRecord, 'outputPath'> {
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
    status: 'queued',
    progress: 0,
    message: messageByState.queued,
    renderMode: v2Request.renderMode,
    voiceoverMode: v2Request.narrationMode,
    subtitlesEnabled: true,
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
  authorizeArtifact?: (artifact: ApprovedRenderArtifactV2) => boolean | Promise<boolean>
): Omit<JobRecord, 'outputPath'> {
  const artifact = ApprovedRenderArtifactV2Schema.parse(input);
  if (!verifyArtifactIntegrity(artifact)) {
    throw new Error('artifact_tampered: Approved render artifact content hash does not match canonical payload');
  }
  if (artifact.renderConfig.renderMode === 'live' && !process.env.GEMINI_API_KEY) {
    throw new Error('live_mode_unavailable: GEMINI_API_KEY is not configured');
  }
  if (artifact.renderConfig.narrationMode === 'gemini_tts' && !process.env.GEMINI_API_KEY) {
    throw new Error('tts_api_key_missing: GEMINI_API_KEY is required for Gemini TTS');
  }
  const jobId = createHybridJobId();
  const now = new Date().toISOString();
  const job: JobRecord = {
    jobId,
    status: 'queued',
    progress: 0,
    message: messageByState.queued,
    renderMode: artifact.renderConfig.renderMode,
    voiceoverMode: artifact.renderConfig.narrationMode,
    subtitlesEnabled: true,
    createdAt: now,
    updatedAt: now
  };
  store.jobs.set(jobId, job);
  repository.save(job);
  store.queue.push({ jobId, v2Artifact: artifact, authorizeArtifact });
  pump();
  return publicJob(job);
}

export function getJob(jobId: string): Omit<JobRecord, 'outputPath'> | undefined {
  const job = store.jobs.get(jobId); return job ? publicJob(job) : undefined;
}

export function getJobOutputPath(jobId: string): string | undefined {
  const job = store.jobs.get(jobId); return job?.status === 'completed' ? job.outputPath : undefined;
}

