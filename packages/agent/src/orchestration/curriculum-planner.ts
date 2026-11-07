import {
  LessonPlanV2Schema,
  type LessonPlanV2,
  type VerifiedClaim
} from '@luminalearn/scene-schema';
import type { DocumentAnalysisResult, TopicClassification } from './types';

export class CurriculumPlanner {
  public plan(options: {
    lessonId: string;
    topicInfo: TopicClassification;
    audience: string;
    targetDurationSeconds: number;
    documentAnalysis?: DocumentAnalysisResult;
  }): LessonPlanV2 {
    const { lessonId, topicInfo, audience, targetDurationSeconds, documentAnalysis } = options;

    if (!topicInfo.isSupported) {
      throw new Error(`Cannot plan unsupported topic: ${topicInfo.topicId}`);
    }

    let title = topicInfo.displayName;
    let learningObjectives: string[] = [];
    let keyConcepts: string[] = [];
    let mathematicalClaims: VerifiedClaim[] = [];
    let pedagogicalSequence: LessonPlanV2['pedagogicalSequence'] = [];
    let summary = '';

    if (topicInfo.topicId === 'calculus.derivative.intuition') {
      title = 'Bản chất hình học của đạo hàm';
      learningObjectives = [
        'Hiểu bản chất tiếp tuyến là giới hạn của cát tuyến khi hai điểm tiến lại gần nhau',
        'Nắm vững mối liên hệ giữa hệ số góc tiếp tuyến và tốc độ thay đổi tức thời'
      ];
      keyConcepts = ['Đường cong parabol', 'Đường cát tuyến', 'Khoảng cách h', 'Đường tiếp tuyến', 'Hệ số góc'];
      mathematicalClaims = [
        {
          id: 'claim_polynomial_deriv',
          statement: 'Đạo hàm của hàm f(x) = x^2 là f\'(x) = 2x',
          validatorKey: 'polynomial_derivative',
          expectedExpression: '2*x',
          verificationStatus: 'unverified'
        },
        {
          id: 'claim_secant_slope',
          statement: 'Hệ số góc cát tuyến qua (1, 1) và (1+h, (1+h)^2) là 2 + h',
          validatorKey: 'secant_slope',
          expectedExpression: '2 + h',
          verificationStatus: 'unverified'
        },
        {
          id: 'claim_limit_zero',
          statement: 'Giới hạn của hệ số góc cát tuyến khi h tiến về 0 là 2',
          validatorKey: 'limit_at_zero',
          expectedExpression: '2',
          verificationStatus: 'unverified'
        },
        {
          id: 'claim_tangent_slope',
          statement: 'Hệ số góc của tiếp tuyến tại điểm x = 1 bằng 2',
          validatorKey: 'value_at_point',
          expectedExpression: '2',
          verificationStatus: 'unverified'
        }
      ];
      pedagogicalSequence = [
        {
          stepNumber: 1,
          pedagogicalGoal: 'Gợi mở trực quan',
          intuitiveConcept: 'Làm thế nào để đo độ dốc tại duy nhất một điểm trên đường cong cong?',
          targetDurationSeconds: 8
        },
        {
          stepNumber: 2,
          pedagogicalGoal: 'Mô phỏng chuyển động cát tuyến',
          intuitiveConcept: 'Cố định điểm P(1,1), cho điểm Q trượt dần về P. Cát tuyến PQ dần xoay và biến thành tiếp tuyến.',
          formalFormula: 'm(h) = [f(1+h) - f(1)] / h',
          targetDurationSeconds: 16
        },
        {
          stepNumber: 3,
          pedagogicalGoal: 'Đại số hóa giới hạn',
          intuitiveConcept: 'Đơn giản hóa biểu thức đại số và cho khoảng cách h triệt tiêu về 0.',
          formalFormula: 'lim_{h -> 0} (2 + h) = 2',
          targetDurationSeconds: 10
        },
        {
          stepNumber: 4,
          pedagogicalGoal: 'Tổng kết bản chất',
          intuitiveConcept: 'Đạo hàm chính là độ nghiêng tức thời của đồ thị và là tốc độ thay đổi tức thời của hàm số.',
          formalFormula: "f'(1) = 2",
          targetDurationSeconds: 6
        }
      ];
      summary = 'Đạo hàm tại một điểm là hệ số góc của tiếp tuyến tại điểm đó, thu được khi khoảng cách của cát tuyến tiến về không.';
    } else if (topicInfo.topicId === 'calculus.integral.riemann_sum') {
      title = 'Tổng tích phân Riemann trực quan';
      learningObjectives = [
        'Hiểu cách xấp xỉ diện tích hình phẳng bằng vô số hình chữ nhật mỏng',
        'Nắm được định nghĩa tích phân xác định như giới hạn của tổng Riemann'
      ];
      keyConcepts = ['Diện tích dưới đường cong', 'Phân hoạch khoảng', 'Chiều rộng delta x', 'Tổng Riemann', 'Tích phân xác định'];
      mathematicalClaims = [
        {
          id: 'claim_riemann_approx',
          statement: 'Giới hạn của tổng diện tích các hình chữ nhật khi n tiến ra vô cực bằng 1/3',
          validatorKey: 'riemann_sum_limit',
          expectedExpression: '1/3',
          verificationStatus: 'unverified'
        },
        {
          id: 'claim_definite_integral',
          statement: 'Tích phân xác định của x^2 trên đoạn [0, 1] bằng đúng 1/3',
          validatorKey: 'definite_integral',
          expectedExpression: '1/3',
          verificationStatus: 'unverified'
        }
      ];
      pedagogicalSequence = [
        {
          stepNumber: 1,
          pedagogicalGoal: 'Đặt vấn đề diện tích cong',
          intuitiveConcept: 'Làm sao tính diện tích một hình có biên cong khi chỉ biết công thức hình chữ nhật?',
          targetDurationSeconds: 10
        },
        {
          stepNumber: 2,
          pedagogicalGoal: 'Chia nhỏ hình phẳng',
          intuitiveConcept: 'Chia đoạn [a,b] thành n cột chữ nhật mỏng. Khi n càng lớn, các cột càng khít với đường cong cong.',
          targetDurationSeconds: 20
        },
        {
          stepNumber: 3,
          pedagogicalGoal: 'Giới hạn tích phân',
          intuitiveConcept: 'Khi n tiến tới vô cùng, tổng diện tích cột chữ nhật tiến chính xác về giá trị tích phân.',
          targetDurationSeconds: 10
        }
      ];
      summary = 'Tích phân xác định là giới hạn của tổng diện tích các hình chữ nhật siêu mỏng khi số lượng phân hoạch tiến ra vô cực.';
    } else {
      // General fallback for other supported registered topics
      title = topicInfo.displayName;
      learningObjectives = [`Hiểu khái niệm nền tảng của ${topicInfo.displayName}`];
      keyConcepts = [topicInfo.displayName];
      mathematicalClaims = [
        {
          id: `claim_${topicInfo.topicId.replace(/\./g, '_')}_core`,
          statement: `Mệnh đề cốt lõi của ${topicInfo.displayName}`,
          validatorKey: topicInfo.requiredValidators[0] || 'general_math',
          expectedExpression: '1',
          verificationStatus: 'unverified'
        }
      ];
      pedagogicalSequence = [
        {
          stepNumber: 1,
          pedagogicalGoal: 'Mở đầu và trực quan hóa',
          intuitiveConcept: `Giới thiệu trực quan về ${topicInfo.displayName}`,
          targetDurationSeconds: Math.floor(targetDurationSeconds * 0.4)
        },
        {
          stepNumber: 2,
          pedagogicalGoal: 'Giải thích chi tiết và tổng kết',
          intuitiveConcept: `Phân tích chi tiết khái niệm và ứng dụng của ${topicInfo.displayName}`,
          targetDurationSeconds: targetDurationSeconds - Math.floor(targetDurationSeconds * 0.4)
        }
      ];
      summary = `Tổng kết các điểm cốt lõi của bài học ${topicInfo.displayName}.`;
    }

    const plan: LessonPlanV2 = {
      schemaVersion: 'lesson-v2',
      lessonId,
      topicId: topicInfo.topicId,
      title,
      learningObjectives,
      prerequisites: ['Đại số cơ bản', 'Đồ thị hàm số'],
      keyConcepts,
      mathematicalClaims,
      sourceEvidence: documentAnalysis?.evidence || [],
      pedagogicalSequence,
      summary
    };

    return LessonPlanV2Schema.parse(plan);
  }
}

