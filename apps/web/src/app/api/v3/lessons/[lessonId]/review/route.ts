import { NextResponse } from 'next/server';
import { DraftVersionConflictV3Error } from '@luminalearn/agent';
import { draftManagerV3 } from '@/server/v3-services';
import { assertRequestAuthorized, readBoundedJson, resolveOwnerId, SecurityError } from '@/server/security';

export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string }> }): Promise<Response> {
  try {
    assertRequestAuthorized(request);
    const ownerId = resolveOwnerId(request);
    const { lessonId } = await params;
    const body = await readBoundedJson<{ expectedVersion?: number; semanticReviewConfirmed?: boolean }>(request);
    if (!Number.isInteger(body.expectedVersion) || body.semanticReviewConfirmed !== true) {
      return NextResponse.json({ error: 'semantic_review_confirmation_required' }, { status: 400 });
    }
    return NextResponse.json(await draftManagerV3.confirmSemanticReview(lessonId, ownerId, body.expectedVersion!));
  } catch (error) {
    if (error instanceof DraftVersionConflictV3Error) return NextResponse.json({ error: error.code, currentVersion: error.actualVersion }, { status: 409 });
    if (error instanceof SecurityError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: 'v3_review_failed', message: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

