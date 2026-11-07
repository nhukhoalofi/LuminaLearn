import assert from 'node:assert/strict';
import test from 'node:test';
import { MockGeminiAdapter } from '../src/mock-adapter';
import { MathLessonPlanner } from '../src/planner';
import { NarrationAgent, reviewNarrationMathematics } from '../src/narration';

const report = { status: 'verified' as const, topicId: 'calculus.derivative.intuition' as const, derivative: '2*x', secantSlope: 'h + 2', limitAtZero: '2', slopeAtPoint: 2 };
const scenes = [
  { id: 'scene_hook', template: 'hook', startFrame: 0, durationFrames: 120, content: { title: 'Hook' } },
  { id: 'scene_geometry', template: 'math_clip', startFrame: 120, durationFrames: 193, assetId: 'asset_manim', sourceStartFrame: 0, sourceDurationFrames: 193, content: { title: 'Geometry' } },
  { id: 'scene_math', template: 'equation_explanation', startFrame: 313, durationFrames: 265, content: { title: 'Math' } },
  { id: 'scene_formula', template: 'intuition_formula', startFrame: 578, durationFrames: 219, content: { title: 'Formula' } },
  { id: 'scene_summary', template: 'summary', startFrame: 797, durationFrames: 163, content: { title: 'Summary' } }
] as const;

test('NarrationAgent creates reviewed Vietnamese segment narration', async () => {
  const planned = await new MathLessonPlanner(new MockGeminiAdapter()).plan({ topic: 'Đạo hàm là gì?', targetAudience: 'Học sinh lớp 11', language: 'vi', durationSeconds: 40 });
  assert.equal(planned.status, 'ready');
  if (planned.status !== 'ready') return;
  const narration = new NarrationAgent().create({ draft: planned.draft, verificationReport: report, timelineScenes: [...scenes], audience: 'Học sinh lớp 11', language: 'vi' });
  assert.equal(narration.segments.length, 5);
  assert.match(narration.segments[3].text, /ép phẩy của một bằng hai/);
});

test('Mathematical language review rejects unsupported claims', async () => {
  const planned = await new MathLessonPlanner(new MockGeminiAdapter()).plan({ topic: 'Đạo hàm là gì?', targetAudience: 'Học sinh lớp 11', language: 'vi', durationSeconds: 40 });
  if (planned.status !== 'ready') return;
  assert.throws(() => reviewNarrationMathematics(planned.draft, { ...report, slopeAtPoint: 3 }), /unsupported_mathematical_claim/);
});
