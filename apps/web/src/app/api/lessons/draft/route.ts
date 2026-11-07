import { NextResponse } from 'next/server';
import { draftManager } from '@/server/v2-services';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const requestId = body.requestId || `req_${Date.now()}`;

    const requestPayload = {
      requestId,
      inputMode: body.inputMode || (body.sourceDocumentIds?.length ? 'source_document' : 'topic_prompt'),
      topic: body.topic || 'Bản chất hình học của đạo hàm',
      sourceDocumentIds: body.sourceDocumentIds || [],
      audience: body.audience || 'Học sinh phổ thông',
      language: body.language || 'vi',
      targetDurationSeconds: body.targetDurationSeconds || 40,
      renderMode: body.renderMode || 'mock',
      narrationMode: body.narrationMode || 'none',
      visualStyleId: body.visualStyleId || 'clean_educational_infographic',
      aspectRatio: body.aspectRatio || '9:16'
    };

    const draft = await draftManager.createDraft(requestPayload);
    return NextResponse.json(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'draft_creation_failed', message },
      { status: 400 }
    );
  }
}

