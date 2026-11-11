import { NextResponse } from 'next/server';
import { LessonRequestV3Schema, issueExternalApiConsentV3, type ExternalApiConsentRecordV3 } from '@luminalearn/scene-schema';
import { createPlannerV3, draftManagerV3 } from '@/server/v3-services';
import {
  assertExternalApiConfirmed, assertRequestAuthorized, readBoundedJson,
  resolveOwnerId, SecurityError
} from '@/server/security';
import { formatApiError } from '@/server/error-formatter';

export async function POST(request: Request): Promise<Response> {
  try {
    assertRequestAuthorized(request);
    const ownerId = resolveOwnerId(request);
    const raw = await readBoundedJson<Record<string, unknown>>(request);
    const { confirmExternalApi, ...requestFields } = raw;
    const parsed = LessonRequestV3Schema.parse(requestFields);
    const headerConfirmed = request.headers.get('x-lumina-confirm-external-api') === 'true';
    const isConfirmed = confirmExternalApi === true || headerConfirmed;

    assertExternalApiConfirmed({
      renderMode: parsed.generationMode,
      narrationMode: parsed.narrationMode,
      confirmExternalApi: isConfirmed,
      headerConfirmed
    });

    let consentRecord: ExternalApiConsentRecordV3 | undefined;
    if (isConfirmed && parsed.generationMode === 'live') {
      consentRecord = issueExternalApiConsentV3({
        ownerId,
        provider: 'gemini',
        operation: 'planning',
        requestId: parsed.requestId
      });
    }
    const draft = await draftManagerV3.create(
      parsed,
      ownerId,
      createPlannerV3(parsed.generationMode),
      { consentRecord, confirmExternalApi: isConfirmed }
    );
    return NextResponse.json(draft, { status: 201 });
  } catch (error) {
    if (error instanceof SecurityError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    const formatted = formatApiError(error, 'v3_draft_creation_failed', 'generation_failed');
    const transient = /^gemini_transient_failed\b/.test(formatted.error) || /\b503\b|temporarily unavailable|high demand/i.test(formatted.message);
    return NextResponse.json(formatted, transient ? { status: 503, headers: { 'Retry-After': '5' } } : { status: 400 });
  }
}
export async function GET(request: Request): Promise<Response> {
  try {
    assertRequestAuthorized(request);
    const ownerId = resolveOwnerId(request);
    const drafts = await draftManagerV3.listForOwner(ownerId);
    return NextResponse.json({ drafts });
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'v3_draft_list_failed' }, { status: 500 });
  }
}

