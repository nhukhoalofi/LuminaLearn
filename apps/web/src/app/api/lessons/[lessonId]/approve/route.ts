import { NextResponse } from 'next/server';
import { DraftApprovalConflictError, DraftVersionConflictError } from '@luminalearn/agent';
import { draftManager } from '@/server/v2-services';
import { createV2JobFromArtifact, type JobRecord } from '@/server/job-store';
import {
  assertOwnerMatch,
  assertRequestAuthorized,
  resolveOwnerId,
  SecurityError
} from '@/server/security';
import { assertApprovalExternalApiConsent, readApprovalRequest } from '@/server/approval-request';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    assertRequestAuthorized(req);
    const callerOwnerId = resolveOwnerId(req);
    const { lessonId } = await params;
    const body = await readApprovalRequest(req);

    const existing = draftManager.getDraft(lessonId);
    if (!existing) {
      return NextResponse.json(
        { error: 'not_found', message: `Không tìm thấy bản thảo bài học: ${lessonId}` },
        { status: 404 }
      );
    }
    assertOwnerMatch(existing.ownerId, callerOwnerId, `draft '${lessonId}'`);

    const note =
      typeof body.note === 'string' && body.note
        ? body.note
        : 'User approved lesson draft from Web UI';

    // Consent validation is executed strictly inside the draft mutation lock
    // against the latest authoritative draft state (eliminates TOCTOU races).
    const draft = await draftManager.approveDraftWithUpdates(
      lessonId,
      {
        renderMode: body.renderMode,
        narrationMode: body.narrationMode,
        visualStyleId: body.visualStyleId,
        subtitlesEnabled: body.subtitlesEnabled
      },
      note,
      {
        confirmSemanticReview: body.confirmSemanticReview === true,
        expectedVersion: body.expectedVersion,
        validateConsent: (draftToApprove) => {
          assertApprovalExternalApiConsent(
            {
              renderMode: draftToApprove.context.request.renderMode,
              narrationMode: draftToApprove.context.request.narrationMode
            },
            body,
            req.headers.get('x-lumina-confirm-external-api') === 'true'
          );
        }
      }
    );
    if (!draft.approvedArtifact) {
      throw new Error('draft_approval_missing_artifact: Draft was approved but no immutable artifact was generated');
    }

    let job: Omit<JobRecord, 'outputPath'> | undefined;
    let enqueueError: { code: string; message: string; status: number } | undefined;
    try {
      job = createV2JobFromArtifact(
        draft.approvedArtifact,
        (artifact) => draftManager.isArtifactCurrentlyApproved(artifact),
        callerOwnerId
      );
    } catch (enqueueErr) {
      const status = enqueueErr instanceof SecurityError ? enqueueErr.status : 400;
      const code = enqueueErr instanceof SecurityError ? enqueueErr.code : 'job_enqueue_failed';
      const message = enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr);
      enqueueError = { code, message, status };
    }

    if (enqueueError) {
      return NextResponse.json(
        {
          success: false,
          error: enqueueError.code,
          message: enqueueError.message,
          draftId: draft.draftId,
          artifactId: draft.approvedArtifact.artifactId,
          status: draft.status,
          approved: true,
          currentVersion: draft.version,
          renderConfig: draft.approvedArtifact.renderConfig,
          enqueueFailed: true
        },
        { status: enqueueError.status }
      );
    }

    return NextResponse.json({
      success: true,
      draftId: draft.draftId,
      artifactId: draft.approvedArtifact.artifactId,
      status: draft.status,
      renderConfig: draft.approvedArtifact.renderConfig,
      job
    });
  } catch (error) {
    if (error instanceof DraftVersionConflictError) {
      return NextResponse.json(
        { error: error.code, message: error.message, currentVersion: error.actualVersion },
        { status: 409 }
      );
    }
    if (error instanceof DraftApprovalConflictError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 409 }
      );
    }
    if (error instanceof SecurityError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status }
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'draft_approval_failed', message },
      { status: 400 }
    );
  }
}

