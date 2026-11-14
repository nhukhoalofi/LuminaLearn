import assert from 'node:assert/strict';
import test from 'node:test';
import { EducationalPlannerV3 } from '../src/orchestration/educational-planner-v3';
import { reviewPhysicsStoryboard, runBoundedPhysicsQualityLoop } from '../src/orchestration/physics-storyboard-quality-loop';

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

test('offline planner turns the phone-call reference grammar into six typed process beats', async () => {
  const plan = await new EducationalPlannerV3().planLesson({ lessonId: 'lesson_phone_test', topic: 'Điện thoại truyền giọng nói như thế nào?', targetDurationSeconds: 60 });
  assert.equal(plan.topicId, 'physics.electromagnetism.telecom');
  assert.equal(plan.capabilityReport.renderReadiness, 'render_ready');
  assert.equal(plan.storyboard?.scenes.length, 6);
  assert.ok(plan.storyboard?.scenes.every((scene) => scene.sceneType === 'physics_explainer'));
  assert.ok(plan.storyboard?.scenes.some((scene) => scene.visualPayload.sceneType === 'physics_explainer' && scene.visualPayload.family === 'wave_propagation'));
});

test('offline planner turns condensation into six particle-state beats', async () => {
  const plan = await new EducationalPlannerV3().planLesson({ lessonId: 'lesson_condensation_test', topic: 'Vì sao lon nước lạnh bị đọng sương?', targetDurationSeconds: 60 });
  assert.equal(plan.topicId, 'physics.thermodynamics.condensation');
  assert.equal(plan.storyboard?.scenes.length, 6);
  assert.ok(plan.storyboard?.scenes.every((scene) => scene.visualPayload.sceneType === 'physics_explainer' && scene.visualPayload.family === 'particle_state'));
  const condensation = plan.storyboard?.scenes.find((scene) => scene.sceneId === 'sc_condensation_4');
  if (condensation?.visualPayload.sceneType === 'physics_explainer' && condensation.visualPayload.simulation.kind === 'particle_state') {
    assert.ok((condensation.visualPayload.simulation.surfaceTemperatureC ?? 99) <= (condensation.visualPayload.simulation.dewPointC ?? -99));
  } else {
    assert.fail('missing typed condensation scene');
  }
});

test('offline planner creates typed 60-second storyboards for the expanded physics families', async () => {
  const cases = [
    ['Sóng âm truyền trong không khí như thế nào?', 'physics.waves.sound', 'wave_propagation'],
    ['Định luật II Newton và hợp lực', 'physics.mechanics.newton_forces', 'force_motion'],
    ['Chuyển động ném xiên có quỹ đạo parabol', 'physics.mechanics.projectile', 'force_motion'],
    ['Con lắc đơn có chu kỳ dao động như thế nào?', 'physics.mechanics.pendulum', undefined],
    ['Bảo toàn cơ năng giữa động năng và thế năng', 'physics.mechanics.energy_conservation', 'energy_transfer']
  ] as const;
  for (const [topic, topicId, family] of cases) {
    const plan = await new EducationalPlannerV3().planLesson({ lessonId: `lesson_${topicId.replaceAll('.', '_')}`, topic, targetDurationSeconds: 60 });
    assert.equal(plan.topicId, topicId);
    assert.equal(plan.capabilityReport.renderReadiness, 'render_ready');
    assert.equal(plan.storyboard?.totalDurationSeconds, 60);
    assert.equal(plan.storyboard?.scenes.length, 6);
    assert.ok(plan.storyboard?.scenes.every((scene) => scene.visualPayload.sceneType === 'physics_explainer'));
    if (family) assert.ok(plan.storyboard?.scenes.every((scene) => scene.visualPayload.sceneType === 'physics_explainer' && scene.visualPayload.family === family));
  }
});

test('unsupported physics stays planning-only instead of inheriting another phenomenon readiness', async () => {
  const plan = await new EducationalPlannerV3().planLesson({ lessonId: 'lesson_lorentz_test', topic: 'Lực Lorentz trong từ trường hoạt động thế nào?', targetDurationSeconds: 60 });
  assert.equal(plan.topicId, 'physics.general.concept');
  assert.equal(plan.capabilityReport.renderReadiness, 'planning_only');
});

test('bounded physics quality loop rejects repetition and accepts a corrected draft without an external API', async () => {
  const valid = await new EducationalPlannerV3().planLesson({ lessonId: 'lesson_quality_loop', topic: 'Chuyển động ném xiên', targetDurationSeconds: 60 });
  const repeated = structuredClone(valid);
  const firstPayload = repeated.storyboard?.scenes[0]?.visualPayload;
  if (!repeated.storyboard || firstPayload?.sceneType !== 'physics_explainer') assert.fail('missing physics storyboard');
  repeated.storyboard.scenes = repeated.storyboard.scenes.map((scene) => scene.visualPayload.sceneType === 'physics_explainer'
    ? { ...scene, visualPayload: { ...scene.visualPayload, simulation: firstPayload.simulation } }
    : scene);
  assert.equal(reviewPhysicsStoryboard(repeated).passed, false);

  const result = await runBoundedPhysicsQualityLoop({
    generate: async () => repeated,
    revise: async () => valid,
    maxAttempts: 2
  });
  assert.equal(result.attempts, 2);
  assert.equal(result.report.passed, true);
});
