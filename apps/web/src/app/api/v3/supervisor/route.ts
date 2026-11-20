import { NextResponse } from 'next/server';
import {
  SupervisorRequestV3Schema,
  AgentStudioSelectionV3Schema,
  resolveAgentStudioSelectionV3,
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
import { formatApiError } from '@/server/error-formatter';

export async function POST(request: Request): Promise<Response> {
  try {
    assertRequestAuthorized(request);
    const ownerId = resolveOwnerId(request);
    const raw = await readBoundedJson<Record<string, unknown>>(request);
    const { confirmExternalApi, agentSelection, ...requestFields } = raw;

    const resolvedSelection = agentSelection === undefined
      ? undefined
      : resolveAgentStudioSelectionV3(AgentStudioSelectionV3Schema.parse(agentSelection));

    const parsed = SupervisorRequestV3Schema.parse({
      ...requestFields,
      ...(resolvedSelection
        ? { topic: resolvedSelection.topic, domain: resolvedSelection.domain }
        : {}),
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
        provider: parsed.agentProvider === 'codex' ? 'openai_codex' : 'gemini',
        operation: 'planning',
        requestId: parsed.requestId,
        isLiveOperation: true
      });
    }

    const supervisor = createSupervisorV3(parsed.generationMode, parsed.agentProvider ?? 'gemini');
    const finalDraft = await supervisor.coordinate({
      ...parsed,
      consentRecord
    });

    return NextResponse.json(finalDraft, { status: 201 });
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    const formatted = formatApiError(error, 'v3_supervisor_coordination_failed', 'supervisor_failed');
    return NextResponse.json(formatted, { status: 400 });
  }
}

