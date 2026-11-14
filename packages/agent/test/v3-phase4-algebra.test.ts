import assert from 'node:assert/strict';
import test from 'node:test';
import { EducationalPlannerV3, KnowledgeValidationServiceV3, verifyAlgebraIdentityV3 } from '../src/orchestration/index';

test('trusted SymPy verifier accepts exact algebra identity and rejects a false one', async () => {
  assert.equal((await verifyAlgebraIdentityV3('(a+b)^2', 'a^2+2*a*b+b^2')).status, 'verified');
  assert.equal((await verifyAlgebraIdentityV3('(a+b)^2', 'a^2+b^2')).status, 'incorrect');
  await assert.rejects(() => verifyAlgebraIdentityV3("__import__('os')", 'a'), /algebra_verification_failed/);
});

test('seven identities produce formally bound claims and reusable algebra scenes', async () => {
  const plan = await new EducationalPlannerV3().planLesson({
    lessonId: 'lesson_algebra_phase4', topic: '7 hằng đẳng thức đáng nhớ', targetDurationSeconds: 35
  });
  assert.equal(plan.domain, 'mathematics');
  assert.equal(plan.topicId, 'algebra.identities.seven');
  assert.equal(plan.capabilityReport.renderReadiness, 'render_ready');
  assert.equal(plan.educationalClaims.length, 7);
  assert.ok(plan.educationalClaims.every((claim) => claim.verificationStatus === 'formally_verified'));
  assert.ok(plan.validationReport?.claimReports.every((report) => report.verifierImplementation === 'SymPy bounded algebra identity verifier'));
  assert.equal(plan.storyboard?.scenes.length, 7);
  assert.ok(plan.storyboard?.scenes.every((scene) => scene.visualPayload.sceneType === 'algebra_identity'));
});

test('editing an exact identity to a false equality fails closed', async () => {
  const result = await new KnowledgeValidationServiceV3().validateClaims({
    lessonId: 'lesson_false_identity', topicId: 'algebra.identities.seven', domain: 'mathematics',
    claims: [{
      id: 'claim_false', claimType: 'formal_mathematics', statement: 'Công thức thiếu số hạng giữa',
      formalExpression: '(a+b)^2=a^2+b^2', validatorKey: 'algebra_identity_false', verificationStatus: 'unverified'
    }]
  });
  assert.equal(result.report.overallStatus, 'failed');
  assert.equal(result.validatedClaims[0].verificationStatus, 'rejected');
});

