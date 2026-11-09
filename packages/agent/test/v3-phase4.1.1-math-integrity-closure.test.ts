import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KnowledgeValidationServiceV3,
  inspectStatementSemanticConsistency,
  validateLessonMathematicalIntegrityV3
} from '../src/orchestration/knowledge-validation-v3';
import { LessonDraftManagerV3 } from '../src/orchestration/draft-manager-v3';
import { type EducationalClaimV3 } from '@luminalearn/scene-schema';

test('CHECKPOINT A — Proof Confusion & Key Collision Closure (P0)', async (t) => {
  const validator = new KnowledgeValidationServiceV3();

  await t.test('1. Claim A (false) -> Claim B (true) sharing validatorKey: Claim A remains unproven', async () => {
    const claims: EducationalClaimV3[] = [
      {
        id: 'claim_false_1',
        statement: 'Bình phương của tổng sai',
        claimType: 'formal_mathematics',
        formalExpression: '(a + b)^2 = a^2 + b^2',
        validatorKey: 'shared_key_1',
        verificationStatus: 'unverified'
      },
      {
        id: 'claim_true_1',
        statement: 'Bình phương của tổng đúng',
        claimType: 'formal_mathematics',
        formalExpression: '(a + b)^2 = a^2 + 2*a*b + b^2',
        validatorKey: 'shared_key_1',
        verificationStatus: 'unverified'
      }
    ];

    const result = await validator.validateClaims({
      lessonId: 'lesson_test_1',
      topicId: 'algebra.identities.seven',
      domain: 'mathematics',
      claims
    });

    const falseClaim = result.validatedClaims.find((c) => c.id === 'claim_false_1')!;
    const trueClaim = result.validatedClaims.find((c) => c.id === 'claim_true_1')!;

    assert.equal(falseClaim.formalExpressionVerified, false);
    assert.equal(falseClaim.verificationStatus, 'rejected');
    assert.equal(trueClaim.formalExpressionVerified, true);
  });

  await t.test('2. Claim B (true) -> Claim A (false) sharing validatorKey: Claim A remains unproven', async () => {
    const claims: EducationalClaimV3[] = [
      {
        id: 'claim_true_2',
        statement: 'Bình phương của tổng đúng',
        claimType: 'formal_mathematics',
        formalExpression: '(a + b)^2 = a^2 + 2*a*b + b^2',
        validatorKey: 'shared_key_2',
        verificationStatus: 'unverified'
      },
      {
        id: 'claim_false_2',
        statement: 'Bình phương của tổng sai',
        claimType: 'formal_mathematics',
        formalExpression: '(a + b)^2 = a^2 + b^2',
        validatorKey: 'shared_key_2',
        verificationStatus: 'unverified'
      }
    ];

    const result = await validator.validateClaims({
      lessonId: 'lesson_test_2',
      topicId: 'algebra.identities.seven',
      domain: 'mathematics',
      claims
    });

    const falseClaim = result.validatedClaims.find((c) => c.id === 'claim_false_2')!;
    const trueClaim = result.validatedClaims.find((c) => c.id === 'claim_true_2')!;

    assert.equal(falseClaim.formalExpressionVerified, false);
    assert.equal(falseClaim.verificationStatus, 'rejected');
    assert.equal(trueClaim.formalExpressionVerified, true);
  });

  await t.test('3. Duplicate claim IDs within a verification batch are rejected fail-closed', async () => {
    const claims: EducationalClaimV3[] = [
      {
        id: 'dup_claim_id',
        statement: 'Claim 1',
        claimType: 'formal_mathematics',
        formalExpression: '(a + b)^2 = a^2 + 2*a*b + b^2',
        verificationStatus: 'unverified'
      },
      {
        id: 'dup_claim_id',
        statement: 'Claim 2',
        claimType: 'formal_mathematics',
        formalExpression: '(a - b)^2 = a^2 - 2*a*b + b^2',
        verificationStatus: 'unverified'
      }
    ];

    await assert.rejects(
      () => validator.validateClaims({
        lessonId: 'lesson_dup',
        topicId: 'algebra.identities.seven',
        domain: 'mathematics',
        claims
      }),
      /duplicate_claim_id/
    );
  });

  await t.test('4. Forged verificationStatus and proofSummary from client are overwritten based strictly on SymPy', async () => {
    const claims: EducationalClaimV3[] = [
      {
        id: 'claim_forged',
        statement: 'Khẳng định giả mạo',
        claimType: 'formal_mathematics',
        formalExpression: '(a + b)^2 = a^2 + b^2',
        verificationStatus: 'verified' as any,
        formalProofSummary: 'Forged SymPy Proof',
        formalExpressionVerified: true
      }
    ];

    const result = await validator.validateClaims({
      lessonId: 'lesson_forged',
      topicId: 'algebra.identities.seven',
      domain: 'mathematics',
      claims
    });

    const verified = result.validatedClaims[0];
    assert.equal(verified.formalExpressionVerified, false);
    assert.equal(verified.verificationStatus, 'rejected');
    assert.equal(verified.formalProofSummary, undefined);
  });
});

test('CHECKPOINT B — Scene Mathematics Revalidation After Edits (P0)', async (t) => {
  await t.test('1. Invalid transformation step in storyboard is rejected upon draft update', async () => {
    const draftManager = new LessonDraftManagerV3();
    const draft = await draftManager.create({
      requestId: 'req_algebra_scene_integrity',
      topic: '7 hằng đẳng thức đáng nhớ',
      domain: 'mathematics',
      targetDurationSeconds: 35,
      generationMode: 'mock'
    }, 'teacher_qa');

    const firstScene = draft.lessonPlan.storyboard!.scenes[0];
    const payload = firstScene.visualPayload as any;

    const invalidPayload = {
      ...payload,
      transformationSteps: [
        { expression: payload.leftExpression, explanationVietnamese: 'Bắt đầu', highlightTerms: [] },
        { expression: 'a^2+b^2', explanationVietnamese: 'Bước trung gian sai', highlightTerms: [] },
        { expression: payload.rightExpression, explanationVietnamese: 'Khai triển', highlightTerms: [] }
      ]
    };

    await assert.rejects(
      () => draftManager.update(draft.draftId, 'teacher_qa', draft.version, {
        visualPayloads: {
          [firstScene.sceneId]: invalidPayload
        }
      }),
      /mathematical_integrity_failed|invalid_transformation_step/
    );
  });

  await t.test('2. Valid storyboard edit succeeds, passes review confirmation, and approves artifact', async () => {
    const draftManager = new LessonDraftManagerV3();
    const draft = await draftManager.create({
      requestId: 'req_algebra_scene_valid_edit',
      topic: '7 hằng đẳng thức đáng nhớ',
      domain: 'mathematics',
      targetDurationSeconds: 35,
      generationMode: 'mock'
    }, 'teacher_qa');

    // Update with a valid alternative narration
    const firstScene = draft.lessonPlan.storyboard!.scenes[0];
    const updated = await draftManager.update(draft.draftId, 'teacher_qa', draft.version, {
      narrationTexts: {
        [firstScene.sceneId]: 'Bình phương của một tổng được khai triển chính xác từng bước.'
      }
    });

    assert.equal(updated.version, draft.version + 1);

    // Confirm semantic review
    const reviewed = await draftManager.confirmSemanticReview(updated.draftId, 'teacher_qa', updated.version);
    assert.equal(reviewed.status, 'ready_for_approval');

    // Approve draft into artifact
    const approved = await draftManager.approve(reviewed.draftId, 'teacher_qa', reviewed.version, 'Sư phạm đạt chuẩn');
    assert.equal(approved.status, 'approved');
    assert.ok(approved.approvedArtifact);
  });
});

test('CHECKPOINT C — Semantic Classification Conservative Integrity (P0)', () => {
  const formal = '(a + b)^2 = a^2 + 2*a*b + b^2';

  // 1. Correct equation only
  assert.equal(
    inspectStatementSemanticConsistency('(a + b)^2 = a^2 + 2*a*b + b^2', formal).status,
    'formal_match'
  );

  // 2. Correct equation with standard prefix
  assert.equal(
    inspectStatementSemanticConsistency('Công thức: (a+b)^2 = a^2 + 2*a*b + b^2', formal).status,
    'formal_match'
  );

  // 3. Correct equation with LaTeX wrapping
  assert.equal(
    inspectStatementSemanticConsistency('$$ (a+b)^2 = a^2 + 2ab + b^2 $$', formal).status,
    'formal_match'
  );

  // 4. Correct equation followed by FALSE numeric example
  assert.equal(
    inspectStatementSemanticConsistency('(a+b)^2 = a^2 + 2*a*b + b^2. Khi a=b=1, kết quả bằng 100.', formal).status,
    'contradiction_detected'
  );

  // 5. Correct equation followed by unrelated unsupported statement
  assert.equal(
    inspectStatementSemanticConsistency('(a+b)^2 = a^2 + 2*a*b + b^2. Hằng đẳng thức này được đặt tên theo nhà toán học cổ đại.', formal).status,
    'human_review_required'
  );

  // 6. Correct equation followed by contradictory sentence
  assert.equal(
    inspectStatementSemanticConsistency('(a+b)^2 = a^2 + 2*a*b + b^2, nhưng không có số hạng 2ab.', formal).status,
    'contradiction_detected'
  );
});

