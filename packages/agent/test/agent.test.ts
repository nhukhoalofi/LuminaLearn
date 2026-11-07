import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LiveGeminiAdapter, MathLessonPlanner, MockGeminiAdapter, VisualStoryboardDirector, recognizesDerivativeTopic } from '../src/index';

describe('Math AI contracts', () => {
  it('creates a valid planner draft without an API key', async () => {
    const result = await new MathLessonPlanner(new MockGeminiAdapter()).plan({ topic: 'Đạo hàm là gì?', targetAudience: 'Học sinh lớp 11', language: 'vi', durationSeconds: 40 });
    assert.equal(result.status, 'ready');
    if (result.status === 'ready') assert.equal(result.draft.topicId, 'calculus.derivative.intuition');
  });
  it('rejects an invalid planner schema', async () => {
    const planner = new MathLessonPlanner(new MockGeminiAdapter({ lesson_plan: { topicId: 'wrong' } }));
    await assert.rejects(() => planner.plan({ topic: 'derivative', targetAudience: 'Grade 11', language: 'en', durationSeconds: 40 }));
  });
  it('recognizes derivative prompts and rejects unsupported topics before model generation', async () => {
    assert.equal(recognizesDerivativeTopic('Từ cát tuyến đến tiếp tuyến'), true);
    const result = await new MathLessonPlanner(new MockGeminiAdapter()).plan({ topic: 'Định lý Pythagoras', targetAudience: 'Lớp 8', language: 'vi', durationSeconds: 40 });
    assert.equal(result.status, 'unsupported_topic');
  });
  it('creates a validated approved scene from the mock director', async () => {
    const adapter = new MockGeminiAdapter(); const result = await new MathLessonPlanner(adapter).plan({ topic: 'Đạo hàm', targetAudience: 'Lớp 11', language: 'vi', durationSeconds: 40 });
    assert.equal(result.status, 'ready'); if (result.status !== 'ready') return;
    assert.equal((await new VisualStoryboardDirector(adapter).direct(result.draft)).visualization, 'secant_to_tangent');
  });
  it('reports a clear error when live mode has no API key', () => {
    const previous = process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY;
    try { assert.throws(() => new LiveGeminiAdapter(), /GEMINI_API_KEY/); } finally { if (previous) process.env.GEMINI_API_KEY = previous; }
  });
  it('rejects executable Python embedded in generated text', async () => {
    const valid = await new MockGeminiAdapter().generateStructured({ purpose: 'lesson_plan', prompt: '', jsonSchema: {} }) as Record<string, unknown>;
    const planner = new MathLessonPlanner(new MockGeminiAdapter({ lesson_plan: { ...valid, summary: '```python\nexec(user_input)\n```' } }));
    await assert.rejects(() => planner.plan({ topic: 'Đạo hàm', targetAudience: 'Lớp 11', language: 'vi', durationSeconds: 40 }), /Executable source code/);
  });
});

