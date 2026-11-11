import type { EducationalStoryboardV3 } from '@luminalearn/scene-schema';

export const devfestGradientDescentStoryboardV3: EducationalStoryboardV3 = {
  storyboardId: 'sb_devfest_gradient_descent_v3',
  lessonId: 'lesson_devfest_gradient_descent',
  totalDurationSeconds: 52,
  scenes: [
    {
      sceneId: 'sc_gd_hook',
      sceneType: 'concept_intro',
      title: 'Tối ưu hóa trong Trí tuệ Nhân tạo',
      pedagogicalGoal: 'Giới thiệu bài toán tìm điểm có sai số thấp nhất của mô hình AI',
      durationSeconds: 10,
      boundClaimIds: ['claim_gd_update_rule'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Làm thế nào một mô hình trí tuệ nhân tạo có thể tự điều chỉnh hàng triệu trọng số để giảm thiểu sai số? Câu trả lời chính là giải thuật Gradient Descent.',
        subtitleVietnamese: 'Gradient Descent là thuật toán tìm đáy của thung lũng sai số trong AI.'
      },
      visualPayload: {
        sceneType: 'concept_intro',
        centralQuestion: 'Làm thế nào mô hình AI tự tìm về điểm có sai số thấp nhất?',
        keyConcept: 'Tối ưu hóa Hàm mất mát (Loss Landscape)',
        accentColor: '#10B981',
        visualStyleId: 'clean_educational_infographic',
        reducedMotion: false
      }
    },
    {
      sceneId: 'sc_gd_landscape',
      sceneType: 'loss_landscape',
      title: 'Lăn xuống đáy thung lũng mất mát',
      pedagogicalGoal: 'Mô phỏng 4 bước lặp cập nhật tham số tiến sát điểm cực tiểu w*=2',
      durationSeconds: 24,
      boundClaimIds: ['claim_gd_update_rule'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Hãy quan sát hàm mất mát L w bằng w trừ 2 tất cả bình cộng 1. Bắt đầu từ vị trí w bằng 4 có sai số bằng 5, gradient chỉ hướng lên dốc. Với tốc độ học không phẩy 4, mô hình bước ngược hướng gradient, lần lượt di chuyển về 2 phẩy 4, rồi 2 phẩy 08, tiến sát đáy cực tiểu w bằng 2.',
        subtitleVietnamese: 'L(w)=(w-2)²+1. Bước cập nhật w_{t+1} = w_t - 0.4 * L\'(w_t) đưa loss từ 5.0 về 1.0.'
      },
      visualPayload: {
        sceneType: 'loss_landscape',
        functionType: 'convex_quadratic',
        minimumPoint: { w: 2.0, loss: 1.0 },
        curvature: 1.0,
        currentParam: 4.0,
        learningRate: 0.4,
        steps: [
          { stepNumber: 1, w: 4.0, loss: 5.0, gradient: 4.0 },
          { stepNumber: 2, w: 2.4, loss: 1.16, gradient: 0.8 },
          { stepNumber: 3, w: 2.08, loss: 1.0064, gradient: 0.16 },
          { stepNumber: 4, w: 2.016, loss: 1.000256, gradient: 0.032 }
        ],
        showGradientTangent: true
      }
    },
    {
      sceneId: 'sc_gd_update_formula',
      sceneType: 'formula_derivation',
      title: 'Quy tắc Cập nhật Tham số',
      pedagogicalGoal: 'Khái quát hóa công thức cập nhật bậc một: w_{t+1} = w_t - eta * grad_L(w_t)',
      durationSeconds: 10,
      boundClaimIds: ['claim_gd_update_rule'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Công thức cập nhật vô cùng ngắn gọn: trọng số mới bằng trọng số cũ trừ đi tốc độ học nhân với đạo hàm. Dấu trừ đảm bảo ta luôn đi ngược hướng dốc để giảm thiểu mất mát.',
        subtitleVietnamese: 'w_{t+1} = w_t - η · ∇L(w_t). Dấu trừ đảm bảo luôn đi ngược hướng dốc.'
      },
      visualPayload: {
        sceneType: 'formula_derivation',
        headline: 'Quy tắc cập nhật Gradient Descent',
        formulaTex: 'w_{t+1} = w_t - \\eta \\cdot \\nabla L(w_t)',
        notes: 'η là learning rate, ∇L(w) là gradient của hàm mất mát'
      }
    },
    {
      sceneId: 'sc_gd_summary',
      sceneType: 'summary',
      title: 'Trái tim của Deep Learning',
      pedagogicalGoal: 'Tổng kết: Gradient Descent tối ưu hóa lặp, nền tảng cho mạng nơ-ron và LLM',
      durationSeconds: 8,
      boundClaimIds: ['claim_gd_update_rule'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Từ một hàm hồi quy đơn giản đến các mô hình học sâu, Gradient Descent cùng các biến thể tối ưu hóa là công cụ nền tảng giúp hệ thống học hỏi hiệu quả từ dữ liệu.',
        subtitleVietnamese: 'Gradient Descent: Động lực tối ưu hóa trọng yếu của các mô hình học sâu.'
      },
      visualPayload: {
        sceneType: 'summary',
        title: 'Quy tắc Vàng của Gradient Descent',
        takeaways: [
          'Vector gradient chỉ hướng dốc lên nhanh nhất của hàm mất mát',
          'Bước ngược gradient một khoảng bằng learning rate η để đi xuống',
          'Với hàm lồi và tốc độ học phù hợp, giải thuật hội tụ ổn định về điểm cực tiểu'
        ],
        verifiedFacts: [
          'L(w) = (w-2)^2 + 1',
          'dL/dw = 2*(w-2)',
          'w=4 -> 2.4 -> 2.08 -> 2.016'
        ],
        reviewNotes: [],
        finalCallout: 'Gradient Descent là chìa khóa mở cánh cửa học hỏi của AI.'
      }
    }
  ]
};
