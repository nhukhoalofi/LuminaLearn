import { ZodError } from 'zod';
import { createJob } from '@/server/job-store';
import {
  assertExternalApiConfirmed,
  assertRequestAuthorized,
  MAX_JOB_REQUEST_BYTES,
  readBoundedJson,
  resolveOwnerId,
  SecurityError
} from '@/server/security';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    assertRequestAuthorized(request);
    const ownerId = resolveOwnerId(request);
    const body = await readBoundedJson<Record<string, unknown>>(request, MAX_JOB_REQUEST_BYTES);
    assertExternalApiConfirmed({
      renderMode: typeof body.renderMode === 'string' ? body.renderMode : undefined,
      narrationMode: typeof body.voiceoverMode === 'string' ? body.voiceoverMode : undefined,
      confirmExternalApi: body.confirmExternalApi === true,
      headerConfirmed: request.headers.get('x-lumina-confirm-external-api') === 'true'
    });
    const { confirmExternalApi: _confirm, ...jobInput } = body;
    return Response.json(createJob(jobInput, ownerId), { status: 202 });
  } catch (error) {
    if (error instanceof SecurityError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) return Response.json({ error: 'invalid_request', details: error.issues.map((issue) => issue.message) }, { status: 400 });
    const message = error instanceof Error ? error.message : 'unknown_error';
    return Response.json({ error: message }, { status: /^(live_mode_unavailable|tts_unavailable|tts_api_key_missing)/.test(message) ? 503 : 400 });
  }
}

