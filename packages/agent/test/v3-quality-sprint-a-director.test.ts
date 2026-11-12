import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EducationalPlannerV3 } from '../src/orchestration/educational-planner-v3';

describe('Quality Sprint A Universal Educational Director', () => {
  const planner = new EducationalPlannerV3();
  const topics = [
    ['algebra', 'Bảy hằng đẳng thức đáng nhớ', 'algebra.identities.seven'],
    ['derivative', 'Đạo hàm từ cát tuyến đến tiếp tuyến', 'calculus.derivative.intuition'],
    ['gradient', 'Tối ưu hóa Gradient Descent và bề mặt hàm mất mát', 'ai.gradient_descent.optimization'],
    ['bayes', 'Định lý Bayes và xác suất có điều kiện', 'probability.bayes_theorem'],
    ['attention', 'Cơ chế Self-Attention trong Transformer', 'ai.transformer.attention'],
    ['user_entered', 'Không gian vector embedding và độ tương đồng cosine của token', 'ai.embeddings.vector_space']
  ] as const;

  for (const [id, topic, expectedTopicId] of topics) {
    it(`creates typed beats, quality findings and honest visual readiness for ${id}`, async () => {
      const plan = await planner.planLesson({ lessonId: `quality_${id}`, topic, targetDurationSeconds: 60 });
      assert.equal(plan.topicId, expectedTopicId);
      assert.equal(plan.learningMode, 'short_recap');
      assert.ok(plan.pedagogicalBeats?.length);
      assert.equal(plan.pedagogicalBeats?.length, plan.storyboard?.scenes.length);
      assert.ok(plan.visualIntentMappings?.length);
      assert.ok(plan.educationalQuality?.findings.length);
      assert.ok(plan.retrievalQuestion);
      assert.ok(plan.pedagogicalBeats?.every((beat) => beat.approvedNarrationText.length > 0));
      if (expectedTopicId === 'probability.bayes_theorem') {
        assert.ok(plan.visualIntentMappings?.some((mapping) => mapping.readiness === 'planning_only' && mapping.reviewReason));
      }
      if (expectedTopicId === 'ai.embeddings.vector_space') {
        assert.ok(plan.educationalQuality?.findings.some((finding) => finding.code === 'worked_example_missing'));
      }
    });
  }

  it('selects duration-aware learning modes instead of padding one scene', async () => {
    const recap = await planner.planLesson({ lessonId: 'quality_mode_60', topic: 'Gradient Descent và hàm mất mát', targetDurationSeconds: 60 });
    const explainer = await planner.planLesson({ lessonId: 'quality_mode_180', topic: 'Gradient Descent và hàm mất mát', targetDurationSeconds: 180 });
    const full = await planner.planLesson({ lessonId: 'quality_mode_300', topic: 'Gradient Descent và hàm mất mát', targetDurationSeconds: 300 });
    assert.equal(recap.learningMode, 'short_recap');
    assert.equal(explainer.learningMode, 'concept_explainer');
    assert.equal(full.learningMode, 'full_lesson');
    assert.ok(full.storyboard!.scenes.length >= 3);
  });
});
