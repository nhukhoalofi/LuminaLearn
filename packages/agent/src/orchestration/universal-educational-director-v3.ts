import {
  EducationalLessonPlanV3Schema,
  PedagogicalBeatV1Schema,
  VerifiedScientificExampleV1Schema,
  VisualIntentMappingV1Schema,
  type EducationalClaimV3,
  type EducationalLessonPlanV3,
  type EducationalSceneV3,
  type EducationalVisualActionV1,
  type EducationalVisualIntentV1,
  type LearningModeV1,
  type VisualCapabilityReadinessV1
} from '@luminalearn/scene-schema';
import { runEducationalContentPreflightV3 } from './educational-content-preflight-v3';

function learningMode(duration: number): LearningModeV1 {
  return duration <= 60 ? 'short_recap' : duration <= 180 ? 'concept_explainer' : 'full_lesson';
}

function validationStatus(claims: EducationalClaimV3[]) {
  if (claims.some((claim) => claim.verificationStatus === 'rejected')) return 'blocked' as const;
  if (claims.length && claims.every((claim) => claim.verificationStatus === 'formally_verified')) return 'verified' as const;
  if (claims.length && claims.every((claim) => ['formally_verified', 'numerically_validated'].includes(claim.verificationStatus))) return 'numerically_validated' as const;
  if (claims.length && claims.every((claim) => ['formally_verified', 'numerically_validated', 'source_grounded'].includes(claim.verificationStatus))) return 'source_grounded' as const;
  return 'human_review_required' as const;
}

interface Direction {
  intent: EducationalVisualIntentV1;
  actions: EducationalVisualActionV1[];
  readiness: VisualCapabilityReadinessV1;
  adapterId?: string;
  reviewReason?: string;
}

function visualDirection(scene: EducationalSceneV3, topicId: string): Direction {
  if (scene.sceneType === 'algebra_identity') return { intent: 'formula_transformation', actions: ['reveal_formula_step', 'highlight_term'], readiness: 'render_ready', adapterId: 'algebra_identity_v3' };
  if (topicId === 'calculus.derivative.intuition') return { intent: 'graph_and_tangent', actions: ['draw_graph', 'draw_tangent', 'highlight_term'], readiness: 'render_ready', adapterId: 'derivative_tangent_v3' };
  if (scene.sceneType === 'loss_landscape') return { intent: 'verified_parameter_step', actions: ['draw_graph', 'move_parameter_marker', 'highlight_term'], readiness: 'render_ready', adapterId: 'loss_landscape_v3' };
  if (topicId === 'probability.bayes_theorem') return { intent: 'probability_tree', actions: ['show_probability_branch', 'show_ratio_bars'], readiness: 'planning_only', reviewReason: 'Probability-tree rendering adapter is not implemented in this sprint.' };
  if (scene.sceneType === 'attention_heatmap') return { intent: 'attention_matrix', actions: ['reveal_attention_cell', 'highlight_term'], readiness: 'render_ready', adapterId: 'attention_heatmap_v3' };
  if (scene.sceneType === 'neural_architecture') return { intent: 'information_flow', actions: ['trace_signal', 'highlight_term'], readiness: 'render_ready', adapterId: 'neural_architecture_v3' };
  if (scene.sceneType === 'formula_derivation') return { intent: 'formula_transformation', actions: ['reveal_formula_step', 'highlight_term'], readiness: 'render_ready', adapterId: 'generic_math_v3' };
  if (scene.sceneType === 'comparison_table') return { intent: 'comparison', actions: ['show_comparison'], readiness: 'render_ready', adapterId: 'comparison_v3' };
  if (scene.sceneType === 'summary') return { intent: 'retrieval_prompt', actions: ['ask_question', 'hold_for_reading'], readiness: 'render_ready', adapterId: 'summary_v3' };
  return { intent: 'concept_focus', actions: ['reveal_title', 'hold_for_reading'], readiness: 'render_ready', adapterId: 'concept_intro_v3' };
}

function createScientificExample(plan: EducationalLessonPlanV3) {
  const claimById = new Map(plan.educationalClaims.map((claim) => [claim.id, claim]));
  const lossScene = plan.storyboard?.scenes.find((scene) => scene.sceneType === 'loss_landscape');
  if (lossScene?.visualPayload.sceneType === 'loss_landscape' && lossScene.visualPayload.steps.length >= 2) {
    const payload = lossScene.visualPayload;
    const claims = lossScene.boundClaimIds.map((id) => claimById.get(id)).filter((claim): claim is EducationalClaimV3 => Boolean(claim));
    return VerifiedScientificExampleV1Schema.parse({
      schemaVersion: 'scientific-example-v1',
      exampleId: 'example_gradient_step_1',
      title: 'Một bước cập nhật Gradient Descent',
      conceptOrClaimIds: lossScene.boundClaimIds,
      variables: { learningRate: payload.learningRate, initialW: payload.steps[0].w },
      sourceExpression: `L(w)=${payload.curvature}(w-${payload.minimumPoint.w})^2+${payload.minimumPoint.loss}`,
      steps: payload.steps.slice(0, 2).map((step, index) => ({
        stepId: `gradient_step_${index + 1}`,
        displayExpression: index === 0 ? `L(${step.w})=${step.loss},\\; L'(${step.w})=${step.gradient}` : `w_${index}=${payload.steps[index - 1].w}-${payload.learningRate}\\times${payload.steps[index - 1].gradient}=${step.w}`,
        narrationText: index === 0 ? `Tại w bằng ${step.w}, loss bằng ${step.loss} và gradient bằng ${step.gradient}.` : `Cập nhật tham số theo learning rate cho kết quả w mới bằng ${step.w}.`,
        subtitleText: index === 0 ? `w=${step.w}; L=${step.loss}; gradient=${step.gradient}` : `w mới = ${step.w}`,
        numericValues: { w: step.w, loss: step.loss, gradient: step.gradient },
        boundClaimIds: lossScene.boundClaimIds,
        verificationStatus: 'numerically_validated'
      })),
      graphPoints: payload.steps.slice(0, 2).map((step, index) => ({ x: step.w, y: step.loss, stepId: `gradient_step_${index + 1}` })),
      narrationReferences: [lossScene.sceneId],
      subtitleReferences: [lossScene.sceneId],
      verificationStatus: validationStatus(claims) === 'verified' ? 'formally_verified' : 'numerically_validated',
      verificationProofBinding: { verifier: 'deterministic_numeric', exactExpression: `gradient=2*${payload.curvature}*(w-${payload.minimumPoint.w})` }
    });
  }

  const algebraScene = plan.storyboard?.scenes.find((scene) => scene.sceneType === 'algebra_identity');
  if (algebraScene?.visualPayload.sceneType === 'algebra_identity') {
    const payload = algebraScene.visualPayload;
    const claims = algebraScene.boundClaimIds.map((id) => claimById.get(id)).filter((claim): claim is EducationalClaimV3 => Boolean(claim));
    const verified = validationStatus(claims) === 'verified';
    return VerifiedScientificExampleV1Schema.parse({
      schemaVersion: 'scientific-example-v1',
      exampleId: `example_${payload.identityId}`,
      title: algebraScene.title,
      conceptOrClaimIds: algebraScene.boundClaimIds,
      variables: {},
      sourceExpression: `${payload.leftExpression}=${payload.rightExpression}`,
      steps: payload.transformationSteps.map((step, index) => ({
        stepId: `algebra_step_${index + 1}`,
        displayExpression: step.expression,
        narrationText: step.explanationVietnamese,
        subtitleText: step.explanationVietnamese,
        numericValues: {},
        boundClaimIds: algebraScene.boundClaimIds,
        verificationStatus: verified ? 'formally_verified' : 'human_review_required'
      })),
      graphPoints: [], narrationReferences: [algebraScene.sceneId], subtitleReferences: [algebraScene.sceneId],
      verificationStatus: verified ? 'formally_verified' : 'human_review_required',
      verificationProofBinding: { verifier: verified ? 'sympy' : 'human', exactExpression: `${payload.leftExpression}=${payload.rightExpression}` }
    });
  }
  return undefined;
}

export interface UniversalDirectorOptionsV3 {
  targetLearners: string;
  targetDurationSeconds: number;
}

/** Enriches an already validated lesson without changing claims, evidence, or scene meaning. */
export function directEducationalLessonV3(sourcePlan: EducationalLessonPlanV3, options: UniversalDirectorOptionsV3) {
  const plan = EducationalLessonPlanV3Schema.parse(sourcePlan);
  const claimById = new Map(plan.educationalClaims.map((claim) => [claim.id, claim]));
  const example = createScientificExample(plan);
  const mappings = new Map<EducationalVisualIntentV1, Direction>();
  const beats = (plan.storyboard?.scenes ?? []).map((scene, index) => {
    const direction = visualDirection(scene, plan.topicId);
    mappings.set(direction.intent, direction);
    const claims = scene.boundClaimIds.map((id) => claimById.get(id)).filter((claim): claim is EducationalClaimV3 => Boolean(claim));
    const preferredFrames = Math.round(scene.durationSeconds * 24);
    return PedagogicalBeatV1Schema.parse({
      schemaVersion: 'pedagogical-beat-v1', beatId: `beat_${String(index + 1).padStart(2, '0')}`, sceneId: scene.sceneId,
      learningObjective: scene.pedagogicalGoal,
      pedagogicalIntent: index === 0 ? 'pose_problem' : scene.sceneType === 'summary' ? 'retrieve' : ['formula_derivation', 'algebra_identity', 'loss_landscape'].includes(scene.sceneType) ? 'demonstrate' : 'build_intuition',
      educationalQuestion: scene.visualPayload.sceneType === 'concept_intro' ? scene.visualPayload.centralQuestion : `Điều gì giải thích ${scene.title}?`,
      conceptOrClaimIds: scene.boundClaimIds.length ? scene.boundClaimIds : [plan.educationalClaims[0].id],
      workedExampleReferences: example?.conceptOrClaimIds.some((id) => scene.boundClaimIds.includes(id)) ? [example.exampleId] : [],
      approvedNarrationText: scene.narration.vietnamese, visualIntent: direction.intent, recommendedVisualActions: direction.actions,
      expectedLearnerTakeaway: scene.pedagogicalGoal,
      timingConstraints: { minimumFrames: Math.max(24, Math.round(preferredFrames * 0.5)), preferredFrames, maximumFrames: Math.max(preferredFrames, Math.min(2880, Math.round(preferredFrames * 1.5))), allowMeaningfulHold: direction.actions.includes('hold_for_reading') },
      contentValidationStatus: validationStatus(claims)
    });
  });
  const visualIntentMappings = [...mappings.entries()].map(([intent, direction]) => VisualIntentMappingV1Schema.parse({
    visualIntent: intent, recommendedActions: direction.actions,
    compatibleSceneTypes: [...new Set((plan.storyboard?.scenes ?? []).filter((scene) => visualDirection(scene, plan.topicId).intent === intent).map((scene) => scene.sceneType))],
    readiness: direction.readiness,
    ...(direction.adapterId ? { adapterId: direction.adapterId } : {}),
    ...(direction.reviewReason ? { reviewReason: direction.reviewReason } : {})
  }));
  const directed = EducationalLessonPlanV3Schema.parse({
    ...plan, learningMode: learningMode(options.targetDurationSeconds), targetLearners: options.targetLearners,
    commonMisconceptions: [plan.domain === 'mathematics' ? 'Nhầm việc ghi nhớ công thức với hiểu điều kiện và ý nghĩa của phép biến đổi.' : 'Nhầm hình minh họa trực quan với một kết quả đã được kiểm định khoa học.'],
    pedagogicalBeats: beats, workedExamples: example ? [example] : [], visualIntentMappings,
    retrievalQuestion: `Hãy giải thích bằng lời của em: ý tưởng cốt lõi của ${plan.title} là gì?`
  });
  return EducationalLessonPlanV3Schema.parse({ ...directed, educationalQuality: runEducationalContentPreflightV3(directed) });
}
