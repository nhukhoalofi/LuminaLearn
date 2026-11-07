import { JOB_ID_PATTERN } from '@luminalearn/hybrid-renderer';
import { getJob } from '@/server/job-store';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }): Promise<Response> {
  const { jobId } = await context.params;
  if (!JOB_ID_PATTERN.test(jobId)) return Response.json({ error: 'invalid_job_id' }, { status: 400 });
  const job = getJob(jobId);
  return job ? Response.json(job) : Response.json({ error: 'job_not_found' }, { status: 404 });
}

