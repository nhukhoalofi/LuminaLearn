import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CurriculumPlanner,
  detectRequestedPolynomial
} from '../src/orchestration/curriculum-planner';
import {
  DerivativeSymPyVerifier,
  RiemannSymPyVerifier
} from '../src/orchestration/math-verifier';
import type { AIProvider, AIProviderResult, AIStructuredRequest } from '../src/orchestration/ai-provider';
import type { TopicClassification } from '../src/orchestration/types';
import { LessonPlanV2Schema, type LessonPlanV2, type VerifiedClaim } from '@luminalearn/scene-schema';

class FakeTransportProvider implements AIProvider {
  readonly isMock = false;
  readonly requests: AIStructuredRequest<unknown>[] = [];

  constructor(private readonly responsePayload: unknown) {}

  async generateStructured<T>(request: AIStructuredRequest<T>): Promise<AIProviderResult<T>> {
    this.requests.push(request as AIStructuredRequest<unknown>);
    return {
      data: request.validator(this.responsePayload),
      mode: 'ai_generated_live',
      model: 'fake-test-transport',
      usage: { promptTokens: 100, candidatesTokens: 50 }
    };
  }
}

const derivativeTopic: TopicClassification = {
  topicId: 'calculus.derivative.intuition',
  displayName: 'Đạo hàm của hàm số',
  domain: 'calculus',
  confidence: 1,
  supportedTemplates: ['function_graph', 'secant_to_tangent'],
  requiredValidators: ['polynomial_derivative', 'secant_slope', 'limit_at_zero', 'value_at_point'],
  isSupported: true
};

const riemannTopic: TopicClassification = {
  topicId: 'calculus.integral.riemann_sum',
  displayName: 'Tổng tích phân Riemann',
  domain: 'calculus',
  confidence: 1,
  supportedTemplates: ['function_graph', 'riemann_sum'],
  requiredValidators: ['riemann_sum_limit', 'definite_integral'],
  isSupported: true
};

function buildCandidateLessonPlan(overrides: Partial<LessonPlanV2> = {}): LessonPlanV2 {
  return LessonPlanV2Schema.parse({
    schemaVersion: 'lesson-v2',
    lessonId: 'lesson_test_semantic',
    topicId: 'calculus.derivative.intuition',
    title: 'Kiểm tra ngữ nghĩa toán học',
    learningObjectives: ['Hiểu đạo hàm'],
    prerequisites: [],
    keyConcepts: ['Đạo hàm'],
    mathematicalClaims: [
      {
        id: 'claim_poly_deriv',
        statement: "Đạo hàm của x^2 là 2x",
        validatorKey: 'polynomial_derivative',
        expectedExpression: '2*x',
        verificationStatus: 'unverified'
      }
    ],
    mathSpec: {
      topicId: 'calculus.derivative.intuition',
      visualization: 'secant_to_tangent',
      function: { type: 'polynomial', coefficients: [0, 0, 1] },
      parameters: { pointX: 1, hStart: 2, hEnd: 0.05 },
      boundClaimIds: ['claim_poly_deriv']
    },
    pedagogicalSequence: [
      { stepNumber: 1, pedagogicalGoal: 'Giải thích', intuitiveConcept: 'Quan sát', targetDurationSeconds: 40 }
    ],
    summary: 'Tóm tắt bài học đạo hàm.',
    ...overrides
  });
}

test('Checkpoint A1: Valid derivative f(x)=x^2 passes SymPy formal verification without mutation', async () => {
  const verifier = new DerivativeSymPyVerifier();
  const claims: VerifiedClaim[] = [
    {
      id: 'claim_1',
      statement: "f'(x) = 2x",
      validatorKey: 'polynomial_derivative',
      expectedExpression: '2*x',
      verificationStatus: 'unverified'
    }
  ];

  const report = await verifier.verify('calculus.derivative.intuition', claims);
  assert.equal(report.status, 'verified');
  assert.equal(report.checks.polynomial_derivative?.passed, true);
  assert.equal(report.checks.polynomial_derivative?.expected, '2*x');
  assert.equal(report.checks.polynomial_derivative?.received, '2*x');
});

test('Checkpoint A2: Wrong derivative f\'(x)=3x is evaluated as incorrect by SymPy (not silently corrected)', async () => {
  const verifier = new DerivativeSymPyVerifier();
  const claims: VerifiedClaim[] = [
    {
      id: 'claim_wrong_deriv',
      statement: "f'(x) = 3x",
      validatorKey: 'polynomial_derivative',
      expectedExpression: '3*x',
      verificationStatus: 'unverified'
    }
  ];

  const report = await verifier.verify('calculus.derivative.intuition', claims);
  assert.equal(report.status, 'failed');
  assert.equal(report.checks.polynomial_derivative?.passed, false);
  assert.equal(report.checks.polynomial_derivative?.status, 'incorrect');
  assert.equal(report.checks.polynomial_derivative?.expected, '2*x');
  assert.equal(report.checks.polynomial_derivative?.received, '3*x');
});

test('Checkpoint A3: Malformed derivative expression is preserved as emitted and NOT silently replaced with 2*x', async () => {
  const candidate = buildCandidateLessonPlan({
    mathematicalClaims: [
      {
        id: 'claim_malformed',
        statement: 'Đạo hàm là biểu thức không hợp lệ',
        validatorKey: 'polynomial_derivative',
        expectedExpression: 'not_a_valid_derivative',
        verificationStatus: 'unverified'
      }
    ]
  });

  const provider = new FakeTransportProvider(candidate);
  const planner = new CurriculumPlanner();
  const plan = await planner.plan({
    lessonId: 'lesson_test_malformed',
    topicInfo: derivativeTopic,
    audience: 'Học sinh',
    targetDurationSeconds: 40,
    aiProvider: provider
  });

  // Verify that the malformed expression was NOT silently overwritten with '2*x'
  assert.equal(plan.mathematicalClaims[0].expectedExpression, 'not_a_valid_derivative');

  // Verify that SymPy will fail closed on this expression
  const verifier = new DerivativeSymPyVerifier();
  const report = await verifier.verify('calculus.derivative.intuition', plan.mathematicalClaims);
  assert.equal(report.status, 'failed');
  assert.equal(report.checks.polynomial_derivative?.passed, false);
});

test('Checkpoint A4: Wrong integral result (e.g. 1/2 instead of 1/3 for x^2 on [0,1]) fails SymPy verification', async () => {
  const verifier = new RiemannSymPyVerifier();
  const claims: VerifiedClaim[] = [
    {
      id: 'claim_wrong_integral',
      statement: 'Tích phân bằng 1/2',
      validatorKey: 'definite_integral',
      expectedExpression: '1/2',
      verificationStatus: 'unverified'
    }
  ];

  const report = await verifier.verify('calculus.integral.riemann_sum', claims);
  assert.equal(report.status, 'failed');
  assert.equal(report.checks.definite_integral?.passed, false);
  assert.equal(report.checks.definite_integral?.status, 'incorrect');
  assert.equal(report.checks.definite_integral?.expected, '1/3');
  assert.equal(report.checks.definite_integral?.received, '1/2');
});

test('Checkpoint A5: User asks f(x)=x^3 but pipeline receives MathSpec for x^2 throws requested_function_mismatch error', async () => {
  const candidate = buildCandidateLessonPlan({
    mathSpec: {
      topicId: 'calculus.derivative.intuition',
      visualization: 'secant_to_tangent',
      function: { type: 'polynomial', coefficients: [0, 0, 1] }, // x^2 substituted!
      parameters: { pointX: 1, hStart: 2, hEnd: 0.05 },
      boundClaimIds: ['claim_poly_deriv']
    }
  });

  const provider = new FakeTransportProvider(candidate);
  const planner = new CurriculumPlanner();

  await assert.rejects(
    async () => {
      await planner.plan({
        lessonId: 'lesson_deriv_x3',
        topicInfo: {
          ...derivativeTopic,
          displayName: 'Đạo hàm của hàm số f(x) = x^3'
        },
        audience: 'Học sinh',
        targetDurationSeconds: 40,
        aiProvider: provider
      });
    },
    /requested_function_mismatch/
  );
});

test('Checkpoint A6: detectRequestedPolynomial correctly extracts polynomial degree', () => {
  assert.deepEqual(detectRequestedPolynomial('Đạo hàm của f(x) = x^3 tại điểm x=1'), {
    type: 'polynomial',
    coefficients: [0, 0, 0, 1],
    expression: 'x^3'
  });
  assert.deepEqual(detectRequestedPolynomial('Đạo hàm của f(x) = x³'), {
    type: 'polynomial',
    coefficients: [0, 0, 0, 1],
    expression: 'x^3'
  });
  assert.deepEqual(detectRequestedPolynomial('Đạo hàm của x^2'), {
    type: 'polynomial',
    coefficients: [0, 0, 1],
    expression: 'x^2'
  });
  assert.equal(detectRequestedPolynomial('Giải thích định lý Pythagoras'), undefined);
});

