import { z } from 'zod';
import { NoExecutableString, SafeIdString } from '../v2/document';

export const PEDAGOGICAL_BEAT_SCHEMA_VERSION_V1 = 'pedagogical-beat-v1' as const;
export const SCIENTIFIC_EXAMPLE_SCHEMA_VERSION_V1 = 'scientific-example-v1' as const;

export const EducationalQualityStatusV1Schema = z.enum([
  'PASS',
  'WARNING',
  'NEEDS_REVIEW',
  'BLOCKED'
]);
export type EducationalQualityStatusV1 = z.infer<typeof EducationalQualityStatusV1Schema>;

export const EducationalQualityFindingV1Schema = z.object({
  findingId: SafeIdString,
  code: z.string().regex(/^[a-z0-9_]{3,80}$/),
  status: EducationalQualityStatusV1Schema,
  message: NoExecutableString,
  sceneId: SafeIdString.optional(),
  beatId: SafeIdString.optional(),
  remediation: NoExecutableString.optional()
}).strict();
export type EducationalQualityFindingV1 = z.infer<typeof EducationalQualityFindingV1Schema>;

export const EducationalVisualIntentV1Schema = z.enum([
  'concept_focus',
  'formula_transformation',
  'geometric_proof',
  'graph_and_tangent',
  'verified_parameter_step',
  'probability_tree',
  'ratio_comparison',
  'information_flow',
  'attention_matrix',
  'comparison',
  'retrieval_prompt',
  'meaningful_hold'
]);
export type EducationalVisualIntentV1 = z.infer<typeof EducationalVisualIntentV1Schema>;

export const EducationalVisualActionV1Schema = z.enum([
  'reveal_title',
  'reveal_formula_step',
  'highlight_term',
  'draw_graph',
  'draw_tangent',
  'move_parameter_marker',
  'show_probability_branch',
  'show_ratio_bars',
  'trace_signal',
  'reveal_attention_cell',
  'show_comparison',
  'hold_for_reading',
  'ask_question'
]);
export type EducationalVisualActionV1 = z.infer<typeof EducationalVisualActionV1Schema>;

export const VisualCapabilityReadinessV1Schema = z.enum([
  'render_ready',
  'planning_only',
  'needs_review',
  'unsupported'
]);
export type VisualCapabilityReadinessV1 = z.infer<typeof VisualCapabilityReadinessV1Schema>;

export const VisualIntentMappingV1Schema = z.object({
  visualIntent: EducationalVisualIntentV1Schema,
  recommendedActions: z.array(EducationalVisualActionV1Schema).min(1).max(8),
  compatibleSceneTypes: z.array(z.string().trim().min(2).max(60)).min(1).max(8),
  readiness: VisualCapabilityReadinessV1Schema,
  adapterId: z.string().regex(/^[a-z0-9_.-]{3,80}$/).optional(),
  reviewReason: NoExecutableString.optional()
}).strict().superRefine((mapping, ctx) => {
  if (mapping.readiness !== 'render_ready' && !mapping.reviewReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reviewReason'],
      message: 'A non-render-ready visual intent must explain its limitation.'
    });
  }
});
export type VisualIntentMappingV1 = z.infer<typeof VisualIntentMappingV1Schema>;

export const ScientificExampleStepV1Schema = z.object({
  stepId: SafeIdString,
  displayExpression: z.string().trim().min(1).max(300),
  narrationText: NoExecutableString,
  subtitleText: NoExecutableString,
  numericValues: z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,31}$/), z.number().finite()).default({}),
  boundClaimIds: z.array(SafeIdString).default([]),
  verificationStatus: z.enum(['formally_verified', 'numerically_validated', 'human_review_required'])
}).strict();
export type ScientificExampleStepV1 = z.infer<typeof ScientificExampleStepV1Schema>;

export const VerifiedScientificExampleV1Schema = z.object({
  schemaVersion: z.literal(SCIENTIFIC_EXAMPLE_SCHEMA_VERSION_V1),
  exampleId: SafeIdString,
  title: NoExecutableString,
  conceptOrClaimIds: z.array(SafeIdString).min(1).max(12),
  variables: z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,31}$/), z.number().finite()),
  sourceExpression: z.string().trim().min(1).max(300),
  steps: z.array(ScientificExampleStepV1Schema).min(1).max(20),
  graphPoints: z.array(z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    stepId: SafeIdString.optional()
  }).strict()).max(100).default([]),
  narrationReferences: z.array(SafeIdString).default([]),
  subtitleReferences: z.array(SafeIdString).default([]),
  verificationStatus: z.enum(['formally_verified', 'numerically_validated', 'human_review_required']),
  verificationProofBinding: z.object({
    verifier: z.enum(['sympy', 'deterministic_numeric', 'human']),
    exactExpression: z.string().trim().min(1).max(300),
    proofReferenceId: SafeIdString.optional()
  }).strict()
}).strict().superRefine((example, ctx) => {
  const stepIds = new Set(example.steps.map((step) => step.stepId));
  example.graphPoints.forEach((point, index) => {
    if (point.stepId && !stepIds.has(point.stepId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['graphPoints', index, 'stepId'], message: 'Graph point references an unknown example step.' });
    }
  });
});
export type VerifiedScientificExampleV1 = z.infer<typeof VerifiedScientificExampleV1Schema>;

export const PedagogicalBeatV1Schema = z.object({
  schemaVersion: z.literal(PEDAGOGICAL_BEAT_SCHEMA_VERSION_V1),
  beatId: SafeIdString,
  sceneId: SafeIdString,
  learningObjective: NoExecutableString,
  pedagogicalIntent: z.enum([
    'activate_prior_knowledge',
    'pose_problem',
    'build_intuition',
    'define_formally',
    'demonstrate',
    'practice',
    'address_misconception',
    'summarize',
    'retrieve'
  ]),
  educationalQuestion: NoExecutableString,
  conceptOrClaimIds: z.array(SafeIdString).min(1).max(12),
  workedExampleReferences: z.array(SafeIdString).max(6).default([]),
  approvedNarrationText: NoExecutableString,
  visualIntent: EducationalVisualIntentV1Schema,
  recommendedVisualActions: z.array(EducationalVisualActionV1Schema).min(1).max(8),
  expectedLearnerTakeaway: NoExecutableString,
  timingConstraints: z.object({
    minimumFrames: z.number().int().positive(),
    preferredFrames: z.number().int().positive(),
    maximumFrames: z.number().int().positive(),
    allowMeaningfulHold: z.boolean().default(false)
  }).strict(),
  contentValidationStatus: z.enum([
    'verified',
    'numerically_validated',
    'source_grounded',
    'human_review_required',
    'blocked'
  ])
}).strict().superRefine((beat, ctx) => {
  const timing = beat.timingConstraints;
  if (!(timing.minimumFrames <= timing.preferredFrames && timing.preferredFrames <= timing.maximumFrames)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['timingConstraints'], message: 'Beat timing must satisfy minimum <= preferred <= maximum.' });
  }
  if (beat.recommendedVisualActions.includes('hold_for_reading') && !timing.allowMeaningfulHold) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['timingConstraints', 'allowMeaningfulHold'], message: 'A reading hold must be explicitly authorized.' });
  }
});
export type PedagogicalBeatV1 = z.infer<typeof PedagogicalBeatV1Schema>;

export const LearningModeV1Schema = z.enum(['short_recap', 'concept_explainer', 'full_lesson']);
export type LearningModeV1 = z.infer<typeof LearningModeV1Schema>;

export const EducationalQualityReportV1Schema = z.object({
  overallStatus: EducationalQualityStatusV1Schema,
  findings: z.array(EducationalQualityFindingV1Schema),
  checkedAt: z.string().datetime()
}).strict();
export type EducationalQualityReportV1 = z.infer<typeof EducationalQualityReportV1Schema>;
