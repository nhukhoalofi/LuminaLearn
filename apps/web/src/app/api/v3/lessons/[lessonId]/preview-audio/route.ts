import { NextResponse } from 'next/server';
import { resolve } from 'node:path';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { draftManagerV3 } from '@/server/v3-services';
import {
  assertRequestAuthorized,
  readBoundedJson,
  resolveOwnerId,
  SecurityError
} from '@/server/security';
import {
  normalizeVietnameseNarration,
  computeAudioCacheKey,
  defaultAudioCacheManager,
  MockTtsProvider,
  probeAudio
} from '@luminalearn/hybrid-renderer';

export const runtime = 'nodejs';

const PreviewAudioRequestSchema = z.object({
  draftVersion: z.number().int().positive(),
  sceneId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  customNarrationText: z.string().max(2000).optional(),
  voice: z.string().max(80).optional()
}).strict();

const MAX_BODY_BYTES = 16 * 1024;
const repositoryRoot = resolve(process.cwd(), '../..');

export async function POST(
  request: Request,
  props: { params: Promise<{ lessonId: string }> }
): Promise<Response> {
  const params = await props.params;
  const lessonId = params.lessonId;
  let tempAudioPath = '';

  try {
    assertRequestAuthorized(request);
    const ownerId = resolveOwnerId(request);

    const body = PreviewAudioRequestSchema.parse(
      await readBoundedJson(request, MAX_BODY_BYTES)
    );

    const draft = await draftManagerV3.load(lessonId);
    if (!draft) {
      return NextResponse.json(
        { success: false, error: 'preview_draft_not_found' },
        { status: 404 }
      );
    }

    if (draft.ownerId !== ownerId) {
      throw new SecurityError(
        403,
        'forbidden_owner_mismatch',
        'Lesson draft belongs to another owner'
      );
    }

    if (draft.version !== body.draftVersion) {
      return NextResponse.json(
        { success: false, error: 'stale_draft_version', currentVersion: draft.version },
        { status: 409 }
      );
    }

    const scene = draft.lessonPlan.storyboard?.scenes.find(
      (s) => s.sceneId === body.sceneId
    );
    if (!scene) {
      return NextResponse.json(
        { success: false, error: 'preview_scene_not_found' },
        { status: 404 }
      );
    }

    const rawText = (body.customNarrationText ?? scene.narration.vietnamese ?? '').trim();
    if (!rawText) {
      return NextResponse.json(
        { success: false, error: 'preview_narration_empty' },
        { status: 400 }
      );
    }

    const norm = normalizeVietnameseNarration(rawText);
    const voice = body.voice ?? 'vi-VN-Neural2-A';
    const providerId = 'mock_tts'; // Offline mock provider for teacher studio previews

    await defaultAudioCacheManager.init();

    const cacheKey = computeAudioCacheKey({
      text: norm.normalizedText,
      providerId,
      voice,
      language: 'vi-VN'
    });

    // Check cache first
    const cached = await defaultAudioCacheManager.get(cacheKey, ownerId);
    if (cached) {
      return NextResponse.json(
        {
          success: true,
          sceneId: scene.sceneId,
          normalizedText: norm.normalizedText,
          unsupportedTokens: norm.unsupportedTokens,
          wordCount: norm.wordCount,
          durationSeconds: cached.meta.durationSeconds,
          cacheHit: true,
          audioDataUrl: `data:audio/mp3;base64,${cached.data.toString('base64')}`
        },
        { headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    // Synthesize fresh audio via offline mock provider
    const workDir = resolve(repositoryRoot, 'outputs', '.audio-preview-work');
    await mkdir(workDir, { recursive: true });

    const token = randomUUID();
    tempAudioPath = resolve(workDir, `preview_${token}.mp3`);

    const provider = new MockTtsProvider();
    await provider.synthesize(norm.normalizedText, tempAudioPath);

    const probe = await probeAudio(tempAudioPath, 120);
    const buffer = await readFile(tempAudioPath);

    // Save to audio cache
    await defaultAudioCacheManager.put(
      cacheKey,
      buffer,
      probe,
      providerId,
      voice,
      ownerId
    );

    return NextResponse.json(
      {
        success: true,
        sceneId: scene.sceneId,
        normalizedText: norm.normalizedText,
        unsupportedTokens: norm.unsupportedTokens,
        wordCount: norm.wordCount,
        durationSeconds: probe.durationSeconds,
        cacheHit: false,
        audioDataUrl: `data:audio/mp3;base64,${buffer.toString('base64')}`
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json({ success: false, error: error.code }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'invalid_preview_request' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'preview_audio_failed' }, { status: 500 });
  } finally {
    if (tempAudioPath) {
      await rm(tempAudioPath, { force: true }).catch(() => undefined);
    }
  }
}

