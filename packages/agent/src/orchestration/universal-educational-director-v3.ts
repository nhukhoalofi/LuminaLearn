import {
  EducationalLessonPlanV3Schema,
  AttentionMatrixDataV1Schema,
  DirectedDiagramDataV1Schema,
  OptimizationTraceDataV1Schema,
  PedagogicalBeatV1Schema,
  ScientificVisualDataV1Schema,
  VerifiedFormulaStepsDataV1Schema,
  VerifiedScientificExampleV1Schema,
  VisualIntentMappingV1Schema,
  resolveVisualCapabilityV1,
  type EducationalClaimV3,
  type EducationalLessonPlanV3,
  type EducationalSceneV3,
  type EducationalVisualActionV1,
  type EducationalVisualIntentV1,
  type LearningModeV1,
  type ScientificValidationRequirementV1,
  type ScientificVisualDataV1,
  type VisualCapabilityReadinessV1
} from '@luminalearn/scene-schema';
import { runEducationalContentPreflightV3 } from './educational-content-preflight-v3';

function learningMode(duration: number): LearningModeV1 {
  return duration <= 60 ? 'short_recap' : duration <= 180 ? 'concept_explainer' : 'full_lesson';
}

function validationStatus(claims: EducationalClaimV3[]) {
  if (claims.length === 0) return 'human_review_required' as const;
  if (claims.some((claim) => claim.verificationStatus === 'rejected')) return 'blocked' as const;
  if (claims.some((claim) => claim.verificationStatus === 'human_review_required' || claim.verificationStatus === 'unverified')) return 'human_review_required' as const;
  if (claims.every((claim) => claim.verificationStatus === 'formally_verified' && Boolean(claim.formalProofSummary))) return 'verified' as const;
  if (claims.every((claim) => ['formally_verified', 'numerically_validated'].includes(claim.verificationStatus))) return 'numerically_validated' as const;
  if (claims.every((claim) => ['formally_verified', 'numerically_validated', 'source_grounded'].includes(claim.verificationStatus))) return 'source_grounded' as const;
  return 'human_review_required' as const;
}

interface Direction {
  intent: EducationalVisualIntentV1;
  actions: EducationalVisualActionV1[];
  readiness: VisualCapabilityReadinessV1;
  adapterId?: string;
  reviewReason?: string;
}

const READINESS_SEVERITY: Record<VisualCapabilityReadinessV1, number> = {
  render_ready: 0,
  planning_only: 1,
  needs_review: 2,
  unsupported: 3
};

function mergeDirections(current: Direction | undefined, incoming: Direction): Direction {
  if (!current) return incoming;
  const stricter = READINESS_SEVERITY[incoming.readiness] > READINESS_SEVERITY[current.readiness] ? incoming : current;
  return {
    ...stricter,
    actions: [...new Set([...current.actions, ...incoming.actions])],
    ...(current.adapterId === incoming.adapterId && stricter.readiness === 'render_ready' ? { adapterId: current.adapterId } : { adapterId: undefined }),
    reviewReason: [current.reviewReason, incoming.reviewReason].filter(Boolean).join(' ') || undefined
  };
}

function validationForClaims(claims: EducationalClaimV3[]): ScientificValidationRequirementV1[] {
  const validation = new Set<ScientificValidationRequirementV1>();
  if (claims.length > 0 && claims.every((claim) => claim.verificationStatus === 'formally_verified' && Boolean(claim.formalProofSummary))) validation.add('formal_math');
  if (claims.length > 0 && claims.every((claim) => ['formally_verified', 'numerically_validated'].includes(claim.verificationStatus)) && claims.some((claim) => claim.verificationStatus === 'numerically_validated')) validation.add('deterministic_numeric');
  if (claims.length > 0 && claims.every((claim) => claim.verificationStatus === 'source_grounded')) validation.add('source_grounding');
  if (claims.some((claim) => claim.verificationStatus === 'human_review_required' || claim.verificationStatus === 'unverified' || (claim.verificationStatus === 'formally_verified' && !claim.formalProofSummary))) validation.add('human_review');
  return [...validation];
}

function scientificDataForScene(scene: EducationalSceneV3, claims: EducationalClaimV3[]): ScientificVisualDataV1 | undefined {
  const payload = scene.visualPayload;
  if ('scientificData' in payload && payload.scientificData) return ScientificVisualDataV1Schema.parse(payload.scientificData);
  if (payload.sceneType === 'algebra_identity') {
    const verified = claims.length > 0 && claims.every((claim) => claim.verificationStatus === 'formally_verified' && Boolean(claim.formalProofSummary));
    // Differentiate source citation IDs (sourceReferenceId) from SymPy verification record IDs (proofRecordId)
    const realProofRecordId = claims[0]?.proofRecordId;
    const trustedProofRef = verified && realProofRecordId ? realProofRecordId : undefined;
    return VerifiedFormulaStepsDataV1Schema.parse({
      kind: 'verified_formula_steps',
      title: scene.title,
      validation: verified && trustedProofRef ? 'formally_verified' : 'human_review_required',
      steps: payload.transformationSteps.map((step, index) => ({
        stepId: `${scene.sceneId}_formula_${index + 1}`,
        latex: step.expression,
        explanation: step.explanationVietnamese,
        highlightTerms: step.highlightTerms,
        claimIds: scene.boundClaimIds,
        ...(trustedProofRef ? { proofReferenceId: trustedProofRef } : {})
      }))
    });
  }
  if (payload.sceneType === 'loss_landscape') return OptimizationTraceDataV1Schema.parse({
    kind: 'optimization_trace_1d', expression: `L(w)=${payload.curvature}(w-${payload.minimumPoint.w})^2+${payload.minimumPoint.loss}`,
    learningRate: payload.learningRate,
    points: payload.steps.map((step) => ({ step: step.stepNumber, parameter: step.w, value: step.loss, gradient: step.gradient })),
    claimId: scene.boundClaimIds[0], validation: 'deterministic_numeric'
  });
  if (payload.sceneType === 'attention_heatmap') return AttentionMatrixDataV1Schema.parse({
    kind: 'attention_matrix', tokens: payload.tokens, weights: payload.matrix,
    validation: payload.isIllustrative ? 'human_review_required' : 'deterministic_numeric'
  });
  if (payload.sceneType === 'neural_architecture') {
    const nodeIds = payload.layers.flatMap((layer, layerIndex) => Array.from({ length: layer.nodeCount }, (_, nodeIndex) => `${scene.sceneId}_node_${layerIndex}_${nodeIndex}`));
    const nodes = payload.layers.flatMap((layer, layerIndex) => Array.from({ length: layer.nodeCount }, (_, nodeIndex) => ({ nodeId: nodeIds.find((id) => id.endsWith(`_${layerIndex}_${nodeIndex}`))!, label: `${layer.name} ${nodeIndex + 1}`, layer: layerIndex })));
    return DirectedDiagramDataV1Schema.parse({
      kind: 'directed_diagram', nodes,
      edges: payload.weights.map((weight, index) => ({ edgeId: `${scene.sceneId}_edge_${index + 1}`, fromNodeId: `${scene.sceneId}_node_${weight.fromLayer}_${weight.fromNode}`, toNodeId: `${scene.sceneId}_node_${weight.toLayer}_${weight.toNode}`, weight: weight.weightValue })),
      validation: payload.signalMode === 'computed_forward_pass' ? 'deterministic_numeric' : 'human_review_required'
    });
  }
  return undefined;
}

function actionsForIntent(intent: EducationalVisualIntentV1): EducationalVisualActionV1[] {
  if (intent === 'formula_transformation') return ['reveal_formula_step', 'highlight_term'];
  if (intent === 'graph_and_tangent') return ['draw_graph', 'draw_tangent', 'highlight_term'];
  if (intent === 'verified_parameter_step') return ['draw_graph', 'move_parameter_marker', 'draw_tangent'];
  if (intent === 'attention_matrix') return ['reveal_attention_cell', 'highlight_term'];
  if (intent === 'information_flow') return ['trace_signal', 'highlight_term'];
  return ['hold_for_reading'];
}

function intentForData(data: ScientificVisualDataV1): EducationalVisualIntentV1 {
  if (data.kind === 'verified_formula_steps') return 'formula_transformation';
  if (data.kind === 'scalar_function_1d') return 'graph_and_tangent';
  if (data.kind === 'optimization_trace_1d') return 'verified_parameter_step';
  if (data.kind === 'geometry_2d') return 'geometric_proof';
  if (data.kind === 'directed_diagram') return 'information_flow';
  if (data.kind === 'attention_matrix') return 'attention_matrix';
  return 'probability_tree';
}

function visualDirection(scene: EducationalSceneV3, claims: EducationalClaimV3[]): Direction {
  const scientificData = scientificDataForScene(scene, claims);
  if (scientificData) {
    const intent = intentForData(scientificData);
    const availableValidation = new Set(validationForClaims(claims));
    const hasRejectedClaim = claims.some((c) => c.verificationStatus === 'rejected');
    const isExplicitlyVerifiedNumericContract = (scientificData.kind === 'optimization_trace_1d' || scientificData.kind === 'attention_matrix') && scientificData.validation === 'deterministic_numeric';
    if (isExplicitlyVerifiedNumericContract && !hasRejectedClaim) {
      availableValidation.add('deterministic_numeric');
    }
    if (scientificData.kind === 'directed_diagram' && scientificData.validation === 'human_review_required') availableValidation.add('human_review');
    const resolution = resolveVisualCapabilityV1({ visualIntent: intent, scientificData, sceneType: scene.sceneType, availableValidation: [...availableValidation], durationFrames: Math.max(1, Math.round(scene.durationSeconds * 24)) });
    if (resolution.status === 'selected') return { intent, actions: actionsForIntent(intent), readiness: 'render_ready', adapterId: resolution.capability.rendererAdapterId };
    return { intent, actions: actionsForIntent(intent), readiness: resolution.finding.code === 'visual_adapter_not_ready' ? resolution.capability?.readinessStatus ?? resolution.status : resolution.status, reviewReason: resolution.finding.message };
  }
  if (scene.sceneType === 'formula_derivation' || scene.sceneType === 'graph_plot' || scene.sceneType === 'flowchart_simulation') return { intent: 'formula_transformation', actions: ['reveal_formula_step', 'highlight_term'], readiness: 'needs_review', reviewReason: 'Scientific scene has no typed scientificData binding; generic animation would be misleading.' };
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
    const claims = scene.boundClaimIds.map((id) => claimById.get(id)).filter((claim): claim is EducationalClaimV3 => Boolean(claim));
    const direction = visualDirection(scene, claims);
    mappings.set(direction.intent, mergeDirections(mappings.get(direction.intent), direction));
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
    compatibleSceneTypes: [...new Set((plan.storyboard?.scenes ?? []).filter((scene) => {
      const claims = scene.boundClaimIds.map((id) => claimById.get(id)).filter((claim): claim is EducationalClaimV3 => Boolean(claim));
      return visualDirection(scene, claims).intent === intent;
    }).map((scene) => scene.sceneType))],
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
