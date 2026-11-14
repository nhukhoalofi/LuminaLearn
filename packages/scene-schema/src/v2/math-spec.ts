import { z } from 'zod';
import { SafeIdString } from './document';

export const SupportedMathVisualizationTypeSchema = z.enum([
  'secant_to_tangent',
  'riemann_sum',
  'function_graph'
]);

export type SupportedMathVisualizationType = z.infer<typeof SupportedMathVisualizationTypeSchema>;

/**
 * Đặc tả hàm số được hiển thị trực quan và kiểm định hình thức
 */
export const MathFunctionSpecSchema = z.object({
  type: z.literal('polynomial'),
  // Hệ số đa thức theo thứ tự bậc tăng dần: [c0, c1, c2, ...] biểu diễn c0 + c1*x + c2*x^2 + ...
  coefficients: z.array(z.number()).min(2).max(6),
  expression: z.string().trim().min(1).max(200).optional()
}).strict();

export type MathFunctionSpec = z.infer<typeof MathFunctionSpecSchema>;

/**
 * Tham số trực quan hóa toán học chi tiết cho từng loại bài toán
 */
export const MathVisualizationParametersSchema = z.object({
  // Tham số cho secant_to_tangent
  pointX: z.number().optional(),
  hStart: z.number().optional(),
  hEnd: z.number().optional(),
  // Tham số cho riemann_sum
  interval: z.tuple([z.number(), z.number()]).optional(),
  partitions: z.array(z.number().int().min(1).max(1000)).min(1).max(10).optional(),
  method: z.enum(['left', 'right', 'midpoint', 'trapezoid']).default('left').optional(),
  // Thời lượng và khung hình
  durationSeconds: z.number().positive().max(60).default(10.83).optional(),
  fps: z.number().int().min(12).max(60).default(24).optional()
}).strict().superRefine((params, ctx) => {
  if (params.interval && params.interval[0] >= params.interval[1]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['interval'],
      message: `Interval start (${params.interval[0]}) must be strictly less than end (${params.interval[1]})`
    });
  }
  if (params.hStart !== undefined && params.hEnd !== undefined) {
    if (params.hEnd === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hEnd'],
        message: 'hEnd cannot be 0 (limit approaches 0)'
      });
    }
  }
});

export type MathVisualizationParameters = z.infer<typeof MathVisualizationParametersSchema>;

/**
 * Đặc tả toán học hoàn chỉnh kết nối verifier, storyboard và manim render engine
 */
export const MathVisualizationSpecV2Schema = z.object({
  topicId: z.string().regex(/^[a-z0-9_.-]{3,80}$/),
  visualization: SupportedMathVisualizationTypeSchema,
  function: MathFunctionSpecSchema,
  parameters: MathVisualizationParametersSchema,
  boundClaimIds: z.array(SafeIdString).default([])
}).strict();

export type MathVisualizationSpecV2 = z.infer<typeof MathVisualizationSpecV2Schema>;

