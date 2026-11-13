import assert from 'node:assert/strict';
import test from 'node:test';
import { EducationalPlannerV3 } from '../src/orchestration/educational-planner-v3';

test('offline physics planner creates a 60-second typed rainbow storyboard without external AI', async () => {
  const plan = await new EducationalPlannerV3().planLesson({
    lessonId: 'lesson_physics_rainbow_test',
    topic: 'Vì sao sau cơn mưa xuất hiện cầu vồng?',
    targetDurationSeconds: 60
  });

  assert.equal(plan.domain, 'physics');
  assert.equal(plan.topicId, 'physics.optics.rainbow');
  assert.equal(plan.storyboard?.totalDurationSeconds, 60);
  assert.equal(plan.storyboard?.scenes.length, 6);
  assert.ok(plan.storyboard?.scenes.every((scene) => scene.sceneType === 'physics_optics'));
  assert.ok(plan.storyboard?.scenes.every((scene) => scene.visualPayload.sceneType === 'physics_optics'));
  assert.equal(plan.validationReport?.requiresHumanPedagogicalSignoff, true);

  const angleScene = plan.storyboard?.scenes.find((scene) => scene.sceneId === 'sc_rainbow_5');
  assert.equal(angleScene?.visualPayload.sceneType, 'physics_optics');
  if (angleScene?.visualPayload.sceneType === 'physics_optics') {
    assert.equal(angleScene.visualPayload.primaryRainbowAnglesDeg.red, 42.37);
    assert.equal(angleScene.visualPayload.primaryRainbowAnglesDeg.violet, 40.51);
  }
});
