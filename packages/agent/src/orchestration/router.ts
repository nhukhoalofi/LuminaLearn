import type { LessonRequestV2 } from '@luminalearn/scene-schema';
import type { TopicClassification } from './types';

interface TopicRule {
  topicId: string;
  displayName: string;
  domain: TopicClassification['domain'];
  patterns: RegExp[];
  supportedTemplates: string[];
  requiredValidators: string[];
}

const TOPIC_REGISTRY: TopicRule[] = [
  {
    topicId: 'calculus.derivative.intuition',
    displayName: 'Bản chất trực quan của đạo hàm',
    domain: 'calculus',
    patterns: [/đạo hàm/i, /dao ham/i, /derivative/i, /cát tuyến.*tiếp tuyến/i, /secant.*tangent/i, /tốc độ thay đổi tức thời/i],
    supportedTemplates: ['function_graph', 'secant_to_tangent'],
    requiredValidators: ['polynomial_derivative', 'secant_slope', 'limit_at_zero', 'value_at_point']
  },
  {
    topicId: 'calculus.integral.riemann_sum',
    displayName: 'Tổng tích phân Riemann',
    domain: 'calculus',
    patterns: [/tích phân/i, /tich phan/i, /riemann/i, /integral/i, /diện tích hình thang cong/i],
    supportedTemplates: ['function_graph', 'riemann_sum'],
    requiredValidators: ['riemann_sum_limit', 'definite_integral']
  },
  {
    topicId: 'linear_algebra.matrix_transform',
    displayName: 'Biến đổi tuyến tính ma trận',
    domain: 'linear_algebra',
    patterns: [/ma trận/i, /ma tran/i, /matrix/i, /biến đổi tuyến tính/i, /linear transform/i, /không gian vector/i],
    supportedTemplates: ['vector_transform'],
    requiredValidators: ['determinant', 'eigenvalues']
  },
  {
    topicId: 'trigonometry.unit_circle',
    displayName: 'Đường tròn lượng giác',
    domain: 'trigonometry',
    patterns: [/lượng giác/i, /luong giac/i, /đường tròn đơn vị/i, /unit circle/i, /sin.*cos/i],
    supportedTemplates: ['unit_circle'],
    requiredValidators: ['sin_cos_relation', 'special_angles']
  },
  {
    topicId: 'statistics.simpson_paradox',
    displayName: 'Nghịch lý Simpson',
    domain: 'statistics',
    patterns: [/simpson/i, /nghịch lý simpson/i, /paradox/i, /dữ liệu gộp/i],
    supportedTemplates: ['dual_comparison', 'data_merge', 'concept_summary'],
    requiredValidators: ['simpson_rate_reversal']
  }
];

export class TopicRouter {
  public route(request: LessonRequestV2): TopicClassification {
    const raw = request.topic.trim();

    for (const rule of TOPIC_REGISTRY) {
      if (rule.patterns.some((pattern) => pattern.test(raw))) {
        return {
          topicId: rule.topicId,
          displayName: rule.displayName,
          domain: rule.domain,
          confidence: 0.95,
          supportedTemplates: [...rule.supportedTemplates],
          requiredValidators: [...rule.requiredValidators],
          isSupported: true
        };
      }
    }

    return {
      topicId: 'unknown',
      displayName: raw,
      domain: 'general',
      confidence: 0.0,
      supportedTemplates: [],
      requiredValidators: [],
      isSupported: false,
      unsupportedReason: `unsupported_topic: Chủ đề '${raw}' chưa nằm trong danh mục giáo trình được hỗ trợ`
    };
  }
}

