import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EducationalPlannerV3,
  MockAIProvider
} from '../src/orchestration/index';

describe('Checkpoint F — Topic Coverage Test Matrix (10 Benchmark Topics)', () => {
  const planner = new EducationalPlannerV3({
    aiProvider: new MockAIProvider()
  });

  // ==========================================
  // 5 MATHEMATICS TOPICS
  // ==========================================

  it('Topic 1 (Math): Derivative intuition — secant to tangent', async () => {
    const plan = await planner.planLesson({
      lessonId: 'lesson_math_1',
      topic: 'Đạo hàm là gì? Từ cát tuyến đến tiếp tuyến trên parabol',
      mathSpec: { topicId: 'calculus.derivative.intuition', visualization: 'secant_to_tangent', function: { type: 'polynomial', coefficients: [0, 0, 1] }, parameters: { pointX: 1 }, boundClaimIds: ['claim_poly_deriv', 'claim_secant_limit'] }
    });

    assert.equal(plan.domain, 'mathematics');
    assert.equal(plan.topicId, 'calculus.derivative.intuition');
    assert.equal(plan.capabilityReport.renderReadiness, 'render_ready');
    assert.ok(plan.educationalClaims.length >= 2);

    // Verify claims are formal_mathematics with proofs
    const formalClaim = plan.educationalClaims.find((c) => c.claimType === 'formal_mathematics');
    assert.ok(formalClaim);
    assert.equal(formalClaim.verificationStatus, 'formally_verified');
    assert.ok(formalClaim.formalExpression);
    assert.ok(formalClaim.formalProofSummary);

    // Check scenes
    assert.ok(plan.storyboard);
    assert.ok(plan.storyboard.scenes.length >= 2);
    assert.equal(plan.storyboard.scenes[0].rendererTarget, 'manim_hybrid');
  });

  it('Topic 2 (Math): Definite integral as Riemann sum limit', async () => {
    const plan = await planner.planLesson({
      lessonId: 'lesson_math_2',
      topic: 'Tổng Riemann xấp xỉ diện tích hình thang cong và tích phân',
      mathSpec: { topicId: 'calculus.integral.riemann_sum', visualization: 'riemann_sum', function: { type: 'polynomial', coefficients: [0, 0, 1] }, parameters: { interval: [0, 1], partitions: [4, 8] }, boundClaimIds: ['claim_riemann_int'] }
    });

    assert.equal(plan.domain, 'mathematics');
    assert.equal(plan.topicId, 'calculus.riemann_integral.intuition');
    assert.equal(plan.capabilityReport.renderReadiness, 'render_ready');

    const integralClaim = plan.educationalClaims.find((c) => c.validatorKey === 'riemann_integral');
    assert.ok(integralClaim);
    assert.equal(integralClaim.formalExpression, '1/3');
    assert.equal(integralClaim.verificationStatus, 'formally_verified');
  });

  it('Topic 3 (Math): Matrix transformation in 2D', async () => {
    const plan = await planner.planLesson({
      lessonId: 'lesson_math_3',
      topic: 'Biến đổi không gian 2D bằng ma trận đại số tuyến tính'
    });

    assert.equal(plan.domain, 'mathematics');
    assert.equal(plan.topicId, 'linear_algebra.matrix_transform');
    // Matrix transform renderer is scheduled for Phase 2, so it MUST be planning_only
    assert.equal(plan.capabilityReport.renderReadiness, 'planning_only');
    assert.ok(plan.capabilityReport.limitations.length > 0);
  });

  it('Topic 4 (Math): Limit intuition with epsilon-delta', async () => {
    const plan = await planner.planLesson({
      lessonId: 'lesson_math_4',
      topic: 'Định nghĩa giới hạn hàm số bằng Epsilon và Delta'
    });

    assert.equal(plan.domain, 'mathematics');
    assert.equal(plan.topicId, 'calculus.limits.epsilon_delta');
    assert.equal(plan.capabilityReport.renderReadiness, 'planning_only');
    assert.ok(plan.capabilityReport.supportedCapabilities.includes('human_review_required'));
  });

  it('Topic 5 (Math): Bayes theorem and probability update', async () => {
    const plan = await planner.planLesson({
      lessonId: 'lesson_math_5',
      topic: 'Định lý Bayes và xác suất có điều kiện'
    });

    assert.equal(plan.domain, 'mathematics');
    assert.equal(plan.topicId, 'probability.bayes_theorem');
    assert.equal(plan.capabilityReport.renderReadiness, 'planning_only');
    const claim = plan.educationalClaims[0];
    assert.match(claim.formalExpression ?? '', /P\(A\|B\)/);
  });

  // ==========================================
  // 5 ARTIFICIAL INTELLIGENCE / ML TOPICS
  // ==========================================

  it('Topic 6 (AI): Perceptron and activation functions (Sigmoid, ReLU)', async () => {
    const plan = await planner.planLesson({
      lessonId: 'lesson_ai_6',
      topic: 'Mô hình Perceptron và các hàm kích hoạt Sigmoid, ReLU'
    });

    assert.equal(plan.domain, 'artificial_intelligence');
    assert.equal(plan.topicId, 'ai.perceptron.activation');
    assert.equal(plan.capabilityReport.renderReadiness, 'render_ready');

    // Never force a fake polynomial derivative on conceptual AI topic!
    for (const claim of plan.educationalClaims) {
      assert.notEqual(claim.validatorKey, 'polynomial_derivative');
      assert.notEqual(claim.validatorKey, 'riemann_integral');
      assert.ok(['ai_concept', 'algorithmic_property'].includes(claim.claimType));
    }

    assert.ok(plan.storyboard);
    const archScene = plan.storyboard.scenes.find((s) => s.sceneType === 'neural_architecture');
    assert.ok(archScene, 'Should include a neural_architecture scene');
  });

  it('Topic 7 (AI): Gradient descent and loss landscape', async () => {
    const plan = await planner.planLesson({
      lessonId: 'lesson_ai_7',
      topic: 'Tối ưu hóa Gradient Descent và bề mặt hàm mất mát Loss Function'
    });

    assert.equal(plan.domain, 'artificial_intelligence');
    assert.equal(plan.topicId, 'ai.gradient_descent.optimization');
    assert.equal(plan.capabilityReport.renderReadiness, 'render_ready');

    // Mixed topic: contains both optimization formula and conceptual intuition
    const formalClaim = plan.educationalClaims.find((c) => c.claimType === 'formal_mathematics');
    const conceptClaim = plan.educationalClaims.find((c) => c.claimType === 'ai_concept');
    assert.ok(formalClaim);
    assert.ok(conceptClaim);

    const lossScene = plan.storyboard?.scenes.find((s) => s.sceneType === 'loss_landscape');
    assert.ok(lossScene, 'Should include a loss_landscape scene');
  });

  it('Topic 8 (AI): Self-attention mechanism in Transformers', async () => {
    const plan = await planner.planLesson({
      lessonId: 'lesson_ai_8',
      topic: 'Cơ chế Self-Attention và kiến trúc mạng Transformer'
    });

    assert.equal(plan.domain, 'artificial_intelligence');
    assert.equal(plan.topicId, 'ai.transformer.attention');
    assert.equal(plan.capabilityReport.renderReadiness, 'render_ready');

    const algoClaim = plan.educationalClaims.find((c) => c.validatorKey === 'scaled_dot_product');
    assert.ok(algoClaim);
    assert.match(algoClaim.formalExpression ?? '', /softmax/);
  });

  it('Topic 9 (AI): Neural network backpropagation and chain rule', async () => {
    const plan = await planner.planLesson({
      lessonId: 'lesson_ai_9',
      topic: 'Thuật toán lan truyền ngược Backpropagation và quy tắc chuỗi Chain Rule'
    });

    assert.equal(plan.domain, 'artificial_intelligence');
    assert.equal(plan.topicId, 'ai.neural_network.backpropagation');
    assert.equal(plan.capabilityReport.renderReadiness, 'planning_only');

    const chainRuleClaim = plan.educationalClaims.find((c) => c.validatorKey === 'chain_rule_formula');
    assert.ok(chainRuleClaim);
    assert.match(chainRuleClaim.formalExpression ?? '', /dL\/dw/);
  });

  it('Topic 10 (AI): Word / token embeddings and vector similarity', async () => {
    const plan = await planner.planLesson({
      lessonId: 'lesson_ai_10',
      topic: 'Không gian vector nhúng Word Embeddings và khoảng cách ngữ nghĩa'
    });

    assert.equal(plan.domain, 'artificial_intelligence');
    assert.equal(plan.topicId, 'ai.embeddings.vector_space');
    assert.equal(plan.capabilityReport.renderReadiness, 'planning_only');

    // Verifies valid Vietnamese narration & subtitles
    for (const sc of plan.storyboard?.scenes ?? []) {
      assert.ok(sc.narration.vietnamese.length > 5);
      assert.ok(sc.narration.subtitleVietnamese.length > 5);
    }
  });
});

