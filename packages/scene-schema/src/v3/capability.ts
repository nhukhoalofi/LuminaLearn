import { z } from 'zod';
import { NoExecutableString, SafeIdString } from '../v2/document';

export const EducationalDomainSchema = z.enum(['mathematics', 'artificial_intelligence', 'physics']);
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
  'algebra.identities.seven': {
    topicId: 'algebra.identities.seven',
    domain: 'mathematics',
    subCategory: 'Algebra',
    displayName: '7 hằng đẳng thức đáng nhớ',
    supportedCapabilities: ['formal_math_verification', 'conceptual_visualization'],
    requiredValidationTypes: ['formal_math'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['mathematical_proof'],
    renderReadiness: 'render_ready',
    limitations: ['Biểu thức chỉ cho phép hai biến a, b; phép cộng, trừ, nhân và lũy thừa nguyên bị chặn.']
  },
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
    renderReadiness: 'render_ready',
    limitations: ['Minh họa trực quan bề mặt hàm mất mát lồi/phi lồi và bước cập nhật learning rate.']
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
    renderReadiness: 'render_ready',
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
  },

  // --- PHYSICS & OPTICS ---
  'physics.optics.rainbow': {
    topicId: 'physics.optics.rainbow',
    domain: 'physics',
    subCategory: 'Optics & Wave Physics',
    displayName: 'Sự hình thành cầu vồng: Khúc xạ, tán sắc và phản xạ trong giọt nước',
    supportedCapabilities: ['formal_math_verification', 'numerical_validation', 'conceptual_visualization', 'source_grounded_explanation'],
    requiredValidationTypes: ['formal_math', 'numerical'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['mathematical_proof', 'source_citation'],
    renderReadiness: 'render_ready',
    limitations: ['Mô phỏng quang hình học định luật Snell (n1 sin i = n2 sin r), tán sắc bước sóng qua giọt nước hình cầu và góc lệch cực tiểu Descartes 40°-42°.']
  },
  'physics.electromagnetism.telecom': {
    topicId: 'physics.electromagnetism.telecom',
    domain: 'physics',
    subCategory: 'Electromagnetism & Waves',
    displayName: 'Âm thanh được truyền qua cuộc gọi điện thoại như thế nào?',
    supportedCapabilities: ['conceptual_visualization', 'source_grounded_explanation', 'human_review_required'],
    requiredValidationTypes: ['source_grounding', 'pedagogical_review'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['source_citation', 'human_signoff'],
    renderReadiness: 'render_ready',
    limitations: ['Mô hình sư phạm 6 bước: micro, số hóa, sóng vô tuyến, trạm gốc, giải mã và loa; không mô phỏng chi tiết giao thức mạng.']
  },
  'physics.thermodynamics.condensation': {
    topicId: 'physics.thermodynamics.condensation',
    domain: 'physics',
    subCategory: 'Thermodynamics & Phase Transition',
    displayName: 'Vì sao lon nước lạnh bị đọng sương?',
    supportedCapabilities: ['numerical_validation', 'conceptual_visualization', 'source_grounded_explanation', 'human_review_required'],
    requiredValidationTypes: ['numerical', 'source_grounding', 'pedagogical_review'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['source_citation', 'human_signoff'],
    renderReadiness: 'render_ready',
    limitations: ['Mô hình động học hạt và điều kiện nhiệt độ bề mặt không vượt điểm sương; không thay thế mô hình psychrometric đầy đủ.']
  },
  'physics.waves.sound': {
    topicId: 'physics.waves.sound',
    domain: 'physics',
    subCategory: 'Mechanical Waves & Acoustics',
    displayName: 'Sóng âm truyền qua không khí như thế nào?',
    supportedCapabilities: ['numerical_validation', 'conceptual_visualization', 'source_grounded_explanation', 'human_review_required'],
    requiredValidationTypes: ['numerical', 'source_grounding', 'pedagogical_review'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['source_citation', 'human_signoff'],
    renderReadiness: 'render_ready',
    limitations: ['Mô hình sóng điều hòa trong môi trường đồng nhất; không mô phỏng nhiễu xạ, phản xạ phòng hoặc suy hao phức tạp.']
  },
  'physics.waves.lightning_thunder': {
    topicId: 'physics.waves.lightning_thunder',
    domain: 'physics',
    subCategory: 'Acoustics & Electromagnetism',
    displayName: 'Vì sao ta thấy tia chớp trước rồi mới nghe thấy tiếng sấm?',
    supportedCapabilities: ['numerical_validation', 'conceptual_visualization', 'source_grounded_explanation', 'human_review_required'],
    requiredValidationTypes: ['numerical', 'source_grounding', 'pedagogical_review'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['source_citation', 'human_signoff'],
    renderReadiness: 'render_ready',
    limitations: ['So sánh vận tốc ánh sáng c ≈ 300.000 km/s và vận tốc âm thanh v ≈ 340 m/s trong không khí; giải thích độ trễ thời gian Δt = d / v_âm.']
  },
  'physics.mechanics.inertia_braking': {
    topicId: 'physics.mechanics.inertia_braking',
    domain: 'physics',
    subCategory: 'Classical Mechanics & Inertia',
    displayName: 'Quán tính: Vì sao xe phanh gấp người lại chúi về phía trước?',
    supportedCapabilities: ['numerical_validation', 'conceptual_visualization', 'source_grounded_explanation', 'human_review_required'],
    requiredValidationTypes: ['numerical', 'source_grounding', 'pedagogical_review'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['source_citation', 'human_signoff'],
    renderReadiness: 'render_ready',
    limitations: ['Mô tả định luật I Newton và hiện tượng quán tính trong hệ quy chiếu xe giảm tốc; hợp lực hãm làm xe chậm lại trong khi cơ thể duy trì vận tốc cũ.']
  },
  'physics.mechanics.newton_forces': {
    topicId: 'physics.mechanics.newton_forces',
    domain: 'physics',
    subCategory: 'Classical Mechanics',
    displayName: 'Hợp lực và định luật II Newton',
    supportedCapabilities: ['numerical_validation', 'conceptual_visualization', 'source_grounded_explanation', 'human_review_required'],
    requiredValidationTypes: ['numerical', 'source_grounding', 'pedagogical_review'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['source_citation', 'human_signoff'],
    renderReadiness: 'render_ready',
    limitations: ['Mô hình vật rắn như chất điểm trong hệ quy chiếu quán tính; payload số phải thỏa F = ma.']
  },
  'physics.astronomy.earth_seasons': {
    topicId: 'physics.astronomy.earth_seasons',
    domain: 'physics',
    subCategory: 'Astronomy & Thermodynamics',
    displayName: 'Vì sao mùa hè thì nóng, còn mùa đông lại lạnh?',
    supportedCapabilities: ['numerical_validation', 'conceptual_visualization', 'source_grounded_explanation', 'human_review_required'],
    requiredValidationTypes: ['numerical', 'source_grounding', 'pedagogical_review'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['source_citation', 'human_signoff'],
    renderReadiness: 'render_ready',
    limitations: ['Mô tả độ nghiêng trục Trái Đất 23.5° và định luật góc chiếu bức xạ quang năng Lambert; so sánh ngày đêm thực tế Hà Nội.']
  },
  'physics.mechanics.projectile': {
    topicId: 'physics.mechanics.projectile',
    domain: 'physics',
    subCategory: 'Kinematics',
    displayName: 'Chuyển động ném xiên và quỹ đạo parabol',
    supportedCapabilities: ['numerical_validation', 'conceptual_visualization', 'source_grounded_explanation', 'human_review_required'],
    requiredValidationTypes: ['numerical', 'source_grounding', 'pedagogical_review'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['source_citation', 'human_signoff'],
    renderReadiness: 'render_ready',
    limitations: ['Bỏ qua lực cản không khí, dùng gia tốc trọng trường không đổi và mặt đất phẳng.']
  },
  'physics.mechanics.pendulum': {
    topicId: 'physics.mechanics.pendulum',
    domain: 'physics',
    subCategory: 'Oscillations',
    displayName: 'Con lắc đơn và chu kỳ dao động',
    supportedCapabilities: ['numerical_validation', 'conceptual_visualization', 'source_grounded_explanation', 'human_review_required'],
    requiredValidationTypes: ['numerical', 'source_grounding', 'pedagogical_review'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['source_citation', 'human_signoff'],
    renderReadiness: 'render_ready',
    limitations: ['Công thức chu kỳ chỉ áp dụng cho con lắc đơn góc nhỏ, dây nhẹ và bỏ qua lực cản.']
  },
  'physics.mechanics.energy_conservation': {
    topicId: 'physics.mechanics.energy_conservation',
    domain: 'physics',
    subCategory: 'Work & Energy',
    displayName: 'Bảo toàn cơ năng trong hệ lý tưởng',
    supportedCapabilities: ['numerical_validation', 'conceptual_visualization', 'source_grounded_explanation', 'human_review_required'],
    requiredValidationTypes: ['numerical', 'source_grounding', 'pedagogical_review'],
    availableRenderers: ['remotion_infographic'],
    evidenceRequirements: ['source_citation', 'human_signoff'],
    renderReadiness: 'render_ready',
    limitations: ['Chỉ bảo toàn động năng cộng thế năng khi không có công của lực không bảo toàn; payload luôn ghi rõ mô hình lý tưởng.']
  }
};

/**
 * Danh sách các từ khóa ngoài phạm vi (Out-of-scope domains)
 * Phải fail-closed cho các lĩnh vực không được hỗ trợ như hóa học, sinh học, nấu ăn...
 */
const FORBIDDEN_DOMAINS_REGEX = /\b(hóa học|chemistry|sinh học|biology|địa lý|geography|lịch sử|history|nấu ăn|cooking|chứng khoán|crypto|bất động sản|y học|medical)\b/i;

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
      `LuminaLearn hiện hỗ trợ Toán học, Trí tuệ nhân tạo và các chủ đề Vật lý đã đăng ký. Chủ đề "${topicText}" nằm ngoài phạm vi giáo dục của hệ thống.`
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

  // 3. Physics Patterns (Optics, Electromagnetism, Telecom, Thermodynamics, Mechanics, Waves, Energy, Astronomy)
  if (/mùa hè|mùa đông|mua he|mua dong|trục trái đất|truc trai dat|23\.5|các mùa|cac mua|seasons|hạ chí|đông chí|ngày dài đêm ngắn/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['physics.astronomy.earth_seasons'];
  }
  if (/sấm sét|sam set|chớp.*sấm|sấm.*chớp|tia chớp|tiếng sấm|chớp trước.*sấm|sét trước.*sấm|lightning|thunder/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['physics.waves.lightning_thunder'];
  }
  if (/cầu vồng|cau vong|rainbow|tán sắc|tan sac|khúc xạ|khuc xa|phản xạ toàn phần|raindrop|lăng kính|quang học|ánh sáng|quang phổ|gương|thấu kính/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['physics.optics.rainbow'];
  }
  if (/điện thoại|phone|viễn thông|nghe gọi|cuộc gọi|bts|trạm phát sóng|sóng điện từ|vô tuyến|ăng ten|antenna/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['physics.electromagnetism.telecom'];
  }
  if (/ngưng tụ|sương|lon nước|dew point|bay hơi|nhiệt độ|nhiệt học|đông đặc|nóng chảy|chuyển thể|khí lý tưởng|áp suất/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['physics.thermodynamics.condensation'];
  }
  if (/sóng âm|truyền âm|âm thanh truyền|tần số âm|bước sóng âm|acoustic|sound wave|sóng cơ|dao động sóng|giao thoa sóng|hộp đàn|tiếng vang/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['physics.waves.sound'];
  }
  if (/ném ngang|ném xiên|ném chéo|quỹ đạo parabol|projectile|rơi tự do|chuyển động cong|tầm xa|vận tốc đầu/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['physics.mechanics.projectile'];
  }
  if (/con lắc|pendulum|chu kỳ dao động|dao động điều hòa|dao động cơ|lực kéo về|vị trí cân bằng/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['physics.mechanics.pendulum'];
  }
  if (/bảo toàn cơ năng|chuyển hóa động năng.*thế năng|động năng.*thế năng|conservation of mechanical energy|thế năng|động năng|cơ năng|va chạm đàn hồi|tàu lượn/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['physics.mechanics.energy_conservation'];
  }
  if (/quán tính|quan tinh|phanh gấp|phanh xe|hãm phanh|chúi.*phía trước|ngả.*phía sau|xe.*dừng.*đột ngột|định luật i newton|định luật 1 newton/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['physics.mechanics.inertia_braking'];
  }
  if (/định luật ii newton|định luật 2 newton|newton.*thứ hai|hợp lực|lực ma sát|lực kéo|lực đẩy|gia tốc|f\s*=\s*m\s*\*?\s*a/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['physics.mechanics.newton_forces'];
  }

  // 4. Mathematics Patterns (Chủ đề toán học thuần túy)
  // Keep equation aliases bounded to the registered square-sum identity. The
  // Teacher Studio preset asks a formula question and may omit the topic name.
  if (/7\s*hằng đẳng thức|bảy\s*hằng đẳng thức|hằng đẳng thức đáng nhớ|algebraic?\s*identit|algebra\.identities|\(\s*a\s*\+\s*b\s*\)\s*(?:\^\s*2|²)/i.test(normalized)) {
    return REGISTERED_TOPICS_V3['algebra.identities.seven'];
  }
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
  if (/toán|hàm số|phương trình|đồ thị|hình học|calculus|algebra|geometry|pythagor|tam giác|định lý|lượng giác/i.test(normalized)) {
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

  // 6. Physics Generic Dynamic Topics (Cho phép render tự động mọi hiện tượng vật lý qua Universal Cinematic Engine)
  if (!FORBIDDEN_DOMAINS_REGEX.test(normalized)) {
    // Tự động phân loại phân họ vật lý phù hợp nhất
    const isWave = /sóng|âm thanh|dao động|tần số|bước sóng|lan truyền/i.test(normalized);
    const isThermodynamics = /nhiệt|nóng|lạnh|ngưng tụ|bay hơi|đông|sôi|áp suất|chất khí|phân tử/i.test(normalized);
    const isOptics = /quang|sáng|màu|gương|kính|khúc xạ|phản xạ|tán sắc|hình ảnh|mắt/i.test(normalized);
    const isEnergy = /năng lượng|cơ năng|động năng|thế năng|bảo toàn|chuyển hóa/i.test(normalized);

    const subCategory = isWave ? 'Waves & Oscillations'
      : isThermodynamics ? 'Thermodynamics & Kinetics'
      : isOptics ? 'Optics & Electromagnetism'
      : isEnergy ? 'Work & Energy'
      : 'Classical Mechanics & Dynamics';

    return {
      topicId: 'physics.general.concept',
      domain: 'physics',
      subCategory,
      displayName: topicText.trim(),
      supportedCapabilities: ['numerical_validation', 'conceptual_visualization', 'source_grounded_explanation', 'human_review_required'],
      requiredValidationTypes: ['numerical', 'source_grounding', 'pedagogical_review'],
      availableRenderers: ['remotion_infographic'],
      evidenceRequirements: ['source_citation', 'human_signoff'],
      renderReadiness: 'render_ready',
      limitations: ['Chủ đề vật lý tổng quát được sinh động theo 6 nhịp sư phạm và bộ Universal Cinematic Engine.']
    };
  }

  // 6. Fail-closed
  throw new DomainScopeViolationError(
    `Không nhận diện được chủ đề Toán học, Trí tuệ nhân tạo hoặc Vật lý từ nội dung: "${topicText}". Vui lòng cung cấp một chủ đề cụ thể thuộc capability registry.`
  );
}

