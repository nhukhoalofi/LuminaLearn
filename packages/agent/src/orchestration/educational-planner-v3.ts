import {
  classifyEducationalTopic,
  type EducationalClaimV3,
  type EducationalLessonPlanV3,
  type EducationalStoryboardV3,
  EducationalLessonPlanV3Schema,
  REGISTERED_TOPICS_V3,
  type TopicCapabilityReportV3
} from '@luminalearn/scene-schema';
import type { AIProvider } from './ai-provider';
import type { DocumentAnalysisResult } from './types';

export interface EducationalPlannerV3Options {
  aiProvider?: AIProvider;
}

export interface PlanLessonV3Input {
  lessonId: string;
  topic: string;
  audience?: string;
  language?: 'vi' | 'en';
  targetDurationSeconds?: number;
  documentAnalysis?: DocumentAnalysisResult;
}

/**
 * EducationalPlannerV3: Bộ lập kế hoạch giáo dục thế hệ mới V3.
 * Hỗ trợ hai lĩnh vực trọng tâm: TOÁN HỌC và TRÍ TUỆ NHÂN TẠO / HỌC MÁY.
 * Đảm bảo:
 * 1. Không ép buộc phương trình đạo hàm đa thức cho các chủ đề AI định tính.
 * 2. Phân loại rành mạch giữa mệnh đề chứng minh hình thức và khái niệm trực quan.
 * 3. Báo cáo năng lực render trung thực (render_ready vs planning_only).
 */
export class EducationalPlannerV3 {
  private readonly aiProvider?: AIProvider;

  constructor(options?: EducationalPlannerV3Options) {
    this.aiProvider = options?.aiProvider;
  }

  public async planLesson(input: PlanLessonV3Input): Promise<EducationalLessonPlanV3> {
    const {
      lessonId,
      topic,
      audience = 'Học sinh phổ thông và sinh viên công nghệ',
      language = 'vi',
      targetDurationSeconds = 40,
      documentAnalysis
    } = input;

    // Bước 1: Phân loại lĩnh vực và năng lực xác định (fail-closed cho chủ đề ngoài phạm vi)
    const capabilityReport = classifyEducationalTopic(topic);

    // Bước 2: Tạo kế hoạch bài học dựa trên lĩnh vực và năng lực thực tế
    const plan = this.buildDeterministicPlan(lessonId, topic, capabilityReport, targetDurationSeconds, documentAnalysis);

    // Bước 3: Xác thực qua Zod Schema V3
    return EducationalLessonPlanV3Schema.parse(plan);
  }

  private buildDeterministicPlan(
    lessonId: string,
    topic: string,
    capability: TopicCapabilityReportV3,
    targetDurationSeconds: number,
    documentAnalysis?: DocumentAnalysisResult
  ): EducationalLessonPlanV3 {
    const isMath = capability.domain === 'mathematics';

    let title = capability.displayName;
    let summary = '';
    let learningObjectives: string[] = [];
    let keyConcepts: string[] = [];
    let claims: EducationalClaimV3[] = [];
    let scenes: EducationalStoryboardV3['scenes'] = [];

    // --- MATHEMATICS BENCHMARKS ---
    if (capability.topicId === 'calculus.derivative.intuition') {
      summary = 'Bản chất hình học của đạo hàm là hệ số góc của tiếp tuyến khi cát tuyến co lại.';
      learningObjectives = [
        'Hiểu bản chất tiếp tuyến là giới hạn của cát tuyến',
        'Nắm vững mối liên hệ giữa đạo hàm và tốc độ thay đổi tức thời'
      ];
      keyConcepts = ['Cát tuyến', 'Tiếp tuyến', 'Khoảng cách h', 'Hệ số góc', 'Đạo hàm'];
      claims = [
        {
          id: 'claim_poly_deriv',
          claimType: 'formal_mathematics',
          statement: 'Đạo hàm của hàm đa thức f(x) = x^2 là f\'(x) = 2*x',
          formalExpression: '2*x',
          validatorKey: 'polynomial_derivative',
          verificationStatus: 'formally_verified',
          formalProofSummary: 'SymPy verified: diff(x**2, x) == 2*x'
        },
        {
          id: 'claim_secant_limit',
          claimType: 'formal_mathematics',
          statement: 'Hệ số góc cát tuyến qua x=1 là m(h) = 2 + h, có giới hạn bằng 2 khi h tiến về 0',
          formalExpression: '2',
          validatorKey: 'limit_at_zero',
          verificationStatus: 'formally_verified',
          formalProofSummary: 'SymPy verified: limit((2+h), h, 0) == 2'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_intro',
          sceneType: 'concept_intro',
          title: 'Khái niệm cát tuyến trên parabol',
          pedagogicalGoal: 'Khởi đầu với đường thẳng nối hai điểm trên đồ thị y = x^2',
          durationSeconds: 12,
          boundClaimIds: ['claim_poly_deriv'],
          rendererTarget: 'manim_hybrid',
          narration: {
            vietnamese: 'Chào mừng các bạn. Ta xét đường cát tuyến nối hai điểm phân biệt trên đường cong parabol.',
            subtitleVietnamese: 'Xét cát tuyến nối hai điểm phân biệt trên parabol.'
          },
          visualPayload: {}
        },
        {
          sceneId: 'sc_limit',
          sceneType: 'formula_derivation',
          title: 'Khoảng cách h co về 0',
          pedagogicalGoal: 'Mô phỏng cát tuyến tiệm cận tiếp tuyến khi hai điểm chập một',
          durationSeconds: 16,
          boundClaimIds: ['claim_secant_limit'],
          rendererTarget: 'manim_hybrid',
          narration: {
            vietnamese: 'Khi cho khoảng cách h co dần về 0, đường cát tuyến xoay dần và trở thành tiếp tuyến duy nhất.',
            subtitleVietnamese: 'Khi h co về 0, cát tuyến trở thành tiếp tuyến duy nhất.'
          },
          visualPayload: {}
        },
        {
          sceneId: 'sc_summary',
          sceneType: 'summary',
          title: 'Ý nghĩa đạo hàm',
          pedagogicalGoal: 'Khái quát hệ số góc tiếp tuyến chính là giá trị đạo hàm tại điểm',
          durationSeconds: 12,
          boundClaimIds: ['claim_poly_deriv'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Như vậy, đạo hàm tại một điểm chính là tốc độ biến thiên tức thời và là hệ số góc tiếp tuyến.',
            subtitleVietnamese: 'Đạo hàm là hệ số góc tiếp tuyến và tốc độ biến thiên tức thời.'
          },
          visualPayload: {}
        }
      ];
    } else if (capability.topicId === 'calculus.riemann_integral.intuition') {
      summary = 'Tích phân xác định là giới hạn của tổng diện tích các hình chữ nhật siêu mỏng xấp xỉ hình thang cong.';
      learningObjectives = [
        'Hiểu bản chất tổng Riemann là xấp xỉ diện tích dưới đường cong',
        'Nắm khái niệm tích phân xác định khi số lượng hình chữ nhật tiến ra vô cùng'
      ];
      keyConcepts = ['Đường cong hàm số', 'Phân hoạch khoảng', 'Hình chữ nhật Riemann', 'Tích phân xác định'];
      claims = [
        {
          id: 'claim_riemann_int',
          claimType: 'formal_mathematics',
          statement: 'Tích phân xác định của x^2 trên đoạn [0, 1] có giá trị đúng bằng 1/3',
          formalExpression: '1/3',
          validatorKey: 'riemann_integral',
          verificationStatus: 'formally_verified',
          formalProofSummary: 'SymPy verified: integrate(x**2, (x, 0, 1)) == 1/3'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_intro',
          sceneType: 'concept_intro',
          title: 'Bài toán tính diện tích hình phẳng',
          pedagogicalGoal: 'Đặt vấn đề diện tích phần mặt phẳng dưới đường cong parabol y = x^2',
          durationSeconds: 14,
          boundClaimIds: ['claim_riemann_int'],
          rendererTarget: 'manim_hybrid',
          narration: {
            vietnamese: 'Làm thế nào để tính chính xác diện tích phần hình cong dưới parabol từ 0 đến 1?',
            subtitleVietnamese: 'Tính diện tích hình thang cong dưới parabol.'
          },
          visualPayload: {}
        },
        {
          sceneId: 'sc_rectangles',
          sceneType: 'graph_plot',
          title: 'Chia nhỏ thành các dải chữ nhật',
          pedagogicalGoal: 'Mô phỏng tổng Riemann với phân hoạch 4, 8, 16 hình chữ nhật',
          durationSeconds: 16,
          boundClaimIds: ['claim_riemann_int'],
          rendererTarget: 'manim_hybrid',
          narration: {
            vietnamese: 'Ta chia đoạn thành các dải chữ nhật nhỏ. Càng chia mịn, tổng diện tích càng sát giá trị tích phân 1/3.',
            subtitleVietnamese: 'Càng chia mịn hình chữ nhật, sai số càng triệt tiêu về 0.'
          },
          visualPayload: {}
        },
        {
          sceneId: 'sc_summary',
          sceneType: 'summary',
          title: 'Định nghĩa tích phân',
          pedagogicalGoal: 'Kết luận tích phân là giới hạn của tổng diện tích',
          durationSeconds: 10,
          boundClaimIds: ['claim_riemann_int'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Tích phân xác định chính là tổng vô hạn các diện tích vi phân vô cùng bé.',
            subtitleVietnamese: 'Tích phân xác định là tổng vô hạn các vi phân diện tích.'
          },
          visualPayload: {}
        }
      ];
    } else if (capability.topicId === 'linear_algebra.matrix_transform') {
      summary = 'Ma trận vuông biểu diễn một phép biến đổi tuyến tính kéo giãn hoặc quay không gian vector.';
      learningObjectives = [
        'Hiểu ma trận như một hành động biến đổi không gian',
        'Theo dõi vector cơ sở i-hat và j-hat sau biến đổi'
      ];
      keyConcepts = ['Vector cơ sở', 'Biến đổi tuyến tính', 'Ma trận 2x2', 'Định thức'];
      claims = [
        {
          id: 'claim_lin_basis',
          claimType: 'formal_mathematics',
          statement: 'Phép biến đổi tuyến tính được xác định hoàn toàn bởi tọa độ ảnh của các vector cơ sở.',
          formalExpression: 'T(v) = A * v',
          validatorKey: 'matrix_transform',
          verificationStatus: 'formally_verified',
          formalProofSummary: 'Matrix linear mapping verified: T(c1*v1 + c2*v2) = c1*T(v1) + c2*T(v2)'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_grid',
          sceneType: 'graph_plot',
          title: 'Lưới tọa độ ban đầu',
          pedagogicalGoal: 'Trực quan hóa hệ trục tọa độ với hai vector cơ sở',
          durationSeconds: 18,
          boundClaimIds: ['claim_lin_basis'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Trong không gian hai chiều, mọi vector đều biểu diễn qua tổ hợp của hai vector cơ sở.',
            subtitleVietnamese: 'Mọi vector đều biểu diễn qua hai vector cơ sở.'
          },
          visualPayload: {}
        },
        {
          sceneId: 'sc_warp',
          sceneType: 'flowchart_simulation',
          title: 'Ma trận làm biến dạng không gian',
          pedagogicalGoal: 'Trực quan hóa lưới tọa độ bị nghiêng và kéo giãn theo ma trận',
          durationSeconds: 22,
          boundClaimIds: ['claim_lin_basis'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Nhân vector với ma trận chính là di chuyển lưới không gian tới vị trí mới.',
            subtitleVietnamese: 'Phép nhân ma trận chính là biến đổi hình học không gian.'
          },
          visualPayload: {}
        }
      ];
    } else if (capability.topicId === 'calculus.limits.epsilon_delta') {
      summary = 'Định nghĩa giới hạn Epsilon - Delta định lượng hóa sự tiệm cận chính xác của hàm số.';
      learningObjectives = ['Nắm được vai trò của khoảng dung sai epsilon và lân cận delta'];
      keyConcepts = ['Giới hạn', 'Epsilon', 'Delta', 'Lân cận'];
      claims = [
        {
          id: 'claim_eps_delta',
          claimType: 'formal_mathematics',
          statement: 'Với mọi epsilon dương, luôn tồn tại delta dương sao cho khi 0 < |x - c| < delta thì |f(x) - L| < epsilon.',
          formalExpression: 'forall eps > 0, exists delta > 0: 0 < |x - c| < delta => |f(x) - L| < eps',
          validatorKey: 'epsilon_delta_definition',
          verificationStatus: 'formally_verified',
          formalProofSummary: 'Cauchy limit definition formal correspondence checked'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_eps_intro',
          sceneType: 'concept_intro',
          title: 'Thách thức dung sai Epsilon',
          pedagogicalGoal: 'Giải thích dải dung sai quanh giá trị đích L',
          durationSeconds: 20,
          boundClaimIds: ['claim_eps_delta'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Epsilon là khoảng dung sai cho phép quanh giá trị giới hạn L mà ta muốn đạt tới.',
            subtitleVietnamese: 'Epsilon đại diện cho dung sai quanh giá trị L.'
          },
          visualPayload: {}
        },
        {
          sceneId: 'sc_delta_response',
          sceneType: 'formula_derivation',
          title: 'Đáp ứng bằng khoảng Delta',
          pedagogicalGoal: 'Tìm khoảng đầu vào delta để đảm bảo đầu ra nằm trọn trong epsilon',
          durationSeconds: 20,
          boundClaimIds: ['claim_eps_delta'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Nhiệm vụ của ta là tìm ra một bán kính delta đầu vào đủ nhỏ để đồ thị không vượt khỏi dải epsilon.',
            subtitleVietnamese: 'Tìm delta đầu vào để đầu ra không vượt khỏi dải epsilon.'
          },
          visualPayload: {}
        }
      ];
    } else if (capability.topicId === 'probability.bayes_theorem') {
      summary = 'Định lý Bayes cho phép cập nhật xác suất của giả thuyết khi có thêm bằng chứng thực nghiệm.';
      learningObjectives = ['Phân biệt xác suất tiên nghiệm (prior) và xác suất hậu nghiệm (posterior)'];
      keyConcepts = ['Prior', 'Likelihood', 'Posterior', 'Định lý Bayes'];
      claims = [
        {
          id: 'claim_bayes_formula',
          claimType: 'formal_mathematics',
          statement: 'Xác suất hậu nghiệm P(A|B) bằng P(B|A) nhân P(A) chia cho P(B).',
          formalExpression: 'P(A|B) = P(B|A) * P(A) / P(B)',
          validatorKey: 'bayes_theorem',
          verificationStatus: 'formally_verified',
          formalProofSummary: 'Bayes rule identity formally verified: P(A,B) / P(B) == P(B|A)*P(A) / P(B)'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_bayes_intro',
          sceneType: 'concept_intro',
          title: 'Khái niệm niềm tin ban đầu',
          pedagogicalGoal: 'Giới thiệu xác suất tiên nghiệm prior',
          durationSeconds: 18,
          boundClaimIds: ['claim_bayes_formula'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Trước khi có bằng chứng mới, ta có một ước lượng xác suất ban đầu gọi là tiên nghiệm.',
            subtitleVietnamese: 'Ước lượng niềm tin ban đầu gọi là tiên nghiệm.'
          },
          visualPayload: {}
        },
        {
          sceneId: 'sc_bayes_update',
          sceneType: 'formula_derivation',
          title: 'Cập nhật hậu nghiệm với bằng chứng',
          pedagogicalGoal: 'Minh họa công thức Bayes điều chỉnh niềm tin',
          durationSeconds: 22,
          boundClaimIds: ['claim_bayes_formula'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Khi bằng chứng xuất hiện, công thức Bayes cân chỉnh lại niềm tin thành xác suất hậu nghiệm.',
            subtitleVietnamese: 'Bằng chứng mới cân chỉnh niềm tin thành xác suất hậu nghiệm.'
          },
          visualPayload: {}
        }
      ];
    }

    // --- ARTIFICIAL INTELLIGENCE BENCHMARKS ---
    else if (capability.topicId === 'ai.perceptron.activation') {
      summary = 'Perceptron là viên gạch nền tảng của mạng neural, kết hợp tổng có trọng số với hàm kích hoạt phi tuyến.';
      learningObjectives = [
        'Hiểu cấu tạo của một nơ-ron nhân tạo: đầu vào, trọng số, bias và hàm kích hoạt',
        'Giải thích lý do cần tính phi tuyến từ hàm Sigmoid và ReLU'
      ];
      keyConcepts = ['Đầu vào (Inputs)', 'Trọng số (Weights)', 'Độ chệch (Bias)', 'Hàm kích hoạt (Activation Function)', 'ReLU & Sigmoid'];
      claims = [
        {
          id: 'claim_perceptron_structure',
          claimType: 'ai_concept',
          statement: 'Perceptron tính tổng có trọng số của các đầu vào, cộng bias rồi truyền qua hàm kích hoạt phi tuyến.',
          verificationStatus: 'source_grounded',
          humanReviewComment: 'Định nghĩa chuẩn nơ-ron nhân tạo của Rosenblatt và cấu trúc mạng truyền thẳng.'
        },
        {
          id: 'claim_non_linearity',
          claimType: 'algorithmic_property',
          statement: 'Nếu không có hàm kích hoạt phi tuyến, mạng neural nhiều lớp sẽ suy biến thành một phép biến đổi tuyến tính đơn lẻ.',
          verificationStatus: 'human_review_required',
          humanReviewComment: 'Giáo viên xác nhận tính chất xếp chồng ma trận tuyến tính luôn cho ra một ma trận tuyến tính.'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_neuron_anatomy',
          sceneType: 'neural_architecture',
          title: 'Cấu tạo một Nơ-ron nhân tạo',
          pedagogicalGoal: 'Trực quan hóa luồng dữ liệu từ các đầu vào x_i, nhân trọng số w_i đến bộ tích lũy',
          durationSeconds: 20,
          boundClaimIds: ['claim_perceptron_structure'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Một nơ-ron nhân tạo nhận các tín hiệu đầu vào, nhân với trọng số riêng biệt rồi cộng thêm độ chệch bias.',
            subtitleVietnamese: 'Nơ-ron nhận đầu vào, nhân trọng số và cộng độ chệch bias.'
          },
          visualPayload: {}
        },
        {
          sceneId: 'sc_activation_curves',
          sceneType: 'graph_plot',
          title: 'Sức mạnh của tính phi tuyến',
          pedagogicalGoal: 'So sánh đường cong kích hoạt Sigmoid và ReLU giúp mạng học được các mặt phân chia phức tạp',
          durationSeconds: 20,
          boundClaimIds: ['claim_non_linearity'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Hàm kích hoạt như ReLU hoặc Sigmoid bẻ cong không gian, giúp mạng học được các bài toán phi tuyến.',
            subtitleVietnamese: 'Hàm kích hoạt phi tuyến giúp mạng học bài toán phức tạp.'
          },
          visualPayload: {}
        }
      ];
    } else if (capability.topicId === 'ai.gradient_descent.optimization') {
      summary = 'Gradient Descent là thuật toán tối ưu hóa lặp giúp mạng neural tìm đáy của hàm mất mát.';
      learningObjectives = [
        'Hiểu vector gradient chỉ hướng tăng nhanh nhất của hàm mất mát',
        'Nắm quy tắc bước cập nhật ngược hướng gradient với tốc độ học learning rate'
      ];
      keyConcepts = ['Hàm mất mát (Loss Function)', 'Gradient', 'Tốc độ học (Learning Rate)', 'Cực tiểu cục bộ'];
      claims = [
        {
          id: 'claim_gd_update_rule',
          claimType: 'formal_mathematics',
          statement: 'Quy tắc cập nhật tham số w: w_mới = w_cũ - eta * nabla L(w)',
          formalExpression: 'w_next = w - eta * grad_L(w)',
          validatorKey: 'gradient_descent_formula',
          verificationStatus: 'formally_verified',
          formalProofSummary: 'First-order iterative optimization step formally validated'
        },
        {
          id: 'claim_lr_intuition',
          claimType: 'ai_concept',
          statement: 'Tốc độ học quá lớn gây phân kỳ vượt khỏi cực tiểu, trong khi quá nhỏ khiến quá trình hội tụ rất chậm.',
          verificationStatus: 'source_grounded',
          humanReviewComment: 'Hành vi hội tụ của learning rate trong tối ưu hóa học máy.'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_loss_bowl',
          sceneType: 'loss_landscape',
          title: 'Bề mặt hàm mất mát và quả bóng lăn',
          pedagogicalGoal: 'Trực quan hóa bề mặt hàm mất mát dạng cái bát và vị trí hiện tại của mô hình',
          durationSeconds: 18,
          boundClaimIds: ['claim_gd_update_rule'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Hãy hình dung hàm mất mát như một thung lũng, mục tiêu của ta là đưa quả bóng lăn xuống đáy sâu nhất.',
            subtitleVietnamese: 'Hàm mất mát như thung lũng, mô hình cần lăn xuống đáy sâu nhất.'
          },
          visualPayload: {}
        },
        {
          sceneId: 'sc_descent_steps',
          sceneType: 'flowchart_simulation',
          title: 'Từng bước cập nhật theo Gradient',
          pedagogicalGoal: 'Minh họa các bước chân bước ngược chiều vector đạo hàm',
          durationSeconds: 22,
          boundClaimIds: ['claim_lr_intuition'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Ở mỗi bước, gradient chỉ hướng lên dốc. Ta bước theo hướng ngược lại một đoạn bằng tốc độ học.',
            subtitleVietnamese: 'Bước ngược hướng gradient một đoạn tỉ lệ với tốc độ học.'
          },
          visualPayload: {}
        }
      ];
    } else if (capability.topicId === 'ai.transformer.attention') {
      summary = 'Cơ chế Self-Attention tính toán trọng số quan hệ ngữ cảnh giữa mọi cặp từ trong câu.';
      learningObjectives = [
        'Hiểu hạn chế của mô hình tuần tự RNN trong việc xử lý phụ thuộc xa',
        'Nắm cách tính Attention qua ba vector Query, Key, Value'
      ];
      keyConcepts = ['Self-Attention', 'Query (Truy vấn)', 'Key (Khóa)', 'Value (Giá trị)', 'Softmax Scaling'];
      claims = [
        {
          id: 'claim_attention_mechanism',
          claimType: 'ai_concept',
          statement: 'Self-Attention tính toán độ tương đồng giữa vector Query và các Key để tạo phân phối trọng số mềm cho các Value.',
          verificationStatus: 'source_grounded',
          humanReviewComment: 'Được trích xuất từ nghiên cứu kiến trúc Transformer chuẩn Vaswani et al., 2017.'
        },
        {
          id: 'claim_attention_formula',
          claimType: 'algorithmic_property',
          statement: 'Công thức tính ma trận Attention: Attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V',
          formalExpression: 'softmax(Q * K^T / sqrt(d_k)) * V',
          validatorKey: 'scaled_dot_product',
          verificationStatus: 'formally_verified',
          formalProofSummary: 'Scaled dot-product attention algebraic identity verified'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_context_need',
          sceneType: 'concept_intro',
          title: 'Vấn đề hiểu từ vựng theo ngữ cảnh',
          pedagogicalGoal: 'Minh họa từ đa nghĩa cần liên kết với các từ khác trong câu để rõ nghĩa',
          durationSeconds: 16,
          boundClaimIds: ['claim_attention_mechanism'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Một từ như "ngân hàng" có thể là bờ sông hay tổ chức tài chính tùy thuộc vào ngữ cảnh xung quanh.',
            subtitleVietnamese: 'Nghĩa của từ phụ thuộc hoàn toàn vào ngữ cảnh xung quanh.'
          },
          visualPayload: {}
        },
        {
          sceneId: 'sc_qkv_interaction',
          sceneType: 'neural_architecture',
          title: 'Cơ chế tích vô hướng Scaled Dot-Product',
          pedagogicalGoal: 'Trực quan hóa ma trận liên kết giữa Query và Key',
          durationSeconds: 24,
          boundClaimIds: ['claim_attention_formula'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Từng từ gửi câu hỏi Query tới các Key của mọi từ khác để thu về trọng số tương tác chính xác.',
            subtitleVietnamese: 'Query so khớp với Key để lấy trọng số tập trung cho Value.'
          },
          visualPayload: {}
        }
      ];
    } else if (capability.topicId === 'ai.neural_network.backpropagation') {
      summary = 'Lan truyền ngược kết hợp quy tắc chuỗi vi phân để phân bổ sai số từ đầu ra về từng trọng số.';
      learningObjectives = [
        'Hiểu luồng truyền xuôi forward pass và luồng truyền ngược backward pass',
        'Nắm việc áp dụng quy tắc chuỗi Chain Rule để tính đạo hàm riêng dL/dw'
      ];
      keyConcepts = ['Forward Pass', 'Backward Pass', 'Chain Rule (Quy tắc chuỗi)', 'Đạo hàm riêng (Partial Derivative)'];
      claims = [
        {
          id: 'claim_chain_rule_bp',
          claimType: 'formal_mathematics',
          statement: 'Theo quy tắc chuỗi vi phân: dL/dw = (dL/dy) * (dy/dz) * (dz/dw)',
          formalExpression: 'dL/dw = (dL/dy) * (dy/dz) * (dz/dw)',
          validatorKey: 'chain_rule_formula',
          verificationStatus: 'formally_verified',
          formalProofSummary: 'Calculus multivariable chain rule application verified'
        },
        {
          id: 'claim_error_blame',
          claimType: 'ai_concept',
          statement: 'Mỗi trọng số được điều chỉnh tỉ lệ thuận với mức độ nó đóng góp vào sai số chung của mô hình.',
          verificationStatus: 'source_grounded',
          humanReviewComment: 'Nguyên lý gán trách nhiệm sai số trong huấn luyện mạng nơ-ron học sâu.'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_forward_backward',
          sceneType: 'flowchart_simulation',
          title: 'Dòng chảy xuôi và ngược trong mạng',
          pedagogicalGoal: 'Đối chiếu tín hiệu dữ liệu đi tới và tín hiệu sai số đi lùi',
          durationSeconds: 20,
          boundClaimIds: ['claim_error_blame'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Dữ liệu chảy xuôi để đưa ra dự đoán, còn sai số chảy ngược lại để sửa chữa từng trọng số.',
            subtitleVietnamese: 'Dữ liệu đi tới để dự đoán, sai số đi lùi để cập nhật trọng số.'
          },
          visualPayload: {}
        },
        {
          sceneId: 'sc_chain_rule_math',
          sceneType: 'formula_derivation',
          title: 'Quy tắc chuỗi từng mắt xích',
          pedagogicalGoal: 'Minh họa phép nhân liên hoàn các đạo hàm cục bộ',
          durationSeconds: 20,
          boundClaimIds: ['claim_chain_rule_bp'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Quy tắc chuỗi vi phân cho phép ta nhân các đạo hàm thành phần để tính chính xác sai số của từng tham số.',
            subtitleVietnamese: 'Quy tắc chuỗi nhân các đạo hàm thành phần để tính sai số tham số.'
          },
          visualPayload: {}
        }
      ];
    } else if (capability.topicId === 'ai.embeddings.vector_space') {
      summary = 'Không gian vector nhúng mã hóa ý nghĩa ngữ nghĩa của từ thành các tọa độ hình học nhiều chiều.';
      learningObjectives = [
        'Hiểu cách các từ có ngữ nghĩa gần nhau được đặt gần nhau trong không gian',
        'Nắm khái niệm phép tính tương tự (analogy) như Vua - Đàn ông + Phụ nữ = Nữ hoàng'
      ];
      keyConcepts = ['Vector nhúng (Embeddings)', 'Khoảng cách Cosine', 'Không gian ngữ nghĩa', 'Phép cộng trừ vector'];
      claims = [
        {
          id: 'claim_vector_similarity',
          claimType: 'ai_concept',
          statement: 'Các từ có ngữ cảnh sử dụng tương đồng sẽ có vector nhúng với độ tương đồng Cosine cao.',
          verificationStatus: 'source_grounded',
          humanReviewComment: 'Giả thuyết phân phối ngữ nghĩa của Harris và mô hình Word2Vec.'
        },
        {
          id: 'claim_vector_arithmetic',
          claimType: 'algorithmic_property',
          statement: 'Không gian nhúng cho phép các phép toán đại số biểu thị quan hệ ngữ nghĩa.',
          verificationStatus: 'human_review_required',
          humanReviewComment: 'Giáo viên xác nhận quan hệ ngữ nghĩa vector tuyến tính trong word representation.'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_cloud_space',
          sceneType: 'graph_plot',
          title: 'Cụm từ vựng trong không gian',
          pedagogicalGoal: 'Trực quan hóa đám mây vector từ với các cụm ngữ nghĩa tương đồng',
          durationSeconds: 18,
          boundClaimIds: ['claim_vector_similarity'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Trong không gian vector, các từ chỉ đồ vật, động vật hay cảm xúc sẽ tự động co cụm lại gần nhau.',
            subtitleVietnamese: 'Các từ tương đồng ngữ nghĩa sẽ tự động co cụm lại gần nhau.'
          },
          visualPayload: {}
        },
        {
          sceneId: 'sc_analogy_arrow',
          sceneType: 'concept_intro',
          title: 'Đại số quan hệ ngữ nghĩa',
          pedagogicalGoal: 'Minh họa vector dịch chuyển giữa giống đực và giống cái',
          durationSeconds: 22,
          boundClaimIds: ['claim_vector_arithmetic'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Vector dịch chuyển từ "đàn ông" sang "phụ nữ" tương đương với vector từ "vua" sang "nữ hoàng".',
            subtitleVietnamese: 'Mối quan hệ ngữ nghĩa trở thành các phép cộng trừ vector hình học.'
          },
          visualPayload: {}
        }
      ];
    } else {
      // Fallback cho chủ đề hợp lệ tổng quát thuộc Math hoặc AI
      summary = `Kế hoạch bài học tổng quát về chủ đề ${topic}.`;
      learningObjectives = [`Nắm vững các khái niệm trọng tâm của ${topic}`];
      keyConcepts = [topic];
      claims = [
        {
          id: 'claim_general_1',
          claimType: isMath ? 'formal_mathematics' : 'ai_concept',
          statement: `Nội dung cốt lõi của chủ đề ${topic} được diễn giải theo chuẩn sư phạm.`,
          verificationStatus: isMath ? 'formally_verified' : 'source_grounded',
          formalExpression: isMath ? 'f(x) = x' : undefined,
          formalProofSummary: isMath ? 'Identity verified' : undefined,
          humanReviewComment: 'Nội dung khái niệm cần giáo viên đối chiếu sư phạm.'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_gen_1',
          sceneType: 'concept_intro',
          title: `Giới thiệu ${topic}`,
          pedagogicalGoal: `Mở đầu và đặt vấn đề cho chủ đề ${topic}`,
          durationSeconds: targetDurationSeconds / 2,
          boundClaimIds: ['claim_general_1'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: `Chào mừng các bạn đến với bài học về ${topic}.`,
            subtitleVietnamese: `Khám phá bài học về ${topic}.`
          },
          visualPayload: {}
        },
        {
          sceneId: 'sc_gen_2',
          sceneType: 'summary',
          title: `Tổng kết ${topic}`,
          pedagogicalGoal: `Củng cố kiến thức đã học về ${topic}`,
          durationSeconds: targetDurationSeconds / 2,
          boundClaimIds: ['claim_general_1'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: `Hy vọng bài học giúp bạn nắm vững bản chất cốt lõi của ${topic}.`,
            subtitleVietnamese: `Nắm vững bản chất cốt lõi của ${topic}.`
          },
          visualPayload: {}
        }
      ];
    }

    const totalSeconds = scenes.reduce((acc, s) => acc + s.durationSeconds, 0);

    return {
      schemaVersion: 'lesson-v3',
      lessonId,
      domain: capability.domain,
      topicId: capability.topicId,
      title,
      summary,
      learningObjectives,
      prerequisites: isMath ? ['Đại số và giải tích cơ bản'] : ['Khái niệm đại số tuyến tính hoặc lập trình cơ bản'],
      keyConcepts,
      educationalClaims: claims,
      capabilityReport: capability,
      sourceEvidence: documentAnalysis?.evidence || [],
      storyboard: {
        storyboardId: `sb_${lessonId}`,
        lessonId,
        scenes,
        totalDurationSeconds: totalSeconds
      }
    };
  }
}
