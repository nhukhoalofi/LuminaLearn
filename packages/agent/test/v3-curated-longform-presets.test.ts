import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EducationalPlannerV3 } from '../src/orchestration/educational-planner-v3';

const presets = [
  {
    id: 'algebra',
    topic: 'Vì sao (a+b)² = a² + 2ab + b²?',
    expectedDomain: 'mathematics',
    expectedTopicId: 'algebra.identities.seven',
    expectedScenes: 9
  },
  {
    id: 'derivative',
    topic: 'Đạo hàm là gì? Từ cát tuyến đến tiếp tuyến',
    expectedDomain: 'mathematics',
    expectedTopicId: 'calculus.derivative.intuition',
    expectedScenes: 8
  },
  {
    id: 'gradient',
    topic: 'Gradient Descent — AI tìm điểm tối ưu như thế nào?',
    expectedDomain: 'artificial_intelligence',
    expectedTopicId: 'ai.gradient_descent.optimization',
    expectedScenes: 8
  }
] as const;

describe('Teacher Studio curated 5-minute presets', () => {
  const planner = new EducationalPlannerV3();

  for (const preset of presets) {
    it(`${preset.id} remains deterministic, render-ready and within the TTS budget`, async () => {
      const plan = await planner.planLesson({
        lessonId: `lesson_curated_${preset.id}`,
        topic: preset.topic,
        targetDurationSeconds: 300
      });

      assert.equal(plan.generationProvenance, 'deterministic_mock');
      assert.equal(plan.domain, preset.expectedDomain);
      assert.equal(plan.capabilityReport.topicId, preset.expectedTopicId);
      assert.equal(plan.capabilityReport.renderReadiness, 'render_ready');
      assert.equal(plan.storyboard?.totalDurationSeconds, 300);
      assert.equal(plan.storyboard?.scenes.length, preset.expectedScenes);
      assert.ok((plan.storyboard?.scenes.length ?? 0) <= 10, 'must fit GEMINI_TTS_MAX_REQUESTS_PER_JOB=10');
      assert.notEqual(plan.validationReport?.overallStatus, 'failed');
      assert.ok(plan.storyboard?.scenes.every((scene) => scene.boundClaimIds.length > 0));
    });
  }
});
