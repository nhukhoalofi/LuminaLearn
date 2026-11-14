import { test, expect } from '@playwright/test';

const requestBody = (topic: string) => ({
  requestId: `request_${Date.now()}_${Math.random().toString(16).slice(2)}`,
  topic, domain: 'artificial_intelligence', generationMode: 'mock', targetDurationSeconds: 35,
  narrationMode: 'none', subtitlesEnabled: true, fps: 24, width: 720, height: 1280
});

test('V3 API rejects unsupported subject and unconfirmed Live mode without making a job', async ({ request }) => {
  const unsupported = await request.post('/api/v3/lessons/draft', { data: requestBody('Lịch sử nghệ thuật Phục Hưng') });
  expect(unsupported.status()).toBe(400);

  const live = await request.post('/api/v3/lessons/draft', { data: { ...requestBody('Perceptron và mạng nơ-ron'), generationMode: 'live' } });
  expect(live.status()).toBe(400);
  expect((await live.json()).error).toBe('external_api_confirmation_required');
});

test('V3 API rejects stale review, invalid visual payload, and planning-only rendering', async ({ request }) => {
  const createdResponse = await request.post('/api/v3/lessons/draft', { data: requestBody('Perceptron và mạng nơ-ron') });
  expect(createdResponse.status()).toBe(201);
  const draft = await createdResponse.json() as { draftId: string; version: number; lessonPlan: { storyboard: { scenes: Array<{ sceneId: string }> } } };

  const staleReview = await request.post(`/api/v3/lessons/${draft.draftId}/review`, { data: { expectedVersion: draft.version + 1, semanticReviewConfirmed: true } });
  expect(staleReview.status()).toBe(409);

  const sceneId = draft.lessonPlan.storyboard.scenes[0].sceneId;
  const invalidVisual = await request.patch(`/api/v3/lessons/${draft.draftId}/draft`, {
    data: { expectedVersion: draft.version, visualPayloads: { [sceneId]: { sceneType: 'neural_architecture', layers: [], inputValues: [], weights: [] } } }
  });
  expect(invalidVisual.status()).toBe(400);

  const backpropResponse = await request.post('/api/v3/lessons/draft', { data: requestBody('Thuật toán lan truyền ngược Backpropagation và quy tắc chuỗi Chain Rule') });
  expect(backpropResponse.status()).toBe(201);
  const backprop = await backpropResponse.json() as { draftId: string; version: number };
  const reviewedResponse = await request.post(`/api/v3/lessons/${backprop.draftId}/review`, { data: { expectedVersion: backprop.version, semanticReviewConfirmed: true } });
  expect(reviewedResponse.status()).toBe(200);
  const reviewed = await reviewedResponse.json() as { version: number };
  const approval = await request.post(`/api/v3/lessons/${backprop.draftId}/approve`, { data: { expectedVersion: reviewed.version } });
  expect(approval.status()).toBe(400);
  expect((await approval.json()).message).toContain('topic_not_render_ready');
});

