import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EducationalPlannerV3,
  KnowledgeValidationServiceV3
} from '../src/orchestration';
import type { AIProvider, AIProviderResult, AIStructuredRequest } from '../src/orchestration/ai-provider';
import type { EducationalClaimV3, GroundingEvidence } from '@luminalearn/scene-schema';

class FakeTransportAIProvider implements AIProvider {
  public readonly isMock = false;
  public callCount = 0;
  constructor(private readonly payload: unknown) {}

  async generateStructured<T>(request: AIStructuredRequest<T>): Promise<AIProviderResult<T>> {
    this.callCount++;
    return {
      data: request.validator(this.payload),
      mode: 'ai_generated_live',
      model: 'fake-gemini-test',
      attempts: 1,
      usage: { promptTokens: 50, candidatesTokens: 30 }
    };
  }
}

test('CHECKPOINT A: Negative Test A - Fake claim with "SymPy verified" self-certification must not become formally_verified', async () => {
  const service = new KnowledgeValidationServiceV3();
  const fakeClaim: EducationalClaimV3 = {
    id: 'claim_fake',
    claimType: 'formal_mathematics',
    statement: 'Đạo hàm x^3 là 3*x^2',
    formalExpression: '3*x^2',
    validatorKey: 'polynomial_derivative',
    verificationStatus: 'formally_verified', // Gemini or fixture self-certifies
    formalProofSummary: 'SymPy verified: diff(x**3, x) == 3*x**2'
  };

  // We test on an unsupported topic or without real sympy execution for this key
  const result = await service.validateClaims({
    lessonId: 'test_fake_claim',
    topicId: 'calculus.limits.epsilon_delta', // no sympy verifier for epsilon_delta
    domain: 'mathematics',
    claims: [fakeClaim]
  });

  const verified = result.validatedClaims[0];
  assert.notEqual(verified.verificationStatus, 'formally_verified');
  assert.equal(verified.verificationStatus, 'human_review_required');
  assert.equal(verified.formalProofSummary, undefined);
});

test('CHECKPOINT A: Negative Test B - Neural attention formula with no verifier must remain human_review_required', async () => {
  const service = new KnowledgeValidationServiceV3();
  const attentionClaim: EducationalClaimV3 = {
    id: 'claim_attn_math',
    claimType: 'formal_mathematics',
    statement: 'Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) V',
    formalExpression: 'softmax(Q * K.T / sqrt(d_k)) * V',
    validatorKey: 'scaled_dot_product',
    verificationStatus: 'unverified'
  };

  const result = await service.validateClaims({
    lessonId: 'test_attn',
    topicId: 'ai.transformer.attention',
    domain: 'artificial_intelligence',
    claims: [attentionClaim]
  });

  const verified = result.validatedClaims[0];
  assert.equal(verified.verificationStatus, 'human_review_required');
  assert.equal(verified.formalProofSummary, undefined);
  assert.ok(result.report.requiresHumanPedagogicalSignoff);
});

test('CHECKPOINT A: Negative Test C - Bayes theorem formula must not be reported as formally_verified', async () => {
  const service = new KnowledgeValidationServiceV3();
  const bayesClaim: EducationalClaimV3 = {
    id: 'claim_bayes',
    claimType: 'formal_mathematics',
    statement: 'P(A|B) = P(B|A) * P(A) / P(B)',
    formalExpression: 'P(A|B) = P(B|A) * P(A) / P(B)',
    validatorKey: 'bayes_theorem',
    verificationStatus: 'unverified'
  };

  const result = await service.validateClaims({
    lessonId: 'test_bayes',
    topicId: 'probability.bayes_theorem',
    domain: 'mathematics',
    claims: [bayesClaim]
  });

  const verified = result.validatedClaims[0];
  assert.notEqual(verified.verificationStatus, 'formally_verified');
  assert.equal(verified.verificationStatus, 'human_review_required');
  assert.equal(verified.formalProofSummary, undefined);
});

test('CHECKPOINT A: Negative Test D - Altering a verified expression invalidates verification (rejected)', async () => {
  const service = new KnowledgeValidationServiceV3();
  // Valid expression for derivative of x^2 is 2*x. Let's supply an altered/corrupted expression 5*x.
  const alteredClaim: EducationalClaimV3 = {
    id: 'claim_corrupted_deriv',
    claimType: 'formal_mathematics',
    statement: 'Đạo hàm của x^2 là 5*x',
    formalExpression: '5*x',
    validatorKey: 'polynomial_derivative',
    verificationStatus: 'unverified'
  };

  const result = await service.validateClaims({
    lessonId: 'test_altered',
    topicId: 'calculus.derivative.intuition',
    domain: 'mathematics',
    claims: [alteredClaim]
  });

  const verified = result.validatedClaims[0];
  assert.equal(verified.verificationStatus, 'rejected');
  assert.equal(verified.formalProofSummary, undefined);
  assert.equal(result.report.overallStatus, 'failed');
});

test('CHECKPOINT A: Negative Test E - Malformed numerical example fails validation', async () => {
  const service = new KnowledgeValidationServiceV3();
  const malformedClaim: EducationalClaimV3 = {
    id: 'claim_malformed_riemann',
    claimType: 'formal_mathematics',
    statement: 'Tích phân x^2 từ 0 đến 1 bằng 999',
    formalExpression: '999',
    validatorKey: 'riemann_integral',
    verificationStatus: 'unverified'
  };

  const result = await service.validateClaims({
    lessonId: 'test_malformed',
    topicId: 'calculus.riemann_integral.intuition',
    domain: 'mathematics',
    claims: [malformedClaim]
  });

  const verified = result.validatedClaims[0];
  assert.equal(verified.verificationStatus, 'rejected');
  assert.equal(result.report.overallStatus, 'failed');
});

test('CHECKPOINT A: Negative Test F - Independently verified supported derivative retains formally_verified', async () => {
  const service = new KnowledgeValidationServiceV3();
  const validDerivativeClaim: EducationalClaimV3 = {
    id: 'claim_valid_deriv',
    claimType: 'formal_mathematics',
    statement: 'Đạo hàm của x^2 là 2*x',
    formalExpression: '2*x',
    validatorKey: 'polynomial_derivative',
    verificationStatus: 'unverified'
  };

  const result = await service.validateClaims({
    lessonId: 'test_valid',
    topicId: 'calculus.derivative.intuition',
    domain: 'mathematics',
    claims: [validDerivativeClaim]
  });

  const verified = result.validatedClaims[0];
  assert.equal(verified.verificationStatus, 'formally_verified');
  assert.ok(verified.formalProofSummary?.includes('SymPy verified'));
  assert.equal(result.report.overallStatus, 'verified');
});

test('CHECKPOINT B: Real Source Grounding - Valid quote produces source_grounded', async () => {
  const service = new KnowledgeValidationServiceV3();
  const claim: EducationalClaimV3 = {
    id: 'claim_perceptron_def',
    claimType: 'ai_concept',
    statement: 'Perceptron nhận đầu vào x, nhân trọng số w, cộng bias và qua hàm kích hoạt.',
    verificationStatus: 'unverified'
  };

  const validEvidence: GroundingEvidence[] = [
    {
      evidenceId: 'ev_1',
      claimId: 'claim_perceptron_def',
      evidenceFound: true,
      evidenceMatchConfidence: 0.95,
      matchType: 'exact',
      isExactQuote: true,
      sourceReference: {
        id: 'ref_rosenblatt_1958',
        documentId: 'doc_neural_foundations_pdf',
        pageNumber: 42,
        exactQuote: 'The perceptron computes a weighted sum of inputs and applies a threshold function.',
        relevanceScore: 0.95
      }
    }
  ];

  const result = await service.validateClaims({
    lessonId: 'test_grounded',
    topicId: 'ai.perceptron.activation',
    domain: 'artificial_intelligence',
    claims: [claim],
    sourceEvidence: validEvidence
  });

  const verified = result.validatedClaims[0];
  assert.equal(verified.verificationStatus, 'source_grounded');
  assert.equal(verified.sourceReferenceId, 'ref_rosenblatt_1958');
  assert.equal(result.report.claimReports[0].status, 'source_grounded');
});

test('CHECKPOINT B: Real Source Grounding - Missing or empty quote falls back to human_review_required', async () => {
  const service = new KnowledgeValidationServiceV3();
  const claim: EducationalClaimV3 = {
    id: 'claim_missing_quote',
    claimType: 'ai_concept',
    statement: 'Backpropagation sử dụng quy tắc chuỗi.',
    verificationStatus: 'unverified'
  };

  const invalidEvidence: GroundingEvidence[] = [
    {
      evidenceId: 'ev_empty',
      claimId: 'claim_missing_quote',
      evidenceFound: false, // quote missing!
      evidenceMatchConfidence: 0.1,
      matchType: 'none',
      isExactQuote: false,
      sourceReference: {
        id: 'ref_empty',
        documentId: 'doc_empty',
        pageNumber: 1,
        exactQuote: '',
        relevanceScore: 0.1
      }
    }
  ];

  const result = await service.validateClaims({
    lessonId: 'test_missing_grounding',
    topicId: 'ai.neural_network.backpropagation',
    domain: 'artificial_intelligence',
    claims: [claim],
    sourceEvidence: invalidEvidence
  });

  const verified = result.validatedClaims[0];
  assert.equal(verified.verificationStatus, 'human_review_required');
  assert.equal(verified.sourceReferenceId, undefined);
});

test('CHECKPOINT B: Real Source Grounding - Claim with no source evidence requires human review', async () => {
  const service = new KnowledgeValidationServiceV3();
  const claim: EducationalClaimV3 = {
    id: 'claim_no_evidence',
    claimType: 'ai_concept',
    statement: 'Khái niệm không có tài liệu trích dẫn đi kèm',
    verificationStatus: 'unverified'
  };

  const result = await service.validateClaims({
    lessonId: 'test_no_ev',
    topicId: 'ai.embeddings.vector_space',
    domain: 'artificial_intelligence',
    claims: [claim],
    sourceEvidence: []
  });

  const verified = result.validatedClaims[0];
  assert.equal(verified.verificationStatus, 'human_review_required');
  assert.equal(verified.sourceReferenceId, undefined);
});

test('CHECKPOINT D: EducationalPlannerV3 with AIProvider sanitizes claims and enforces candidate status', async () => {
  const fakeAIResponse = {
    title: 'Bài học Thử nghiệm AI',
    summary: 'Tóm tắt bài học',
    learningObjectives: ['Mục tiêu 1'],
    prerequisites: ['Đại số'],
    keyConcepts: ['Khái niệm A'],
    educationalClaims: [
      {
        id: 'claim_ai_untrusted',
        claimType: 'formal_mathematics',
        statement: 'Đạo hàm x^2 là 2*x',
        formalExpression: '2*x',
        validatorKey: 'polynomial_derivative',
        // The LLM claims it is verified:
        verificationStatus: 'formally_verified',
        formalProofSummary: 'LLM self-claimed proof'
      }
    ],
    storyboard: {
      scenes: [
        {
          sceneId: 'sc_1',
          sceneType: 'concept_intro',
          title: 'Cảnh 1',
          pedagogicalGoal: 'Mục tiêu cảnh 1',
          durationSeconds: 20,
          boundClaimIds: ['claim_ai_untrusted'],
          rendererTarget: 'remotion_infographic',
          narration: { vietnamese: 'Chào mừng', subtitleVietnamese: 'Chào mừng' },
          visualPayload: {
            sceneType: 'concept_intro',
            centralQuestion: 'Câu hỏi là gì?',
            keyConcept: 'Khái niệm A',
            accentColor: '#3B82F6',
            visualStyleId: 'clean_educational_infographic',
            reducedMotion: false
          }
        },
        {
          sceneId: 'sc_2',
          sceneType: 'summary',
          title: 'Cảnh 2',
          pedagogicalGoal: 'Mục tiêu cảnh 2',
          durationSeconds: 20,
          boundClaimIds: ['claim_ai_untrusted'],
          rendererTarget: 'remotion_infographic',
          narration: { vietnamese: 'Tóm lại', subtitleVietnamese: 'Tóm lại' },
          visualPayload: {
            sceneType: 'summary',
            title: 'Tổng kết',
            takeaways: ['Ý 1', 'Ý 2'],
            verifiedFacts: [],
            reviewNotes: [],
            finalCallout: 'Hoàn thành'
          }
        }
      ]
    }
  };

  const fakeProvider = new FakeTransportAIProvider(fakeAIResponse);
  const planner = new EducationalPlannerV3({ aiProvider: fakeProvider });

  const plan = await planner.planLesson({
    lessonId: 'plan_ai_test',
    topic: 'Đạo hàm x^2',
    targetDurationSeconds: 40
  });

  assert.equal(fakeProvider.callCount, 1);
  assert.equal(plan.educationalClaims.length, 1);
  const claim = plan.educationalClaims[0];
  // Even though LLM returned 'LLM self-claimed proof', our independent SymPy verifier verified it!
  assert.equal(claim.verificationStatus, 'formally_verified');
  assert.ok(claim.formalProofSummary?.includes('SymPy verified'));
  assert.notEqual(claim.formalProofSummary, 'LLM self-claimed proof');
  assert.ok(plan.validationReport);
  assert.equal(plan.validationReport.overallStatus, 'verified');
});
