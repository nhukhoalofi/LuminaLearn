import { NextResponse } from 'next/server';
import { draftManager } from '@/server/v2-services';
import { createV2Job } from '@/server/job-store';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;
    const body = await req.json().catch(() => ({}));
    const note = body.note || 'User approved lesson draft from Web UI';

    const draft = await draftManager.approveDraft(lessonId, note);
    const job = createV2Job(draft.context.request);

    return NextResponse.json({
      success: true,
      draftId: draft.draftId,
      status: draft.status,
      job
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'draft_approval_failed', message },
      { status: 400 }
    );
  }
}

