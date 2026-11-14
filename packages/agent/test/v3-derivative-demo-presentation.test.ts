import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EducationalPlannerV3 } from '../src/orchestration/educational-planner-v3';

describe('60-second derivative demo presentation', () => {
  it('produces typed, varied scenes with continuous secant motion and separate subtitles', async () => {
    const plan = await new EducationalPlannerV3().planLesson({
      lessonId: 'lesson_derivative_demo',
      topic: 'Đạo hàm là gì? Từ cát tuyến đến tiếp tuyến',
      targetDurationSeconds: 60
    });
    const storyboard = plan.storyboard;
    assert.ok(storyboard);
    assert.equal(storyboard.totalDurationSeconds, 60);
    assert.equal(storyboard.scenes.length, 5);
    const limitScene = storyboard.scenes.find((scene) => scene.sceneId === 'sc_limit_transition');
    assert.ok(limitScene && 'visualIntent' in limitScene.visualPayload);
    assert.equal(limitScene.visualPayload.visualIntent, 'limit_transition');
    const scientificData = 'scientificData' in limitScene.visualPayload ? limitScene.visualPayload.scientificData : undefined;
    assert.ok(scientificData?.kind === 'scalar_function_1d');
    assert.deepEqual(scientificData.secantProgression, [2, 1.5, 1.2, 1.05, 1.01]);
    const formulaScene = storyboard.scenes.find((scene) => scene.sceneId === 'sc_formula_focus');
    assert.ok(formulaScene && 'displayMath' in formulaScene.visualPayload);
    assert.equal(formulaScene.visualPayload.displayMath?.presentation, 'formula_focus');
    assert.ok(storyboard.scenes.every((scene) => !/[\\]|lim_/.test(scene.narration.subtitleVietnamese)));
  });
});
