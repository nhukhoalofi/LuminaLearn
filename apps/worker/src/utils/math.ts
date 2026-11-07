/**
 * Pure math & formatting functions for LuminaLearn Video Engine
 * Không hardcode phần trăm - tất cả được tính toán trực tiếp từ facts.
 */

export interface RatioData {
  success: number;
  total: number;
}

/**
 * Tính phần trăm từ số thành công và tổng số
 */
export function computePercentage(success: number, total: number): number {
  if (total <= 0) return 0;
  return (success / total) * 100;
}

/**
 * Định dạng phần trăm theo chuẩn tiếng Việt hoặc số thập phân sạch
 */
export function formatPercentage(
  percent: number,
  decimals: number = 1,
  locale: string = 'vi-VN'
): string {
  const rounded = Number(percent.toFixed(decimals));
  // Nếu là số nguyên thì không cần số thập phân
  if (Number.isInteger(rounded)) {
    return `${rounded}%`;
  }
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  }).format(percent)}%`;
}

/**
 * Định dạng tỷ lệ thành công / tổng số (vd: 9/10)
 */
export function formatRatio(success: number, total: number): string {
  return `${success}/${total}`;
}

/**
 * Gộp hai tập dữ liệu (cộng dồn success và total)
 */
export function sumFacts(a: RatioData, b: RatioData): RatioData {
  return {
    success: a.success + b.success,
    total: a.total + b.total
  };
}

