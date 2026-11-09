import { z } from 'zod';
import {
  ConceptIntroVisualPayloadSchema,
  NeuralArchitectureVisualPayloadSchema,
  LossLandscapeVisualPayloadSchema,
  AttentionHeatmapVisualPayloadSchema,
  SummaryVisualPayloadSchema,
  AlgebraIdentityVisualPayloadSchema,
  GenericSceneVisualPayloadSchema,
  VisualLayoutPresetV3,
  VisualStylePresetV3
} from './visual-dsl';

export type VisualComponentCategoryV3 = 'mathematics' | 'ai_ml' | 'common' | 'foundational';
export type VisualRenderBackendV3 = 'remotion' | 'manim' | 'hybrid';

export interface RegisteredVisualComponentV3 {
  componentId: string;
  name: string;
  description: string;
  category: VisualComponentCategoryV3;
  supportedTopics: string[];
  supportedBackends: VisualRenderBackendV3[];
  payloadSchema: z.ZodType<any>;
  defaultLayout: VisualLayoutPresetV3;
  defaultStyle: VisualStylePresetV3;
  requiresMathVerification: boolean;
}

export class EducationalVisualRegistryV3 {
  private static instance: EducationalVisualRegistryV3;
  private components: Map<string, RegisteredVisualComponentV3> = new Map();

  constructor() {
    this.registerCanonicalComponents();
  }

  public static getInstance(): EducationalVisualRegistryV3 {
    if (!EducationalVisualRegistryV3.instance) {
      EducationalVisualRegistryV3.instance = new EducationalVisualRegistryV3();
    }
    return EducationalVisualRegistryV3.instance;
  }

  private registerCanonicalComponents(): void {
    // 1. Algebra Identity
    this.register({
      componentId: 'algebra_identity',
      name: 'Hằng đẳng thức đại số (Algebraic Identity)',
      description: 'Biểu diễn trực quan 7 hằng đẳng thức đáng nhớ với các bước khai triển đại số và hình học diện tích.',
      category: 'mathematics',
      supportedTopics: ['seven_algebraic_identities', 'algebra_identities', 'math_algebra'],
      supportedBackends: ['remotion', 'hybrid'],
      payloadSchema: AlgebraIdentityVisualPayloadSchema,
      defaultLayout: 'split_horizontal',
      defaultStyle: 'clean_educational_infographic',
      requiresMathVerification: true
    });

    // 2. Concept Intro
    this.register({
      componentId: 'concept_intro',
      name: 'Giới thiệu khái niệm bài giảng (Concept Intro)',
      description: 'Mở đầu bài học với câu hỏi trọng tâm, khái niệm chính và mục tiêu sư phạm.',
      category: 'foundational',
      supportedTopics: ['*'],
      supportedBackends: ['remotion', 'manim', 'hybrid'],
      payloadSchema: ConceptIntroVisualPayloadSchema,
      defaultLayout: 'centered_focus',
      defaultStyle: 'clean_educational_infographic',
      requiresMathVerification: false
    });

    // 3. Neural Architecture
    this.register({
      componentId: 'neural_architecture',
      name: 'Cấu trúc mạng nơ-ron (Neural Architecture)',
      description: 'Hiển thị các lớp nơ-ron, liên kết trọng số synapse và mô phỏng luồng truyền tín hiệu forward-pass.',
      category: 'ai_ml',
      supportedTopics: ['perceptron', 'neural_network', 'feedforward', 'deep_learning'],
      supportedBackends: ['remotion', 'hybrid'],
      payloadSchema: NeuralArchitectureVisualPayloadSchema,
      defaultLayout: 'centered_focus',
      defaultStyle: 'ai_neural_visualization',
      requiresMathVerification: false
    });

    // 4. Loss Landscape
    this.register({
      componentId: 'loss_landscape',
      name: 'Mặt cong hàm mất mát (Loss Landscape & Gradient Descent)',
      description: 'Đồ thị đường mức contour 2D/3D biểu diễn quỹ đạo giảm gradient tối ưu hóa tham số w1, w2.',
      category: 'ai_ml',
      supportedTopics: ['gradient_descent', 'optimization', 'loss_function'],
      supportedBackends: ['remotion', 'manim', 'hybrid'],
      payloadSchema: LossLandscapeVisualPayloadSchema,
      defaultLayout: 'split_horizontal',
      defaultStyle: 'ai_neural_visualization',
      requiresMathVerification: true
    });

    // 5. Attention Heatmap
    this.register({
      componentId: 'attention_heatmap',
      name: 'Bản đồ chú ý Self-Attention (Attention Heatmap)',
      description: 'Ma trận trọng số chú ý softmax(Q*K^T / sqrt(d)) giữa các tokens trong mô hình Transformer.',
      category: 'ai_ml',
      supportedTopics: ['self_attention', 'transformer', 'attention_mechanism'],
      supportedBackends: ['remotion', 'hybrid'],
      payloadSchema: AttentionHeatmapVisualPayloadSchema,
      defaultLayout: 'split_horizontal',
      defaultStyle: 'ai_neural_visualization',
      requiresMathVerification: true
    });

    // 6. Summary
    this.register({
      componentId: 'summary',
      name: 'Tổng kết bài học & ghi nhớ (Summary)',
      description: 'Tóm tắt các điểm cốt lõi, kiến thức đã chứng minh và lưu ý sư phạm cần ôn tập.',
      category: 'common',
      supportedTopics: ['*'],
      supportedBackends: ['remotion', 'manim', 'hybrid'],
      payloadSchema: SummaryVisualPayloadSchema,
      defaultLayout: 'stacked_column',
      defaultStyle: 'clean_educational_infographic',
      requiresMathVerification: false
    });

    // 7. Generic Plot
    this.register({
      componentId: 'generic_plot',
      name: 'Đồ thị hàm số & Đạo hàm/Tích phân (Generic Plot)',
      description: 'Trực quan hóa hàm số, tiếp tuyến vi phân (derivative) và diện tích hình thang cong Riemann (integral).',
      category: 'mathematics',
      supportedTopics: ['derivative_intuition', 'riemann_integral', 'graph_plot', 'calculus'],
      supportedBackends: ['remotion', 'manim', 'hybrid'],
      payloadSchema: GenericSceneVisualPayloadSchema,
      defaultLayout: 'centered_focus',
      defaultStyle: 'math_chalkboard',
      requiresMathVerification: true
    });
  }

  public register(component: RegisteredVisualComponentV3): void {
    this.components.set(component.componentId, component);
  }

  public get(componentId: string): RegisteredVisualComponentV3 | undefined {
    return this.components.get(componentId);
  }

  public listAll(): RegisteredVisualComponentV3[] {
    return Array.from(this.components.values());
  }

  public listByCategory(category: VisualComponentCategoryV3): RegisteredVisualComponentV3[] {
    return this.listAll().filter((comp) => comp.category === category);
  }

  public isRenderSupported(componentId: string, backend: VisualRenderBackendV3): boolean {
    const comp = this.get(componentId);
    if (!comp) return false;
    return comp.supportedBackends.includes(backend);
  }

  public isTopicSupported(componentId: string, topicId: string): boolean {
    const comp = this.get(componentId);
    if (!comp) return false;
    if (comp.supportedTopics.includes('*')) return true;
    return comp.supportedTopics.some((t) => t.toLowerCase() === topicId.toLowerCase());
  }

  public validatePayload(
    componentId: string,
    payload: unknown
  ): { success: boolean; data?: any; error?: string } {
    const comp = this.get(componentId);
    if (!comp) {
      return { success: false, error: `Thành phần trực quan '${componentId}' chưa được đăng ký trong Registry` };
    }
    const result = comp.payloadSchema.safeParse(payload);
    if (!result.success) {
      const errorMsg = result.error.errors.map((e) => `[${e.path.join('.')}] ${e.message}`).join('; ');
      return { success: false, error: errorMsg };
    }
    return { success: true, data: result.data };
  }
}

export const visualRegistryV3 = EducationalVisualRegistryV3.getInstance();

