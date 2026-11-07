import { z } from 'zod';

export const MATH_SCHEMA_VERSION = 'math-v1' as const;
export const DERIVATIVE_INTUITION_TOPIC = 'calculus.derivative.intuition' as const;

export const PolynomialFunctionSchema = z.object({
  type: z.literal('polynomial'),
  coefficients: z.array(z.number().finite())
    .min(2, 'A polynomial needs at least two coefficients')
    .max(6, 'MVP polynomials are limited to degree 5')
}).strict().superRefine((value, ctx) => {
  if (value.coefficients.at(-1) === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['coefficients'],
      message: 'The highest-order coefficient must be non-zero'
    });
  }
});

const MathSceneBaseSchema = z.object({
  schemaVersion: z.literal(MATH_SCHEMA_VERSION),
  topicId: z.literal(DERIVATIVE_INTUITION_TOPIC),
  function: PolynomialFunctionSchema,
  pointX: z.number().finite().min(-10).max(10),
  durationSeconds: z.number().finite().min(1).max(15),
  fps: z.number().int().min(12).max(60),
  width: z.number().int().min(360).max(1920),
  height: z.number().int().min(360).max(1920)
}).strict();

export const FunctionGraphMathSceneSchema = MathSceneBaseSchema.extend({
  visualization: z.literal('function_graph')
}).strict();

export const SecantToTangentMathSceneSchema = MathSceneBaseSchema.extend({
  visualization: z.literal('secant_to_tangent'),
  hStart: z.number().finite().min(0.05).max(5),
  hEnd: z.number().finite().min(0.001).max(0.5)
}).strict();

export const MathSceneSchema = z.discriminatedUnion('visualization', [
  FunctionGraphMathSceneSchema,
  SecantToTangentMathSceneSchema
]).superRefine((value, ctx) => {
  if (value.visualization === 'secant_to_tangent' && value.hEnd >= value.hStart) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['hEnd'],
      message: 'hEnd must be positive and smaller than hStart; h = 0 is forbidden'
    });
  }
});

