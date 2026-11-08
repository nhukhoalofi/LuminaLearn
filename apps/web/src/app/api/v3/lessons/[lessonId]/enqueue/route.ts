import { NextResponse } from 'next/server';
import { createV3JobFromArtifact } from '@/server/job-store';
import { draftManagerV3 } from '@/server/v3-services';
import { assertRequestAuthorized, readBoundedJson, resolveOwnerId, SecurityError } from '@/server/security';

interface RetryEnqueueBody { artifactId: string; contentHash: string }

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
    const job = await createV3JobFromArtifact(artifact, (candidate) => draftManagerV3.isArtifactAuthorized(candidate), ownerId);
    return NextResponse.json({ artifactId: artifact.artifactId, job }, { status: 202 });
  } catch (error) {
    if (error instanceof SecurityError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: 'v3_enqueue_retry_failed', message: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

