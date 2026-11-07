import { NextResponse } from 'next/server';
import { draftManager, ensureDocumentsLoaded, toLessonDraftResponse } from '@/server/v2-services';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const requestId = body.requestId || `req_${Date.now()}`;
    const sourceDocumentIds = Array.isArray(body.sourceDocumentIds) ? body.sourceDocumentIds : [];

    await ensureDocumentsLoaded(sourceDocumentIds);

    const requestPayload = {
      requestId,
      inputMode: body.inputMode || (sourceDocumentIds.length ? 'source_document' : 'topic_prompt'),
      topic: body.topic || 'Bản chất hình học của đạo hàm',
      sourceDocumentIds,
      audience: body.audience || 'Học sinh phổ thông',
      language: body.language || 'vi',
      targetDurationSeconds: body.targetDurationSeconds || 40,
      renderMode: body.renderMode || 'mock',
      narrationMode: body.narrationMode || 'none',
      visualStyleId: body.visualStyleId || 'clean_educational_infographic',
      aspectRatio: body.aspectRatio || '9:16'
    };

    const draft = await draftManager.createDraft(requestPayload);
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
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'draft_creation_failed', message },
      { status: 400 }
    );
  }
}

