import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { EducationalSceneV3Schema } from '@luminalearn/scene-schema';
import { draftManagerV3 } from '@/server/v3-services';
import { acquirePreviewPermit, previewCacheKey, PreviewLimitError } from '@/server/preview-guard';
import { assertRequestAuthorized, readBoundedJson, resolveOwnerId, SecurityError } from '@/server/security';

export const runtime = 'nodejs';
const PreviewRequestSchema = z.object({
  draftId: z.string().regex(/^draft_[a-zA-Z0-9_-]{1,120}$/),
  draftVersion: z.number().int().positive(),
  sceneId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  frame: z.number().finite().int().nonnegative().max(24 * 120),
  subtitlesEnabled: z.boolean().default(true)
}).strict();
const MAX_PREVIEW_BODY_BYTES = 8 * 1024;
const MAX_PNG_BYTES = 3 * 1024 * 1024;
const repositoryRoot = resolve(process.cwd(), '../..');

function renderStill(args: string[], cwd: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    execFile(process.execPath, args, { cwd, timeout: 45_000, windowsHide: true, maxBuffer: 512 * 1024 },
      (error) => error ? reject(new Error('preview_renderer_failed')) : resolvePromise());
  });
}

function validatePng(image: Buffer): void {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (image.byteLength < signature.byteLength || image.byteLength > MAX_PNG_BYTES || !image.subarray(0, signature.byteLength).equals(signature)) {
    throw new Error('preview_output_invalid');
  }
}

export async function POST(request: Request): Promise<Response> {
  let release: (() => void) | undefined;
  let temporaryProps = '';
  let temporaryPng = '';
  try {
    assertRequestAuthorized(request);
    const ownerId = resolveOwnerId(request);
    const body = PreviewRequestSchema.parse(await readBoundedJson(request, MAX_PREVIEW_BODY_BYTES));
    const draft = await draftManagerV3.load(body.draftId);
    if (!draft) return NextResponse.json({ success: false, error: 'preview_draft_not_found' }, { status: 404 });
    if (draft.ownerId !== ownerId) throw new SecurityError(403, 'forbidden_owner_mismatch', 'Preview draft belongs to another owner');
    if (draft.version !== body.draftVersion) return NextResponse.json({ success: false, error: 'stale_draft_version', currentVersion: draft.version }, { status: 409 });
    const scene = draft.lessonPlan.storyboard?.scenes.find((candidate) => candidate.sceneId === body.sceneId);
    if (!scene) return NextResponse.json({ success: false, error: 'preview_scene_not_found' }, { status: 404 });
    const parsedScene = EducationalSceneV3Schema.parse(scene);
    const totalFrames = Math.max(1, Math.round(parsedScene.durationSeconds * 24));
    if (body.frame >= totalFrames) return NextResponse.json({ success: false, error: 'preview_frame_out_of_bounds', totalFrames }, { status: 400 });

    release = acquirePreviewPermit(ownerId);
    const key = previewCacheKey({ ownerId, draftId: body.draftId, version: body.draftVersion, sceneId: body.sceneId, frame: body.frame, subtitlesEnabled: body.subtitlesEnabled, scene: parsedScene });
    const previewDir = resolve(repositoryRoot, 'outputs', '.preview-cache-v3');
    await mkdir(previewDir, { recursive: true });
    const cachedPng = resolve(previewDir, `${key}.png`);
    let image: Buffer;
    try {
      image = await readFile(cachedPng);
      validatePng(image);
    }
    catch {
      await rm(cachedPng, { force: true }).catch(() => undefined);
      const token = randomUUID();
      temporaryProps = resolve(previewDir, `${key}.${token}.json.tmp`);
      temporaryPng = resolve(previewDir, `${key}.${token}.png.tmp`);
      await writeFile(temporaryProps, JSON.stringify({ scene: parsedScene, subtitlesEnabled: body.subtitlesEnabled }), { encoding: 'utf8', flag: 'wx' });
      const workerDir = resolve(repositoryRoot, 'apps', 'worker');
      await renderStill([resolve(workerDir, 'node_modules', '@remotion', 'cli', 'remotion-cli.js'), 'still', 'src/index.ts',
        'LuminaScenePreviewV3', temporaryPng, '--props', temporaryProps, '--frame', String(body.frame), '--image-format', 'png'], workerDir);
      const info = await stat(temporaryPng);
      if (info.size <= 0 || info.size > MAX_PNG_BYTES) throw new Error('preview_output_size_invalid');
      await rename(temporaryPng, cachedPng);
      temporaryPng = '';
      image = await readFile(cachedPng);
    }
    validatePng(image);
    return NextResponse.json({ success: true, frame: body.frame, totalFrames, sceneId: parsedScene.sceneId, sceneType: parsedScene.sceneType,
      previewDataUrl: `data:image/png;base64,${image.toString('base64')}` }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof SecurityError) return NextResponse.json({ success: false, error: error.code }, { status: error.status });
    if (error instanceof PreviewLimitError) return NextResponse.json({ success: false, error: error.code }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'invalid_preview_request' }, { status: 400 });
    return NextResponse.json({ success: false, error: 'preview_render_failed' }, { status: 500 });
  } finally {
    release?.();
    if (temporaryProps) await rm(temporaryProps, { force: true }).catch(() => undefined);
    if (temporaryPng) await rm(temporaryPng, { force: true }).catch(() => undefined);
  }
}
