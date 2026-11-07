import { readFile } from 'node:fs/promises';
import { JOB_ID_PATTERN } from '@luminalearn/hybrid-renderer';
import { getJobOutputPath } from '@/server/job-store';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }): Promise<Response> {
  const { jobId } = await context.params;
  if (!JOB_ID_PATTERN.test(jobId)) return Response.json({ error: 'invalid_job_id' }, { status: 400 });
  const outputPath = getJobOutputPath(jobId);
  if (!outputPath) return Response.json({ error: 'video_not_ready' }, { status: 404 });
  const bytes = await readFile(outputPath);
  const download = new URL(request.url).searchParams.get('download') === '1';
  const baseHeaders = {
    'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes',
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="luminalearn-derivative.mp4"`,
    'Cache-Control': 'private, no-store'
  };
  const range = request.headers.get('range');
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!match) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.byteLength}` } });
    const start = Number(match[1]);
    const end = match[2] ? Math.min(Number(match[2]), bytes.byteLength - 1) : bytes.byteLength - 1;
    if (start > end || start >= bytes.byteLength) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.byteLength}` } });
    const chunk = bytes.subarray(start, end + 1);
    return new Response(chunk, { status: 206, headers: { ...baseHeaders, 'Content-Length': String(chunk.byteLength), 'Content-Range': `bytes ${start}-${end}/${bytes.byteLength}` } });
  }
  return new Response(bytes, { headers: { ...baseHeaders, 'Content-Length': String(bytes.byteLength) } });
}

