import { NextResponse } from 'next/server';
import { LessonRequestV3Schema } from '@luminalearn/scene-schema';
import { createPlannerV3, draftManagerV3 } from '@/server/v3-services';
import {
  assertExternalApiConfirmed, assertRequestAuthorized, readBoundedJson,
  resolveOwnerId, SecurityError
} from '@/server/security';

export async function POST(request: Request): Promise<Response> {
  try {
    assertRequestAuthorized(request);
    const ownerId = resolveOwnerId(request);
    const raw = await readBoundedJson<Record<string, unknown>>(request);
    const { confirmExternalApi, ...requestFields } = raw;
    const parsed = LessonRequestV3Schema.parse(requestFields);
    assertExternalApiConfirmed({
      renderMode: parsed.generationMode,
      narrationMode: 'none',
      confirmExternalApi: confirmExternalApi === true,
      headerConfirmed: request.headers.get('x-lumina-confirm-external-api') === 'true'
    });
    const draft = await draftManagerV3.create(parsed, ownerId, createPlannerV3(parsed.generationMode));
    return NextResponse.json(draft, { status: 201 });
  } catch (error) {
    if (error instanceof SecurityError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    const code = typeof (error as { code?: unknown })?.code === 'string' ? String((error as { code: string }).code) : 'v3_draft_creation_failed';
    return NextResponse.json({ error: code, provenance: 'generation_failed', message: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

