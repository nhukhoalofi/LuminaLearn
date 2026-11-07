import type { LessonStoryboard, Scene, Fact } from '@luminalearn/scene-schema';
import { validateStoryboard } from '@luminalearn/scene-schema';
import { validateFactArithmetic } from './arithmetic';
import { validateSimpsonParadox, type SimpsonValidationResult } from './simpson';
import { validateEducationalClaims, type EducationalClaimsResult } from './claims';
import { FactRegistry } from './registry';

export interface ScienceValidationResult {
  valid: boolean;
  status: 'verified' | 'hypothetical_valid' | 'needs_review' | 'rejected' | 'unsupported_topic';
  errors: string[];
  warnings: string[];
  claims: {
    hypothetical: number;
    verified: number;
    unsupported: number;
  };
  simpsonAnalysis?: SimpsonValidationResult;
  claimsAnalysis?: EducationalClaimsResult;
}

/**
 * Kiểm tra tính toàn vẹn tham chiếu của các Fact ID trong Scene
 */
export function validateFactReferences(scenes: Scene[], facts: Fact[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const factIds = new Set(facts.map((f) => f.id));

  for (const scene of scenes) {
    if (scene.template === 'dual_comparison') {
      if (!factIds.has(scene.content.factAId)) {
        errors.push(`Scene '${scene.id}' tham chiếu factAId '${scene.content.factAId}' không tồn tại.`);
      }
      if (!factIds.has(scene.content.factBId)) {
        errors.push(`Scene '${scene.id}' tham chiếu factBId '${scene.content.factBId}' không tồn tại.`);
      }
    } else if (scene.template === 'data_merge') {
      const refs = [
        scene.content.factAId1,
        scene.content.factAId2,
        scene.content.factBId1,
        scene.content.factBId2
      ];
      for (const ref of refs) {
        if (!factIds.has(ref)) {
          errors.push(`Scene '${scene.id}' tham chiếu Fact ID '${ref}' không tồn tại.`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Tổng hợp toàn bộ quá trình thẩm định khoa học & sư phạm cho LessonStoryboard
 */
export function validateLessonStoryboard(
  storyboard: LessonStoryboard,
  userTopic?: string
): ScienceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Kiểm tra chủ đề có được hỗ trợ ở Phase 3 không
  const topicToCheck = userTopic || storyboard.title;
  if (!FactRegistry.isTopicSupported(topicToCheck)) {
    return {
      valid: false,
      status: 'unsupported_topic',
      errors: [
        `Chủ đề '${topicToCheck}' hiện chưa nằm trong danh mục hỗ trợ của MVP Phase 3 (Hiện tại chỉ hỗ trợ 'Nghịch lý Simpson').`
      ],
      warnings: [],
      claims: { hypothetical: 0, verified: 0, unsupported: 0 }
    };
  }

  // 2. Kiểm tra Schema Zod cơ bản
  const schemaResult = validateStoryboard(storyboard);
  if (!schemaResult.success && schemaResult.errors) {
    errors.push(...schemaResult.errors);
  }

  // 3. Kiểm tra số học Fact (total > 0, success <= total)
  const arithmeticResult = validateFactArithmetic(storyboard.facts);
  if (!arithmeticResult.valid) {
    errors.push(...arithmeticResult.errors);
  }

  // 4. Kiểm tra tham chiếu Fact trong Scene
  const refResult = validateFactReferences(storyboard.scenes, storyboard.facts);
  if (!refResult.valid) {
    errors.push(...refResult.errors);
  }

  // 5. Kiểm tra toán học Nghịch lý Simpson
  let simpsonAnalysis: SimpsonValidationResult | undefined;
  if (FactRegistry.isTopicSupported(topicToCheck)) {
    simpsonAnalysis = validateSimpsonParadox(storyboard.facts);
    if (!simpsonAnalysis.valid) {
      errors.push(...simpsonAnalysis.errors);
    }
  }

  // 6. Kiểm định các khẳng định giáo dục (Hypothetical vs Verified disclaimer)
  const claimsAnalysis = validateEducationalClaims(storyboard);
  if (!claimsAnalysis.valid) {
    errors.push(...claimsAnalysis.errors);
  }
  warnings.push(...claimsAnalysis.warnings);

  let status: ScienceValidationResult['status'] = 'verified';
  if (errors.length > 0) {
    status = 'rejected';
  } else if (claimsAnalysis.status === 'needs_review') {
    status = 'needs_review';
  } else if (claimsAnalysis.status === 'hypothetical_valid') {
    status = 'hypothetical_valid';
  }

  return {
    valid: errors.length === 0,
    status,
    errors,
    warnings,
    claims: {
      hypothetical: claimsAnalysis.hypotheticalCount,
      verified: claimsAnalysis.verifiedCount,
      unsupported: claimsAnalysis.unsupportedCount
    },
    simpsonAnalysis,
    claimsAnalysis
  };
}

