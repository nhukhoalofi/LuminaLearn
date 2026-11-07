import { LessonStoryboardSchema } from './storyboard.schema';
import type { LessonStoryboard, StoryboardValidationResult } from './types';

/**
 * Phân tích và validate storyboard bằng Zod schema.
 * Ném lỗi nếu input không hợp lệ.
 */
export function parseStoryboard(input: unknown): LessonStoryboard {
  return LessonStoryboardSchema.parse(input) as LessonStoryboard;
}

/**
 * Validate an toàn storyboard, trả về object kết quả với mảng lỗi chi tiết.
 */
export function validateStoryboard(input: unknown): StoryboardValidationResult {
  const result = LessonStoryboardSchema.safeParse(input);

  if (!result.success) {
    const errorMessages = result.error.issues.map((issue) => {
      const pathStr = issue.path.length > 0 ? `[${issue.path.join('.')}] ` : '';
      return `${pathStr}${issue.message}`;
    });

    return {
      success: false,
      errors: errorMessages
    };
  }

  return {
    success: true,
    data: result.data as LessonStoryboard
  };
}

/**
 * Tính tổng số frames của tất cả các scenes trong storyboard.
 */
export function getTotalFrames(storyboard: LessonStoryboard): number {
  return storyboard.scenes.reduce((sum, scene) => sum + scene.durationFrames, 0);
}

