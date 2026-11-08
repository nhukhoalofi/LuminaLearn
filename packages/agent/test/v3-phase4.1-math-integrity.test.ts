import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KnowledgeValidationServiceV3,
  inspectStatementSemanticConsistency
} from '../src/orchestration/knowledge-validation-v3.js';
import { verifyAlgebraIdentityV3 } from '../src/orchestration/algebra-verifier-v3.js';

test('Checkpoint B — Formal Mathematics Semantic Integrity (P0)', async (t) => {
  const service = new KnowledgeValidationServiceV3();

  await t.test('1. Correct formula paired with contradictory Vietnamese statement is rejected with contradiction', async () => {
    // Formula is mathematically valid: (a+b)^2 = a^2 + 2*a*b + b^2
    // But statement denies the existence of the 2ab cross term!
    const result = await service.validateClaims({
      lessonId: 'lesson_math_contradiction',
      topicId: 'algebra.identities.seven',
      domain: 'mathematics',
      claims: [
        {
          id: 'claim_contradictory',
          claimType: 'formal_mathematics',
          statement: 'Bình phương của một tổng không có số hạng 2ab',
          formalExpression: '(a+b)^2=a^2+2*a*b+b^2',
          validatorKey: 'algebra_identity_square_of_sum',
          verificationStatus: 'unverified'
        }
      ]
    });

    const validatedClaim = result.validatedClaims[0];
    assert.equal(validatedClaim.formalExpressionVerified, false, 'Contradiction overrides formal expression verification');
    assert.equal(validatedClaim.statementSemanticStatus, 'contradiction_detected', 'Semantic check flagged contradiction');
    assert.equal(validatedClaim.verificationStatus, 'rejected', 'Must NOT be certified as formally verified when statement contradicts formula');
    assert.ok(validatedClaim.statementContradictionReason);
    assert.equal(result.report.overallStatus, 'failed');
  });

  await t.test('2. Correct formula paired with free-form prose statement requires explicit human semantic review', async () => {
    const result = await service.validateClaims({
      lessonId: 'lesson_math_prose',
      topicId: 'algebra.identities.seven',
      domain: 'mathematics',
      claims: [
        {
          id: 'claim_freeform_prose',
          claimType: 'formal_mathematics',
          statement: 'Đẳng thức này rất hữu ích và đẹp mắt trong toán học',
          formalExpression: '(a+b)^2=a^2+2*a*b+b^2',
          validatorKey: 'algebra_identity_square_of_sum',
          verificationStatus: 'unverified'
        }
      ]
    });

    const validatedClaim = result.validatedClaims[0];
    assert.equal(validatedClaim.formalExpressionVerified, true);
    assert.equal(validatedClaim.statementSemanticStatus, 'human_review_required');
    // Cannot be certified as formally_verified without human semantic review!
    assert.equal(validatedClaim.verificationStatus, 'human_review_required');
    assert.equal(result.report.overallStatus, 'needs_review');
  });

  await t.test('3. Wrong formula with convincing explanation fails formal verification', async () => {
    const result = await service.validateClaims({
      lessonId: 'lesson_wrong_formula',
      topicId: 'algebra.identities.seven',
      domain: 'mathematics',
      claims: [
        {
          id: 'claim_false_formula',
          claimType: 'formal_mathematics',
          statement: 'Bình phương của một tổng bằng tổng hai bình phương: (a+b)^2 = a^2 + b^2',
          formalExpression: '(a+b)^2=a^2+b^2',
          validatorKey: 'algebra_identity_square_of_sum',
          verificationStatus: 'unverified'
        }
      ]
    });

    const validatedClaim = result.validatedClaims[0];
    assert.equal(validatedClaim.formalExpressionVerified, false);
    assert.equal(validatedClaim.verificationStatus, 'rejected');
    assert.equal(result.report.overallStatus, 'failed');
  });

  await t.test('4. Client-provided verificationStatus or formalProofSummary is untrusted and overwritten', async () => {
    // Malicious client pretends this false formula was already formally verified
    const result = await service.validateClaims({
      lessonId: 'lesson_forged_proof',
      topicId: 'algebra.identities.seven',
      domain: 'mathematics',
      claims: [
        {
          id: 'claim_forged',
          claimType: 'formal_mathematics',
          statement: 'Fake proof forged by attacker',
          formalExpression: '(a+b)^2=a^2+b^2',
          validatorKey: 'algebra_identity_square_of_sum',
          verificationStatus: 'formally_verified',
          formalProofSummary: 'FORGED: SymPy proves this is universally true'
        }
      ]
    });

    const validatedClaim = result.validatedClaims[0];
    assert.equal(validatedClaim.formalExpressionVerified, false);
    assert.notEqual(validatedClaim.formalProofSummary, 'FORGED: SymPy proves this is universally true');
    assert.equal(validatedClaim.verificationStatus, 'rejected');
    assert.equal(result.report.overallStatus, 'failed');
  });

  await t.test('5. Direct semantic inspector identifies contradictions and formal matches accurately', () => {
    const match = inspectStatementSemanticConsistency(
      '(a+b)^2 = a^2 + 2*a*b + b^2',
      '(a+b)^2=a^2+2*a*b+b^2'
    );
    assert.equal(match.status, 'formal_match');

    const contradiction1 = inspectStatementSemanticConsistency(
      'không có số hạng 2ab',
      '(a+b)^2=a^2+2*a*b+b^2'
    );
    assert.equal(contradiction1.status, 'contradiction_detected');

    const contradiction2 = inspectStatementSemanticConsistency(
      '(a+b)^2 = a^2 - 2*a*b + b^2',
      '(a+b)^2=a^2+2*a*b+b^2'
    );
    assert.equal(contradiction2.status, 'contradiction_detected');

    const prose = inspectStatementSemanticConsistency(
      'Công thức tính nhanh diện tích hình vuông lớn',
      '(a+b)^2=a^2+2*a*b+b^2'
    );
    assert.equal(prose.status, 'human_review_required');
  });

  await t.test('6. SymPy algebra verifier fails closed when python script encounters invalid syntax', async () => {
    await assert.rejects(
      () => verifyAlgebraIdentityV3('__import__("os").system("whoami")', 'a'),
      /algebra_verification_failed/
    );
  });
});
