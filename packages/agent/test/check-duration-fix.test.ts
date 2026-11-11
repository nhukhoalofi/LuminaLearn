/**
 * Sprint B — CHECKPOINT 0 regression: verify expandScenesForDuration()
 * ensures supported presets are covered and the unsupported 600s request fails
 * with the explicit timeline-capacity contract (never generic filler).
 *
 * Delete this file after Sprint B is merged.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EducationalPlannerV3 } from '../src/orchestration/educational-planner-v3.js';

const TOPICS = [
  { label: 'Perceptron', topic: 'Perceptron' },
  { label: 'Bayes', topic: 'Định lý Bayes' },
  { label: 'LinearAlgebra', topic: 'Ma trận biến đổi' },
  { label: 'Backprop', topic: 'Lan truyền ngược' },
  { label: 'Embeddings', topic: 'Word Embeddings' },
  { label: 'Derivative', topic: 'Đạo hàm' },
  { label: 'Integral', topic: 'Tích phân Riemann' },
];

const SUPPORTED_DURATIONS = [35, 60, 180, 300];
const MAX_SCENE_DURATION = 120;

describe('expandScenesForDuration — honest duration capacity contract', () => {
  const planner = new EducationalPlannerV3();

  for (const { label, topic } of TOPICS) {
    for (const dur of SUPPORTED_DURATIONS) {
      it(`${label} @ ${dur}s: scene capacity must cover target`, async () => {
        const plan = await planner.planLesson({
          lessonId: `test_${label}_${dur}`,
          topic,
          targetDurationSeconds: dur,
        });
        assert.ok(plan.storyboard, `${label} ${dur}s: plan must have storyboard`);
        const scenes = plan.storyboard.scenes;
        const capacity = scenes.length * MAX_SCENE_DURATION;
        assert.ok(
          capacity >= dur,
          `${label} ${dur}s: ${scenes.length} scenes × 120s = ${capacity}s < ${dur}s target — too_big error will occur`
        );
      });
    }

    it(`${label} @ 600s: rejects unsupported capacity without filler`, async () => {
      await assert.rejects(
        () => planner.planLesson({
          lessonId: `test_${label}_600`,
          topic,
          targetDurationSeconds: 600
        }),
        (error: unknown) => {
          const candidate = error as { code?: string; message?: string };
          return candidate.code === 'timeline_insufficient_scene_capacity' &&
            /3 approved scenes can cover .*360 seconds/.test(candidate.message ?? '');
        }
      );
    });
  }
});

