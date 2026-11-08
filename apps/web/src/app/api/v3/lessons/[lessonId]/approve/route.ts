import { NextResponse } from 'next/server';
import { DraftVersionConflictV3Error } from '@luminalearn/agent';
import { issueExternalApiConsentV3, type ExternalApiConsentRecordV3 } from '@luminalearn/scene-schema';
import { createV3JobFromArtifact } from '@/server/job-store';
import { draftManagerV3 } from '@/server/v3-services';
import { assertExternalApiConfirmed, assertRequestAuthorized, readBoundedJson, resolveOwnerId, SecurityError } from '@/server/security';

export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string }> }): Promise<Response> {
  try {
    assertRequestAuthorized(request);
    const ownerId = resolveOwnerId(request);
    const { lessonId } = await params;
    const body = await readBoundedJson<{ expectedVersion?: number; note?: string; confirmExternalApi?: boolean }>(request);
    if (!Number.isInteger(body.expectedVersion)) return NextResponse.json({ error: 'missing_expected_version' }, { status: 400 });
    const draft = await draftManagerV3.approve(lessonId, ownerId, body.expectedVersion!, body.note);
    if (!draft.approvedArtifact) throw new Error('approved_artifact_missing');

    const headerConfirmed = request.headers.get('x-lumina-confirm-external-api') === 'true';
    const isConfirmed = body.confirmExternalApi === true || headerConfirmed;

    const needsExternalTts =
      draft.approvedArtifact.request.narrationMode === 'gemini_tts' ||
      draft.approvedArtifact.request.narrationMode === 'google_cloud_tts';

    if (needsExternalTts) {
      assertExternalApiConfirmed({
        narrationMode: draft.approvedArtifact.request.narrationMode,
        confirmExternalApi: isConfirmed,
        headerConfirmed
      });
    }

    let consentRecord: ExternalApiConsentRecordV3 | undefined;
    if (needsExternalTts && isConfirmed) {
      consentRecord = issueExternalApiConsentV3({
        ownerId,
        provider: draft.approvedArtifact.request.narrationMode === 'gemini_tts' ? 'gemini_tts' : 'google_cloud_tts',
        operation: 'narration',
        draftId: draft.draftId,
        artifactId: draft.approvedArtifact.artifactId,
        artifactVersion: draft.approvedArtifact.approvedVersion,
        contentHash: draft.approvedArtifact.contentHash
      });
    }

    const job = await createV3JobFromArtifact(
      draft.approvedArtifact,
      (artifact) => draftManagerV3.isArtifactAuthorized(artifact),
      ownerId,
      consentRecord
    );
    return NextResponse.json({ draft, artifactId: draft.approvedArtifact.artifactId, job }, { status: 202 });
  } catch (error) {
    if (error instanceof DraftVersionConflictV3Error) return NextResponse.json({ error: error.code, currentVersion: error.actualVersion }, { status: 409 });
    if (error instanceof SecurityError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: 'v3_approval_failed', message: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

