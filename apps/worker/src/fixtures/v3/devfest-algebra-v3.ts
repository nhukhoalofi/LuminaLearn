import type { EducationalStoryboardV3 } from '@luminalearn/scene-schema';

export const devfestAlgebraStoryboardV3: EducationalStoryboardV3 = {
  storyboardId: 'sb_devfest_algebra_identity_v3',
  lessonId: 'lesson_devfest_algebra_identity',
  totalDurationSeconds: 48,
  scenes: [
    {
      sceneId: 'sc_alg_hook',
      sceneType: 'concept_intro',
      title: 'Vì sao (a+b)² lại có thêm 2ab?',
      pedagogicalGoal: 'Đặt câu hỏi khơi gợi tư duy: vì sao bình phương một tổng không đơn giản là a² + b²',
      durationSeconds: 10,
      boundClaimIds: ['claim_identity_square_sum'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Khi tính bình phương của a cộng b, nhiều người lầm tưởng kết quả chỉ là a bình cộng b bình. Nhưng tại sao công thức đúng lại có thêm hai a b?',
        subtitleVietnamese: 'Vì sao (a+b)² = a² + 2ab + b² mà không phải là a² + b²?'
      },
      visualPayload: {
        sceneType: 'concept_intro',
        centralQuestion: 'Tại sao (a+b)² lại xuất hiện thêm số hạng 2ab?',
        keyConcept: 'Bình phương của một tổng',
        accentColor: '#38BDF8',
        visualStyleId: 'clean_educational_infographic',
        reducedMotion: false
      }
    },
    {
      sceneId: 'sc_alg_algebra',
      sceneType: 'algebra_identity',
      title: 'Chứng minh bằng biến đổi đại số',
      pedagogicalGoal: 'Khai triển tích hai nhị thức và gom hai hạng tử đồng dạng',
      durationSeconds: 14,
      boundClaimIds: ['claim_identity_square_sum'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Về mặt đại số, a cộng b tất cả bình chính là tích của hai nhị thức. Áp dụng tính chất phân phối, ta có a bình cộng a b, cộng b a, cộng b bình. Do a b bằng b a, ta thu được hai a b.',
        subtitleVietnamese: '(a+b)(a+b) = a² + ab + ba + b² = a² + 2ab + b²'
      },
      visualPayload: {
        sceneType: 'algebra_identity',
        identityId: 'square_sum',
        leftExpression: '(a+b)^2',
        rightExpression: 'a^2+2*a*b+b^2',
        presentation: 'expansion',
        transformationSteps: [
          {
            expression: '(a+b)^2',
            explanationVietnamese: 'Bình phương của một tổng.',
            highlightTerms: ['(a+b)^2']
          },
          {
            expression: '(a+b)(a+b)',
            explanationVietnamese: 'Viết dưới dạng tích hai nhân tử.',
            highlightTerms: ['(a+b)']
          },
          {
            expression: 'a^2 + ab + ba + b^2',
            explanationVietnamese: 'Nhân phân phối từng hạng tử.',
            highlightTerms: ['ab', 'ba']
          },
          {
            expression: 'a^2 + 2ab + b^2',
            explanationVietnamese: 'Gom hai hạng tử đồng dạng: ab + ba = 2ab.',
            highlightTerms: ['2ab']
          }
        ]
      }
    },
    {
      sceneId: 'sc_alg_geometry',
      sceneType: 'graph_plot',
      title: 'Minh họa hình học diện tích',
      pedagogicalGoal: 'Chia hình vuông cạnh a+b thành 4 miền diện tích a², 2 khối ab và b²',
      durationSeconds: 14,
      boundClaimIds: ['claim_identity_square_sum'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Về mặt hình học, một hình vuông cạnh a cộng b được ghép từ bốn mảnh: một hình vuông diện tích a bình, một hình vuông b bình, và hai hình chữ nhật diện tích a b.',
        subtitleVietnamese: 'Hình vuông lớn (a+b)² ghép từ 4 phần: a², b² và hai hình chữ nhật ab.'
      },
      visualPayload: {
        sceneType: 'graph_plot',
        headline: 'Phân tích diện tích hình học (a+b)²',
        notes: 'Hình vuông cạnh a+b gồm 4 miền: a², 2 khối ab và b²',
        scientificData: {
          kind: 'geometry_2d',
          points: [
            { pointId: 'pt_O', x: 0, y: 0 },
            { pointId: 'pt_A', x: 3, y: 0 },
            { pointId: 'pt_B', x: 5, y: 0 },
            { pointId: 'pt_C', x: 5, y: 3 },
            { pointId: 'pt_D', x: 5, y: 5 },
            { pointId: 'pt_E', x: 3, y: 5 },
            { pointId: 'pt_F', x: 0, y: 5 },
            { pointId: 'pt_G', x: 0, y: 3 },
            { pointId: 'pt_M', x: 3, y: 3 }
          ],
          segments: [
            { fromPointId: 'pt_O', toPointId: 'pt_B' },
            { fromPointId: 'pt_B', toPointId: 'pt_D' },
            { fromPointId: 'pt_D', toPointId: 'pt_F' },
            { fromPointId: 'pt_F', toPointId: 'pt_O' },
            { fromPointId: 'pt_A', toPointId: 'pt_E' },
            { fromPointId: 'pt_G', toPointId: 'pt_C' }
          ],
          polygons: [
            { pointIds: ['pt_O', 'pt_A', 'pt_M', 'pt_G'], areaClaimId: 'claim_identity_square_sum', label: 'a² = 9', fill: '#38BDF8' },
            { pointIds: ['pt_A', 'pt_B', 'pt_C', 'pt_M'], areaClaimId: 'claim_identity_square_sum', label: 'ab = 6', fill: '#34D399' },
            { pointIds: ['pt_G', 'pt_M', 'pt_E', 'pt_F'], areaClaimId: 'claim_identity_square_sum', label: 'ab = 6', fill: '#F472B6' },
            { pointIds: ['pt_M', 'pt_C', 'pt_D', 'pt_E'], areaClaimId: 'claim_identity_square_sum', label: 'b² = 4', fill: '#FBBF24' }
          ],
          claimIds: ['claim_identity_square_sum'],
          validation: 'formally_verified'
        }
      }
    },
    {
      sceneId: 'sc_alg_summary',
      sceneType: 'summary',
      title: 'Tổng kết và ví dụ số',
      pedagogicalGoal: 'Khái quát hóa công thức và kiểm chứng bằng số cụ thể a=3, b=2',
      durationSeconds: 10,
      boundClaimIds: ['claim_identity_square_sum'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Ví dụ với a bằng 3 và b bằng 2: 5 bình phương bằng 25, đúng bằng 9 cộng 12 cộng 4. Hai a b chính là diện tích hai góc chữ nhật bù vào.',
        subtitleVietnamese: '(3+2)² = 5² = 25 = 3² + 2(3)(2) + 2² = 9 + 12 + 4 = 25.'
      },
      visualPayload: {
        sceneType: 'summary',
        title: 'Bản chất của Hằng đẳng thức (a+b)²',
        takeaways: [
          'Đại số: (a+b)(a+b) = a² + ab + ba + b² = a² + 2ab + b²',
          'Hình học: Ghép từ 1 hình vuông a², 1 hình vuông b² và 2 hình chữ nhật ab',
          'Kiểm chứng số: Với a=3, b=2 thì 5² = 3² + 2(3)(2) + 2² = 25'
        ],
        verifiedFacts: ['(a+b)^2 = a^2 + 2*a*b + b^2'],
        reviewNotes: [],
        finalCallout: 'Hằng đẳng thức là cầu nối giữa đại số thuần túy và hình học trực quan.'
      }
    }
  ]
};
