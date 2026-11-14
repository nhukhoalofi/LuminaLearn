import type { EducationalStoryboardV3 } from '@luminalearn/scene-schema';

export const gradientDescentStoryboardV3: EducationalStoryboardV3 = {
  storyboardId: 'sb_gradient_descent_v3',
  lessonId: 'lesson_ai_gradient_descent',
  scenes: [
    {
      sceneId: 'sc_gd1_intro',
      sceneType: 'concept_intro',
      title: 'Tối ưu hóa Gradient Descent',
      pedagogicalGoal: 'Giới thiệu bài toán tìm điểm cực tiểu của hàm mất mát',
      durationSeconds: 10,
      boundClaimIds: ['claim_gd_update_rule'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Làm thế nào một mô hình học máy tự điều chỉnh tham số để giảm thiểu sai số dự đoán?',
        subtitleVietnamese: 'Gradient Descent là thuật toán tìm đáy của thung lũng sai số.'
      },
      visualPayload: {
        sceneType: 'concept_intro',
        centralQuestion: 'Làm thế nào để đưa tham số mô hình về điểm có sai số thấp nhất?',
        keyConcept: 'Gradient Descent',
        accentColor: '#10B981',
        visualStyleId: 'clean_educational_infographic',
        reducedMotion: false
      }
    },
    {
      sceneId: 'sc_gd2_landscape',
      sceneType: 'loss_landscape',
      title: 'Bề mặt hàm mất mát và bước lặp',
      pedagogicalGoal: 'Mô phỏng quả bóng lăn xuống đáy thung lũng lồi theo gradient',
      durationSeconds: 18,
      boundClaimIds: ['claim_gd_update_rule'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Hàm mất mát dạng thung lũng có đáy cực tiểu tại w*=0. Vector gradient chỉ hướng dốc lên, ta bước ngược lại.',
        subtitleVietnamese: 'Bước ngược hướng gradient để di chuyển dần về cực tiểu toàn cục.'
      },
      visualPayload: {
        sceneType: 'loss_landscape',
        functionType: 'convex_quadratic',
        minimumPoint: { w: 0.0, loss: 0.0 },
        curvature: 1.0,
        currentParam: 2.0,
        learningRate: 0.3,
        steps: [
          { stepNumber: 1, w: 2.0, loss: 4.0, gradient: 4.0 },
          { stepNumber: 2, w: 0.8, loss: 0.64, gradient: 1.6 },
          { stepNumber: 3, w: 0.32, loss: 0.1024, gradient: 0.64 }
        ],
        showGradientTangent: true
      }
    },
    {
      sceneId: 'sc_gd3_summary',
      sceneType: 'summary',
      title: 'Tổng kết thuật toán Gradient Descent',
      pedagogicalGoal: 'Nhấn mạnh vai trò của learning rate và đạo hàm',
      durationSeconds: 10,
      boundClaimIds: ['claim_gd_update_rule'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Tốc độ học thích hợp giúp thuật toán hội tụ nhanh chóng và ổn định về cực tiểu.',
        subtitleVietnamese: 'Chọn tốc độ học phù hợp để đảm bảo sự hội tụ an toàn.'
      },
      visualPayload: {
        sceneType: 'summary',
        title: 'Quy tắc vàng của Gradient Descent',
        takeaways: [
          'Đạo hàm (Gradient) xác định độ dốc và hướng dốc nhất',
          'Bước cập nhật w_next = w - eta * grad_L(w)',
          'Learning rate eta vừa phải giúp mô hình hội tụ ổn định'
        ],
        verifiedFacts: [],
        reviewNotes: ['Thuật toán tối ưu hóa bậc một trong huấn luyện mô hình.'],
        finalCallout: 'Gradient Descent là trái tim của quá trình học máy hiện đại.'
      }
    }
  ],
  totalDurationSeconds: 38
};

