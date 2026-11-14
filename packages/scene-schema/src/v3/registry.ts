import { z } from 'zod';
import {
  ConceptIntroVisualPayloadSchema,
  NeuralArchitectureVisualPayloadSchema,
  LossLandscapeVisualPayloadSchema,
  AttentionHeatmapVisualPayloadSchema,
  SummaryVisualPayloadSchema,
  AlgebraIdentityVisualPayloadSchema,
  PhysicsOpticsVisualPayloadSchema,
  PhysicsExplainerVisualPayloadSchema,
  GenericSceneVisualPayloadSchema,
  VisualLayoutPresetV3,
  VisualStylePresetV3
} from './visual-dsl';

export type VisualComponentCategoryV3 = 'mathematics' | 'ai_ml' | 'physics' | 'common' | 'foundational';
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

function genericSceneSchemaFor(sceneType: 'formula_derivation' | 'graph_plot' | 'flowchart_simulation' | 'comparison_table') {
  return GenericSceneVisualPayloadSchema.refine(
    (payload) => payload.sceneType === sceneType,
    { path: ['sceneType'], message: `sceneType phải là '${sceneType}'` }
  );
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

    // SceneInspector validates by the exact sceneType, while the renderer uses
    // the shared GenericScene payload contract for these four scene families.
    // Register exact IDs with narrowed schemas so supported renderer paths are
    // represented honestly without weakening scene/payload matching.
    this.register({
      componentId: 'formula_derivation',
      name: 'Biến đổi công thức từng bước (Formula Derivation)',
      description: 'Trình bày chuỗi công thức; dữ liệu verified_formula_steps được chuyển tới FormulaSequenceSceneV3.',
      category: 'mathematics',
      supportedTopics: ['*'],
      supportedBackends: ['remotion', 'manim', 'hybrid'],
      payloadSchema: genericSceneSchemaFor('formula_derivation'),
      defaultLayout: 'stacked_column',
      defaultStyle: 'math_chalkboard',
      requiresMathVerification: true
    });

    this.register({
      componentId: 'graph_plot',
      name: 'Đồ thị khoa học (Graph Plot)',
      description: 'Hiển thị đồ thị typed hoặc scientificData một chiều bằng adapter đã đăng ký.',
      category: 'mathematics',
      supportedTopics: ['*'],
      supportedBackends: ['remotion', 'manim', 'hybrid'],
      payloadSchema: genericSceneSchemaFor('graph_plot'),
      defaultLayout: 'centered_focus',
      defaultStyle: 'math_chalkboard',
      requiresMathVerification: true
    });

    this.register({
      componentId: 'flowchart_simulation',
      name: 'Lưu đồ mô phỏng (Flowchart Simulation)',
      description: 'Trình bày luồng thuật toán hoặc sơ đồ có hướng bằng payload typed.',
      category: 'common',
      supportedTopics: ['*'],
      supportedBackends: ['remotion', 'hybrid'],
      payloadSchema: genericSceneSchemaFor('flowchart_simulation'),
      defaultLayout: 'centered_focus',
      defaultStyle: 'clean_educational_infographic',
      requiresMathVerification: false
    });

    this.register({
      componentId: 'comparison_table',
      name: 'Bảng so sánh (Comparison Table)',
      description: 'Đối chiếu các khái niệm hoặc kết quả trong bố cục typed an toàn.',
      category: 'common',
      supportedTopics: ['*'],
      supportedBackends: ['remotion', 'hybrid'],
      payloadSchema: genericSceneSchemaFor('comparison_table'),
      defaultLayout: 'split_horizontal',
      defaultStyle: 'clean_educational_infographic',
      requiresMathVerification: false
    });

    // --- PHYSICS & OPTICS ENGINE COMPONENTS ---
    this.register({
      componentId: 'physics_optics',
      name: 'Mô phỏng quang học theo tiến trình (Physics Optics)',
      description: 'Payload typed cho ánh sáng trắng, tán sắc, khúc xạ, phản xạ trong, góc thoát và hình học người quan sát.',
      category: 'physics',
      supportedTopics: ['physics.optics.rainbow', 'optics', 'physics'],
      supportedBackends: ['remotion', 'hybrid'],
      payloadSchema: PhysicsOpticsVisualPayloadSchema,
      defaultLayout: 'centered_focus',
      defaultStyle: 'clean_educational_infographic',
      requiresMathVerification: true
    });

    this.register({
      componentId: 'physics_explainer',
      name: 'Cinematic Physics Explainer',
      description: 'Format 6 beat tái sử dụng cho chuỗi quá trình, trạng thái hạt, sóng, lực và năng lượng.',
      category: 'physics',
      supportedTopics: ['physics.electromagnetism.telecom', 'physics.thermodynamics.condensation', 'physics'],
      supportedBackends: ['remotion', 'hybrid'],
      payloadSchema: PhysicsExplainerVisualPayloadSchema,
      defaultLayout: 'centered_focus',
      defaultStyle: 'clean_educational_infographic',
      requiresMathVerification: false
    });

    this.register({
      componentId: 'light_ray_animation',
      name: 'Mô phỏng tia sáng quang học (Light Ray Animation)',
      description: 'Hiển thị tia sáng định hướng, mặt sóng và luồng photon di chuyển theo thời gian thực.',
      category: 'physics',
      supportedTopics: ['physics.optics.rainbow', 'optics', 'physics'],
      supportedBackends: ['remotion', 'hybrid'],
      payloadSchema: GenericSceneVisualPayloadSchema,
      defaultLayout: 'centered_focus',
      defaultStyle: 'clean_educational_infographic',
      requiresMathVerification: false
    });

    this.register({
      componentId: 'prism_dispersion',
      name: 'Tán sắc lăng kính Newton (Prism Dispersion)',
      description: 'Mô phỏng thí nghiệm tán sắc ánh sáng trắng qua lăng kính thành 7 dải màu quang phổ.',
      category: 'physics',
      supportedTopics: ['physics.optics.rainbow', 'optics', 'physics'],
      supportedBackends: ['remotion', 'hybrid'],
      payloadSchema: GenericSceneVisualPayloadSchema,
      defaultLayout: 'centered_focus',
      defaultStyle: 'clean_educational_infographic',
      requiresMathVerification: false
    });

    this.register({
      componentId: 'raindrop_refraction',
      name: 'Khúc xạ giọt nước mưa (Raindrop Refraction)',
      description: 'Mô phỏng mặt cắt giọt nước mưa hình cầu, pháp tuyến và góc khúc xạ định luật Snell.',
      category: 'physics',
      supportedTopics: ['physics.optics.rainbow', 'optics', 'physics'],
      supportedBackends: ['remotion', 'hybrid'],
      payloadSchema: GenericSceneVisualPayloadSchema,
      defaultLayout: 'centered_focus',
      defaultStyle: 'clean_educational_infographic',
      requiresMathVerification: true
    });

    this.register({
      componentId: 'internal_reflection',
      name: 'Phản xạ trong giọt nước (Internal Reflection)',
      description: 'Mô phỏng tia sáng phản xạ tại thành sau của giọt nước đổi hướng về mặt trước.',
      category: 'physics',
      supportedTopics: ['physics.optics.rainbow', 'optics', 'physics'],
      supportedBackends: ['remotion', 'hybrid'],
      payloadSchema: GenericSceneVisualPayloadSchema,
      defaultLayout: 'centered_focus',
      defaultStyle: 'clean_educational_infographic',
      requiresMathVerification: false
    });

    this.register({
      componentId: 'rainbow_formation',
      name: 'Hình thành cầu vồng khí quyển (Rainbow Formation)',
      description: 'Mô phỏng góc lệch cực tiểu Descartes 40°-42° và vòng cung cầu vồng 7 sắc trên bầu trời.',
      category: 'physics',
      supportedTopics: ['physics.optics.rainbow', 'optics', 'physics'],
      supportedBackends: ['remotion', 'hybrid'],
      payloadSchema: GenericSceneVisualPayloadSchema,
      defaultLayout: 'centered_focus',
      defaultStyle: 'clean_educational_infographic',
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

