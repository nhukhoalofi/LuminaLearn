import assert from 'node:assert/strict';
import test from 'node:test';
import { acquirePreviewPermit, previewCacheKey, PreviewLimitError, resetPreviewGuardForTests } from '../src/server/preview-guard';
import { LossLandscapeVisualPayloadSchema } from '@luminalearn/scene-schema';
import { POST as previewHandler } from '../src/app/api/v3/preview/route';
import { draftManagerV3 } from '../src/server/v3-services';

test('preview concurrency and per-owner rate are bounded', () => {
  resetPreviewGuardForTests();
  const release = acquirePreviewPermit('owner_a', 1_000);
  assert.throws(() => acquirePreviewPermit('owner_b', 1_000), (error: unknown) => error instanceof PreviewLimitError && error.code === 'preview_busy');
  release();
  for (let index = 1; index < 8; index += 1) acquirePreviewPermit('owner_a', 1_000)();
  assert.throws(() => acquirePreviewPermit('owner_a', 1_000), (error: unknown) => error instanceof PreviewLimitError && error.code === 'preview_rate_limited');
});

test('preview cache keys are isolated by owner and draft version', () => {
  const base = { draftId: 'draft_v3_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', version: 1, sceneId: 'scene_1', frame: 0, subtitlesEnabled: true, scene: { sceneId: 'scene_1' } };
  const first = previewCacheKey({ ...base, ownerId: 'owner_a' });
  assert.notEqual(first, previewCacheKey({ ...base, ownerId: 'owner_b' }));
  assert.notEqual(first, previewCacheKey({ ...base, ownerId: 'owner_a', version: 2 }));
});

test('loss landscape selectable options exactly match the trusted schema', () => {
  const payload = {
    sceneType: 'loss_landscape', minimumPoint: { w: 0, loss: 0 }, curvature: 1,
    currentParam: 2, learningRate: 0.3,
    steps: [{ stepNumber: 1, w: 2, loss: 4, gradient: 4 }], showGradientTangent: true
  };
  for (const functionType of ['convex_quadratic', '1d_curve']) {
    assert.equal(LossLandscapeVisualPayloadSchema.safeParse({ ...payload, functionType }).success, true);
  }
  for (const functionType of ['bowl', 'saddle', 'multimodal']) {
    assert.equal(LossLandscapeVisualPayloadSchema.safeParse({ ...payload, functionType }).success, false);
  }
});

test('preview route rejects missing authorization, wrong owner, missing draft and oversized body', async () => {
  const original = { public: process.env.LUMINA_PUBLIC_DEPLOYMENT, local: process.env.LUMINA_LOCAL_DEMO, token: process.env.LUMINA_API_AUTH_TOKEN };
  try {
    process.env.LUMINA_PUBLIC_DEPLOYMENT = 'true';
    process.env.LUMINA_LOCAL_DEMO = 'false';
    process.env.LUMINA_API_AUTH_TOKEN = 'phase8-preview-token';
    const base = { draftId: 'draft_v3_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', draftVersion: 1, sceneId: 'scene_1', frame: 0, subtitlesEnabled: true };
    const unauthorized = await previewHandler(new Request('http://localhost/api/v3/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base) }));
    assert.equal(unauthorized.status, 401);

    const authHeaders = { 'content-type': 'application/json', authorization: 'Bearer phase8-preview-token' };
    const missing = await previewHandler(new Request('http://localhost/api/v3/preview', { method: 'POST', headers: authHeaders, body: JSON.stringify(base) }));
    assert.equal(missing.status, 404);

    const draft = await draftManagerV3.create({
      requestId: `request_wrong_owner_${Date.now()}`, topic: 'Perceptron và mạng nơ-ron', domain: 'artificial_intelligence', generationMode: 'mock',
      targetDurationSeconds: 35, narrationMode: 'none', subtitlesEnabled: true, fps: 24, width: 720, height: 1280
    }, 'different-owner');
    const scene = draft.lessonPlan.storyboard!.scenes[0];
    const wrongOwner = await previewHandler(new Request('http://localhost/api/v3/preview', { method: 'POST', headers: authHeaders, body: JSON.stringify({ ...base, draftId: draft.draftId, draftVersion: draft.version, sceneId: scene.sceneId }) }));
    assert.equal(wrongOwner.status, 403);

    const oversized = await previewHandler(new Request('http://localhost/api/v3/preview', { method: 'POST', headers: authHeaders, body: JSON.stringify({ ...base, padding: 'x'.repeat(9_000) }) }));
    assert.equal(oversized.status, 413);
  } finally {
    if (original.public === undefined) delete process.env.LUMINA_PUBLIC_DEPLOYMENT; else process.env.LUMINA_PUBLIC_DEPLOYMENT = original.public;
    if (original.local === undefined) delete process.env.LUMINA_LOCAL_DEMO; else process.env.LUMINA_LOCAL_DEMO = original.local;
    if (original.token === undefined) delete process.env.LUMINA_API_AUTH_TOKEN; else process.env.LUMINA_API_AUTH_TOKEN = original.token;
  }
});
