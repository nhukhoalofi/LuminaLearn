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
  highlightActiveSignal: z.boolean().default(true),
  outputLabels: z.array(z.string().trim().max(30)).max(4).default([])
}).strict().superRefine((payload, ctx) => {
  const maxLayerIdx = payload.layers.length - 1;
  for (let i = 0; i < payload.weights.length; i++) {
    const w = payload.weights[i];
    if (w.fromLayer < 0 || w.fromLayer > maxLayerIdx || w.toLayer < 0 || w.toLayer > maxLayerIdx) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weights', i],
        message: `Chỉ số layer của weight (${w.fromLayer} -> ${w.toLayer}) vượt quá số layer hiện có (0-${maxLayerIdx})`
      });
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
}).strict();
export type LossLandscapeVisualPayload = z.infer<typeof LossLandscapeVisualPayloadSchema>;

// 4. Attention Heatmap Visual Payload
export const AttentionHeatmapVisualPayloadSchema = z.object({
  sceneType: z.literal('attention_heatmap'),
  tokens: z.array(z.string().trim().min(1).max(20)).min(2).max(8),
  matrix: z.array(z.array(z.number().finite().min(0).max(1))).min(2).max(8),
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
    // Softmax normalization constraint: tổng hàng phải xấp xỉ 1 (dung sai 0.15 cho làm tròn minh họa)
    if (Math.abs(sum - 1.0) > 0.15) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['matrix', i],
        message: `Tổng xác suất Softmax của hàng ${i} (${sum.toFixed(3)}) phải xấp xỉ 1.0`
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
  headline: z.string().max(120).optional(),
  formulaTex: z.string().max(200).optional(),
  notes: z.string().max(300).optional()
}).strict();
export type GenericSceneVisualPayload = z.infer<typeof GenericSceneVisualPayloadSchema>;

// Union của toàn bộ visual payloads có kiểm định chặt chẽ
export const EducationalVisualPayloadSchema = z.union([
  ConceptIntroVisualPayloadSchema,
  NeuralArchitectureVisualPayloadSchema,
  LossLandscapeVisualPayloadSchema,
  AttentionHeatmapVisualPayloadSchema,
  SummaryVisualPayloadSchema,
  GenericSceneVisualPayloadSchema
]);
export type EducationalVisualPayload = z.infer<typeof EducationalVisualPayloadSchema>;
