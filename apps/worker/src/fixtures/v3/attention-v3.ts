import type { EducationalStoryboardV3 } from '@luminalearn/scene-schema';

export const attentionStoryboardV3: EducationalStoryboardV3 = {
  storyboardId: 'sb_attention_v3',
  lessonId: 'lesson_ai_attention',
  scenes: [
    {
      sceneId: 'sc_att1_intro',
      sceneType: 'concept_intro',
      title: 'Cơ chế Self-Attention',
      pedagogicalGoal: 'Đặt vấn đề hiểu ngữ cảnh của từ trong câu',
      durationSeconds: 10,
      boundClaimIds: ['claim_attention_mechanism'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Làm thế nào máy tính hiểu được từ "ngân hàng" là bờ sông hay tổ chức tài chính?',
        subtitleVietnamese: 'Ý nghĩa của mỗi từ phụ thuộc vào các từ liên quan trong câu.'
      },
      visualPayload: {
        sceneType: 'concept_intro',
        centralQuestion: 'Làm thế nào mô hình xác định từ nào liên kết chặt chẽ nhất với từ đang xét?',
        keyConcept: 'Cơ chế Self-Attention',
        accentColor: '#A78BFA',
        visualStyleId: 'clean_educational_infographic',
        reducedMotion: false
      }
    },
    {
      sceneId: 'sc_att2_heatmap',
      sceneType: 'attention_heatmap',
      title: 'Ma trận trọng số chú ý',
      pedagogicalGoal: 'Trực quan hóa ma trận liên kết giữa các cặp từ qua phân phối Softmax',
      durationSeconds: 18,
      boundClaimIds: ['claim_attention_formula'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Từng từ so khớp Query với Key của mọi từ khác. Ma trận Softmax chuẩn hóa trọng số về tổng bằng 1.',
        subtitleVietnamese: 'Mỗi hàng trong ma trận Attention biểu diễn trọng số chú ý sau Softmax.'
      },
      visualPayload: {
        sceneType: 'attention_heatmap',
        tokens: ['Ngân', 'hàng', 'bên', 'sông'],
        matrix: [
          [0.45, 0.40, 0.08, 0.07],
          [0.35, 0.45, 0.10, 0.10],
          [0.08, 0.12, 0.40, 0.40],
          [0.06, 0.10, 0.39, 0.45]
        ],
        highlightTokenIndex: 0,
        isIllustrative: true
      }
    },
    {
      sceneId: 'sc_att3_summary',
      sceneType: 'summary',
      title: 'Tổng kết cơ chế Attention',
      pedagogicalGoal: 'Khái quát hóa cách Transformer xử lý ngôn ngữ tự nhiên',
      durationSeconds: 10,
      boundClaimIds: ['claim_attention_mechanism'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Self-Attention giúp mạng Transformer xử lý toàn bộ ngữ cảnh song song, vượt qua hạn chế của RNN.',
        subtitleVietnamese: 'Self-Attention là chìa khóa tạo nên các mô hình ngôn ngữ lớn (LLM).'
      },
      visualPayload: {
        sceneType: 'summary',
        title: 'Cốt lõi của Self-Attention',
        takeaways: [
          'Ba thành phần Query, Key, Value tương tác trực tiếp',
          'Softmax(Q * K^T / sqrt(d_k)) tính toán ma trận trọng số mềm',
          'Cho phép liên kết từ vựng cách xa nhau một cách trực tiếp'
        ],
        verifiedFacts: [],
        reviewNotes: ['Ma trận trọng số minh họa chuẩn hóa Softmax sum ≈ 1.0.'],
        finalCallout: 'Attention là công nghệ đột phá định hình kỷ nguyên Trí tuệ Nhân tạo mới.'
      }
    }
  ],
  totalDurationSeconds: 38
};

