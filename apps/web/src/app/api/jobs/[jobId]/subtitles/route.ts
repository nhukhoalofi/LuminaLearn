import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { JOB_ID_PATTERN } from '@luminalearn/hybrid-renderer';
import { getJobOutputPath } from '@/server/job-store';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }): Promise<Response> {
  const { jobId } = await context.params;
  if (!JOB_ID_PATTERN.test(jobId)) return Response.json({ error: 'invalid_job_id' }, { status: 400 });
  const outputPath = getJobOutputPath(jobId);
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
}
