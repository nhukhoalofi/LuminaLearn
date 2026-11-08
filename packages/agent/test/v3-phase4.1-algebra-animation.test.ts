import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyTransformationChainV3,
  verifyAlgebraIdentityV3
} from '../src/orchestration/algebra-verifier-v3.js';
import { validateAlgebraSceneMath } from '../src/orchestration/knowledge-validation-v3.js';
import { EducationalPlannerV3 } from '../src/orchestration/educational-planner-v3.js';
import type { EducationalClaimV3, EducationalSceneV3 } from '@luminalearn/scene-schema';

test('Checkpoint C — Algebra Animation & Transformation Chain Proof (P0)', async (t) => {
  await t.test('1. Valid transformation steps for (a+b)^2 prove symbolic equivalence', async () => {
    const validChain = [
      '(a + b)^2',
      '(a + b)*(a + b)',
      'a*(a + b) + b*(a + b)',
      'a^2 + a*b + b*a + b^2',
      'a^2 + 2*a*b + b^2'
    ];

    const result = await verifyTransformationChainV3(validChain);
    assert.equal(result.valid, true);
  });

  await t.test('2. Tampered intermediate transformation step is detected and rejected by SymPy', async () => {
    // Endpoints are valid ((a+b)^2 = a^2+2ab+b^2), but intermediate step 2 is tampered/bogus!
    const tamperedChain = [
      '(a + b)^2',
      'a^2 + b^2', // BOGUS intermediate step!
      'a^2 + 2*a*b + b^2'
    ];

    const result = await verifyTransformationChainV3(tamperedChain);
    assert.equal(result.valid, false);
    assert.equal(result.failedStepIndex, 0);
    assert.match(result.reason!, /Invalid intermediate transformation at step 0/);
  });

  await t.test('3. validateAlgebraSceneMath rejects scene with unbound claim ID', async () => {
    const scene: EducationalSceneV3 = {
      sceneId: 'scene_algebra_1',
      sceneType: 'algebra_identity',
      title: 'Bình phương của một tổng',
      pedagogicalGoal: 'Khai triển hằng đẳng thức',
      durationSeconds: 15,
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Ta khai triển bình phương của một tổng',
        subtitleVietnamese: 'Ta khai triển bình phương của một tổng'
      },
      boundClaimIds: [], // UNBOUND!
      visualPayload: {
        sceneType: 'algebra_identity',
        identityId: 'square_sum',
        presentation: 'expansion',
        leftExpression: '(a + b)^2',
        rightExpression: 'a^2 + 2*a*b + b^2',
        transformationSteps: [
          { expression: '(a + b)^2', explanationVietnamese: 'Biểu thức ban đầu', highlightTerms: ['(a+b)^2'] },
          { expression: 'a^2 + 2*a*b + b^2', explanationVietnamese: 'Khai triển đầy đủ', highlightTerms: ['a^2', '2ab', 'b^2'] }
        ]
      }
    };

    const verifiedClaims: EducationalClaimV3[] = [
      {
        id: 'claim_1',
        claimType: 'formal_mathematics',
        statement: '(a+b)^2 = a^2 + 2*a*b + b^2',
        formalExpression: '(a+b)^2=a^2+2*a*b+b^2',
        validatorKey: 'algebra_identity_square_of_sum',
        verificationStatus: 'formally_verified'
      }
    ];

    const validation = await validateAlgebraSceneMath({ scene, verifiedClaims });
    assert.equal(validation.valid, false);
    assert.match(validation.reason!, /algebra_scene_unbound/);
  });

  await t.test('4. validateAlgebraSceneMath rejects expression mismatch against bound claim', async () => {
    const scene: EducationalSceneV3 = {
      sceneId: 'scene_algebra_1',
      sceneType: 'algebra_identity',
      title: 'Bình phương của một tổng',
      pedagogicalGoal: 'Khai triển hằng đẳng thức',
      durationSeconds: 15,
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: 'Ta khai triển',
        subtitleVietnamese: 'Ta khai triển'
      },
      boundClaimIds: ['claim_1'],
      visualPayload: {
        sceneType: 'algebra_identity',
        identityId: 'square_sum',
        presentation: 'expansion',
        leftExpression: '(a + b)^2',
        rightExpression: 'a^2 + b^2', // Mismatched right expression!
        transformationSteps: [
          { expression: '(a + b)^2', explanationVietnamese: 'Bắt đầu', highlightTerms: [] },
          { expression: 'a^2 + b^2', explanationVietnamese: 'Sai', highlightTerms: [] }
        ]
      }
    };

    const verifiedClaims: EducationalClaimV3[] = [
      {
        id: 'claim_1',
        claimType: 'formal_mathematics',
        statement: '(a+b)^2 = a^2 + 2*a*b + b^2',
        formalExpression: '(a+b)^2=a^2+2*a*b+b^2',
        validatorKey: 'algebra_identity_square_of_sum',
        verificationStatus: 'formally_verified'
      }
    ];

    const validation = await validateAlgebraSceneMath({ scene, verifiedClaims });
    assert.equal(validation.valid, false);
    assert.match(validation.reason!, /algebra_expression_mismatch/);
  });

  await t.test('5. All 7 planned algebraic identity scenes pass rigorous math verification', async () => {
    const planner = new EducationalPlannerV3();
    const plan = await planner.planLesson({
      lessonId: 'lesson_seven_identities_proof',
      topic: '7 hằng đẳng thức đáng nhớ',
      targetDurationSeconds: 40
    });

    assert.equal(plan.topicId, 'algebra.identities.seven');
    assert.ok(plan.storyboard?.scenes);
    assert.equal(plan.storyboard.scenes.length, 7);

    for (const scene of plan.storyboard.scenes) {
      const validation = await validateAlgebraSceneMath({
        scene,
        verifiedClaims: plan.educationalClaims
      });
      assert.equal(validation.valid, true, `Scene '${scene.sceneId}' failed math validation: ${validation.reason}`);
    }
  });
});
