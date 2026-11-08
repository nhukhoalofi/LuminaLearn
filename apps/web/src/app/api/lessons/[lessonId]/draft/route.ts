import { NextResponse } from 'next/server';
import { draftManager, toLessonDraftResponse } from '@/server/v2-services';
import {
  assertOwnerMatch,
  assertRequestAuthorized,
  readBoundedJson,
  resolveOwnerId,
  SecurityError
} from '@/server/security';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    assertRequestAuthorized(req);
    const callerOwnerId = resolveOwnerId(req);
    const { lessonId } = await params;
    const draft = draftManager.getDraft(lessonId);

    if (!draft) {
      return NextResponse.json(
        { error: 'not_found', message: `Không tìm thấy bản thảo bài học: ${lessonId}` },
        { status: 404 }
      );
    }

    assertOwnerMatch(draft.ownerId, callerOwnerId, `draft '${lessonId}'`);
    return NextResponse.json(toLessonDraftResponse(draft));
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status }
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'draft_read_failed', message }, { status: 400 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    assertRequestAuthorized(req);
    const callerOwnerId = resolveOwnerId(req);
    const { lessonId } = await params;
    const existing = draftManager.getDraft(lessonId);
    if (!existing) {
      return NextResponse.json(
        { error: 'not_found', message: `Không tìm thấy bản thảo bài học: ${lessonId}` },
        { status: 404 }
      );
    }
    assertOwnerMatch(existing.ownerId, callerOwnerId, `draft '${lessonId}'`);

    const body = await readBoundedJson<Record<string, unknown>>(req);

    const updated = await draftManager.updateDraft(
      lessonId,
      {
        title: typeof body.title === 'string' ? body.title : undefined,
        summary: typeof body.summary === 'string' ? body.summary : undefined,
        learningObjectives: Array.isArray(body.learningObjectives)
          ? (body.learningObjectives as string[])
          : undefined,
        mathematicalClaims: Array.isArray(body.mathematicalClaims)
          ? (body.mathematicalClaims as never)
          : undefined,
        mathSpec: body.mathSpec as never,
        narrationTexts: body.narrationTexts as never,
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
          typeof body.subtitlesEnabled === 'boolean' ? body.subtitlesEnabled : undefined,
        humanSemanticReviewConfirmed:
          typeof body.humanSemanticReviewConfirmed === 'boolean'
            ? body.humanSemanticReviewConfirmed
            : undefined
      },
      typeof body.note === 'string' ? body.note : undefined
    );

    return NextResponse.json(toLessonDraftResponse(updated));
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status }
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'draft_update_failed', message },
      { status: 400 }
    );
  }
}

