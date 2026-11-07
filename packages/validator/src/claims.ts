import type { LessonStoryboard, ConceptSummaryScene } from '@luminalearn/scene-schema';

export interface EducationalClaimsResult {
  valid: boolean;
  status: 'verified' | 'hypothetical_valid' | 'needs_review';
  hypotheticalCount: number;
  verifiedCount: number;
  unsupportedCount: number;
  warnings: string[];
  errors: string[];
}

/**
 * Kiểm định các tuyên bố khoa học và giáo dục trong Storyboard:
 * - Phân định rõ dữ liệu giả định (hypothetical) và dữ liệu có nguồn (verified).
 * - Nếu dùng dữ liệu giả định, bắt buộc phải có câu disclaimer rõ ràng trong scene concept_summary.
 * - Không cho phép đánh dấu tuyên bố là verified chỉ vì AI tự sinh.
 */
export function validateEducationalClaims(storyboard: LessonStoryboard): EducationalClaimsResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  let hypotheticalCount = 0;
  let verifiedCount = 0;
  let unsupportedCount = 0;

  for (const fact of storyboard.facts) {
    if (fact.isHypothetical) {
      hypotheticalCount++;
    } else if (fact.note && (fact.note.includes('nguồn') || fact.note.includes('source') || fact.note.includes('verified'))) {
      verifiedCount++;
    } else {
      unsupportedCount++;
    }
  }

  // Tìm scene concept_summary
  const summaryScene = storyboard.scenes.find(
    (s): s is ConceptSummaryScene => s.template === 'concept_summary'
  );

  if (hypotheticalCount > 0) {
    if (!summaryScene) {
      errors.push('Storyboard sử dụng dữ liệu giả định (hypothetical) nhưng thiếu Scene concept_summary để cảnh báo.');
    } else {
      const disclaimer = summaryScene.content.disclaimer.toLowerCase();
      const hasDisclaimerKeyword =
        disclaimer.includes('giả định') ||
        disclaimer.includes('minh họa') ||
        disclaimer.includes('hypothetical') ||
        disclaimer.includes('sư phạm');

      if (!hasDisclaimerKeyword) {
        errors.push(
          'Dữ liệu bài học là giả định nhưng disclaimer của concept_summary chưa ghi rõ từ khóa "giả định" hoặc "minh họa".'
        );
      }
    }
  }

  let status: 'verified' | 'hypothetical_valid' | 'needs_review' = 'verified';

  if (unsupportedCount > 0) {
    status = 'needs_review';
    warnings.push(`Có ${unsupportedCount} facts chưa được kiểm chứng nguồn gốc xác thực.`);
  } else if (hypotheticalCount > 0) {
    status = 'hypothetical_valid';
  }

  return {
    valid: errors.length === 0,
    status,
    hypotheticalCount,
    verifiedCount,
    unsupportedCount,
    warnings,
    errors
  };
}
