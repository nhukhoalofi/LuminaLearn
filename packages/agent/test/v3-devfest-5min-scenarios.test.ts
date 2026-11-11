import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EducationalPlannerV3 } from '../src/orchestration/educational-planner-v3.js';

describe('V3 5-Minute (300s) Rich Pedagogical Scenarios', () => {
  const planner = new EducationalPlannerV3();

  it('1. Algebra (a+b)^2 5-min plan produces 9 diverse scenes with >= 50 words per scene', async () => {
    const plan = await planner.planLesson({
      lessonId: 'lesson_test_algebra_5min',
      topic: 'Vì sao (a+b)^2 = a^2 + 2ab + b^2?',
      targetDurationSeconds: 300
    });

    assert.ok(plan.storyboard, 'Storyboard must exist');
    const scenes = plan.storyboard.scenes;
    assert.equal(scenes.length, 9, 'Must have 9 rich scenes');
    assert.equal(plan.storyboard.totalDurationSeconds, 300, 'Total duration must be 300 seconds');

    let totalWords = 0;
    for (const scene of scenes) {
      assert.ok(scene.durationSeconds >= 25 && scene.durationSeconds <= 45, `Scene ${scene.sceneId} duration ${scene.durationSeconds} must be in [25, 45]s`);
      const words = scene.narration.vietnamese.trim().split(/\s+/).length;
      totalWords += words;
      assert.ok(words >= 45, `Scene ${scene.sceneId} narration must have >= 45 words, got ${words}: "${scene.narration.vietnamese}"`);
      assert.ok(scene.boundClaimIds.length >= 1, `Scene ${scene.sceneId} must bind to claims`);
    }
    assert.ok(totalWords >= 500, `Total words across 9 scenes must be >= 500 for ~300s speech, got ${totalWords}`);
  });

  it('2. Derivative 5-min plan produces 8 diverse scenes with >= 50 words per scene', async () => {
    const plan = await planner.planLesson({
      lessonId: 'lesson_test_derivative_5min',
      topic: 'Đạo hàm là gì? Từ cát tuyến đến tiếp tuyến',
      targetDurationSeconds: 300
    });

    assert.ok(plan.storyboard, 'Storyboard must exist');
    const scenes = plan.storyboard.scenes;
    assert.equal(scenes.length, 8, 'Must have 8 rich scenes');
    assert.equal(plan.storyboard.totalDurationSeconds, 300, 'Total duration must be 300 seconds');

    let totalWords = 0;
    for (const scene of scenes) {
      assert.ok(scene.durationSeconds >= 25 && scene.durationSeconds <= 50, `Scene ${scene.sceneId} duration ${scene.durationSeconds} must be in [25, 50]s`);
      const words = scene.narration.vietnamese.trim().split(/\s+/).length;
      totalWords += words;
      assert.ok(words >= 45, `Scene ${scene.sceneId} narration must have >= 45 words, got ${words}: "${scene.narration.vietnamese}"`);
      assert.ok(scene.boundClaimIds.length >= 1, `Scene ${scene.sceneId} must bind to claims`);
    }
    assert.ok(totalWords >= 500, `Total words across 8 scenes must be >= 500 for ~300s speech, got ${totalWords}`);
  });

  it('3. Gradient Descent 5-min plan produces 8 diverse scenes with >= 50 words per scene', async () => {
    const plan = await planner.planLesson({
      lessonId: 'lesson_test_gradient_5min',
      topic: 'Gradient Descent — AI tìm điểm tối ưu như thế nào?',
      targetDurationSeconds: 300
    });

    assert.ok(plan.storyboard, 'Storyboard must exist');
    const scenes = plan.storyboard.scenes;
    assert.equal(scenes.length, 8, 'Must have 8 rich scenes');
    assert.equal(plan.storyboard.totalDurationSeconds, 300, 'Total duration must be 300 seconds');

    let totalWords = 0;
    for (const scene of scenes) {
      assert.ok(scene.durationSeconds >= 20 && scene.durationSeconds <= 50, `Scene ${scene.sceneId} duration ${scene.durationSeconds} must be in [20, 50]s`);
      const words = scene.narration.vietnamese.trim().split(/\s+/).length;
      totalWords += words;
      assert.ok(words >= 45, `Scene ${scene.sceneId} narration must have >= 45 words, got ${words}: "${scene.narration.vietnamese}"`);
      assert.ok(scene.boundClaimIds.length >= 1, `Scene ${scene.sceneId} must bind to claims`);
    }
    assert.ok(totalWords >= 500, `Total words across 8 scenes must be >= 500 for ~300s speech, got ${totalWords}`);
  });
});

