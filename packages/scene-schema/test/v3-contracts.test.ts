import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyEducationalTopic,
  DomainScopeViolationError,
  EducationalClaimV3Schema,
  EducationalLessonPlanV3Schema,
  EducationalStoryboardV3Schema,
  EducationalVisualPayloadSchema,
  REGISTERED_TOPICS_V3
} from '../src/v3/index';

describe('V3 Educational Contracts & Capability Registry', () => {
  it('registers 10 benchmark topics across Mathematics and AI with honest renderReadiness', () => {
    const keys = Object.keys(REGISTERED_TOPICS_V3);
    assert.equal(keys.length, 10);

    const mathTopics = Object.values(REGISTERED_TOPICS_V3).filter((t) => t.domain === 'mathematics');
    const aiTopics = Object.values(REGISTERED_TOPICS_V3).filter((t) => t.domain === 'artificial_intelligence');

    assert.equal(mathTopics.length, 5);
    assert.equal(aiTopics.length, 5);

    // Only topics with real renderers are marked render_ready
    assert.equal(REGISTERED_TOPICS_V3['calculus.derivative.intuition'].renderReadiness, 'render_ready');
    assert.equal(REGISTERED_TOPICS_V3['calculus.riemann_integral.intuition'].renderReadiness, 'render_ready');
    assert.equal(REGISTERED_TOPICS_V3['ai.transformer.attention'].renderReadiness, 'planning_only');
    assert.equal(REGISTERED_TOPICS_V3['ai.perceptron.activation'].renderReadiness, 'render_ready');
  });

  it('deterministic classifier routes math and AI topics appropriately', () => {
    const deriv = classifyEducationalTopic('Tìm hiểu đạo hàm từ cát tuyến');
    assert.equal(deriv.domain, 'mathematics');
    assert.equal(deriv.topicId, 'calculus.derivative.intuition');

    const riemann = classifyEducationalTopic('Tổng Riemann và diện tích');
    assert.equal(riemann.domain, 'mathematics');
    assert.equal(riemann.topicId, 'calculus.riemann_integral.intuition');

    const transformer = classifyEducationalTopic('Kiến trúc Transformer và cơ chế Attention');
    assert.equal(transformer.domain, 'artificial_intelligence');
    assert.equal(transformer.topicId, 'ai.transformer.attention');

    const gd = classifyEducationalTopic('Tối ưu hóa Gradient Descent');
    assert.equal(gd.domain, 'artificial_intelligence');
    assert.equal(gd.topicId, 'ai.gradient_descent.optimization');
  });

  it('Checkpoint C Regression Matrix: correctly classifies all 8 hybrid and domain benchmark prompts', () => {
    // 1. "Gradient Descent dùng đạo hàm để cập nhật trọng số"
    const r1 = classifyEducationalTopic('Gradient Descent dùng đạo hàm để cập nhật trọng số');
    assert.equal(r1.domain, 'artificial_intelligence');
    assert.equal(r1.topicId, 'ai.gradient_descent.optimization');

    // 2. "Backpropagation và quy tắc chuỗi"
    const r2 = classifyEducationalTopic('Backpropagation và quy tắc chuỗi');
    assert.equal(r2.domain, 'artificial_intelligence');
    assert.equal(r2.topicId, 'ai.neural_network.backpropagation');

    // 3. "Self-Attention sử dụng phép nhân ma trận"
    const r3 = classifyEducationalTopic('Self-Attention sử dụng phép nhân ma trận');
    assert.equal(r3.domain, 'artificial_intelligence');
    assert.equal(r3.topicId, 'ai.transformer.attention');

    // 4. "Đạo hàm hàm x^2"
    const r4 = classifyEducationalTopic('Đạo hàm hàm x^2');
    assert.equal(r4.domain, 'mathematics');
    assert.equal(r4.topicId, 'calculus.derivative.intuition');

    // 5. "Tích phân Riemann"
    const r5 = classifyEducationalTopic('Tích phân Riemann');
    assert.equal(r5.domain, 'mathematics');
    assert.equal(r5.topicId, 'calculus.riemann_integral.intuition');

    // 6. "Định lý Bayes trong phân loại Machine Learning"
    const r6 = classifyEducationalTopic('Định lý Bayes trong phân loại Machine Learning');
    assert.equal(r6.domain, 'artificial_intelligence');

    // 7. "Word Embeddings và không gian vector"
    const r7 = classifyEducationalTopic('Word Embeddings và không gian vector');
    assert.equal(r7.domain, 'artificial_intelligence');
    assert.equal(r7.topicId, 'ai.embeddings.vector_space');

    // 8. "Định luật Newton" -> Fail-closed!
    assert.throws(
      () => classifyEducationalTopic('Định luật Newton'),
      (err: unknown) => err instanceof DomainScopeViolationError
    );
  });

  it('deterministic classifier strictly rejects out-of-scope domains (fail-closed)', () => {
    assert.throws(
      () => classifyEducationalTopic('Phản ứng nhiệt nhôm trong Hóa học'),
      (err: unknown) => err instanceof DomainScopeViolationError && /chỉ hỗ trợ hai lĩnh vực/i.test(err.message)
    );
    assert.throws(
      () => classifyEducationalTopic('Quá trình quang hợp ở tế bào thực vật (Sinh học)'),
      (err: unknown) => err instanceof DomainScopeViolationError
    );
    assert.throws(
      () => classifyEducationalTopic('Địa lý tự nhiên các vùng miền'),
      (err: unknown) => err instanceof DomainScopeViolationError
    );
  });

  it('EducationalClaimV3Schema rejects formally_verified if formalExpression is missing', () => {
    const invalidMathClaim = {
      id: 'claim_math_1',
      claimType: 'formal_mathematics',
      statement: 'Đạo hàm của x^2 là 2x',
      verificationStatus: 'formally_verified',
      // Missing formalExpression and formalProofSummary
    };

    const res = EducationalClaimV3Schema.safeParse(invalidMathClaim);
    assert.equal(res.success, false);
  });

  it('EducationalClaimV3Schema rejects formally_verified on qualitative ai_concept', () => {
    const invalidAiClaim = {
      id: 'claim_ai_1',
      claimType: 'ai_concept',
      statement: 'Mạng Perceptron mô phỏng tế bào thần kinh sinh học',
      verificationStatus: 'formally_verified' // Illegal! Should be source_grounded or human_review_required
    };

    const res = EducationalClaimV3Schema.safeParse(invalidAiClaim);
    assert.equal(res.success, false);
  });

  it('validates a complete AI Lesson Plan V3 without requiring polynomial math equations', () => {
    const aiLessonPlan = {
      schemaVersion: 'lesson-v3',
      generationProvenance: 'deterministic_mock',
      lessonId: 'lesson_ai_transformer_1',
      domain: 'artificial_intelligence',
      topicId: 'ai.transformer.attention',
      title: 'Cơ chế Self-Attention và kiến trúc Transformer',
      summary: 'Khám phá cách mạng transformer tính toán trọng số quan hệ giữa các từ trong câu.',
      learningObjectives: [
        'Hiểu bản chất của Self-Attention trong việc thu nạp ngữ cảnh',
        'Nắm vai trò của bộ ba ma trận Query, Key, Value'
      ],
      prerequisites: ['Khái niệm vector nhúng Word Embeddings cơ bản'],
      keyConcepts: ['Self-Attention', 'Query', 'Key', 'Value', 'Softmax Scaling'],
      educationalClaims: [
        {
          id: 'claim_concept_1',
          claimType: 'ai_concept',
          statement: 'Cơ chế Self-Attention cho phép mỗi token chú ý tới mọi token khác trong câu.',
          verificationStatus: 'source_grounded',
          sourceReferenceId: 'ref_attention_paper'
        },
        {
          id: 'claim_algo_2',
          claimType: 'algorithmic_property',
          statement: 'Tích vô hướng giữa Query và Key xác định mức độ liên quan ngữ nghĩa.',
          verificationStatus: 'human_review_required',
          humanReviewComment: 'Giáo viên xác nhận định nghĩa tích vô hướng ma trận phù hợp sư phạm.'
        }
      ],
      capabilityReport: REGISTERED_TOPICS_V3['ai.transformer.attention'],
      sourceEvidence: [
        {
          evidenceId: 'ev_1',
          claimId: 'claim_concept_1',
          sourceReference: {
            id: 'ref_1',
            documentId: 'doc_vaswani',
            pageNumber: 3,
            exactQuote: 'Attention mechanisms have become an integral part of compelling sequence modeling.'
          },
          evidenceFound: true,
          evidenceMatchConfidence: 0.98
        }
      ],
      storyboard: {
        storyboardId: 'sb_ai_transformer_1',
        lessonId: 'lesson_ai_transformer_1',
        totalDurationSeconds: 40,
        scenes: [
          {
            sceneId: 'sc_intro',
            sceneType: 'concept_intro',
            title: 'Đặt vấn đề: Ngữ cảnh từ vựng',
            pedagogicalGoal: 'Giới thiệu bài toán hiểu nghĩa từ theo ngữ cảnh',
            durationSeconds: 15,
            boundClaimIds: ['claim_concept_1'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Chào mừng bạn. Hôm nay chúng ta tìm hiểu cách AI hiểu ngữ cảnh qua Self-Attention.',
              subtitleVietnamese: 'Khám phá cơ chế Self-Attention trong AI.'
            },
            visualPayload: {
              sceneType: 'concept_intro',
              centralQuestion: 'Làm thế nào để AI hiểu đúng ngữ cảnh của từng từ trong câu?',
              keyConcept: 'Self-Attention Mechanism',
              accentColor: '#22D3EE',
              visualStyleId: 'clean_educational_infographic',
              reducedMotion: false
            }
          },
          {
            sceneId: 'sc_matrix',
            sceneType: 'flowchart_simulation',
            title: 'Bộ ba Query, Key, Value',
            pedagogicalGoal: 'Minh họa cơ chế tính điểm chú ý bằng ma trận',
            durationSeconds: 25,
            boundClaimIds: ['claim_algo_2'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Mỗi từ được chiếu vào ba không gian vector: truy vấn, khóa và giá trị.',
              subtitleVietnamese: 'Mô hình hóa qua Query, Key và Value.'
            },
            visualPayload: {
              sceneType: 'flowchart_simulation',
              headline: 'Bộ ba Query, Key, Value trong Transformer'
            }
          }
        ]
      }
    };

    const parsed = EducationalLessonPlanV3Schema.safeParse(aiLessonPlan);
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues));
    assert.equal(parsed.data.domain, 'artificial_intelligence');
    assert.equal(parsed.data.educationalClaims.length, 2);
  });

  describe('Checkpoint E: Strict Visual DSL Validation', () => {
    it('validates a correct NeuralArchitectureVisualPayload', () => {
      const validPayload = {
        sceneType: 'neural_architecture' as const,
        networkType: 'perceptron' as const,
        layers: [
          { layerId: 'l_in', name: 'Input Layer', nodeCount: 2, activation: 'linear' as const },
          { layerId: 'l_out', name: 'Output', nodeCount: 1, activation: 'sigmoid' as const }
        ],
        weights: [
          { fromLayer: 0, fromNode: 0, toLayer: 1, toNode: 0, weightValue: 0.5 },
          { fromLayer: 0, fromNode: 1, toLayer: 1, toNode: 0, weightValue: -0.2 }
        ],
        inputValues: [1.0, 0.5],
        highlightActiveSignal: true,
        outputLabels: ['P(y=1)']
      };

      const res = EducationalVisualPayloadSchema.safeParse(validPayload);
      assert.ok(res.success);
    });

    it('rejects NeuralArchitectureVisualPayload with NaN or out-of-bounds layer indices', () => {
      const invalidWeightPayload = {
        sceneType: 'neural_architecture',
        networkType: 'perceptron',
        layers: [
          { layerId: 'l_in', name: 'Input', nodeCount: 2 },
          { layerId: 'l_out', name: 'Output', nodeCount: 1 }
        ],
        weights: [
          { fromLayer: 0, fromNode: 0, toLayer: 99, toNode: 0, weightValue: NaN } // Illegal layer 99 and NaN!
        ]
      };
      const res = EducationalVisualPayloadSchema.safeParse(invalidWeightPayload);
      assert.equal(res.success, false);
    });

    it('validates and rejects ill-conditioned AttentionHeatmapVisualPayload', () => {
      // Valid attention matrix: 3x3 square, row sums approx 1.0
      const validAttention = {
        sceneType: 'attention_heatmap' as const,
        tokens: ['AI', 'thấu', 'hiểu'],
        matrix: [
          [0.70, 0.20, 0.10],
          [0.15, 0.75, 0.10],
          [0.10, 0.30, 0.60]
        ],
        isIllustrative: true
      };
      assert.ok(EducationalVisualPayloadSchema.safeParse(validAttention).success);

      // Invalid matrix: row sum equals 5.0 (violates softmax normalization constraint)
      const invalidSoftmax = {
        sceneType: 'attention_heatmap',
        tokens: ['A', 'B'],
        matrix: [
          [2.5, 2.5],
          [0.5, 0.5]
        ]
      };
      assert.equal(EducationalVisualPayloadSchema.safeParse(invalidSoftmax).success, false);

      // Invalid matrix: non-square dimension (2 tokens but 3 rows)
      const nonSquare = {
        sceneType: 'attention_heatmap',
        tokens: ['A', 'B'],
        matrix: [
          [0.5, 0.5],
          [0.5, 0.5],
          [0.5, 0.5]
        ]
      };
      assert.equal(EducationalVisualPayloadSchema.safeParse(nonSquare).success, false);

      const formerlyAcceptedLooseRow = {
        sceneType: 'attention_heatmap', tokens: ['A', 'B'],
        matrix: [[0.55, 0.55], [0.5, 0.5]], highlightTokenIndex: 2
      };
      assert.equal(EducationalVisualPayloadSchema.safeParse(formerlyAcceptedLooseRow).success, false);
    });

    it('validates a mathematically bounded LossLandscapeVisualPayload', () => {
      const validLoss = {
        sceneType: 'loss_landscape' as const,
        functionType: 'convex_quadratic' as const,
        minimumPoint: { w: 1.5, loss: 0.0 },
        curvature: 1.0,
        currentParam: 3.5,
        learningRate: 0.1,
        steps: [
          { stepNumber: 1, w: 3.5, loss: 4.0, gradient: 4.0 },
          { stepNumber: 2, w: 3.1, loss: 2.56, gradient: 3.2 }
        ],
        showGradientTangent: true
      };
      assert.ok(EducationalVisualPayloadSchema.safeParse(validLoss).success);

      // Negative curvature or infinite step must be rejected
      const invalidLoss = {
        ...validLoss,
        curvature: -1.0
      };
      assert.equal(EducationalVisualPayloadSchema.safeParse(invalidLoss).success, false);

      const fabricatedStep = { ...validLoss, steps: [{ stepNumber: 1, w: 3.5, loss: 999, gradient: 4 }] };
      assert.equal(EducationalVisualPayloadSchema.safeParse(fabricatedStep).success, false);
    });

    it('rejects impossible nodes, reverse edges, duplicate layer IDs, and input dimension mismatch', () => {
      const invalid = {
        sceneType: 'neural_architecture', networkType: 'perceptron',
        layers: [{ layerId: 'same', name: 'In', nodeCount: 1 }, { layerId: 'same', name: 'Out', nodeCount: 1 }],
        weights: [{ fromLayer: 1, fromNode: 4, toLayer: 0, toNode: 0, weightValue: 1 }],
        inputValues: [1, 2], signalMode: 'signal_flow_illustration'
      };
      assert.equal(EducationalVisualPayloadSchema.safeParse(invalid).success, false);
    });
  });
});
