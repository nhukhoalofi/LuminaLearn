import { NextResponse } from 'next/server';
import { draftManager } from '@/server/v2-services';
import { createV2JobFromArtifact } from '@/server/job-store';
import {
  assertExternalApiConfirmed,
  assertOwnerMatch,
  assertRequestAuthorized,
  resolveOwnerId,
  SecurityError
} from '@/server/security';
import { readApprovalRequest } from '@/server/approval-request';

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

    // If the caller supplied config updates alongside approval, apply them before approving so the artifact matches
    const hasConfigUpdates =
      body.renderMode !== undefined ||
      body.narrationMode !== undefined ||
      body.visualStyleId !== undefined ||
      body.subtitlesEnabled !== undefined;
    if (hasConfigUpdates) {
      await draftManager.updateDraft(lessonId, {
        renderMode:
          body.renderMode === 'mock' || body.renderMode === 'live' ? body.renderMode : undefined,
        narrationMode:
          body.narrationMode === 'none' ||
          body.narrationMode === 'provided_audio' ||
          body.narrationMode === 'google_cloud_tts' ||
          body.narrationMode === 'gemini_tts'
            ? body.narrationMode
            : undefined,
        visualStyleId:
          body.visualStyleId === 'math_chalkboard' ||
          body.visualStyleId === 'clean_educational_infographic'
            ? body.visualStyleId
            : undefined,
        subtitlesEnabled:
          typeof body.subtitlesEnabled === 'boolean' ? body.subtitlesEnabled : undefined
      });
    }

    const currentDraft = draftManager.getDraft(lessonId)!;
    assertExternalApiConfirmed({
      renderMode: currentDraft.context.request.renderMode,
      narrationMode: currentDraft.context.request.narrationMode,
      confirmExternalApi: body.confirmExternalApi === true,
      headerConfirmed: req.headers.get('x-lumina-confirm-external-api') === 'true'
    });

    const note =
      typeof body.note === 'string' && body.note
        ? body.note
        : 'User approved lesson draft from Web UI';

    const draft = await draftManager.approveDraft(lessonId, note, {
      confirmSemanticReview: body.confirmSemanticReview === true
    });
    if (!draft.approvedArtifact) {
      throw new Error('draft_approval_missing_artifact: Draft was approved but no immutable artifact was generated');
    }

    const job = createV2JobFromArtifact(
      draft.approvedArtifact,
      (artifact) => draftManager.isArtifactCurrentlyApproved(artifact),
      callerOwnerId
    );

    return NextResponse.json({
      success: true,
      draftId: draft.draftId,
      artifactId: draft.approvedArtifact.artifactId,
      status: draft.status,
      renderConfig: draft.approvedArtifact.renderConfig,
      job
    });
  } catch (error) {
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

