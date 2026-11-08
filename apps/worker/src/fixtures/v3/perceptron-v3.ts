import type { EducationalStoryboardV3 } from '@luminalearn/scene-schema';

export const perceptronStoryboardV3: EducationalStoryboardV3 = {
  storyboardId: 'sb_perceptron_v3',
  lessonId: 'lesson_ai_perceptron',
  scenes: [
    {
      sceneId: 'sc_p1_intro',
      sceneType: 'concept_intro',
      title: 'Khái niệm Nơ-ron nhân tạo',
      pedagogicalGoal: 'Mở đầu và đặt câu hỏi về cách nơ-ron sinh học được mô phỏng trong máy tính',
      durationSeconds: 10,
      boundClaimIds: ['claim_perceptron_structure'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Chào mừng các bạn đến với mô hình Perceptron, nền tảng của mọi mạng nơ-ron nhân tạo.',
        subtitleVietnamese: 'Mô hình Perceptron là tế bào tính toán cơ bản của học sâu.'
      },
      visualPayload: {
        sceneType: 'concept_intro',
        centralQuestion: 'Làm thế nào một nơ-ron máy tính đưa ra quyết định từ các tín hiệu đầu vào?',
        keyConcept: 'Nơ-ron Perceptron',
        accentColor: '#38BDF8',
        visualStyleId: 'clean_educational_infographic',
        reducedMotion: false
      }
    },
    {
      sceneId: 'sc_p2_arch',
      sceneType: 'neural_architecture',
      title: 'Luồng truyền tín hiệu có trọng số',
      pedagogicalGoal: 'Trực quan hóa luồng dữ liệu qua các liên kết trọng số và kích hoạt',
      durationSeconds: 15,
      boundClaimIds: ['claim_perceptron_structure'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Mỗi đầu vào được nhân với một trọng số riêng biệt, cộng thêm độ chệch rồi truyền qua hàm kích hoạt.',
        subtitleVietnamese: 'Nhân trọng số, cộng độ chệch bias và kích hoạt phi tuyến.'
      },
      visualPayload: {
        sceneType: 'neural_architecture',
        networkType: 'perceptron',
        layers: [
          { layerId: 'l_in', name: 'Đầu vào (Inputs)', nodeCount: 2, activation: 'linear' },
          { layerId: 'l_out', name: 'Đầu ra (Output)', nodeCount: 1, activation: 'sigmoid' }
        ],
        weights: [
          { fromLayer: 0, fromNode: 0, toLayer: 1, toNode: 0, weightValue: 0.8 },
          { fromLayer: 0, fromNode: 1, toLayer: 1, toNode: 0, weightValue: -0.5 }
        ],
        inputValues: [1.0, 0.5],
        highlightActiveSignal: true,
        outputLabels: ['Dự đoán (y)']
      }
    },
    {
      sceneId: 'sc_p3_summary',
      sceneType: 'summary',
      title: 'Tổng kết nguyên lý Perceptron',
      pedagogicalGoal: 'Củng cố 3 điểm cốt lõi của nơ-ron nhân tạo',
      durationSeconds: 10,
      boundClaimIds: ['claim_perceptron_structure'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Như vậy, Perceptron kết hợp phép tính tuyến tính với kích hoạt phi tuyến để giải quyết bài toán phân loại.',
        subtitleVietnamese: 'Perceptron kết hợp tổ hợp tuyến tính và kích hoạt phi tuyến.'
      },
      visualPayload: {
        sceneType: 'summary',
        title: 'Cốt lõi của Perceptron',
        takeaways: [
          'Nhân trọng số w_i với từng tín hiệu đầu vào x_i',
          'Cộng độ chệch bias b để dịch chuyển ranh giới quyết định',
          'Truyền qua hàm phi tuyến như Sigmoid hoặc ReLU'
        ],
        verifiedFacts: [],
        reviewNotes: ['Khái niệm mạng truyền thẳng cơ bản theo Rosenblatt.'],
        finalCallout: 'Perceptron là viên gạch đầu tiên xây dựng nên các mạng học sâu khổng lồ.'
      }
    }
  ],
  totalDurationSeconds: 35
};

