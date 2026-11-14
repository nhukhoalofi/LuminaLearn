import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { JOB_ID_PATTERN } from '@luminalearn/hybrid-renderer';
import { getJob, getJobOutputPath } from '@/server/job-store';
import { assertRequestAuthorized, resolveOwnerId, SecurityError } from '@/server/security';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }): Promise<Response> {
  try {
    assertRequestAuthorized(request);
    const callerOwnerId = resolveOwnerId(request);
    const { jobId } = await context.params;
    if (!JOB_ID_PATTERN.test(jobId)) return Response.json({ error: 'invalid_job_id' }, { status: 400 });
    const job = getJob(jobId, callerOwnerId);
    if (job && !job.subtitlesEnabled) {
      return Response.json({ error: 'subtitles_disabled' }, { status: 404 });
    }
    const outputPath = getJobOutputPath(jobId, callerOwnerId);
    if (!outputPath) return Response.json({ error: 'subtitles_not_ready' }, { status: 404 });
    try {
      const bytes = await readFile(resolve(dirname(outputPath), 'subtitles.srt'));
      return new Response(bytes, {
        headers: {
          'Content-Type': 'application/x-subrip; charset=utf-8',
          'Content-Disposition': 'attachment; filename="luminalearn-subtitles-vi.srt"',
          'Cache-Control': 'private, no-store'
        }
      });
    } catch {
      return Response.json({ error: 'subtitles_not_available' }, { status: 404 });
    }
  } catch (error) {
    if (error instanceof SecurityError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return Response.json({ error: 'subtitles_read_failed' }, { status: 400 });
  }
}
