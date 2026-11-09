import { NextResponse } from 'next/server';
import {
  SupervisorRequestV3Schema,
  issueExternalApiConsentV3,
  type ExternalApiConsentRecordV3
} from '@luminalearn/scene-schema';
import { createSupervisorV3, draftManagerV3 } from '@/server/v3-services';
import {
  assertExternalApiConfirmed,
  assertRequestAuthorized,
  readBoundedJson,
  resolveOwnerId,
  SecurityError
} from '@/server/security';

export async function POST(request: Request): Promise<Response> {
  try {
    assertRequestAuthorized(request);
    const ownerId = resolveOwnerId(request);
    const raw = await readBoundedJson<Record<string, unknown>>(request);
    const { confirmExternalApi, ...requestFields } = raw;

    const parsed = SupervisorRequestV3Schema.parse({
      ...requestFields,
      ownerId
    });

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
        requestId: parsed.requestId,
        isLiveOperation: true
      });
    }

    const supervisor = createSupervisorV3(parsed.generationMode);
    const finalDraft = await supervisor.coordinate({
      ...parsed,
      consentRecord
    });

    return NextResponse.json(finalDraft, { status: 201 });
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    const code = typeof (error as { code?: unknown })?.code === 'string'
      ? String((error as { code: string }).code)
      : 'v3_supervisor_coordination_failed';
    return NextResponse.json(
      {
        error: code,
        provenance: 'supervisor_failed',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 400 }
    );
  }
}

