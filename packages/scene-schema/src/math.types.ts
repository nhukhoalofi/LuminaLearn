import type { z } from 'zod';
import type {
  FunctionGraphMathSceneSchema,
  MathSceneSchema,
  PolynomialFunctionSchema,
  SecantToTangentMathSceneSchema
} from './math.schema';

export type PolynomialFunction = z.infer<typeof PolynomialFunctionSchema>;
export type FunctionGraphMathScene = z.infer<typeof FunctionGraphMathSceneSchema>;
export type SecantToTangentMathScene = z.infer<typeof SecantToTangentMathSceneSchema>;
export type MathScene = z.infer<typeof MathSceneSchema>;

export interface MathSceneValidationResult {
  success: boolean;
  data?: MathScene;
  errors?: string[];
}

