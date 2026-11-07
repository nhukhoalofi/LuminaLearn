import type { Fact } from '@luminalearn/scene-schema';

/**
 * Bộ dữ liệu chuẩn mực cho Nghịch lý Simpson (Phase 2 & Phase 3 baseline)
 * Dữ liệu giả định phục vụ sư phạm đã qua kiểm định số học.
 */
export const CANONICAL_SIMPSON_FACTS: Fact[] = [
  {
    id: 'fact_easy_a',
    label: 'Phương pháp A (Nhóm Dễ)',
    group: 'easy',
    success: 9,
    total: 10,
    unit: 'ca hồi phục',
    note: '9/10 ca thành công (90%)',
    isHypothetical: true
  },
  {
    id: 'fact_easy_b',
    label: 'Phương pháp B (Nhóm Dễ)',
    group: 'easy',
    success: 80,
    total: 100,
    unit: 'ca hồi phục',
    note: '80/100 ca thành công (80%)',
    isHypothetical: true
  },
  {
    id: 'fact_hard_a',
    label: 'Phương pháp A (Nhóm Khó)',
    group: 'hard',
    success: 20,
    total: 100,
    unit: 'ca hồi phục',
    note: '20/100 ca thành công (20%)',
    isHypothetical: true
  },
  {
    id: 'fact_hard_b',
    label: 'Phương pháp B (Nhóm Khó)',
    group: 'hard',
    success: 1,
    total: 10,
    unit: 'ca hồi phục',
    note: '1/10 ca thành công (10%)',
    isHypothetical: true
  }
];

export class FactRegistry {
  private static registeredTopics: Map<string, Fact[]> = new Map([
    ['simpson', CANONICAL_SIMPSON_FACTS]
  ]);

  /**
   * Kiểm tra xem chủ đề có nằm trong danh mục hỗ trợ của MVP không.
   * Phase 3 MVP chỉ hỗ trợ Nghịch lý Simpson.
   */
  public static isTopicSupported(topic: string): boolean {
    const normalized = topic.toLowerCase().trim();
    return (
      normalized.includes('simpson') ||
      normalized.includes('nghịch lý simpson') ||
      normalized.includes("simpson's paradox")
    );
  }

  /**
   * Lấy bộ dữ liệu chuẩn đã được kiểm chứng khoa học cho chủ đề
   */
  public static getFactsForTopic(topic: string): Fact[] | null {
    if (this.isTopicSupported(topic)) {
      // Trả về bản sao sâu (deep clone) để tránh đột biến ngoài ý muốn
      return JSON.parse(JSON.stringify(CANONICAL_SIMPSON_FACTS));
    }
    return null;
  }
}

