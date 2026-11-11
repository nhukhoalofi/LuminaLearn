import { NextResponse } from 'next/server';
import { JOB_ID_PATTERN } from '@luminalearn/hybrid-renderer';
import { resumeV3Job, getJob } from '@/server/job-store';
import { draftManagerV3 } from '@/server/v3-services';
import { assertExternalApiConfirmed, assertRequestAuthorized, resolveOwnerId, SecurityError, readBoundedJson } from '@/server/security';
import {
  issueExternalApiConsentV3,
  type ApprovedRenderArtifactV3,
  type ExternalApiConsentRecordV3
} from '@luminalearn/scene-schema';
import { z } from 'zod';

export const runtime = 'nodejs';

const ResumeRequestSchema = z.object({
  artifactId: z.string().regex(/^artifact_v3_[a-f0-9]{32}$/),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  confirmExternalApi: z.boolean().optional()
}).strict();

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

    const body = ResumeRequestSchema.parse(await readBoundedJson(request));
    if (!existingJob.draftId) return NextResponse.json({ error: 'job_missing_draft_id' }, { status: 409 });
    const draft = await draftManagerV3.load(existingJob.draftId);
    const artifactOverride: ApprovedRenderArtifactV3 | undefined = draft?.approvedArtifact;
    if (!artifactOverride) return NextResponse.json({ error: 'approved_artifact_unavailable' }, { status: 409 });

    const headerConfirmed = request.headers.get('x-lumina-confirm-external-api') === 'true';
    const isConfirmed = body.confirmExternalApi === true || headerConfirmed;
    const needsExternalTts =
      artifactOverride.request.narrationMode === 'gemini_tts' ||
      artifactOverride.request.narrationMode === 'google_cloud_tts';
    if (needsExternalTts) {
      assertExternalApiConfirmed({
        narrationMode: artifactOverride.request.narrationMode,
        confirmExternalApi: isConfirmed,
        headerConfirmed
      });
    }

    let consentRecord: ExternalApiConsentRecordV3 | undefined;
    if (needsExternalTts && isConfirmed) {
      consentRecord = issueExternalApiConsentV3({
        ownerId,
        provider: artifactOverride.request.narrationMode === 'gemini_tts' ? 'gemini_tts' : 'google_cloud_tts',
        operation: 'narration',
        draftId: artifactOverride.draftId,
        artifactId: artifactOverride.artifactId,
        artifactVersion: artifactOverride.approvedVersion,
        contentHash: artifactOverride.contentHash
      });
    }

    const job = await resumeV3Job(
      jobId,
      ownerId,
      (candidate) => draftManagerV3.isArtifactAuthorized(candidate),
      artifactOverride,
      { artifactId: body.artifactId, contentHash: body.contentHash },
      consentRecord
    );

    return NextResponse.json({ jobId, job }, { status: 202 });
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'invalid_resume_request' }, { status: 400 });
    return NextResponse.json(
      { error: 'v3_resume_failed', message: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}

