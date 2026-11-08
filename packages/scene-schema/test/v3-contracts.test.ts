import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyEducationalTopic,
  DomainScopeViolationError,
  EducationalClaimV3Schema,
  EducationalLessonPlanV3Schema,
  EducationalStoryboardV3Schema,
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
    assert.equal(REGISTERED_TOPICS_V3['ai.perceptron.activation'].renderReadiness, 'planning_only');
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
            visualPayload: {}
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
            visualPayload: {}
          }
        ]
      }
    };

    const parsed = EducationalLessonPlanV3Schema.safeParse(aiLessonPlan);
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues));
    assert.equal(parsed.data.domain, 'artificial_intelligence');
    assert.equal(parsed.data.educationalClaims.length, 2);
  });
});
