import { MathSceneSchema } from './math.schema';
import type { MathScene, MathSceneValidationResult } from './math.types';

export function parseMathScene(input: unknown): MathScene {
  return MathSceneSchema.parse(input);
}

export function validateMathScene(input: unknown): MathSceneValidationResult {
  const result = MathSceneSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? `[${issue.path.join('.')}] ` : '';
        return `${path}${issue.message}`;
      })
    };
  }

  return { success: true, data: result.data };
}

