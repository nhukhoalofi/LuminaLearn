import { z } from 'zod';
import { type SupportedAspectRatio, type SceneTypeSchema } from './contracts';

export type SceneType = z.infer<typeof SceneTypeSchema>;

/**
 * Năng lực kỹ thuật của visual template
 */
export interface MathTemplateCapabilities {
  supportsAspectRatios: SupportedAspectRatio[];
  minDurationSeconds: number;
  maxDurationSeconds: number;
  supportsLatex: boolean;
  supportsMotionPath: boolean;
  requiresPythonSymPy: boolean;
}

/**
 * Định nghĩa template hoạt họa toán học (MathTemplateDefinition)
 */
export interface MathTemplateDefinition<TParams = Record<string, unknown>> {
  templateId: string;
  name: string;
  description: string;
  topicIds: string[];
  sceneType: SceneType;
  renderer: 'manim' | 'remotion' | 'hybrid';
  estimatedRenderCost: 'low' | 'medium' | 'high';
  validatorKeys: string[];
  capabilities: MathTemplateCapabilities;
  parameterSchema: z.ZodType<TParams>;
}

/**
 * Registry quản trị danh mục visual templates mở rộng
 * Đảm bảo:
 * 1. AI chỉ được chọn template đã được đăng ký và kiểm định an toàn.
 * 2. Không cho phép sinh mã Python tùy tiện (Zero arbitrary code execution).
 * 3. Tham số đầu vào phải pass Zod schema tương ứng của template.
 */
export class MathTemplateRegistry {
  private readonly templates = new Map<string, MathTemplateDefinition>();

  constructor() {
    this.registerBuiltinTemplates();
  }

  public register<T>(definition: MathTemplateDefinition<T>): void {
    if (this.templates.has(definition.templateId)) {
      throw new Error(`Template already registered: ${definition.templateId}`);
    }
    this.templates.set(definition.templateId, definition as MathTemplateDefinition);
  }

  public get(templateId: string): MathTemplateDefinition | undefined {
    return this.templates.get(templateId);
  }

  public getOrThrow(templateId: string): MathTemplateDefinition {
    const tmpl = this.templates.get(templateId);
    if (!tmpl) {
      throw new Error(`unsupported_visualization: Template '${templateId}' is not registered`);
    }
    return tmpl;
  }

  public has(templateId: string): boolean {
    return this.templates.has(templateId);
  }

  public listAll(): MathTemplateDefinition[] {
    return Array.from(this.templates.values());
  }

  public listForTopic(topicId: string): MathTemplateDefinition[] {
    return this.listAll().filter((t) => t.topicIds.includes(topicId) || t.topicIds.includes('*'));
  }

  public validateParameters(templateId: string, parameters: unknown): Record<string, unknown> {
    const tmpl = this.getOrThrow(templateId);
    return tmpl.parameterSchema.parse(parameters) as Record<string, unknown>;
  }

  private registerBuiltinTemplates(): void {
    // 1. Template hiện có: function_graph (Vẽ đồ thị hàm đa thức)
    this.register({
      templateId: 'function_graph',
      name: 'Đồ thị hàm số',
      description: 'Vẽ đồ thị hàm số và đánh dấu điểm khảo sát trên hệ trục tọa độ',
      topicIds: ['calculus.derivative.intuition', 'calculus.functions.general', '*'],
      sceneType: 'concept',
      renderer: 'manim',
      estimatedRenderCost: 'low',
      validatorKeys: ['polynomial_derivative', 'value_at_point'],
      capabilities: {
        supportsAspectRatios: ['9:16', '16:9', '1:1'],
        minDurationSeconds: 2,
        maxDurationSeconds: 15,
        supportsLatex: true,
        supportsMotionPath: false,
        requiresPythonSymPy: true
      },
      parameterSchema: z.object({
        title: z.string().max(200).optional(),
        body: z.string().max(1000).optional(),
        eyebrow: z.string().max(100).optional(),
        coefficients: z.array(z.number().finite()).min(2).max(6),
        pointX: z.number().finite().min(-10).max(10),
        xRange: z.tuple([z.number(), z.number()]).default([-4, 4]),
        yRange: z.tuple([z.number(), z.number()]).default([-2, 10])
      }).strict()
    });

    // 2. Template hiện có: secant_to_tangent (Cát tuyến tiến về tiếp tuyến khi h -> 0)
    this.register({
      templateId: 'secant_to_tangent',
      name: 'Từ cát tuyến đến tiếp tuyến',
      description: 'Mô phỏng điểm Q trượt dần về P khi khoảng cách h tiến dần về 0',
      topicIds: ['calculus.derivative.intuition'],
      sceneType: 'animation',
      renderer: 'manim',
      estimatedRenderCost: 'medium',
      validatorKeys: ['secant_slope', 'limit_at_zero', 'polynomial_derivative'],
      capabilities: {
        supportsAspectRatios: ['9:16', '16:9'],
        minDurationSeconds: 4,
        maxDurationSeconds: 20,
        supportsLatex: true,
        supportsMotionPath: true,
        requiresPythonSymPy: true
      },
      parameterSchema: z.object({
        title: z.string().max(200).optional(),
        body: z.string().max(1000).optional(),
        eyebrow: z.string().max(100).optional(),
        coefficients: z.array(z.number().finite()).min(2).max(6),
        pointX: z.number().finite().min(-10).max(10),
        hStart: z.number().finite().min(0.05).max(5),
        hEnd: z.number().finite().min(0.001).max(0.5)
      }).strict().superRefine((val, ctx) => {
        if (val.hEnd >= val.hStart) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'hEnd must be smaller than hStart' });
        }
      })
    });

    // 3. Template mở rộng: riemann_sum (Tổng tích phân Riemann)
    this.register({
      templateId: 'riemann_sum',
      name: 'Tổng tích phân Riemann',
      description: 'Chia nhỏ diện tích dưới đường cong thành các hình chữ nhật khi n -> vô cùng',
      topicIds: ['calculus.integral.riemann_sum'],
      sceneType: 'animation',
      renderer: 'manim',
      estimatedRenderCost: 'high',
      validatorKeys: ['riemann_sum_limit', 'definite_integral'],
      capabilities: {
        supportsAspectRatios: ['9:16', '16:9'],
        minDurationSeconds: 4,
        maxDurationSeconds: 20,
        supportsLatex: true,
        supportsMotionPath: true,
        requiresPythonSymPy: true
      },
      parameterSchema: z.object({
        title: z.string().max(200).optional(),
        body: z.string().max(1000).optional(),
        eyebrow: z.string().max(100).optional(),
        functionExpression: z.string().min(1).max(100),
        interval: z.tuple([z.number(), z.number()]),
        partitionsStart: z.number().int().min(2).max(20).default(4),
        partitionsEnd: z.number().int().min(4).max(200).default(64),
        method: z.enum(['left', 'right', 'midpoint', 'trapezoid']).default('midpoint')
      }).strict()
    });

    // 4. Template mở rộng: vector_transform (Biến đổi không gian vector)
    this.register({
      templateId: 'vector_transform',
      name: 'Biến đổi ma trận vector',
      description: 'Minh họa phép biến đổi tuyến tính qua ma trận 2x2 biến đổi hệ trục cơ sở i-hat, j-hat',
      topicIds: ['linear_algebra.matrix_transform'],
      sceneType: 'animation',
      renderer: 'manim',
      estimatedRenderCost: 'medium',
      validatorKeys: ['determinant', 'eigenvalues'],
      capabilities: {
        supportsAspectRatios: ['9:16', '16:9', '1:1'],
        minDurationSeconds: 3,
        maxDurationSeconds: 15,
        supportsLatex: true,
        supportsMotionPath: true,
        requiresPythonSymPy: true
      },
      parameterSchema: z.object({
        title: z.string().max(200).optional(),
        body: z.string().max(1000).optional(),
        eyebrow: z.string().max(100).optional(),
        matrix: z.tuple([
          z.tuple([z.number(), z.number()]),
          z.tuple([z.number(), z.number()])
        ]),
        showBasisVectors: z.boolean().default(true),
        showGrid: z.boolean().default(true)
      }).strict()
    });

    // 5. Template mở rộng: unit_circle (Đường tròn lượng giác)
    this.register({
      templateId: 'unit_circle',
      name: 'Đường tròn lượng giác',
      description: 'Biểu diễn góc quay theta và các giá trị sin, cos, tan trên đường tròn đơn vị',
      topicIds: ['trigonometry.unit_circle'],
      sceneType: 'concept',
      renderer: 'hybrid',
      estimatedRenderCost: 'low',
      validatorKeys: ['sin_cos_relation', 'special_angles'],
      capabilities: {
        supportsAspectRatios: ['9:16', '16:9', '1:1'],
        minDurationSeconds: 3,
        maxDurationSeconds: 15,
        supportsLatex: true,
        supportsMotionPath: true,
        requiresPythonSymPy: true
      },
      parameterSchema: z.object({
        title: z.string().max(200).optional(),
        body: z.string().max(1000).optional(),
        eyebrow: z.string().max(100).optional(),
        angleRadians: z.number().finite().default(0),
        sweepRange: z.tuple([z.number(), z.number()]).default([0, 6.28318]),
        showComponents: z.enum(['all', 'sin_only', 'cos_only']).default('all')
      }).strict()
    });
  }
}

export const defaultTemplateRegistry = new MathTemplateRegistry();
