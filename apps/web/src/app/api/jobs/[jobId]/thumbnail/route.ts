import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { JOB_ID_PATTERN } from '@luminalearn/hybrid-renderer';
import { getJobOutputPath } from '@/server/job-store';
import { assertRequestAuthorized, resolveOwnerId, SecurityError } from '@/server/security';

export const runtime = 'nodejs';
const execFileAsync = promisify(execFile);

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }): Promise<Response> {
  try {
    let callerOwnerId: string | undefined;
    try {
      assertRequestAuthorized(request);
      callerOwnerId = resolveOwnerId(request);
    } catch (authError) {
      if (process.env.LUMINA_PUBLIC_DEMO === 'true') {
        callerOwnerId = 'public-demo-user';
      } else {
        throw authError;
      }
    }
    const { jobId } = await context.params;
    if (!JOB_ID_PATTERN.test(jobId)) {
      return Response.json({ error: 'invalid_job_id' }, { status: 400 });
    }

    const outputPath = getJobOutputPath(jobId, callerOwnerId);
    if (!outputPath || !existsSync(outputPath)) {
      return Response.json({ error: 'video_not_ready' }, { status: 404 });
    }

    const jobDir = dirname(outputPath);
    const thumbnailPath = resolve(jobDir, 'thumbnail.png');

    // Nếu chưa có file thumbnail, tự động trích xuất frame đầu tiên (0.5s) bằng FFmpeg
    if (!existsSync(thumbnailPath)) {
      try {
        await execFileAsync('ffmpeg', [
          '-y',
          '-ss', '0.5',
          '-i', outputPath,
          '-vframes', '1',
          '-q:v', '2',
          thumbnailPath
        ]);
      } catch {
        // Fallback trích xuất tại 0.0s nếu video ngắn
        try {
          await execFileAsync('ffmpeg', [
            '-y',
            '-ss', '0.0',
            '-i', outputPath,
            '-vframes', '1',
            '-q:v', '2',
            thumbnailPath
          ]);
        } catch {
          // ignore
        }
      }
    }

    if (existsSync(thumbnailPath)) {
      const bytes = await readFile(thumbnailPath);
      return new Response(bytes, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
        }
      });
    }

    return Response.json({ error: 'thumbnail_generation_failed' }, { status: 500 });
  } catch (error) {
    if (error instanceof SecurityError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return Response.json({ error: 'thumbnail_read_failed' }, { status: 500 });
  }
}

