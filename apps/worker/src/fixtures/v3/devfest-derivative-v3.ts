import type { EducationalStoryboardV3 } from '@luminalearn/scene-schema';

export const devfestDerivativeStoryboardV3: EducationalStoryboardV3 = {
  storyboardId: 'sb_devfest_derivative_tangent_v3',
  lessonId: 'lesson_devfest_derivative_tangent',
  totalDurationSeconds: 52,
  scenes: [
    {
      sceneId: 'sc_der_hook',
      sceneType: 'concept_intro',
      title: 'Đạo hàm là gì?',
      pedagogicalGoal: 'Đặt câu hỏi: Làm sao đo tốc độ thay đổi tức thời tại một điểm duy nhất?',
      durationSeconds: 10,
      boundClaimIds: ['claim_derivative_tangent'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Trên một cung đường cong, làm thế nào để ta đo được vận tốc tức thời hoặc độ dốc tại đúng một điểm duy nhất?',
        subtitleVietnamese: 'Làm thế nào xác định độ dốc đường cong tại đúng một điểm?'
      },
      visualPayload: {
        sceneType: 'concept_intro',
        centralQuestion: 'Làm thế nào tính độ dốc tại một điểm duy nhất trên đồ thị?',
        keyConcept: 'Cát tuyến và Tiếp tuyến',
        accentColor: '#38BDF8',
        visualStyleId: 'clean_educational_infographic',
        reducedMotion: false
      }
    },
    {
      sceneId: 'sc_der_secant_to_tangent',
      sceneType: 'formula_derivation',
      title: 'Cát tuyến tiến tới Tiếp tuyến',
      pedagogicalGoal: 'Trực quan hóa chuyển động điểm Q tiến dần về P=(1,1) trên parabol y=x²',
      durationSeconds: 24,
      boundClaimIds: ['claim_derivative_tangent'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Xét điểm P tại tọa độ một một trên đồ thị parabol y bằng x bình. Ta chọn điểm thứ hai Q và vẽ cát tuyến. Khi Q tiến dần về P, cát tuyến xoay dần và trở thành đường tiếp tuyến duy nhất có hệ số góc bằng hai.',
        subtitleVietnamese: 'Khi điểm Q tiến về P(1,1), cát tuyến tiệm cận tiếp tuyến f\'(1) = 2.00.'
      },
      visualPayload: {
        sceneType: 'formula_derivation',
        headline: 'Cát tuyến tiến dần về tiếp tuyến',
        formulaTex: "f'(1) = \\lim_{x \\to 1} \\frac{f(x) - f(1)}{x - 1} = 2",
        notes: 'Khi điểm di động tiến sát P(1,1), cát tuyến trở thành tiếp tuyến',
        scientificData: {
          kind: 'scalar_function_1d',
          functionType: 'polynomial',
          expression: 'x^2',
          xRange: [-2, 3],
          yRange: [-1, 9],
          pointX: 1,
          tangentAtX: 1,
          secantFromX: 1,
          secantToX: 2.25,
          claimId: 'claim_derivative_tangent',
          validation: 'formally_verified'
        }
      }
    },
    {
      sceneId: 'sc_der_formula',
      sceneType: 'formula_derivation',
      title: 'Định nghĩa giải tích của Đạo hàm',
      pedagogicalGoal: 'Giới thiệu công thức giới hạn f\'(x) = lim (f(x+h) - f(x))/h = 2x',
      durationSeconds: 10,
      boundClaimIds: ['claim_derivative_tangent'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Về mặt giải tích, đạo hàm là giới hạn của tỉ số biến thiên khi khoảng cách h tiến dần về không. Với x bình phương, đạo hàm tổng quát bằng hai x.',
        subtitleVietnamese: "f'(x) = lim_{h->0} [f(x+h) - f(x)] / h = 2x. Tại x=1: f'(1) = 2."
      },
      visualPayload: {
        sceneType: 'formula_derivation',
        headline: 'Giới hạn định nghĩa đạo hàm',
        formulaTex: "f'(x) = \\lim_{h \\to 0} \\frac{(x+h)^2 - x^2}{h} = \\lim_{h \\to 0} (2x + h) = 2x",
        notes: 'Đạo hàm của f(x) = x² là f\'(x) = 2x'
      }
    },
    {
      sceneId: 'sc_der_summary',
      sceneType: 'summary',
      title: 'Ý nghĩa của Đạo hàm',
      pedagogicalGoal: 'Khái quát hóa: Đạo hàm là tốc độ biến thiên tức thời, nền tảng của AI',
      durationSeconds: 8,
      boundClaimIds: ['claim_derivative_tangent'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Đạo hàm chính là tốc độ biến thiên tức thời và hệ số góc tiếp tuyến. Đây là chiếc la bàn dẫn đường cho các thuật toán tối ưu hóa trong học máy.',
        subtitleVietnamese: 'Đạo hàm là tốc độ biến thiên tức thời — chiếc la bàn của học máy.'
      },
      visualPayload: {
        sceneType: 'summary',
        title: 'Bản chất của Đạo hàm',
        takeaways: [
          'Hình học: Hệ số góc của tiếp tuyến khi cát tuyến co lại',
          'Vật lý: Tốc độ biến thiên tức thời tại một thời điểm',
          'Giải tích: f\'(x) = 2x cho hàm số f(x) = x², f\'(1) = 2'
        ],
        verifiedFacts: ['diff(x^2, x) = 2*x', 'diff(x^2, x).subs(x, 1) = 2'],
        reviewNotes: [],
        finalCallout: 'Đạo hàm là nền móng của giải thuật Gradient Descent trong AI.'
      }
    }
  ]
};

