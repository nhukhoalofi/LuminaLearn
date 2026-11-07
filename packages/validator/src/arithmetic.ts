import type { Fact } from '@luminalearn/scene-schema';

export interface ArithmeticValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * So sánh 2 phân số bằng phép nhân chéo (cross-multiplication)
 * Tránh hoàn toàn lỗi làm tròn số thực dấu phẩy động (floating point).
 * n1/d1 so với n2/d2
 * Trả về:
 *  1 nếu n1/d1 > n2/d2
 * -1 nếu n1/d1 < n2/d2
 *  0 nếu n1/d1 == n2/d2
 */
export function compareFractions(
  n1: number,
  d1: number,
  n2: number,
  d2: number
): number {
  if (d1 <= 0 || d2 <= 0) {
    throw new Error('Mẫu số phải là số nguyên dương khi so sánh phân số.');
  }

  const cross1 = BigInt(Math.round(n1)) * BigInt(Math.round(d2));
  const cross2 = BigInt(Math.round(n2)) * BigInt(Math.round(d1));

  if (cross1 > cross2) return 1;
  if (cross1 < cross2) return -1;
  return 0;
}

/**
 * Kiểm tra tính hợp lệ số học của danh sách Fact:
 * - total > 0
 * - success >= 0
 * - success <= total
 */
export function validateFactArithmetic(facts: Fact[]): ArithmeticValidationResult {
  const errors: string[] = [];

  for (const fact of facts) {
    if (typeof fact.total !== 'number' || fact.total <= 0) {
      errors.push(`Fact '${fact.id}' có tổng số lần thử (total) không hợp lệ: ${fact.total} (yêu cầu total > 0).`);
    }

    if (typeof fact.success !== 'number' || fact.success < 0) {
      errors.push(`Fact '${fact.id}' có số ca thành công (success) không hợp lệ: ${fact.success} (yêu cầu >= 0).`);
    }

    if (typeof fact.success === 'number' && typeof fact.total === 'number' && fact.success > fact.total) {
      errors.push(
        `Fact '${fact.id}' có số ca thành công (${fact.success}) lớn hơn tổng số (${fact.total}), vi phạm nguyên lý xác suất cơ bản.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

