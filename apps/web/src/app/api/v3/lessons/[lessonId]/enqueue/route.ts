import { NextResponse } from 'next/server';
import { issueExternalApiConsentV3, type ExternalApiConsentRecordV3 } from '@luminalearn/scene-schema';
import { createV3JobFromArtifact } from '@/server/job-store';
import { draftManagerV3 } from '@/server/v3-services';
import { assertExternalApiConfirmed, assertRequestAuthorized, readBoundedJson, resolveOwnerId, SecurityError } from '@/server/security';

interface RetryEnqueueBody { artifactId: string; contentHash: string; confirmExternalApi?: boolean }

/** Idempotently schedules the exact, still-authorized approval snapshot. */
export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string }> }): Promise<Response> {
  try {
    assertRequestAuthorized(request);
    const ownerId = resolveOwnerId(request);
    const { lessonId } = await params;
    const body = await readBoundedJson<RetryEnqueueBody>(request);
    if (typeof body.artifactId !== 'string' || typeof body.contentHash !== 'string') {
      return NextResponse.json({ error: 'invalid_enqueue_retry' }, { status: 400 });
    }
    const draft = await draftManagerV3.load(lessonId);
    if (!draft) return NextResponse.json({ error: 'draft_not_found' }, { status: 404 });
    if (draft.ownerId !== ownerId) throw new SecurityError(403, 'artifact_unauthorized', 'Draft owner does not match');
    const artifact = draft.approvedArtifact;
    if (draft.status !== 'approved' || !artifact) {
      return NextResponse.json({ error: 'approved_artifact_unavailable' }, { status: 409 });
    }
    if (artifact.artifactId !== body.artifactId || artifact.contentHash !== body.contentHash) {
      return NextResponse.json({ error: 'stale_or_tampered_artifact_reference' }, { status: 409 });
    }

    const headerConfirmed = request.headers.get('x-lumina-confirm-external-api') === 'true';
    const isConfirmed = body.confirmExternalApi === true || headerConfirmed;
    const needsExternalTts =
      artifact.request.narrationMode === 'gemini_tts' ||
      artifact.request.narrationMode === 'google_cloud_tts';

    if (needsExternalTts) {
      assertExternalApiConfirmed({
        narrationMode: artifact.request.narrationMode,
        confirmExternalApi: isConfirmed,
        headerConfirmed
      });
    }

    let consentRecord: ExternalApiConsentRecordV3 | undefined;
    if (needsExternalTts && isConfirmed) {
      consentRecord = issueExternalApiConsentV3({
        ownerId,
        provider: artifact.request.narrationMode === 'gemini_tts' ? 'gemini_tts' : 'google_cloud_tts',
        operation: 'narration',
        draftId: draft.draftId,
        artifactId: artifact.artifactId,
        artifactVersion: artifact.approvedVersion,
        contentHash: artifact.contentHash
      });
    }

    const job = await createV3JobFromArtifact(
      artifact,
      (candidate) => draftManagerV3.isArtifactAuthorized(candidate),
      ownerId,
      consentRecord
    );
    return NextResponse.json({ artifactId: artifact.artifactId, job }, { status: 202 });
  } catch (error) {
    if (error instanceof SecurityError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: 'v3_enqueue_retry_failed', message: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

