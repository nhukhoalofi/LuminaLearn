import { ZodError } from 'zod';
import { createJob } from '@/server/job-store';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 2048) return Response.json({ error: 'request_too_large' }, { status: 413 });
    return Response.json(createJob(JSON.parse(raw)), { status: 202 });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: 'invalid_request', details: error.issues.map((issue) => issue.message) }, { status: 400 });
    const message = error instanceof Error ? error.message : 'unknown_error';
    return Response.json({ error: message }, { status: /^(live_mode_unavailable|tts_unavailable|tts_api_key_missing)/.test(message) ? 503 : 400 });
  }
}

