import { z } from 'zod';
import { NoExecutableString, SafeIdString } from '../v2/document';

/**
 * CHECKPOINT E: STRICT VISUAL SCENE DSL
 * Loại bỏ hoàn toàn kiểu `any` tự do trong visualPayload.
 * Bắt buộc toàn bộ giá trị số học phải hữu hạn (finite), không chứa NaN, Infinity, script tag hay mã thực thi.
 */

// 1. Concept Intro Visual Payload
export const ConceptIntroVisualPayloadSchema = z.object({
  sceneType: z.literal('concept_intro'),
  centralQuestion: z.string().trim().min(5).max(300),
  keyConcept: z.string().trim().min(2).max(100),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#22D3EE'),
  visualStyleId: z.enum(['clean_educational_infographic', 'math_chalkboard']).default('clean_educational_infographic'),
  reducedMotion: z.boolean().default(false)
}).strict();
export type ConceptIntroVisualPayload = z.infer<typeof ConceptIntroVisualPayloadSchema>;

// 2. Neural Architecture Visual Payload
export const NeuralLayerSpecSchema = z.object({
  layerId: SafeIdString,
  name: z.string().trim().min(1).max(50),
  nodeCount: z.number().int().min(1).max(8),
  activation: z.enum(['linear', 'sigmoid', 'relu', 'step']).optional()
}).strict();

export const NeuralWeightSpecSchema = z.object({
  fromLayer: z.number().int().nonnegative(),
  fromNode: z.number().int().nonnegative(),
  toLayer: z.number().int().nonnegative(),
  toNode: z.number().int().nonnegative(),
  weightValue: z.number().finite()
}).strict();

export const NeuralArchitectureVisualPayloadSchema = z.object({
  sceneType: z.literal('neural_architecture'),
  networkType: z.enum(['perceptron', 'feedforward', 'dense']).default('perceptron'),
  layers: z.array(NeuralLayerSpecSchema).min(1).max(5),
  weights: z.array(NeuralWeightSpecSchema).max(64).default([]),
  inputValues: z.array(z.number().finite()).max(8).default([]),
  signalMode: z.enum(['signal_flow_illustration', 'computed_forward_pass']).default('signal_flow_illustration'),
  computedOutputs: z.array(z.number().finite()).max(8).optional(),
  highlightActiveSignal: z.boolean().default(true),
  outputLabels: z.array(z.string().trim().max(30)).max(4).default([])
}).strict().superRefine((payload, ctx) => {
  const maxLayerIdx = payload.layers.length - 1;
  const layerIds = new Set<string>();
  payload.layers.forEach((layer, index) => {
    if (layerIds.has(layer.layerId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['layers', index, 'layerId'], message: `Trùng layerId: ${layer.layerId}` });
    }
    layerIds.add(layer.layerId);
  });
  if (payload.inputValues.length !== payload.layers[0]?.nodeCount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['inputValues'], message: 'Số giá trị đầu vào phải bằng nodeCount của lớp đầu vào' });
  }
  const edges = new Set<string>();
  for (let i = 0; i < payload.weights.length; i++) {
    const w = payload.weights[i];
    if (w.fromLayer < 0 || w.fromLayer > maxLayerIdx || w.toLayer < 0 || w.toLayer > maxLayerIdx) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weights', i],
        message: `Chỉ số layer của weight (${w.fromLayer} -> ${w.toLayer}) vượt quá số layer hiện có (0-${maxLayerIdx})`
      });
      continue;
    }
    if (w.toLayer !== w.fromLayer + 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weights', i], message: 'Cạnh neural chỉ được nối xuôi giữa hai lớp kề nhau' });
    }
    if (w.fromNode >= payload.layers[w.fromLayer].nodeCount || w.toNode >= payload.layers[w.toLayer].nodeCount) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weights', i], message: 'Cạnh neural tham chiếu node không tồn tại' });
    }
    const edgeId = `${w.fromLayer}:${w.fromNode}>${w.toLayer}:${w.toNode}`;
    if (edges.has(edgeId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weights', i], message: `Trùng cạnh neural: ${edgeId}` });
    }
    edges.add(edgeId);
  }
  if (payload.signalMode === 'computed_forward_pass' && !payload.computedOutputs?.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['computedOutputs'], message: 'computed_forward_pass yêu cầu computedOutputs' });
  } else if (payload.signalMode === 'computed_forward_pass' && payload.computedOutputs) {
    let values = payload.inputValues;
    const activate = (value: number, activation: 'linear' | 'sigmoid' | 'relu' | 'step' | undefined) => {
      if (activation === 'sigmoid') return 1 / (1 + Math.exp(-value));
      if (activation === 'relu') return Math.max(0, value);
      if (activation === 'step') return value >= 0 ? 1 : 0;
      return value;
    };
    for (let layerIndex = 1; layerIndex < payload.layers.length; layerIndex += 1) {
      const next = Array.from({ length: payload.layers[layerIndex].nodeCount }, (_, toNode) => {
        const sum = payload.weights
          .filter((weight) => weight.fromLayer === layerIndex - 1 && weight.toLayer === layerIndex && weight.toNode === toNode)
          .reduce((total, weight) => total + values[weight.fromNode] * weight.weightValue, 0);
        return activate(sum, payload.layers[layerIndex].activation);
      });
      values = next;
    }
    if (values.length !== payload.computedOutputs.length || values.some((value, index) => Math.abs(value - payload.computedOutputs![index]) > 1e-8)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['computedOutputs'], message: 'computedOutputs không khớp phép lan truyền xuôi từ inputValues và weights' });
    }
  }
});
export type NeuralArchitectureVisualPayload = z.infer<typeof NeuralArchitectureVisualPayloadSchema>;

// 3. Loss Landscape Visual Payload
export const OptimizationStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  w: z.number().finite(),
  loss: z.number().finite(),
  gradient: z.number().finite()
}).strict();

export const LossLandscapeVisualPayloadSchema = z.object({
  sceneType: z.literal('loss_landscape'),
  functionType: z.enum(['convex_quadratic', '1d_curve']).default('convex_quadratic'),
  minimumPoint: z.object({
    w: z.number().finite(),
    loss: z.number().finite()
  }).strict(),
  curvature: z.number().finite().positive(),
  currentParam: z.number().finite(),
  learningRate: z.number().finite().min(0.001).max(2.0),
  steps: z.array(OptimizationStepSchema).min(1).max(10),
  showGradientTangent: z.boolean().default(true)
}).strict().superRefine((payload, ctx) => {
  const tolerance = 1e-8;
  payload.steps.forEach((step, index) => {
    const delta = step.w - payload.minimumPoint.w;
    const expectedLoss = payload.curvature * delta * delta + payload.minimumPoint.loss;
    const expectedGradient = 2 * payload.curvature * delta;
    if (Math.abs(step.loss - expectedLoss) > tolerance) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['steps', index, 'loss'], message: `loss không khớp hàm quadratic; cần ${expectedLoss}` });
    }
    if (Math.abs(step.gradient - expectedGradient) > tolerance) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['steps', index, 'gradient'], message: `gradient không khớp đạo hàm quadratic; cần ${expectedGradient}` });
    }
    const next = payload.steps[index + 1];
    if (next) {
      const expectedNext = step.w - payload.learningRate * step.gradient;
      if (Math.abs(next.w - expectedNext) > tolerance) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['steps', index + 1, 'w'], message: `Bước cập nhật không khớp gradient descent; cần ${expectedNext}` });
      }
    }
  });
});
export type LossLandscapeVisualPayload = z.infer<typeof LossLandscapeVisualPayloadSchema>;

// 4. Attention Heatmap Visual Payload
export const AttentionHeatmapVisualPayloadSchema = z.object({
  sceneType: z.literal('attention_heatmap'),
  tokens: z.array(z.string().trim().min(1).max(20)).min(2).max(8),
  matrix: z.array(z.array(z.number().finite().min(0).max(1))).min(2).max(8),
  scoreMatrix: z.array(z.array(z.number().finite())).min(2).max(8).optional(),
  highlightTokenIndex: z.number().int().min(0).max(7).optional(),
  isIllustrative: z.boolean().default(true)
}).strict().superRefine((payload, ctx) => {
  const n = payload.tokens.length;
  if (payload.matrix.length !== n) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['matrix'],
      message: `Ma trận Attention phải có kích thước vuông khớp với số token (${n}x${n}), nhận được ${payload.matrix.length} hàng`
    });
    return;
  }
  if (payload.highlightTokenIndex !== undefined && payload.highlightTokenIndex >= n) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['highlightTokenIndex'], message: 'highlightTokenIndex vượt quá số token' });
  }
  if (payload.scoreMatrix && (payload.scoreMatrix.length !== n || payload.scoreMatrix.some((row) => row.length !== n))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scoreMatrix'], message: `scoreMatrix phải có kích thước ${n}x${n}` });
  }
  for (let i = 0; i < n; i++) {
    const row = payload.matrix[i];
    if (row.length !== n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['matrix', i],
        message: `Hàng ${i} có độ dài ${row.length}, cần đúng ${n}`
      });
      continue;
    }
    const sum = row.reduce((acc, v) => acc + v, 0);
    if (Math.abs(sum - 1.0) > 1e-6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['matrix', i],
        message: `Tổng xác suất Softmax của hàng ${i} (${sum.toFixed(3)}) phải xấp xỉ 1.0`
      });
    }
    const scores = payload.scoreMatrix?.[i];
    if (scores?.length === n) {
      const max = Math.max(...scores);
      const exps = scores.map((score) => Math.exp(score - max));
      const denominator = exps.reduce((acc, value) => acc + value, 0);
      exps.forEach((value, column) => {
        const expected = value / denominator;
        if (Math.abs(row[column] - expected) > 1e-6) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['matrix', i, column], message: 'Trọng số không khớp stable softmax của scoreMatrix' });
        }
      });
    }
  }
});
export type AttentionHeatmapVisualPayload = z.infer<typeof AttentionHeatmapVisualPayloadSchema>;

// 5. Summary Visual Payload
export const SummaryVisualPayloadSchema = z.object({
  sceneType: z.literal('summary'),
  title: z.string().trim().min(2).max(120),
  takeaways: z.array(z.string().trim().min(3).max(150)).min(2).max(4),
  verifiedFacts: z.array(z.string().trim().max(150)).max(4).default([]),
  reviewNotes: z.array(z.string().trim().max(150)).max(4).default([]),
  finalCallout: z.string().trim().max(200)
}).strict();
export type SummaryVisualPayload = z.infer<typeof SummaryVisualPayloadSchema>;

// 6. Generic/Math Plot Fallback Payloads
export const GenericSceneVisualPayloadSchema = z.object({
  sceneType: z.enum(['formula_derivation', 'graph_plot', 'flowchart_simulation', 'comparison_table']),
  headline: NoExecutableString.optional(),
  formulaTex: NoExecutableString.optional(),
  notes: NoExecutableString.optional()
}).strict();
export type GenericSceneVisualPayload = z.infer<typeof GenericSceneVisualPayloadSchema>;

export const AlgebraTransformationStepSchema = z.object({
  expression: z.string().trim().min(1).max(120).regex(/^[a-b0-9+\-*/^() ]+$/),
  explanationVietnamese: NoExecutableString,
  highlightTerms: z.array(z.string().trim().min(1).max(24)).max(6).default([])
}).strict();

export const AlgebraIdentityVisualPayloadSchema = z.object({
  sceneType: z.literal('algebra_identity'),
  identityId: z.enum(['square_sum', 'square_difference', 'difference_squares', 'cube_sum_expansion', 'cube_difference_expansion', 'sum_cubes', 'difference_cubes']),
  leftExpression: z.string().trim().min(1).max(120).regex(/^[a-b0-9+\-*/^() ]+$/),
  rightExpression: z.string().trim().min(1).max(120).regex(/^[a-b0-9+\-*/^() ]+$/),
  transformationSteps: z.array(AlgebraTransformationStepSchema).min(2).max(6),
  presentation: z.enum(['expansion', 'factorization', 'comparison'])
}).strict().superRefine((payload, ctx) => {
  if (payload.transformationSteps[0]?.expression !== payload.leftExpression) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['transformationSteps', 0, 'expression'], message: 'Bước đầu phải giữ nguyên vế trái đã được xác minh' });
  }
  if (payload.transformationSteps.at(-1)?.expression !== payload.rightExpression) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['transformationSteps'], message: 'Bước cuối phải đúng vế phải đã được xác minh' });
  }
});
export type AlgebraIdentityVisualPayload = z.infer<typeof AlgebraIdentityVisualPayloadSchema>;

// Union của toàn bộ visual payloads có kiểm định chặt chẽ
export const EducationalVisualPayloadSchema = z.union([
  ConceptIntroVisualPayloadSchema,
  NeuralArchitectureVisualPayloadSchema,
  LossLandscapeVisualPayloadSchema,
  AttentionHeatmapVisualPayloadSchema,
  AlgebraIdentityVisualPayloadSchema,
  SummaryVisualPayloadSchema,
  GenericSceneVisualPayloadSchema
]);
export type EducationalVisualPayload = z.infer<typeof EducationalVisualPayloadSchema>;

// ============================================================================
// CHECKPOINT A: UNIVERSAL VISUAL DSL V3.1 CONTRACTS & PRIMITIVES
// ============================================================================
export const EDUCATIONAL_VISUAL_DSL_VERSION_V3 = 'visual-dsl-v3.1';
export type EducationalVisualDSLVersionV3 = typeof EDUCATIONAL_VISUAL_DSL_VERSION_V3;

export const VisualAnimationPresetV3Schema = z.enum([
  'fade_in',
  'slide_up',
  'draw_line',
  'highlight_pulse',
  'step_reveal',
  'spring_scale',
  'none'
]);
export type VisualAnimationPresetV3 = z.infer<typeof VisualAnimationPresetV3Schema>;

export const VisualLayoutPresetV3Schema = z.enum([
  'split_horizontal',
  'split_vertical',
  'centered_focus',
  'grid_2x2',
  'full_canvas',
  'stacked_column'
]);
export type VisualLayoutPresetV3 = z.infer<typeof VisualLayoutPresetV3Schema>;

export const VisualStylePresetV3Schema = z.enum([
  'clean_educational_infographic',
  'math_chalkboard',
  'ai_neural_visualization'
]);
export type VisualStylePresetV3 = z.infer<typeof VisualStylePresetV3Schema>;

export const TimelineMarkerV3Schema = z.object({
  frame: z.number().int().nonnegative(),
  label: z.string().trim().min(1).max(100),
  eventType: z.enum(['reveal', 'highlight', 'transition', 'compute', 'callout'])
}).strict();
export type TimelineMarkerV3 = z.infer<typeof TimelineMarkerV3Schema>;

export const VisualTimelineV3Schema = z.object({
  startFrame: z.number().int().nonnegative().default(0),
  durationFrames: z.number().int().positive(),
  fps: z.literal(24).default(24),
  markers: z.array(TimelineMarkerV3Schema).default([])
}).strict();
export type VisualTimelineV3 = z.infer<typeof VisualTimelineV3Schema>;

// --- Controlled Visual Primitives ---
export const VisualTextElementSchema = z.object({
  elementType: z.literal('text'),
  elementId: SafeIdString,
  content: z.string().trim().min(1).max(500),
  typography: z.enum(['heading_1', 'heading_2', 'body', 'caption', 'code']).default('body'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#F8FAFC'),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }).optional(),
  animation: VisualAnimationPresetV3Schema.default('fade_in')
}).strict();

export const MathContentPolicySchema = z.enum([
  'formal_verified',
  'illustrative_unverified',
  'conceptual'
]);
export type MathContentPolicy = z.infer<typeof MathContentPolicySchema>;

export const VisualFormulaElementSchema = z.object({
  elementType: z.literal('formula'),
  elementId: SafeIdString,
  latex: z.string().trim().min(1).max(300),
  revealSpeed: z.enum(['slow', 'medium', 'fast', 'instant']).default('medium'),
  highlightTerms: z.array(z.string().trim().max(50)).default([]),
  claimId: SafeIdString.optional(),
  contentPolicy: MathContentPolicySchema.optional(),
  fontSize: z.number().min(12).max(72).default(36),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#38BDF8'),
  animation: VisualAnimationPresetV3Schema.default('step_reveal')
}).strict();

export const VisualGraphElementSchema = z.object({
  elementType: z.literal('graph'),
  elementId: SafeIdString,
  functionType: z.enum(['convex_quadratic', 'sine', 'polynomial', 'exponential', 'custom_curve']),
  expression: z.string().max(100).optional(),
  claimId: SafeIdString.optional(),
  contentPolicy: MathContentPolicySchema.optional(),
  xRange: z.tuple([z.number().finite(), z.number().finite()]).default([-3, 3]),
  yRange: z.tuple([z.number().finite(), z.number().finite()]).default([-1, 9]),
  showTangentLine: z.boolean().default(false),
  tangentAtX: z.number().finite().optional(),
  animation: VisualAnimationPresetV3Schema.default('draw_line')
}).strict();

export const VisualAxesElementSchema = z.object({
  elementType: z.literal('axes'),
  elementId: SafeIdString,
  xLabel: z.string().max(30).default('x'),
  yLabel: z.string().max(30).default('y'),
  showGrid: z.boolean().default(true),
  gridColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#334155')
}).strict();

export const VisualPointElementSchema = z.object({
  elementType: z.literal('point'),
  elementId: SafeIdString,
  coordinates: z.tuple([z.number().finite(), z.number().finite()]),
  label: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#EF4444'),
  pulse: z.boolean().default(false),
  animation: VisualAnimationPresetV3Schema.default('highlight_pulse')
}).strict();

export const VisualVectorElementSchema = z.object({
  elementType: z.literal('vector'),
  elementId: SafeIdString,
  start: z.tuple([z.number().finite(), z.number().finite()]),
  end: z.tuple([z.number().finite(), z.number().finite()]),
  label: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#10B981')
}).strict();

export const VisualArrowElementSchema = z.object({
  elementType: z.literal('arrow'),
  elementId: SafeIdString,
  fromElementId: SafeIdString,
  toElementId: SafeIdString,
  curve: z.number().finite().default(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#94A3B8')
}).strict();

export const VisualMatrixElementSchema = z.object({
  elementType: z.literal('matrix'),
  elementId: SafeIdString,
  rows: z.number().int().min(1).max(8),
  cols: z.number().int().min(1).max(8),
  values: z.array(z.array(z.number().finite())).min(1).max(8),
  rowLabels: z.array(z.string().max(20)).optional(),
  colLabels: z.array(z.string().max(20)).optional(),
  showHeatmap: z.boolean().default(false),
  animation: VisualAnimationPresetV3Schema.default('fade_in')
}).strict();

export const VisualChartElementSchema = z.object({
  elementType: z.literal('chart'),
  elementId: SafeIdString,
  chartType: z.enum(['bar', 'line', 'scatter']),
  labels: z.array(z.string().max(30)).min(1).max(12),
  data: z.array(z.number().finite()).min(1).max(12),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366F1')
}).strict();

export const VisualNeuralNodeElementSchema = z.object({
  elementType: z.literal('neural_node'),
  elementId: SafeIdString,
  layerIndex: z.number().int().nonnegative(),
  nodeIndex: z.number().int().nonnegative(),
  activation: z.enum(['linear', 'sigmoid', 'relu', 'step']).default('linear'),
  state: z.enum(['idle', 'active', 'firing']).default('idle'),
  value: z.number().finite().optional(),
  label: z.string().max(20).optional()
}).strict();

export const VisualNeuralConnectionElementSchema = z.object({
  elementType: z.literal('neural_connection'),
  elementId: SafeIdString,
  fromLayer: z.number().int().nonnegative(),
  fromNode: z.number().int().nonnegative(),
  toLayer: z.number().int().nonnegative(),
  toNode: z.number().int().nonnegative(),
  weight: z.number().finite(),
  signalActive: z.boolean().default(false)
}).strict();

export const VisualShapeElementSchema = z.object({
  elementType: z.literal('shape'),
  elementId: SafeIdString,
  shapeType: z.enum(['rectangle', 'circle', 'box']),
  width: z.number().positive(),
  height: z.number().positive(),
  fill: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1E293B'),
  borderColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  borderWidth: z.number().nonnegative().default(1)
}).strict();

export const VisualCalloutElementSchema = z.object({
  elementType: z.literal('callout'),
  elementId: SafeIdString,
  text: z.string().trim().min(1).max(250),
  calloutType: z.enum(['note', 'warning', 'key_takeaway', 'pedagogical_tip']).default('note'),
  position: z.enum(['top', 'bottom', 'left', 'right', 'center']).default('bottom'),
  animation: VisualAnimationPresetV3Schema.default('slide_up')
}).strict();

export const VisualHighlightedRegionElementSchema = z.object({
  elementType: z.literal('highlighted_region'),
  elementId: SafeIdString,
  bounds: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive(),
    height: z.number().positive()
  }).strict(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#FBBF24'),
  opacity: z.number().min(0).max(1).default(0.2)
}).strict();

export const VisualLabeledStepElementSchema = z.object({
  elementType: z.literal('labeled_step'),
  elementId: SafeIdString,
  stepNumber: z.number().int().positive(),
  title: z.string().trim().min(1).max(100),
  formula: z.string().max(200).optional(),
  explanation: z.string().trim().min(1).max(250),
  active: z.boolean().default(true)
}).strict();

export const VisualTimelineMarkerElementSchema = z.object({
  elementType: z.literal('timeline_marker'),
  elementId: SafeIdString,
  frame: z.number().int().nonnegative(),
  label: z.string().max(50),
  eventType: z.enum(['reveal', 'highlight', 'transition', 'compute', 'callout'])
}).strict();

// Controlled Primitive Elements Union
export const VisualElementV3Schema = z.discriminatedUnion('elementType', [
  VisualTextElementSchema,
  VisualFormulaElementSchema,
  VisualGraphElementSchema,
  VisualAxesElementSchema,
  VisualPointElementSchema,
  VisualVectorElementSchema,
  VisualArrowElementSchema,
  VisualMatrixElementSchema,
  VisualChartElementSchema,
  VisualNeuralNodeElementSchema,
  VisualNeuralConnectionElementSchema,
  VisualShapeElementSchema,
  VisualCalloutElementSchema,
  VisualHighlightedRegionElementSchema,
  VisualLabeledStepElementSchema,
  VisualTimelineMarkerElementSchema
]);
export type VisualElementV3 = z.infer<typeof VisualElementV3Schema>;
export type VisualGraphElement = Extract<VisualElementV3, { elementType: 'graph' }>;
export type VisualPointElement = Extract<VisualElementV3, { elementType: 'point' }>;
export type VisualVectorElement = Extract<VisualElementV3, { elementType: 'vector' }>;
export type VisualFormulaElement = Extract<VisualElementV3, { elementType: 'formula' }>;
export type VisualMatrixElement = Extract<VisualElementV3, { elementType: 'matrix' }>;

// Mathematical Binding: Binds visual formula to SymPy-verified claim
export const VerifiedMathBindingV3Schema = z.object({
  bindingId: SafeIdString,
  claimId: SafeIdString,
  elementId: SafeIdString,
  formalExpression: z.string().trim().min(1).max(200),
  mathSymbol: z.string().trim().max(50),
  sympySummary: z.string().trim().max(300).optional(),
  isVerified: z.boolean().default(true)
}).strict();
export type VerifiedMathBindingV3 = z.infer<typeof VerifiedMathBindingV3Schema>;

export const TrustedVisualMathBindingV3Schema = z.object({
  authority: z.literal('server_sympy_v3'),
  claimId: SafeIdString,
  elementId: SafeIdString,
  verifiedExpression: z.string().trim().min(1).max(300),
  normalizedExpressionFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  verificationResult: z.literal('formally_verified'),
  verificationTimestamp: z.string().datetime(),
  approvedDraftVersion: z.number().int().positive(),
  sourceSceneId: SafeIdString
}).strict();
export type TrustedVisualMathBindingV3 = z.infer<typeof TrustedVisualMathBindingV3Schema>;

// Visual Data Binding: Dynamic parameter links
export const VisualDataBindingV3Schema = z.object({
  bindingKey: SafeIdString,
  targetElementId: SafeIdString,
  sourceProperty: z.string().min(1).max(100),
  transform: z.enum(['identity', 'percentage', 'fixed_decimal_2', 'fixed_decimal_4']).default('identity')
}).strict();
export type VisualDataBindingV3 = z.infer<typeof VisualDataBindingV3Schema>;

// Complete Visual Scene Definition
export const VisualSceneDefinitionV3Schema = z.object({
  schemaVersion: z.literal(EDUCATIONAL_VISUAL_DSL_VERSION_V3).default(EDUCATIONAL_VISUAL_DSL_VERSION_V3),
  sceneId: SafeIdString,
  sceneType: z.string().trim().min(2).max(50),
  layout: VisualLayoutPresetV3Schema.default('centered_focus'),
  style: VisualStylePresetV3Schema.default('clean_educational_infographic'),
  animation: VisualAnimationPresetV3Schema.default('fade_in'),
  elements: z.array(VisualElementV3Schema).default([]),
  timeline: VisualTimelineV3Schema.optional(),
  mathBindings: z.array(VerifiedMathBindingV3Schema).default([]),
  trustedMathBindings: z.array(TrustedVisualMathBindingV3Schema).default([]),
  dataBindings: z.array(VisualDataBindingV3Schema).default([]),
  legacyPayload: EducationalVisualPayloadSchema.optional()
}).strict().superRefine((scene, ctx) => {
  const ids = new Set<string>();
  scene.elements.forEach((element, index) => {
    if (ids.has(element.elementId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['elements', index, 'elementId'], message: `Trùng elementId '${element.elementId}'` });
    ids.add(element.elementId);
    if ('position' in element && element.position && typeof element.position === 'object' && (element.position.x < 0 || element.position.x > 720 || element.position.y < 0 || element.position.y > 1280)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['elements', index, 'position'], message: 'Vị trí phải nằm trong canvas an toàn 720x1280' });
    }
    if (element.elementType === 'matrix' && (element.values.length !== element.rows || element.values.some((row) => row.length !== element.cols))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['elements', index, 'values'], message: 'Kích thước values phải khớp rows x cols' });
    }
    if (element.elementType === 'graph' && (element.xRange[0] >= element.xRange[1] || element.yRange[0] >= element.yRange[1])) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['elements', index], message: 'Miền đồ thị phải tăng nghiêm ngặt' });
    }
  });
  scene.elements.forEach((element, index) => {
    if (element.elementType === 'arrow' && (!ids.has(element.fromElementId) || !ids.has(element.toElementId))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['elements', index], message: 'Arrow tham chiếu element không tồn tại' });
    }
    if (element.elementType === 'neural_connection') {
      const nodes = scene.elements.filter((candidate) => candidate.elementType === 'neural_node');
      const from = nodes.some((node) => node.layerIndex === element.fromLayer && node.nodeIndex === element.fromNode);
      const to = nodes.some((node) => node.layerIndex === element.toLayer && node.nodeIndex === element.toNode);
      if (!from || !to || element.toLayer <= element.fromLayer) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['elements', index], message: 'Neural connection phải nối xuôi giữa hai node tồn tại' });
    }
  });
  scene.mathBindings.forEach((binding, index) => {
    const element = scene.elements.find((candidate) => candidate.elementId === binding.elementId);
    if (!element || (element.elementType !== 'formula' && element.elementType !== 'graph')) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mathBindings', index, 'elementId'], message: 'Math binding phải tham chiếu formula hoặc graph element tồn tại' });
  });
  scene.trustedMathBindings.forEach((binding, index) => {
    const element = scene.elements.find((candidate) => candidate.elementId === binding.elementId);
    if (!element || (element.elementType !== 'formula' && element.elementType !== 'graph') || element.claimId !== binding.claimId || binding.sourceSceneId !== scene.sceneId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['trustedMathBindings', index], message: 'Trusted binding phải khớp formula/graph, claim và scene hiện tại' });
    }
  });
  scene.dataBindings.forEach((binding, index) => {
    if (!ids.has(binding.targetElementId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dataBindings', index, 'targetElementId'], message: 'Data binding tham chiếu element không tồn tại' });
  });
  scene.timeline?.markers.forEach((marker, index) => {
    if (marker.frame >= scene.timeline!.durationFrames) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['timeline', 'markers', index, 'frame'], message: 'Timeline marker nằm ngoài durationFrames' });
  });
});
export type VisualSceneDefinitionV3 = z.infer<typeof VisualSceneDefinitionV3Schema>;

export const VISUAL_PRIMITIVE_READINESS_V3 = {
  text: 'render_ready', formula: 'render_ready', graph: 'render_ready', axes: 'render_ready', point: 'render_ready',
  arrow: 'render_ready', matrix: 'render_ready', labeled_step: 'render_ready', neural_node: 'render_ready', neural_connection: 'render_ready',
  vector: 'schema_only', chart: 'schema_only', shape: 'schema_only', callout: 'schema_only', highlighted_region: 'schema_only', timeline_marker: 'schema_only'
} as const satisfies Record<VisualElementV3['elementType'], 'schema_only' | 'preview_ready' | 'render_ready' | 'end_to_end_verified'>;
