import { z } from 'zod';
import { NoExecutableString, SafeIdString } from '../v2/document';

export const EducationalDomainSchema = z.enum(['mathematics', 'artificial_intelligence']);
export type EducationalDomain = z.infer<typeof EducationalDomainSchema>;

export const EducationalCapabilitySchema = z.enum([
  'formal_math_verification',
  'numerical_validation',
  'source_grounded_explanation',
  'conceptual_visualization',
  'algorithm_simulation',
  'human_review_required'
]);
export type EducationalCapability = z.infer<typeof EducationalCapabilitySchema>;

export const ValidationTypeSchema = z.enum([
  'formal_math',
  'numerical',
  'source_grounding',
  'pedagogical_review'
]);
export type ValidationType = z.infer<typeof ValidationTypeSchema>;

export const RendererTargetSchema = z.enum([
  'remotion_infographic',
  'manim_hybrid',
  'interactive_sidecar'
]);
export type RendererTarget = z.infer<typeof RendererTargetSchema>;

export const EvidenceRequirementSchema = z.enum([
  'source_citation',
  'mathematical_proof',
  'human_signoff'
]);
export type EvidenceRequirement = z.infer<typeof EvidenceRequirementSchema>;

export const RenderReadinessSchema = z.enum([
  'render_ready',
  'planning_only',
  'requires_review'
]);
export type RenderReadiness = z.infer<typeof RenderReadinessSchema>;

/**
 * Báo cáo năng lực chủ đề V3 (TopicCapabilityReportV3)
 */
export const TopicCapabilityReportV3Schema = z.object({
  topicId: z.string().regex(/^[a-z0-9_.-]{3,80}$/),
  domain: EducationalDomainSchema,
  subCategory: z.string().min(2).max(100),
  displayName: NoExecutableString,
  supportedCapabilities: z.array(EducationalCapabilitySchema).min(1),
  requiredValidationTypes: z.array(ValidationTypeSchema).min(1),
  availableRenderers: z.array(RendererTargetSchema).min(1),
  evidenceRequirements: z.array(EvidenceRequirementSchema).min(1),
  renderReadiness: RenderReadinessSchema,
  limitations: z.array(NoExecutableString).default([])
}).strict();

export type TopicCapabilityReportV3 = z.infer<typeof TopicCapabilityReportV3Schema>;

/**
 * Danh mục năng lực chuẩn được đăng ký trước (Registered Topics Matrix)
 */
export const REGISTERED_TOPICS_V3: Record<string, TopicCapabilityReportV3> = {
  // --- MATHEMATICS (5 TOPICS) ---
  'calculus.derivative.intuition': {
    topicId: 'calculus.derivative.intuition',
    domain: 'mathematics',
    subCategory: 'Calculus & Analysis',
    displayName: 'Bản chất hình học của đạo hàm: Từ cát tuyến đến tiếp tuyến',
    supportedCapabilities: ['formal_math_verification', 'conceptual_visualization', 'source_grounded_explanation'],
    requiredValidationTypes: ['formal_math', 'source_grounding'],
    availableRenderers: ['manim_hybrid', 'remotion_infographic'],
    evidenceRequirements: ['mathematical_proof', 'source_citation'],
    renderReadiness: 'render_ready',
    limitations: ['Hỗ trợ đồ thị hàm đa thức bậc hai và bậc ba; chuyển động tiếp tuyến trên Remotion + Manim.']
  },
  'calculus.riemann_integral.intuition': {
    topicId: 'calculus.riemann_integral.intuition',
    domain: 'mathematics',
    subCategory: 'Calculus & Analysis',
    displayName: 'Tổng Riemann và bản chất diện tích tích phân',
    supportedCapabilities: ['formal_math_verification', 'conceptual_visualization', 'source_grounded_explanation'],
    requiredValidationTypes: ['formal_math', 'source_grounding'],
    availableRenderers: ['manim_hybrid', 'remotion_infographic'],
    evidenceRequirements: ['mathematical_proof', 'source_citation'],
    renderReadiness: 'render_ready',
    limitations: ['Hỗ trợ phân hoạch hình chữ nhật bậc 4/8/16 xấp xỉ diện tích hình thang cong.']
  },
  'linear_algebra.matrix_transform': {
    topicId: 'linear_algebra.matrix_transform',
    domain: 'mathematics',
    subCategory: 'Linear Algebra',
    displayName: 'Biến đổi không gian và ma trận 2D',
    supportedCapabilities: ['formal_math_verification', 'numerical_validation', 'conceptual_visualization'],
    requiredValidationTypes: ['formal_math', 'numerical'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['mathematical_proof'],
    renderReadiness: 'planning_only',
    limitations: ['Giai đoạn Phase 1 hỗ trợ lập kế hoạch và kịch bản sư phạm; renderer ma trận không gian đang phát triển ở Phase 2.']
  },
  'calculus.limits.epsilon_delta': {
    topicId: 'calculus.limits.epsilon_delta',
    domain: 'mathematics',
    subCategory: 'Calculus & Analysis',
    displayName: 'Định nghĩa giới hạn bằng Epsilon - Delta',
    supportedCapabilities: ['formal_math_verification', 'source_grounded_explanation', 'human_review_required'],
    requiredValidationTypes: ['formal_math', 'pedagogical_review'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['mathematical_proof', 'human_signoff'],
    renderReadiness: 'planning_only',
    limitations: ['Mệnh đề logic định lượng ∀ε>0 ∃δ>0 cần sự rà soát ngữ nghĩa từ giáo viên.']
  },
  'probability.bayes_theorem': {
    topicId: 'probability.bayes_theorem',
    domain: 'mathematics',
    subCategory: 'Probability & Statistics',
    displayName: 'Định lý Bayes và cập nhật niềm tin xác suất',
    supportedCapabilities: ['formal_math_verification', 'numerical_validation', 'source_grounded_explanation'],
    requiredValidationTypes: ['formal_math', 'numerical'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['mathematical_proof', 'source_citation'],
    renderReadiness: 'planning_only',
    limitations: ['Kiểm định xác suất điều kiện và định lý xác suất toàn phần; sơ đồ Venn diện tích ở Phase 2.']
  },

  // --- ARTIFICIAL INTELLIGENCE & MACHINE LEARNING (5 TOPICS) ---
  'ai.perceptron.activation': {
    topicId: 'ai.perceptron.activation',
    domain: 'artificial_intelligence',
    subCategory: 'Neural Networks & Deep Learning',
    displayName: 'Mô hình Perceptron và các hàm kích hoạt (Sigmoid, ReLU)',
    supportedCapabilities: ['conceptual_visualization', 'source_grounded_explanation', 'human_review_required'],
    requiredValidationTypes: ['source_grounding', 'pedagogical_review'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['source_citation', 'human_signoff'],
    renderReadiness: 'render_ready',
    limitations: ['Cảnh tín hiệu được ghi nhãn là minh họa luồng; không tuyên bố là suy luận số nếu không có computed_forward_pass.']
  },
  'ai.gradient_descent.optimization': {
    topicId: 'ai.gradient_descent.optimization',
    domain: 'artificial_intelligence',
    subCategory: 'Optimization & Training',
    displayName: 'Thuật toán Gradient Descent và tối ưu hóa hàm mất mát',
    supportedCapabilities: ['formal_math_verification', 'numerical_validation', 'conceptual_visualization', 'source_grounded_explanation'],
    requiredValidationTypes: ['formal_math', 'numerical', 'source_grounding'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['mathematical_proof', 'source_citation'],
    renderReadiness: 'planning_only',
    limitations: ['Minh họa trực quan bề mặt hàm mất mát lồi/phi lồi và bước cập nhật learning rate đang hoàn thiện ở Phase 2.']
  },
  'ai.transformer.attention': {
    topicId: 'ai.transformer.attention',
    domain: 'artificial_intelligence',
    subCategory: 'Modern Architectures',
    displayName: 'Cơ chế Self-Attention và kiến trúc Transformer',
    supportedCapabilities: ['conceptual_visualization', 'source_grounded_explanation', 'human_review_required'],
    requiredValidationTypes: ['source_grounding', 'pedagogical_review'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['source_citation', 'human_signoff'],
    renderReadiness: 'planning_only',
    limitations: ['Minh họa ma trận Query, Key, Value và bản đồ trọng số Attention.']
  },
  'ai.neural_network.backpropagation': {
    topicId: 'ai.neural_network.backpropagation',
    domain: 'artificial_intelligence',
    subCategory: 'Neural Networks & Deep Learning',
    displayName: 'Thuật toán Lan truyền ngược (Backpropagation) và Quy tắc chuỗi (Chain Rule)',
    supportedCapabilities: ['formal_math_verification', 'numerical_validation', 'conceptual_visualization'],
    requiredValidationTypes: ['formal_math', 'numerical'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['mathematical_proof'],
    renderReadiness: 'planning_only',
    limitations: ['Tính đạo hàm riêng từng lớp trọng số qua chain rule; kiểm định công thức đạo hàm toán học.']
  },
  'ai.embeddings.vector_space': {
    topicId: 'ai.embeddings.vector_space',
    domain: 'artificial_intelligence',
    subCategory: 'NLP & Representation Learning',
    displayName: 'Không gian Vector nhúng (Word & Token Embeddings)',
    supportedCapabilities: ['conceptual_visualization', 'source_grounded_explanation', 'human_review_required'],
    requiredValidationTypes: ['source_grounding', 'pedagogical_review'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['source_citation', 'human_signoff'],
    renderReadiness: 'planning_only',
    limitations: ['Trực quan hóa khoảng cách cosine và cụm ngữ nghĩa trong không gian nhiều chiều.']
  }
};

/**
 * Danh sách các từ khóa ngoài phạm vi (Out-of-scope domains)
 * Phải fail-closed, tuyệt đối không nhận các lĩnh vực vật lý, hóa học, sinh học, địa lý, nấu ăn...
 */
const FORBIDDEN_DOMAINS_REGEX = /\b(newton|vật lý|physics|hóa học|chemistry|sinh học|biology|địa lý|geography|lịch sử|history|nấu ăn|cooking|chứng khoán|crypto|bất động sản|y học|medical)\b/i;

export class DomainScopeViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainScopeViolationError';
  }
}

// Canonical Aliases to resolve V2/V3 topic compatibility:
export const TOPIC_ALIASES_V3: Record<string, string> = {
  'calculus.integral.riemann_sum': 'calculus.riemann_integral.intuition',
  'calculus.riemann_sum.left_rectangle': 'calculus.riemann_integral.intuition',
  'calculus.integral.riemann': 'calculus.riemann_integral.intuition'
};

export function canonicalizeTopicId(topicId: string): string {
  return TOPIC_ALIASES_V3[topicId] || topicId;
}

/**
 * Bộ phân loại chủ đề xác định (Deterministic Canonical Classifier)
 * Nhận diện mục tiêu sư phạm chính (Primary Educational Objective),
 * ưu tiên các thuật toán AI phức hợp trước khi xét các công cụ toán học hỗ trợ.
 */
export function classifyEducationalTopic(topicText: string): TopicCapabilityReportV3 {
  const normalized = topicText.trim().toLowerCase();

  // 1. Kiểm tra phạm vi nghiêm ngặt (Fail-closed)
  if (FORBIDDEN_DOMAINS_REGEX.test(normalized)) {
    throw new DomainScopeViolationError(
      `LuminaLearn chỉ hỗ trợ hai lĩnh vực: Toán học (Mathematics) và Trí tuệ nhân tạo (AI/ML). Chủ đề "${topicText}" nằm ngoài phạm vi giáo dục của hệ thống.`
    );
  }

  // 2. AI & ML Compound Patterns (Phải ưu tiên trước các từ khóa toán học thành phần)
  // Ví dụ: "Gradient Descent dùng đạo hàm" mục tiêu chính là thuật toán tối ưu học máy, dùng đạo hàm làm công cụ
  if (/gradient descent|hàm mất mát|loss function|tối ưu hóa học máy|loss landscape/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['ai.gradient_descent.optimization'];
  }
  if (/backpropagation|lan truyền ngược|chain rule trong mạng|quy tắc chuỗi.*mạng|backward pass/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['ai.neural_network.backpropagation'];
  }
  if (/attention|transformer|tự chú ý|self-attention|cơ chế chú ý/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['ai.transformer.attention'];
  }
  if (/embedding|vector nhúng|word2vec|không gian vector nhúng|từ nhúng/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['ai.embeddings.vector_space'];
  }
  if (/perceptron|hàm kích hoạt|sigmoid|relu/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['ai.perceptron.activation'];
  }
  if (/bayes.*(machine learning|học máy|phân loại|classification|mô hình)/i.test(normalized)) {
    return {
      ...REGISTERED_TOPICS_V3['probability.bayes_theorem'],
      domain: 'artificial_intelligence',
      subCategory: 'Probabilistic Machine Learning',
      displayName: 'Định lý Bayes trong phân loại Machine Learning',
      limitations: ['Ứng dụng định lý Bayes trong phân loại học máy (Naïve Bayes).']
    };
  }

  // 3. Mathematics Patterns (Chủ đề toán học thuần túy)
  if (/cát tuyến|tiếp tuyến|đạo hàm|derivative/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['calculus.derivative.intuition'];
  }
  if (/riemann|tích phân|diện tích hình phẳng|integral/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['calculus.riemann_integral.intuition'];
  }
  if (/ma trận|biến đổi không gian|vector 2d|matrix|linear algebra|đại số tuyến tính/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['linear_algebra.matrix_transform'];
  }
  if (/epsilon|delta|giới hạn|limit/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['calculus.limits.epsilon_delta'];
  }
  if (/bayes|xác suất|probability/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['probability.bayes_theorem'];
  }

  // 4. AI Generic Fallback
  if (/trí tuệ nhân tạo|machine learning|học máy|deep learning|mạng neural|neural network|\bai\b/i.test(normalized)) {
    return {
      topicId: 'ai.general.concept',
      domain: 'artificial_intelligence',
      subCategory: 'General AI Concepts',
      displayName: topicText.trim(),
      supportedCapabilities: ['conceptual_visualization', 'source_grounded_explanation', 'human_review_required'],
      requiredValidationTypes: ['source_grounding', 'pedagogical_review'],
      availableRenderers: ['remotion_infographic'],
      evidenceRequirements: ['source_citation', 'human_signoff'],
      renderReadiness: 'planning_only',
      limitations: ['Chủ đề AI khái niệm tổng quát; hệ thống hỗ trợ lập kế hoạch bài học và kịch bản sư phạm.']
    };
  }

  // 5. Mathematics Generic Fallback
  if (/toán|hàm số|phương trình|đồ thị|hình học|calculus|algebra|geometry/i.test(normalized)) {
    return {
      topicId: 'math.general.concept',
      domain: 'mathematics',
      subCategory: 'General Mathematics',
      displayName: topicText.trim(),
      supportedCapabilities: ['formal_math_verification', 'conceptual_visualization', 'human_review_required'],
      requiredValidationTypes: ['formal_math', 'pedagogical_review'],
      availableRenderers: ['remotion_infographic'],
      evidenceRequirements: ['mathematical_proof', 'human_signoff'],
      renderReadiness: 'planning_only',
      limitations: ['Chủ đề toán tổng quát; cần kiểm định hình thức cho các công thức trước khi hỗ trợ kết xuất video tự động.']
    };
  }

  // 6. Fail-closed
  throw new DomainScopeViolationError(
    `Không nhận diện được chủ đề Toán học hoặc Trí tuệ nhân tạo từ nội dung: "${topicText}". Vui lòng cung cấp chủ đề cụ thể trong phạm vi Toán hoặc AI.`
  );
}

