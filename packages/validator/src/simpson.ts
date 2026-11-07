import type { Fact } from '@luminalearn/scene-schema';
import { compareFractions } from './arithmetic';

export interface SimpsonValidationResult {
  valid: boolean;
  reversalDetected: boolean;
  errors: string[];
  details?: {
    easyComparison: string;
    hardComparison: string;
    mergedComparison: string;
  };
}

/**
 * Kiểm tra tính đúng đắn toán học của Nghịch lý Simpson:
 * Bắt buộc thỏa mãn 3 bất đẳng thức:
 * 1. A_easy > B_easy
 * 2. A_hard > B_hard
 * 3. A_merged < B_merged  (Đảo chiều nghịch lý)
 */
export function validateSimpsonParadox(facts: Fact[]): SimpsonValidationResult {
  const errors: string[] = [];

  const easyA = facts.find((f) => f.id === 'fact_easy_a' || (f.group === 'easy' && f.id.includes('_a')));
  const easyB = facts.find((f) => f.id === 'fact_easy_b' || (f.group === 'easy' && f.id.includes('_b')));
  const hardA = facts.find((f) => f.id === 'fact_hard_a' || (f.group === 'hard' && f.id.includes('_a')));
  const hardB = facts.find((f) => f.id === 'fact_hard_b' || (f.group === 'hard' && f.id.includes('_b')));

  if (!easyA || !easyB || !hardA || !hardB) {
    return {
      valid: false,
      reversalDetected: false,
      errors: ['Không đủ 4 facts phân nhóm chuẩn (easy_a, easy_b, hard_a, hard_b) để xác thực Nghịch lý Simpson.']
    };
  }

  // 1. Kiểm tra nhóm dễ: A_easy > B_easy
  const easyComp = compareFractions(easyA.success, easyA.total, easyB.success, easyB.total);
  if (easyComp <= 0) {
    errors.push(
      `Tại nhóm dễ: Phương pháp A (${easyA.success}/${easyA.total}) không cao hơn B (${easyB.success}/${easyB.total}). Nghịch lý Simpson yêu cầu A phải thắng ở phân nhóm.`
    );
  }

  // 2. Kiểm tra nhóm khó: A_hard > B_hard
  const hardComp = compareFractions(hardA.success, hardA.total, hardB.success, hardB.total);
  if (hardComp <= 0) {
    errors.push(
      `Tại nhóm khó: Phương pháp A (${hardA.success}/${hardA.total}) không cao hơn B (${hardB.success}/${hardB.total}). Nghịch lý Simpson yêu cầu A phải thắng ở phân nhóm.`
    );
  }

  // 3. Tính tổng gộp
  const mergedSuccessA = easyA.success + hardA.success;
  const mergedTotalA = easyA.total + hardA.total;

  const mergedSuccessB = easyB.success + hardB.success;
  const mergedTotalB = easyB.total + hardB.total;

  // 4. Kiểm tra đảo chiều: A_merged < B_merged
  const mergedComp = compareFractions(mergedSuccessA, mergedTotalA, mergedSuccessB, mergedTotalB);
  const reversalDetected = mergedComp < 0;

  if (!reversalDetected) {
    errors.push(
      `Tại kết quả gộp: Phương pháp A (${mergedSuccessA}/${mergedTotalA}) không thua Phương pháp B (${mergedSuccessB}/${mergedTotalB}). Không xuất hiện hiệu ứng đảo chiều của Nghịch lý Simpson!`
    );
  }

  const details = {
    easyComparison: `${easyA.success}/${easyA.total} vs ${easyB.success}/${easyB.total} (A > B: ${easyComp > 0})`,
    hardComparison: `${hardA.success}/${hardA.total} vs ${hardB.success}/${hardB.total} (A > B: ${hardComp > 0})`,
    mergedComparison: `${mergedSuccessA}/${mergedTotalA} vs ${mergedSuccessB}/${mergedTotalB} (A < B: ${reversalDetected})`
  };

  return {
    valid: errors.length === 0,
    reversalDetected,
    errors,
    details
  };
}

