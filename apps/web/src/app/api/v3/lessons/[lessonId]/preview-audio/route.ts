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
  GeminiTtsProvider,
  GoogleCloudTtsProvider,
  probeAudio,
  probeAudioSignal,
  type TtsProvider
} from '@luminalearn/hybrid-renderer';
import { issueExternalApiConsentV3, verifyExternalApiConsentV3 } from '@luminalearn/scene-schema';

export const runtime = 'nodejs';

const PreviewAudioRequestSchema = z.object({
  draftVersion: z.number().int().positive(),
  sceneId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  customNarrationText: z.string().max(2000).optional(),
  voice: z.string().max(80).optional(),
  previewMode: z.enum(['offline_timing', 'real_voice']).default('offline_timing'),
  provider: z.enum(['gemini_tts', 'google_cloud_tts']).optional(),
  confirmExternalApi: z.boolean().optional()
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
    if (body.previewMode === 'real_voice' && norm.requiresHumanReview) {
      return NextResponse.json({ success: false, error: 'narration_pronunciation_review_required', findings: norm.validationFindings }, { status: 422 });
    }
    const providerId = body.previewMode === 'offline_timing' ? 'mock_tts' : (body.provider ?? 'gemini_tts');
    const voice = body.voice ?? (providerId === 'gemini_tts' ? (process.env.GEMINI_TTS_VOICE ?? 'Kore') : (process.env.GOOGLE_TTS_VOICE ?? 'vi-VN-Neural2-A'));
    const model = providerId === 'gemini_tts' ? (process.env.GEMINI_TTS_MODEL ?? 'gemini-3.8-flash-lite-tts') : 'google-cloud-tts';

    if (body.previewMode === 'real_voice') {
      if (body.confirmExternalApi !== true) {
        return NextResponse.json({ success: false, error: 'external_api_consent_required' }, { status: 403 });
      }
      const liveProvider = providerId as 'gemini_tts' | 'google_cloud_tts';
      const consent = issueExternalApiConsentV3({ ownerId, provider: liveProvider, operation: 'narration', draftId: draft.draftId, isLiveOperation: true });
      const consentCheck = verifyExternalApiConsentV3({ consent, ownerId, expectedProvider: liveProvider, expectedOperation: 'narration', expectedDraftId: draft.draftId, isLiveOperation: true });
      if (!consentCheck.valid) return NextResponse.json({ success: false, error: consentCheck.code ?? 'external_api_consent_rejected' }, { status: 403 });
    }

    await defaultAudioCacheManager.init();

    const cacheKey = computeAudioCacheKey({
      text: norm.normalizedText,
      providerId,
      voice,
      language: 'vi-VN',
      model
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
          previewMode: body.previewMode,
          providerId,
          model: cached.meta.model,
          voice: cached.meta.voice,
          audioClassification: body.previewMode === 'offline_timing' ? 'silent_fixture' : 'audible_non_silent',
          audioDataUrl: body.previewMode === 'real_voice' ? `data:audio/mp3;base64,${cached.data.toString('base64')}` : undefined
        },
        { headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    // Synthesize fresh audio via offline mock provider
    const workDir = resolve(repositoryRoot, 'outputs', '.audio-preview-work');
    await mkdir(workDir, { recursive: true });

    const token = randomUUID();
    tempAudioPath = resolve(workDir, `preview_${token}.mp3`);

    const provider: TtsProvider = body.previewMode === 'offline_timing'
      ? new MockTtsProvider()
      : providerId === 'gemini_tts'
        ? new GeminiTtsProvider({ voice, model })
        : new GoogleCloudTtsProvider(voice);
    await provider.synthesize(norm.normalizedText, tempAudioPath, { voice, languageCode: 'vi-VN', speakingRate: 1, pitch: 0, model });

    const probe = await probeAudio(tempAudioPath, 120);
    const buffer = await readFile(tempAudioPath);
    const signal = await probeAudioSignal(tempAudioPath);
    if (body.previewMode === 'real_voice' && signal.isSilent) throw new Error('tts_audio_silent');

    // Save to audio cache
    await defaultAudioCacheManager.put(
      cacheKey,
      buffer,
      probe,
      providerId,
      voice,
      ownerId,
      Date.now(),
      { model, language: 'vi-VN', speakingRate: 1, pitch: 0 }
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
        previewMode: body.previewMode,
        providerId,
        model,
        voice,
        audioClassification: signal.audioClassification,
        audioDataUrl: body.previewMode === 'real_voice' ? `data:audio/mp3;base64,${buffer.toString('base64')}` : undefined
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
    const message = error instanceof Error ? error.message : String(error);
    const knownCode = /^(consent_server_secret_missing|tts_api_key_missing|tts_model_unavailable|tts_model_unsupported|tts_quota_exceeded|tts_timeout|tts_audio_silent)\b/.exec(message)?.[1];
    if (knownCode) {
      const status = knownCode === 'tts_quota_exceeded' ? 429 : knownCode === 'tts_timeout' ? 504 : 503;
      return NextResponse.json({ success: false, error: knownCode }, { status });
    }
    return NextResponse.json({ success: false, error: 'preview_audio_failed' }, { status: 500 });
  } finally {
    if (tempAudioPath) {
      await rm(tempAudioPath, { force: true }).catch(() => undefined);
    }
  }
}

