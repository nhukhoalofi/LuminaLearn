import { z } from 'zod';
import { NoExecutableString, SafeIdString } from '../v2/document';
import {
  EducationalVisualActionV1Schema,
  EducationalVisualIntentV1Schema,
  VisualCapabilityReadinessV1Schema
} from './pedagogy';

export const SCIENTIFIC_VISUAL_ENGINE_VERSION_V1 = 'scientific-visual-engine-v1' as const;

export const ScientificDataKindV1Schema = z.enum([
  'verified_formula_steps',
  'scalar_function_1d',
  'optimization_trace_1d',
  'geometry_2d',
  'directed_diagram',
  'attention_matrix',
  'probability_tree'
]);
export type ScientificDataKindV1 = z.infer<typeof ScientificDataKindV1Schema>;

export const ScientificValidationRequirementV1Schema = z.enum([
  'formal_math',
  'deterministic_numeric',
  'source_grounding',
  'human_review'
]);
export type ScientificValidationRequirementV1 = z.infer<typeof ScientificValidationRequirementV1Schema>;

export const FormulaStepScientificDataV1Schema = z.object({
  stepId: SafeIdString,
  latex: z.string().trim().min(1).max(300),
  explanation: NoExecutableString,
  highlightTerms: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
  claimIds: z.array(SafeIdString).min(1).max(12),
  proofReferenceId: SafeIdString.optional()
}).strict();

export const VerifiedFormulaStepsDataV1Schema = z.object({
  kind: z.literal('verified_formula_steps'),
  title: NoExecutableString,
  steps: z.array(FormulaStepScientificDataV1Schema).min(2).max(20),
  validation: z.enum(['formally_verified', 'human_review_required'])
}).strict().superRefine((data, ctx) => {
  if (data.validation === 'formally_verified' && data.steps.some((step) => !step.proofReferenceId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['steps'], message: 'Every formally verified formula step requires a proofReferenceId.' });
  }
});

export const ScalarFunctionDataV1Schema = z.object({
  kind: z.literal('scalar_function_1d'),
  functionType: z.enum(['convex_quadratic', 'polynomial', 'sine', 'exponential']),
  expression: z.string().trim().min(1).max(100),
  xRange: z.tuple([z.number().finite(), z.number().finite()]),
  yRange: z.tuple([z.number().finite(), z.number().finite()]),
  pointX: z.number().finite().optional(),
  tangentAtX: z.number().finite().optional(),
  secantFromX: z.number().finite().optional(),
  secantToX: z.number().finite().optional(),
  claimId: SafeIdString,
  validation: z.literal('formally_verified')
}).strict().superRefine((data, ctx) => {
  if (data.xRange[0] >= data.xRange[1] || data.yRange[0] >= data.yRange[1]) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['xRange'], message: 'Graph ranges must increase strictly.' });
  }
  for (const [field, value] of [['pointX', data.pointX], ['tangentAtX', data.tangentAtX], ['secantFromX', data.secantFromX], ['secantToX', data.secantToX]] as const) {
    if (value !== undefined && (value < data.xRange[0] || value > data.xRange[1])) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `${field} must lie inside xRange.` });
    }
  }
  if ((data.secantFromX === undefined) !== (data.secantToX === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['secantFromX'], message: 'secantFromX and secantToX must be provided together.' });
  }
  if (data.secantFromX !== undefined && data.secantToX !== undefined && data.secantFromX === data.secantToX) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['secantToX'], message: 'A secant requires two distinct x coordinates.' });
  }
});

export const OptimizationTraceDataV1Schema = z.object({
  kind: z.literal('optimization_trace_1d'),
  expression: z.string().trim().min(1).max(100),
  learningRate: z.number().finite().positive().max(2),
  points: z.array(z.object({
    step: z.number().int().nonnegative(),
    parameter: z.number().finite(),
    value: z.number().finite(),
    gradient: z.number().finite()
  }).strict()).min(2).max(20),
  claimId: SafeIdString,
  validation: z.literal('deterministic_numeric')
}).strict();

const GeometryPointV1Schema = z.object({
  pointId: SafeIdString,
  x: z.number().finite(),
  y: z.number().finite()
}).strict();

export const Geometry2dDataV1Schema = z.object({
  kind: z.literal('geometry_2d'),
  points: z.array(GeometryPointV1Schema).min(2).max(24),
  segments: z.array(z.object({ fromPointId: SafeIdString, toPointId: SafeIdString }).strict()).max(36),
  polygons: z.array(z.object({ pointIds: z.array(SafeIdString).min(3).max(12), areaClaimId: SafeIdString.optional() }).strict()).max(8),
  claimIds: z.array(SafeIdString).default([]),
  validation: z.enum(['formally_verified', 'human_review_required'])
}).strict().superRefine((data, ctx) => {
  const ids = new Set(data.points.map((point) => point.pointId));
  data.segments.forEach((segment, index) => {
    if (!ids.has(segment.fromPointId) || !ids.has(segment.toPointId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['segments', index], message: 'Geometry segment references an unknown point.' });
  });
  data.polygons.forEach((polygon, index) => {
    if (polygon.pointIds.some((pointId) => !ids.has(pointId))) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['polygons', index], message: 'Geometry polygon references an unknown point.' });
  });
});

export const DirectedDiagramDataV1Schema = z.object({
  kind: z.literal('directed_diagram'),
  nodes: z.array(z.object({ nodeId: SafeIdString, label: NoExecutableString, layer: z.number().int().nonnegative(), value: z.number().finite().optional() }).strict()).min(2).max(40),
  edges: z.array(z.object({ edgeId: SafeIdString, fromNodeId: SafeIdString, toNodeId: SafeIdString, weight: z.number().finite().optional() }).strict()).min(1).max(100),
  validation: z.enum(['deterministic_numeric', 'source_grounded', 'human_review_required'])
}).strict().superRefine((data, ctx) => {
  const nodes = new Map(data.nodes.map((node) => [node.nodeId, node]));
  data.edges.forEach((edge, index) => {
    const from = nodes.get(edge.fromNodeId);
    const to = nodes.get(edge.toNodeId);
    if (!from || !to || to.layer <= from.layer) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['edges', index], message: 'Directed edge must connect existing nodes to a later layer.' });
  });
});

export const AttentionMatrixDataV1Schema = z.object({
  kind: z.literal('attention_matrix'),
  tokens: z.array(NoExecutableString).min(2).max(12),
  weights: z.array(z.array(z.number().finite().min(0).max(1))).min(2).max(12),
  validation: z.enum(['deterministic_numeric', 'human_review_required'])
}).strict().superRefine((data, ctx) => {
  const size = data.tokens.length;
  if (data.weights.length !== size || data.weights.some((row) => row.length !== size)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weights'], message: 'Attention matrix dimensions must match token count.' });
    return;
  }
  data.weights.forEach((row, index) => {
    const sum = row.reduce((total, value) => total + value, 0);
    if (Math.abs(sum - 1) > 1e-6) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weights', index], message: 'Each attention row must sum to one.' });
  });
});

export const ProbabilityTreeDataV1Schema = z.object({
  kind: z.literal('probability_tree'),
  rootLabel: NoExecutableString,
  branches: z.array(z.object({ branchId: SafeIdString, label: NoExecutableString, probability: z.number().finite().min(0).max(1), parentBranchId: SafeIdString.optional() }).strict()).min(2).max(24),
  validation: z.enum(['deterministic_numeric', 'human_review_required'])
}).strict().superRefine((data, ctx) => {
  const byId = new Map(data.branches.map((branch) => [branch.branchId, branch]));
  if (byId.size !== data.branches.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['branches'], message: 'Probability branch IDs must be unique.' });
  data.branches.forEach((branch, index) => {
    if (branch.parentBranchId && (!byId.has(branch.parentBranchId) || branch.parentBranchId === branch.branchId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['branches', index, 'parentBranchId'], message: 'Probability branch parent must reference a different existing branch.' });
    }
    const visited = new Set<string>([branch.branchId]);
    let parentId = branch.parentBranchId;
    while (parentId) {
      if (visited.has(parentId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['branches', index, 'parentBranchId'], message: 'Probability tree must not contain a cycle.' });
        break;
      }
      visited.add(parentId);
      parentId = byId.get(parentId)?.parentBranchId;
    }
  });
  const groups = new Map<string, number[]>();
  data.branches.forEach((branch) => {
    const parent = branch.parentBranchId ?? '__root__';
    groups.set(parent, [...(groups.get(parent) ?? []), branch.probability]);
  });
  for (const [parent, probabilities] of groups) {
    const sum = probabilities.reduce((total, value) => total + value, 0);
    if (Math.abs(sum - 1) > 1e-6) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['branches'], message: `Sibling probabilities under '${parent}' must sum to one.` });
  }
});

export const ScientificVisualDataV1Schema = z.union([
  VerifiedFormulaStepsDataV1Schema,
  ScalarFunctionDataV1Schema,
  OptimizationTraceDataV1Schema,
  Geometry2dDataV1Schema,
  DirectedDiagramDataV1Schema,
  AttentionMatrixDataV1Schema,
  ProbabilityTreeDataV1Schema
]);
export type ScientificVisualDataV1 = z.infer<typeof ScientificVisualDataV1Schema>;

export const MotionRecipeIdV1Schema = z.enum(['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10']);
export type MotionRecipeIdV1 = z.infer<typeof MotionRecipeIdV1Schema>;

export const VisualCapabilityV1Schema = z.object({
  capabilityId: SafeIdString,
  supportedVisualIntents: z.array(EducationalVisualIntentV1Schema).min(1),
  supportedScientificData: z.array(ScientificDataKindV1Schema).min(1),
  compatibleSceneTypes: z.array(z.string().trim().min(2).max(60)).min(1),
  requiredValidation: z.array(ScientificValidationRequirementV1Schema).min(1),
  rendererAdapterId: SafeIdString.optional(),
  supportedMotionRecipes: z.array(MotionRecipeIdV1Schema),
  fallbackPolicy: z.enum(['none', 'formula_only', 'static_diagram', 'needs_review']),
  readinessStatus: VisualCapabilityReadinessV1Schema,
  qualityRequirements: z.object({
    safeArea: z.boolean(),
    deterministicFrames: z.boolean(),
    requiresProofBinding: z.boolean(),
    minimumFrames: z.number().int().positive(),
    maximumFrames: z.number().int().positive()
  }).strict(),
  limitation: NoExecutableString.optional()
}).strict().superRefine((capability, ctx) => {
  if (capability.readinessStatus === 'render_ready' && !capability.rendererAdapterId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rendererAdapterId'], message: 'Render-ready capability requires a real adapter.' });
  if (capability.readinessStatus !== 'render_ready' && !capability.limitation) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['limitation'], message: 'Non-render-ready capability must state its limitation.' });
  if (capability.qualityRequirements.minimumFrames > capability.qualityRequirements.maximumFrames) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['qualityRequirements'], message: 'Capability timing bounds are invalid.' });
});
export type VisualCapabilityV1 = z.infer<typeof VisualCapabilityV1Schema>;

const quality = (requiresProofBinding: boolean) => ({ safeArea: true, deterministicFrames: true, requiresProofBinding, minimumFrames: 24, maximumFrames: 2880 });

export const VISUAL_CAPABILITY_REGISTRY_V1 = {
  formula_sequence: VisualCapabilityV1Schema.parse({ capabilityId: 'formula_sequence', supportedVisualIntents: ['formula_transformation'], supportedScientificData: ['verified_formula_steps'], compatibleSceneTypes: ['formula_derivation', 'algebra_identity', 'flowchart_simulation'], requiredValidation: ['formal_math'], rendererAdapterId: 'formula_sequence_v3', supportedMotionRecipes: ['R01', 'R02', 'R10'], fallbackPolicy: 'none', readinessStatus: 'render_ready', qualityRequirements: quality(true) }),
  cartesian_graph: VisualCapabilityV1Schema.parse({ capabilityId: 'cartesian_graph', supportedVisualIntents: ['graph_and_tangent'], supportedScientificData: ['scalar_function_1d'], compatibleSceneTypes: ['graph_plot', 'formula_derivation'], requiredValidation: ['formal_math'], rendererAdapterId: 'cartesian_graph_v3', supportedMotionRecipes: ['R03', 'R05', 'R09'], fallbackPolicy: 'formula_only', readinessStatus: 'render_ready', qualityRequirements: quality(true) }),
  optimization_trace: VisualCapabilityV1Schema.parse({ capabilityId: 'optimization_trace', supportedVisualIntents: ['verified_parameter_step'], supportedScientificData: ['optimization_trace_1d'], compatibleSceneTypes: ['loss_landscape'], requiredValidation: ['deterministic_numeric'], rendererAdapterId: 'loss_landscape_v3', supportedMotionRecipes: ['R03', 'R04', 'R05'], fallbackPolicy: 'none', readinessStatus: 'render_ready', qualityRequirements: quality(true) }),
  directed_diagram: VisualCapabilityV1Schema.parse({ capabilityId: 'directed_diagram', supportedVisualIntents: ['information_flow'], supportedScientificData: ['directed_diagram'], compatibleSceneTypes: ['neural_architecture', 'flowchart_simulation'], requiredValidation: ['source_grounding'], rendererAdapterId: 'directed_diagram_v3', supportedMotionRecipes: ['R07', 'R09'], fallbackPolicy: 'static_diagram', readinessStatus: 'render_ready', qualityRequirements: quality(false) }),
  attention_matrix: VisualCapabilityV1Schema.parse({ capabilityId: 'attention_matrix', supportedVisualIntents: ['attention_matrix'], supportedScientificData: ['attention_matrix'], compatibleSceneTypes: ['attention_heatmap'], requiredValidation: ['deterministic_numeric', 'human_review'], rendererAdapterId: 'attention_heatmap_v3', supportedMotionRecipes: ['R07', 'R08', 'R09'], fallbackPolicy: 'static_diagram', readinessStatus: 'render_ready', qualityRequirements: quality(false) }),
  geometry_2d: VisualCapabilityV1Schema.parse({ capabilityId: 'geometry_2d', supportedVisualIntents: ['geometric_proof'], supportedScientificData: ['geometry_2d'], compatibleSceneTypes: ['algebra_identity', 'graph_plot'], requiredValidation: ['formal_math', 'human_review'], rendererAdapterId: 'geometry_2d_v3', supportedMotionRecipes: ['R06', 'R09'], fallbackPolicy: 'formula_only', readinessStatus: 'planning_only', limitation: 'Geometry 2D primitives and adapter implemented (unverified_pending_qa); general area-preservation proof gate pending QA.', qualityRequirements: quality(true) }),
  probability_tree: VisualCapabilityV1Schema.parse({ capabilityId: 'probability_tree', supportedVisualIntents: ['probability_tree', 'ratio_comparison'], supportedScientificData: ['probability_tree'], compatibleSceneTypes: ['formula_derivation', 'flowchart_simulation'], requiredValidation: ['deterministic_numeric'], supportedMotionRecipes: ['R07', 'R09'], fallbackPolicy: 'needs_review', readinessStatus: 'planning_only', limitation: 'Probability-tree adapter is not implemented; generic branches must not be presented as validated probability evidence.', qualityRequirements: quality(true) })
} as const satisfies Record<string, VisualCapabilityV1>;

export const VisualCapabilityRequestV1Schema = z.object({
  visualIntent: EducationalVisualIntentV1Schema,
  scientificData: ScientificVisualDataV1Schema,
  sceneType: z.string().trim().min(2).max(60),
  availableValidation: z.array(ScientificValidationRequirementV1Schema),
  durationFrames: z.number().int().positive()
}).strict();
export type VisualCapabilityRequestV1 = z.infer<typeof VisualCapabilityRequestV1Schema>;

export type VisualCapabilityResolutionV1 =
  | { status: 'selected'; capability: VisualCapabilityV1 }
  | { status: 'needs_review' | 'unsupported'; capability?: VisualCapabilityV1; finding: { code: string; message: string; requestedIntent: string; scientificDataKind: ScientificDataKindV1; fallbackPolicy: VisualCapabilityV1['fallbackPolicy'] } };

/** Selects only by typed intent, scientific data and real adapter capability; topic names are deliberately absent. */
export function resolveVisualCapabilityV1(input: VisualCapabilityRequestV1): VisualCapabilityResolutionV1 {
  const request = VisualCapabilityRequestV1Schema.parse(input);
  const candidates = Object.values(VISUAL_CAPABILITY_REGISTRY_V1).filter((capability) =>
    capability.supportedVisualIntents.includes(request.visualIntent) &&
    capability.supportedScientificData.includes(request.scientificData.kind) &&
    capability.compatibleSceneTypes.includes(request.sceneType)
  );
  if (candidates.length === 0) return { status: 'unsupported', finding: { code: 'visual_capability_missing', message: `No capability supports intent '${request.visualIntent}' with data '${request.scientificData.kind}' for scene '${request.sceneType}'.`, requestedIntent: request.visualIntent, scientificDataKind: request.scientificData.kind, fallbackPolicy: 'needs_review' } };
  const capability = candidates[0];
  if (capability.readinessStatus !== 'render_ready') return { status: 'needs_review', capability, finding: { code: 'visual_adapter_not_ready', message: capability.limitation ?? `Capability '${capability.capabilityId}' is not render-ready.`, requestedIntent: request.visualIntent, scientificDataKind: request.scientificData.kind, fallbackPolicy: capability.fallbackPolicy } };
  const missing = capability.requiredValidation.filter((required) => !request.availableValidation.includes(required));
  if (missing.length > 0) return { status: 'needs_review', capability, finding: { code: 'visual_validation_missing', message: `Capability '${capability.capabilityId}' requires validation: ${missing.join(', ')}.`, requestedIntent: request.visualIntent, scientificDataKind: request.scientificData.kind, fallbackPolicy: capability.fallbackPolicy } };
  if (request.durationFrames < capability.qualityRequirements.minimumFrames || request.durationFrames > capability.qualityRequirements.maximumFrames) return { status: 'needs_review', capability, finding: { code: 'visual_duration_out_of_bounds', message: `Capability '${capability.capabilityId}' requires ${capability.qualityRequirements.minimumFrames}-${capability.qualityRequirements.maximumFrames} frames.`, requestedIntent: request.visualIntent, scientificDataKind: request.scientificData.kind, fallbackPolicy: capability.fallbackPolicy } };
  return { status: 'selected', capability };
}

export const MotionRecipeV1Schema = z.object({
  recipeId: MotionRecipeIdV1Schema,
  name: NoExecutableString,
  compatibleAdapterIds: z.array(SafeIdString).min(1),
  minimumFrames: z.number().int().positive(),
  safeAreaRequired: z.boolean(),
  readinessStatus: VisualCapabilityReadinessV1Schema,
  limitation: NoExecutableString.optional()
}).strict();
export type MotionRecipeV1 = z.infer<typeof MotionRecipeV1Schema>;

export const MOTION_RECIPE_REGISTRY_V1: Record<MotionRecipeIdV1, MotionRecipeV1> = {
  R01: { recipeId: 'R01', name: 'Formula Reveal', compatibleAdapterIds: ['formula_sequence_v3'], minimumFrames: 12, safeAreaRequired: true, readinessStatus: 'render_ready' },
  R02: { recipeId: 'R02', name: 'Semantic Highlight', compatibleAdapterIds: ['formula_sequence_v3'], minimumFrames: 8, safeAreaRequired: true, readinessStatus: 'render_ready' },
  R03: { recipeId: 'R03', name: 'Graph Trace', compatibleAdapterIds: ['cartesian_graph_v3', 'loss_landscape_v3'], minimumFrames: 16, safeAreaRequired: true, readinessStatus: 'render_ready' },
  R04: { recipeId: 'R04', name: 'Parameter Motion', compatibleAdapterIds: ['cartesian_graph_v3', 'loss_landscape_v3'], minimumFrames: 16, safeAreaRequired: true, readinessStatus: 'render_ready' },
  R05: { recipeId: 'R05', name: 'Dynamic Tangent', compatibleAdapterIds: ['cartesian_graph_v3', 'loss_landscape_v3'], minimumFrames: 16, safeAreaRequired: true, readinessStatus: 'render_ready' },
  R06: { recipeId: 'R06', name: 'Geometry Transformation', compatibleAdapterIds: ['geometry_2d_v3'], minimumFrames: 24, safeAreaRequired: true, readinessStatus: 'planning_only', limitation: 'General geometry adapter is pending.' },
  R07: { recipeId: 'R07', name: 'Information Flow', compatibleAdapterIds: ['directed_diagram_v3', 'attention_heatmap_v3'], minimumFrames: 16, safeAreaRequired: true, readinessStatus: 'render_ready' },
  R08: { recipeId: 'R08', name: 'Matrix Heatmap Reveal', compatibleAdapterIds: ['attention_heatmap_v3'], minimumFrames: 16, safeAreaRequired: true, readinessStatus: 'render_ready' },
  R09: { recipeId: 'R09', name: 'Semantic Camera Focus', compatibleAdapterIds: ['cartesian_graph_v3', 'directed_diagram_v3', 'attention_heatmap_v3'], minimumFrames: 24, safeAreaRequired: true, readinessStatus: 'planning_only', limitation: 'Camera grammar is defined but not compiled into the Remotion scene yet.' },
  R10: { recipeId: 'R10', name: 'Worked Example Progression', compatibleAdapterIds: ['formula_sequence_v3'], minimumFrames: 24, safeAreaRequired: true, readinessStatus: 'render_ready' }
};

export const SCIENTIFIC_VISUAL_STYLE_REGISTRY_V1 = {
  math_chalkboard: {
    background: '#071A14', typography: 'KaTeX + Inter', formulaColor: '#F8FAFC', graphColor: '#86EFAC', accentColor: '#FBBF24', spacingScale: 1,
    motionEasing: 'smoothstep', transitionBehavior: 'argument_step', cameraGrammar: 'stable_board_focus', subtitleSafeAreaBottom: 150
  },
  ai_data_story: {
    background: '#070B14', typography: 'Inter + KaTeX', formulaColor: '#E0F2FE', graphColor: '#22D3EE', accentColor: '#A78BFA', spacingScale: 1,
    motionEasing: 'smoothstep', transitionBehavior: 'data_then_explanation', cameraGrammar: 'chart_focus', subtitleSafeAreaBottom: 150
  },
  systems_whiteboard: {
    background: '#F8FAFC', typography: 'Inter + KaTeX', formulaColor: '#0F172A', graphColor: '#2563EB', accentColor: '#7C3AED', spacingScale: 1,
    motionEasing: 'smoothstep', transitionBehavior: 'node_then_flow', cameraGrammar: 'layer_focus', subtitleSafeAreaBottom: 150
  }
} as const;

export const AnimationCueV1Schema = z.object({
  cueId: SafeIdString,
  beatId: SafeIdString,
  sceneId: SafeIdString,
  visualIntent: EducationalVisualIntentV1Schema,
  action: EducationalVisualActionV1Schema,
  conceptOrClaimIds: z.array(SafeIdString).min(1).max(12),
  scientificDataReferences: z.array(SafeIdString).default([]),
  adapterId: SafeIdString.optional(),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
  timingEvidence: z.enum(['planned', 'measured_audio']),
  motionRecipeId: MotionRecipeIdV1Schema.optional(),
  animationParameters: z.record(z.string(), z.unknown()).optional()
}).strict().refine((cue) => cue.endFrame > cue.startFrame, { message: 'Animation cue must have positive duration.', path: ['endFrame'] });
export type AnimationCueV1 = z.infer<typeof AnimationCueV1Schema>;

export const CompiledPedagogicalAnimationPlanV1Schema = z.object({
  schemaVersion: z.literal('pedagogical-animation-plan-v1'),
  fps: z.number().int().positive().max(60),
  totalFrames: z.number().int().positive(),
  cues: z.array(AnimationCueV1Schema),
  findings: z.array(z.object({ code: z.string().regex(/^[a-z0-9_]{3,80}$/), status: z.enum(['WARNING', 'NEEDS_REVIEW', 'BLOCKED']), message: NoExecutableString, beatId: SafeIdString.optional() }).strict())
}).strict().superRefine((plan, ctx) => {
  const ordered = [...plan.cues].sort((a, b) => a.startFrame - b.startFrame || a.endFrame - b.endFrame);
  ordered.forEach((cue, index) => {
    if (cue.endFrame > plan.totalFrames) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cues', index], message: 'Animation cue exceeds totalFrames.' });
    const previous = ordered[index - 1];
    if (previous && previous.sceneId === cue.sceneId && previous.endFrame > cue.startFrame) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cues', index], message: 'Animation cues overlap inside a scene.' });
  });
});
export type CompiledPedagogicalAnimationPlanV1 = z.infer<typeof CompiledPedagogicalAnimationPlanV1Schema>;

