import { JOB_ID_PATTERN } from '@luminalearn/hybrid-renderer';
import { getJob } from '@/server/job-store';
import { assertRequestAuthorized, resolveOwnerId, SecurityError } from '@/server/security';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }): Promise<Response> {
  try {
    assertRequestAuthorized(request);
    const callerOwnerId = resolveOwnerId(request);
    const { jobId } = await context.params;
    if (!JOB_ID_PATTERN.test(jobId)) return Response.json({ error: 'invalid_job_id' }, { status: 400 });
    const job = getJob(jobId, callerOwnerId);
    return job ? Response.json(job) : Response.json({ error: 'job_not_found' }, { status: 404 });
  } catch (error) {
    if (error instanceof SecurityError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return Response.json({ error: 'job_read_failed' }, { status: 400 });
  }
}

