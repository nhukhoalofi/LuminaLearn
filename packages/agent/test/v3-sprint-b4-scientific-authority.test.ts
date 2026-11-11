import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EducationalLessonPlanV3Schema } from '@luminalearn/scene-schema';
import { directEducationalLessonV3 } from '../src/orchestration/universal-educational-director-v3';
import { KnowledgeValidationServiceV3, validateGradientDescentClaim } from '../src/orchestration/knowledge-validation-v3';
import { EducationalPlannerV3 } from '../src/orchestration/educational-planner-v3';

describe('Quality Sprint B.4 Checkpoint A: Fail-Closed Scientific Verification Authority', () => {
  const planner = new EducationalPlannerV3();

  it('fails closed when scene has zero claims bound', async () => {
    const basePlan = await planner.planLesson({ lessonId: 'sprint_b4_zero_claims', topic: 'Gradient Descent', targetDurationSeconds: 60 });
    const plan = structuredClone(basePlan);
    const lossScene = plan.storyboard!.scenes.find((s) => s.sceneType === 'loss_landscape')!;
    lossScene.boundClaimIds = []; // Zero claims bound
    const directed = directEducationalLessonV3(plan, { targetLearners: plan.targetLearners ?? 'Học sinh', targetDurationSeconds: 60 });
    const mapping = directed.visualIntentMappings?.find((m) => m.visualIntent === 'verified_parameter_step');
    assert.ok(mapping);
    assert.equal(mapping.readiness, 'needs_review');
    assert.notEqual(mapping.readiness, 'render_ready');
  });

  it('fails closed when claim is unverified', async () => {
    const basePlan = await planner.planLesson({ lessonId: 'sprint_b4_unverified', topic: 'Gradient Descent', targetDurationSeconds: 60 });
    const plan = structuredClone(basePlan);
    const lossScene = plan.storyboard!.scenes.find((s) => s.sceneType === 'loss_landscape')!;
    const newClaimId = 'claim_gd_unverified';
    plan.educationalClaims.push({
      id: newClaimId,
      claimType: 'formal_mathematics',
      statement: 'Quy tắc cập nhật',
      formalExpression: 'w_next = w - eta * grad_L(w)',
      verificationStatus: 'unverified'
    });
    plan.validationReport!.overallStatus = 'needs_review';
    plan.validationReport!.claimReports.push({
      claimId: newClaimId,
      claimType: 'formal_mathematics',
      status: 'human_review_required',
      verifierNotes: 'Unverified claim pending review'
    });
    lossScene.boundClaimIds = [newClaimId];
    const directed = directEducationalLessonV3(plan, { targetLearners: plan.targetLearners ?? 'Học sinh', targetDurationSeconds: 60 });
    const mapping = directed.visualIntentMappings?.find((m) => m.visualIntent === 'verified_parameter_step');
    assert.ok(mapping);
    assert.equal(mapping.readiness, 'needs_review');
  });

  it('fails closed when claim requires human review', async () => {
    const basePlan = await planner.planLesson({ lessonId: 'sprint_b4_human_review', topic: 'Gradient Descent', targetDurationSeconds: 60 });
    const plan = structuredClone(basePlan);
    const lossScene = plan.storyboard!.scenes.find((s) => s.sceneType === 'loss_landscape')!;
    const newClaimId = 'claim_gd_review';
    plan.educationalClaims.push({
      id: newClaimId,
      claimType: 'formal_mathematics',
      statement: 'Quy tắc cập nhật có thể phân kỳ nếu eta quá lớn',
      formalExpression: 'w_next = w - eta * grad_L(w)',
      verificationStatus: 'human_review_required',
      humanReviewComment: 'Cần giáo viên kiểm duyệt'
    });
    plan.validationReport!.overallStatus = 'needs_review';
    plan.validationReport!.claimReports.push({
      claimId: newClaimId,
      claimType: 'formal_mathematics',
      status: 'human_review_required',
      verifierNotes: 'Cần giáo viên kiểm duyệt'
    });
    lossScene.boundClaimIds = [newClaimId];
    const directed = directEducationalLessonV3(plan, { targetLearners: plan.targetLearners ?? 'Học sinh', targetDurationSeconds: 60 });
    const mapping = directed.visualIntentMappings?.find((m) => m.visualIntent === 'verified_parameter_step');
    assert.ok(mapping);
    assert.equal(mapping.readiness, 'needs_review');
  });

  it('fails closed when claim is rejected', async () => {
    const basePlan = await planner.planLesson({ lessonId: 'sprint_b4_rejected', topic: 'Gradient Descent', targetDurationSeconds: 60 });
    const plan = structuredClone(basePlan);
    const lossScene = plan.storyboard!.scenes.find((s) => s.sceneType === 'loss_landscape')!;
    const newClaimId = 'claim_gd_rejected';
    plan.educationalClaims.push({
      id: newClaimId,
      claimType: 'formal_mathematics',
      statement: 'Quy tắc cập nhật',
      formalExpression: 'w_next = w + eta * grad_L(w)',
      verificationStatus: 'rejected',
      statementContradictionReason: 'Phát hiện gradient ascent'
    });
    plan.validationReport!.overallStatus = 'failed';
    plan.validationReport!.claimReports.push({
      claimId: newClaimId,
      claimType: 'formal_mathematics',
      status: 'rejected',
      verifierNotes: 'Phát hiện gradient ascent'
    });
    lossScene.boundClaimIds = [newClaimId];
    const directed = directEducationalLessonV3(plan, { targetLearners: plan.targetLearners ?? 'Học sinh', targetDurationSeconds: 60 });
    const mapping = directed.visualIntentMappings?.find((m) => m.visualIntent === 'verified_parameter_step');
    assert.ok(mapping);
    assert.equal(mapping.readiness, 'needs_review');
  });

  it('fails closed when loss landscape schema detects corrupt gradient or parameter step', async () => {
    const basePlan = await planner.planLesson({ lessonId: 'sprint_b4_bad_grad', topic: 'Gradient Descent', targetDurationSeconds: 60 });
    const plan = structuredClone(basePlan);
    const lossScene = plan.storyboard!.scenes.find((s) => s.sceneType === 'loss_landscape')!;
    if (lossScene.visualPayload.sceneType === 'loss_landscape') {
      lossScene.visualPayload.steps[0].gradient = 999.0; // Corrupt gradient
    }
    // Lesson plan schema fails closed at intake validation
    assert.throws(
      () => EducationalLessonPlanV3Schema.parse(plan),
      /gradient không khớp đạo hàm quadratic/
    );
  });

  it('fails closed when loss landscape schema detects corrupt parameter update', async () => {
    const basePlan = await planner.planLesson({ lessonId: 'sprint_b4_bad_update', topic: 'Gradient Descent', targetDurationSeconds: 60 });
    const plan = structuredClone(basePlan);
    const lossScene = plan.storyboard!.scenes.find((s) => s.sceneType === 'loss_landscape')!;
    if (lossScene.visualPayload.sceneType === 'loss_landscape') {
      lossScene.visualPayload.steps[1].w = 99.9; // Corrupt update step
    }
    assert.throws(
      () => EducationalLessonPlanV3Schema.parse(plan),
      /Bước cập nhật không khớp gradient descent/
    );
  });

  it('succeeds with render_ready when claims and numerical trace are valid and verified', async () => {
    const basePlan = await planner.planLesson({ lessonId: 'sprint_b4_valid', topic: 'Gradient Descent', targetDurationSeconds: 60 });
    const directed = directEducationalLessonV3(basePlan, { targetLearners: basePlan.targetLearners ?? 'Học sinh', targetDurationSeconds: 60 });
    const mapping = directed.visualIntentMappings?.find((m) => m.visualIntent === 'verified_parameter_step');
    assert.ok(mapping);
    assert.equal(mapping.readiness, 'render_ready');
    assert.equal(mapping.adapterId, 'loss_landscape_v3');
  });

  it('validates gradient descent claims through validateGradientDescentClaim', () => {
    // Valid claim
    const validClaim = {
      id: 'claim_gd_valid',
      claimType: 'formal_mathematics' as const,
      statement: 'Quy tắc cập nhật w_next = w - eta * grad_L(w)',
      formalExpression: 'w_next = w - eta * grad_L(w)',
      validatorKey: 'gradient_descent_formula',
      verificationStatus: 'unverified' as const
    };
    const validResult = validateGradientDescentClaim(validClaim);
    assert.equal(validResult.status, 'numerically_validated');
    assert.ok(validResult.formalProofSummary);

    // Contradiction: ascent instead of descent
    const ascentClaim = {
      id: 'claim_gd_ascent',
      claimType: 'formal_mathematics' as const,
      statement: 'Quy tắc cập nhật w_next = w + eta * grad_L(w)',
      formalExpression: 'w_next = w + eta * grad_L(w)',
      validatorKey: 'gradient_descent_formula',
      verificationStatus: 'unverified' as const
    };
    const ascentResult = validateGradientDescentClaim(ascentClaim);
    assert.equal(ascentResult.status, 'rejected');
    assert.ok(ascentResult.contradictionReason?.includes('gradient_ascent'));

    // Invalid numeric trace
    const badTrace = {
      kind: 'optimization_trace_1d' as const,
      expression: 'L(w)=(w-2)^2+1',
      learningRate: 0.4,
      points: [
        { step: 1, parameter: 4.0, value: 5.0, gradient: 4.0 },
        { step: 2, parameter: 0.0, value: 1.16, gradient: 0.8 } // incorrect update
      ],
      claimId: 'claim_gd_valid',
      validation: 'deterministic_numeric' as const
    };
    const badTraceResult = validateGradientDescentClaim(validClaim, badTrace);
    assert.equal(badTraceResult.status, 'rejected');
  });

  it('validates claims end-to-end via KnowledgeValidationServiceV3 for AI optimization topic', async () => {
    const validator = new KnowledgeValidationServiceV3();
    const result = await validator.validateClaims({
      lessonId: 'lesson_gd_e2e',
      topicId: 'ai.gradient_descent.optimization',
      domain: 'artificial_intelligence',
      claims: [
        {
          id: 'claim_gd_rule',
          claimType: 'formal_mathematics',
          statement: 'Quy tắc cập nhật tham số: w_next = w - eta * grad_L(w)',
          formalExpression: 'w_next = w - eta * grad_L(w)',
          validatorKey: 'gradient_descent_formula',
          verificationStatus: 'unverified'
        }
      ]
    });

    assert.equal(result.report.overallStatus, 'verified');
    assert.equal(result.validatedClaims[0].verificationStatus, 'numerically_validated');
    assert.equal(result.validatedClaims[0].formalExpressionVerified, true);
    assert.equal(result.validatedClaims[0].proofRecordId, 'proof_claim_gd_rule');
  });
});
