import { NextResponse } from 'next/server';
import { draftManager } from '@/server/v2-services';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  const draft = draftManager.getDraft(lessonId);

  if (!draft) {
    return NextResponse.json(
      { error: 'not_found', message: `Không tìm thấy bản thảo bài học: ${lessonId}` },
      { status: 404 }
    );
  }

  return NextResponse.json(draft);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;
    const body = await req.json();

    const updated = await draftManager.updateDraft(lessonId, {
      title: body.title,
      summary: body.summary,
      learningObjectives: body.learningObjectives,
      mathematicalClaims: body.mathematicalClaims,
      mathSpec: body.mathSpec,
      narrationTexts: body.narrationTexts
    }, body.note);

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'draft_update_failed', message },
      { status: 400 }
    );
  }
}

