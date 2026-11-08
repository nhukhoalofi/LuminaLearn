import { NextResponse } from 'next/server';
import { DraftVersionConflictV3Error } from '@luminalearn/agent';
import { draftManagerV3 } from '@/server/v3-services';
import { assertOwnerMatch, assertRequestAuthorized, readBoundedJson, resolveOwnerId, SecurityError } from '@/server/security';

export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string }> }): Promise<Response> {
  try {
    assertRequestAuthorized(request);
    const ownerId = resolveOwnerId(request);
    const { lessonId } = await params;
    const draft = await draftManagerV3.load(lessonId);
    if (!draft) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    assertOwnerMatch(draft.ownerId, ownerId, `V3 draft '${lessonId}'`);
    return NextResponse.json(draft);
  } catch (error) {
    if (error instanceof SecurityError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: 'v3_draft_read_failed', message: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ lessonId: string }> }): Promise<Response> {
  try {
    assertRequestAuthorized(request);
    const ownerId = resolveOwnerId(request);
    const { lessonId } = await params;
    const body = await readBoundedJson<Record<string, unknown>>(request);
    if (!Number.isInteger(body.expectedVersion)) return NextResponse.json({ error: 'missing_expected_version' }, { status: 400 });
    const draft = await draftManagerV3.update(lessonId, ownerId, Number(body.expectedVersion), {
      title: typeof body.title === 'string' ? body.title : undefined,
      learningObjectives: Array.isArray(body.learningObjectives) ? body.learningObjectives.map(String) : undefined,
      claimStatements: body.claimStatements && typeof body.claimStatements === 'object' ? body.claimStatements as Record<string, string> : undefined,
      narrationTexts: body.narrationTexts && typeof body.narrationTexts === 'object' ? body.narrationTexts as Record<string, string> : undefined,
      subtitleTexts: body.subtitleTexts && typeof body.subtitleTexts === 'object' ? body.subtitleTexts as Record<string, string> : undefined,
      visualPayloads: body.visualPayloads && typeof body.visualPayloads === 'object' ? body.visualPayloads as Record<string, unknown> : undefined
    });
    return NextResponse.json(draft);
  } catch (error) {
    if (error instanceof DraftVersionConflictV3Error) return NextResponse.json({ error: error.code, currentVersion: error.actualVersion }, { status: 409 });
    if (error instanceof SecurityError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: 'v3_draft_update_failed', message: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

