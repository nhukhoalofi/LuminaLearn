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
