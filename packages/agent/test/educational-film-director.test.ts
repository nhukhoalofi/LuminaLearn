import assert from 'node:assert/strict';
import test from 'node:test';
import { EducationalFilmDirector } from '../src/orchestration/educational-film-director';
import { LessonPlanV2Schema, StoryboardV2Schema } from '@luminalearn/scene-schema';

const lesson = LessonPlanV2Schema.parse({
  schemaVersion: 'lesson-v2', lessonId: 'lesson_direction', topicId: 'calculus.integral.riemann_sum', title: 'Tổng Riemann',
  learningObjectives: ['Hiểu diện tích qua tổng Riemann'], prerequisites: [], keyConcepts: ['Tổng Riemann'],
  mathematicalClaims: [{ id: 'claim_integral', statement: 'Tích phân bằng một phần ba', validatorKey: 'definite_integral', expectedExpression: '1/3', verificationStatus: 'verified' }],
  pedagogicalSequence: [{ stepNumber: 1, pedagogicalGoal: 'Mở bài', intuitiveConcept: 'Chia diện tích thành hình chữ nhật', targetDurationSeconds: 3 }], summary: 'Tổng tiến tới tích phân'
});
const storyboard = StoryboardV2Schema.parse({
  storyboardId: 'sb_direction', lessonId: lesson.lessonId, topicId: lesson.topicId, visualTemplateIds: ['function_graph'], mathematicalData: {}, narrationObjectives: [], estimatedDurationFrames: 72, sourceReferences: [],
  scenes: [
    { sceneId: 'scene_intro', templateId: 'function_graph', sceneType: 'intro', durationFrames: 36, parameters: { title: 'Tổng Riemann' }, layout: { aspectRatio: '9:16', safeAreaPadding: 48 }, mathematicalBinding: { boundClaimIds: [], latexFormulas: [] }, sourceReferenceIds: [] },
    { sceneId: 'scene_formula', templateId: 'function_graph', sceneType: 'formula', durationFrames: 36, parameters: { title: 'Giới hạn' }, layout: { aspectRatio: '9:16', safeAreaPadding: 48 }, mathematicalBinding: { boundClaimIds: ['claim_integral'], latexFormulas: ['∫₀¹ x² dx = 1/3'] }, sourceReferenceIds: [] }
  ]
});

test('creates a typed treatment that locks verified claims and selects approved motion components', () => {
  const treatment = new EducationalFilmDirector().createTreatment({ lessonPlan: lesson, storyboard, visualStyleId: 'math_chalkboard' });
  assert.equal(treatment.contentAuthority, 'teacher_approved_lesson');
  assert.deepEqual(treatment.lockedClaimIds, ['claim_integral']);
  assert.deepEqual(treatment.shots.map((shot) => shot.approvedComponent), ['concept_title_reveal', 'step_formula_reveal']);
});

test('rejects a treatment that binds a claim outside the verified lesson', () => {
  const invalid = structuredClone(storyboard);
  invalid.scenes[1].mathematicalBinding.boundClaimIds = ['claim_other'];
  assert.throws(() => new EducationalFilmDirector().createTreatment({ lessonPlan: lesson, storyboard: invalid }), /unverified claim/);
});
