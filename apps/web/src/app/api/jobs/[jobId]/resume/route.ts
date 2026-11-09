import { NextResponse } from 'next/server';
import { JOB_ID_PATTERN } from '@luminalearn/hybrid-renderer';
import { resumeV3Job, getJob } from '@/server/job-store';
import { draftManagerV3 } from '@/server/v3-services';
import { assertRequestAuthorized, resolveOwnerId, SecurityError, readBoundedJson } from '@/server/security';
import type { ApprovedRenderArtifactV3 } from '@luminalearn/scene-schema';

export const runtime = 'nodejs';

interface ResumeRequestBody {
  artifactId?: string;
  contentHash?: string;
  lessonId?: string;
}

/**
 * CHECKPOINT 0.E: Resumes an existing failed or interrupted long-form render job from its persistent checkpoint.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
): Promise<Response> {
  try {
    assertRequestAuthorized(request);
    const ownerId = resolveOwnerId(request);
    const { jobId } = await context.params;

    if (!JOB_ID_PATTERN.test(jobId)) {
      return NextResponse.json({ error: 'invalid_job_id' }, { status: 400 });
    }

    const existingJob = getJob(jobId, ownerId);
    if (!existingJob) {
      return NextResponse.json({ error: 'job_not_found' }, { status: 404 });
    }

    let artifactOverride: ApprovedRenderArtifactV3 | undefined;
    let body: ResumeRequestBody = {};
    try {
      body = await readBoundedJson<ResumeRequestBody>(request);
    } catch {
      // Empty or absent body is acceptable if artifact is cached
    }

    if (body.lessonId) {
      const draft = await draftManagerV3.load(body.lessonId);
      if (draft && draft.approvedArtifact) {
        artifactOverride = draft.approvedArtifact;
      }
    }

    const job = await resumeV3Job(
      jobId,
      ownerId,
      (candidate) => draftManagerV3.isArtifactAuthorized(candidate),
      artifactOverride
    );

    return NextResponse.json({ jobId, job }, { status: 202 });
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'v3_resume_failed', message: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}

