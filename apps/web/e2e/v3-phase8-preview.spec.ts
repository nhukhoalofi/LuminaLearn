import { test, expect } from '@playwright/test';

test('authorized draft-bound preview renders PNG and rejects stale/out-of-range requests', async ({ request }) => {
  test.setTimeout(120_000);
  const created = await request.post('/api/v3/lessons/draft', { data: {
    requestId: `request_preview_${Date.now()}`,
    topic: 'Perceptron và mạng nơ-ron', domain: 'artificial_intelligence', generationMode: 'mock',
    targetDurationSeconds: 35, narrationMode: 'none', subtitlesEnabled: true, fps: 24, width: 720, height: 1280
  } });
  expect(created.status()).toBe(201);
  const draft = await created.json() as { draftId: string; version: number; lessonPlan: { storyboard: { scenes: Array<{ sceneId: string; durationSeconds: number }> } } };
  const scene = draft.lessonPlan.storyboard.scenes[0];
  const body = { draftId: draft.draftId, draftVersion: draft.version, sceneId: scene.sceneId, frame: 0, subtitlesEnabled: true };

  const preview = await request.post('/api/v3/preview', { data: body });
  expect(preview.status()).toBe(200);
  const payload = await preview.json() as { success: boolean; previewDataUrl: string; totalFrames: number };
  expect(payload.success).toBe(true);
  expect(payload.previewDataUrl.startsWith('data:image/png;base64,')).toBe(true);
  expect(payload.previewDataUrl.length).toBeGreaterThan(5_000);

  const stale = await request.post('/api/v3/preview', { data: { ...body, draftVersion: draft.version + 1 } });
  expect(stale.status()).toBe(409);
  const outOfRange = await request.post('/api/v3/preview', { data: { ...body, frame: Math.round(scene.durationSeconds * 24) } });
  expect(outOfRange.status()).toBe(400);
  const negative = await request.post('/api/v3/preview', { data: { ...body, frame: -1 } });
  expect(negative.status()).toBe(400);
});

