import { NextResponse } from 'next/server';
import {
  assertDocumentsOwnedBy,
  draftManager,
  ensureDocumentsLoaded,
  toLessonDraftResponse
} from '@/server/v2-services';
import {
  assertExternalApiConfirmed,
  assertRequestAuthorized,
  readBoundedJson,
  resolveOwnerId,
  SecurityError
} from '@/server/security';

export async function POST(req: Request) {
  try {
    assertRequestAuthorized(req);
    const ownerId = resolveOwnerId(req);
    const body = await readBoundedJson<Record<string, unknown>>(req);
    const requestId = typeof body.requestId === 'string' && body.requestId ? body.requestId : `req_${Date.now()}`;
    const sourceDocumentIds = Array.isArray(body.sourceDocumentIds)
      ? body.sourceDocumentIds.map((id) => String(id))
      : [];

    assertDocumentsOwnedBy(sourceDocumentIds, ownerId);
    await ensureDocumentsLoaded(sourceDocumentIds);

    const renderMode = (body.renderMode === 'live' ? 'live' : 'mock') as 'mock' | 'live';
    const narrationMode = (
      typeof body.narrationMode === 'string' ? body.narrationMode : 'none'
    ) as 'none' | 'provided_audio' | 'google_cloud_tts' | 'gemini_tts';

    assertExternalApiConfirmed({
      renderMode,
      narrationMode: 'none', // Draft creation only calls Gemini text planning/narration when renderMode === 'live'
      confirmExternalApi: body.confirmExternalApi === true,
      headerConfirmed: req.headers.get('x-lumina-confirm-external-api') === 'true'
    });

    const requestPayload = {
      requestId,
      inputMode: (body.inputMode || (sourceDocumentIds.length ? 'source_document' : 'topic_prompt')) as
        | 'topic_prompt'
        | 'source_document',
      topic: typeof body.topic === 'string' && body.topic ? body.topic : 'Bản chất hình học của đạo hàm',
      sourceDocumentIds,
      audience: typeof body.audience === 'string' && body.audience ? body.audience : 'Học sinh phổ thông',
      language: (body.language === 'en' ? 'en' : 'vi') as 'vi' | 'en',
      targetDurationSeconds: typeof body.targetDurationSeconds === 'number' ? body.targetDurationSeconds : 40,
      renderMode,
      narrationMode,
      visualStyleId: (
        body.visualStyleId === 'math_chalkboard' ? 'math_chalkboard' : 'clean_educational_infographic'
      ) as 'math_chalkboard' | 'clean_educational_infographic',
      subtitlesEnabled: body.subtitlesEnabled !== undefined ? Boolean(body.subtitlesEnabled) : true,
      aspectRatio: (
        body.aspectRatio === '16:9' || body.aspectRatio === '1:1' ? body.aspectRatio : '9:16'
      ) as '9:16' | '16:9' | '1:1'
    };

    const draft = await draftManager.createDraft(requestPayload, ownerId);
    if (
      draft.status === 'rejected' ||
      draft.context.stage === 'failed' ||
      draft.context.stage === 'needs_review' ||
      !draft.context.lessonPlan
    ) {
      const code = draft.context.error?.code || 'draft_creation_failed';
      const message = draft.context.error?.message || 'Không thể tạo bản thảo bài học';
      return NextResponse.json(
        { error: code, message, draft: toLessonDraftResponse(draft) },
        { status: 422 }
      );
    }

    return NextResponse.json(toLessonDraftResponse(draft));
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status }
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'draft_creation_failed', message },
      { status: 400 }
    );
  }
}

