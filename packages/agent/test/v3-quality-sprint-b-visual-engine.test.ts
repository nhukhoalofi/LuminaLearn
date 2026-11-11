import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EducationalPlannerV3 } from '../src/orchestration/educational-planner-v3';
import { compilePedagogicalBeatsV3 } from '../src/orchestration/pedagogical-beat-compiler-v3';
import { directEducationalLessonV3 } from '../src/orchestration/universal-educational-director-v3';

describe('Quality Sprint B multi-topic visual selection and beat compilation', () => {
  it('uses scientific payloads rather than benchmark topic names to select adapters', async () => {
    const planner = new EducationalPlannerV3();
    const derivative = await planner.planLesson({ lessonId: 'sprint_b_derivative', topic: 'Đạo hàm', targetDurationSeconds: 60 });
    const gradient = await planner.planLesson({ lessonId: 'sprint_b_gradient', topic: 'Gradient Descent', targetDurationSeconds: 60 });
    const algebra = await planner.planLesson({ lessonId: 'sprint_b_algebra', topic: '7 hằng đẳng thức', targetDurationSeconds: 60 });
    assert.ok(derivative.visualIntentMappings?.some((mapping) => mapping.visualIntent === 'graph_and_tangent' && mapping.readiness === 'needs_review' && mapping.reviewReason?.includes('formal_math')));
    assert.ok(gradient.visualIntentMappings?.some((mapping) => mapping.adapterId === 'loss_landscape_v3'));
    assert.ok(algebra.visualIntentMappings?.some((mapping) => mapping.adapterId === 'formula_sequence_v3'));
  });

  it('reports user-entered unsupported scientific scenes honestly', async () => {
    const plan = await new EducationalPlannerV3().planLesson({ lessonId: 'sprint_b_user_topic', topic: 'Biểu diễn topo đồ thị tri thức AI', targetDurationSeconds: 60 });
    assert.equal(plan.capabilityReport.renderReadiness, 'planning_only');
    assert.ok(plan.capabilityReport.limitations.length > 0);
  });

  it('does not grant formal visual validation when only part of a scene claim set is verified', async () => {
    const planned = await new EducationalPlannerV3().planLesson({ lessonId: 'sprint_b_partial_validation', topic: '7 hằng đẳng thức', targetDurationSeconds: 60 });
    const plan = structuredClone(planned);
    const sourceClaim = plan.educationalClaims[0];
    plan.educationalClaims.push({ ...sourceClaim, id: 'claim_pending_visual_support', verificationStatus: 'human_review_required', formalProofSummary: undefined });
    const sourceReport = plan.validationReport!.claimReports[0];
    plan.validationReport!.overallStatus = 'needs_review';
    plan.validationReport!.claimReports.push({ ...sourceReport, claimId: 'claim_pending_visual_support', status: 'human_review_required', verifierNotes: 'Pending human review.', verificationBinding: undefined });
    const algebraScene = plan.storyboard!.scenes.find((scene) => scene.sceneType === 'algebra_identity')!;
    algebraScene.boundClaimIds.push('claim_pending_visual_support');
    const directed = directEducationalLessonV3(plan, { targetLearners: plan.targetLearners ?? 'Học sinh trung học', targetDurationSeconds: 60 });
    assert.ok(directed.visualIntentMappings?.some((mapping) => mapping.visualIntent === 'formula_transformation' && mapping.readiness === 'needs_review'));
  });

  it('compiles multiple visual actions into contiguous non-overlapping cues', async () => {
    const plan = await new EducationalPlannerV3().planLesson({ lessonId: 'sprint_b_compile', topic: 'Gradient Descent', targetDurationSeconds: 60 });
    const beats = plan.pedagogicalBeats ?? [];
    const mappings = plan.visualIntentMappings ?? [];
    let cursor = 0;
    const sceneTimings = plan.storyboard!.scenes.map((scene) => {
      const startFrame = cursor;
      cursor += Math.round(scene.durationSeconds * 24);
      return { sceneId: scene.sceneId, startFrame, endFrame: cursor, timingEvidence: 'planned' as const };
    });
    const compiled = compilePedagogicalBeatsV3({ beats, visualMappings: mappings, sceneTimings, fps: 24, totalFrames: cursor });
    const ordered = [...compiled.cues].sort((a, b) => a.startFrame - b.startFrame);
    ordered.forEach((cue, index) => { const previous = ordered[index - 1]; if (previous?.sceneId === cue.sceneId) assert.equal(previous.endFrame, cue.startFrame); });
    assert.ok(compiled.cues.some((cue) => cue.action === 'move_parameter_marker'));
    assert.ok(compiled.cues.every((cue) => cue.timingEvidence === 'planned'));
  });
});

