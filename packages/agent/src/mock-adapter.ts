import type { GeminiAdapter, StructuredGenerationRequest } from './adapter';

export class MockGeminiAdapter implements GeminiAdapter {
  constructor(private readonly overrides: Partial<Record<StructuredGenerationRequest['purpose'], unknown>> = {}) {}
  async generateStructured(request: StructuredGenerationRequest): Promise<unknown> {
    if (request.purpose in this.overrides) return this.overrides[request.purpose];
    if (request.purpose === 'lesson_plan') return {
      lessonTitle: 'Đạo hàm là gì? — Từ cát tuyến đến tiếp tuyến', topicId: 'calculus.derivative.intuition', targetAudience: 'Học sinh lớp 11', language: 'vi',
      learningObjectives: ['Hiểu hệ số góc cát tuyến là tốc độ thay đổi trung bình.', 'Nhận ra tiếp tuyến là vị trí giới hạn của cát tuyến khi hai điểm tiến lại gần nhau.'],
      intuitiveExplanation: 'Giữ P cố định trên đồ thị y = x² và đưa Q tiến gần P. Độ nghiêng của đường qua P, Q ổn định dần thành độ nghiêng tiếp tuyến.',
      mathematicalClaims: [
        { id: 'claim_derivative', statement: 'Đạo hàm của x² là 2x.', validatorKey: 'polynomial_derivative', expectedExpression: '2*x' },
        { id: 'claim_secant', statement: 'Tại x = 1, hệ số góc cát tuyến là 2 + h.', validatorKey: 'secant_slope', expectedExpression: '2+h' },
        { id: 'claim_limit', statement: 'Khi h tiến tới 0, hệ số góc tiến tới 2.', validatorKey: 'limit_at_zero', expectedExpression: '2' },
        { id: 'claim_value', statement: 'Hệ số góc tiếp tuyến tại x = 1 bằng 2.', validatorKey: 'value_at_point', expectedExpression: '2' }
      ],
      sceneOutline: [
        { id: 'step_graph', pedagogicalGoal: 'Thiết lập đối tượng hình học.', narration: 'Xét đồ thị y = x² và điểm P tại x = 1.', visualization: 'function_graph', durationSeconds: 8 },
        { id: 'step_secant', pedagogicalGoal: 'Thấy cát tuyến thay đổi liên tục.', narration: 'Điểm Q tiến dần về P, nên h nhỏ dần nhưng không bằng 0.', visualization: 'secant_to_tangent', durationSeconds: 16 },
        { id: 'step_equation', pedagogicalGoal: 'Nối hình học với phép biến đổi đại số.', narration: 'Hệ số góc cát tuyến bằng 2 + h và tiến tới 2.', visualization: 'equation_reveal', durationSeconds: 8 },
        { id: 'step_summary', pedagogicalGoal: 'Khái quát ý nghĩa đạo hàm.', narration: 'Đạo hàm tại một điểm là hệ số góc tiếp tuyến khi đạo hàm tồn tại.', visualization: 'concept_summary', durationSeconds: 8 }
      ],
      summary: 'Với f(x) = x², các cát tuyến qua P tiến tới tiếp tuyến có hệ số góc 2; do đó f\'(1) = 2.'
    };
    return { schemaVersion: 'math-v1', topicId: 'calculus.derivative.intuition', visualization: 'secant_to_tangent', function: { type: 'polynomial', coefficients: [0, 0, 1] }, pointX: 1, hStart: 2, hEnd: 0.05, durationSeconds: 8, fps: 24, width: 720, height: 1280 };
  }
}

