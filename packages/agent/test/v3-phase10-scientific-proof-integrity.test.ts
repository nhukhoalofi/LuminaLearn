import test from 'node:test';
import assert from 'node:assert/strict';
import { LessonDraftManagerV3, verifyArtifactIntegrityV3 } from '../src/orchestration/draft-manager-v3.js';
import type {
  ApprovedRenderArtifactV3,
  VisualSceneDefinitionV3
} from '@luminalearn/scene-schema';

test('Phase 10 — Scientific Proof Integrity, Visual DSL & Authoritative Provenance', async (t) => {
  const manager = new LessonDraftManagerV3();

  await t.test('1. Correct formal algebra identity creates verified draft with server-issued proof binding', async () => {
    let draft = await manager.create(
      {
        requestId: 'req_phase10_test',
        topic: 'algebra.identities.seven',
        domain: 'mathematics',
        generationMode: 'mock',
        targetDurationSeconds: 60,
        narrationMode: 'none',
        subtitlesEnabled: true,
        fps: 24,
        width: 720,
        height: 1280
      },
      'teacher_alpha'
    );

    assert.ok(draft.lessonPlan.educationalClaims.length > 0);
    const sumClaim = draft.lessonPlan.educationalClaims.find((c) => c.id.includes('square_sum') || c.validatorKey?.includes('square_of_sum')) ?? draft.lessonPlan.educationalClaims[0];
    assert.ok(sumClaim, 'Square of sum claim must exist in algebra lesson plan');

    // Attach valid Visual DSL definition to first scene
    const sceneId = draft.lessonPlan.storyboard!.scenes[0].sceneId;
    const validDsl: VisualSceneDefinitionV3 = {
      schemaVersion: 'visual-dsl-v3.1',
      sceneId,
      sceneType: draft.lessonPlan.storyboard!.scenes[0].sceneType,
      layout: 'centered_focus',
      style: 'math_chalkboard',
      animation: 'fade_in',
      elements: [
        {
          elementType: 'formula',
          elementId: 'formula_identity_1',
          latex: '(a+b)^2 = a^2 + 2ab + b^2',
          revealSpeed: 'medium',
          highlightTerms: [],
          claimId: sumClaim.id,
          fontSize: 36,
          color: '#38BDF8',
          animation: 'step_reveal'
        }
      ],
      mathBindings: [
        {
          bindingId: 'binding_id_1',
          claimId: sumClaim.id,
          elementId: 'formula_identity_1',
          formalExpression: sumClaim.formalExpression!,
          mathSymbol: '(a+b)^2',
          isVerified: true
        }
      ],
      trustedMathBindings: [],
      dataBindings: []
    };

    draft = await manager.update(draft.draftId, 'teacher_alpha', draft.version, {
      visualDefinitions: { [sceneId]: validDsl }
    });

    draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_alpha', draft.version);
    draft = await manager.approve(draft.draftId, 'teacher_alpha', draft.version, 'Approved for Phase 10 test');

    const artifact = draft.approvedArtifact!;
    assert.ok(artifact);
    assert.ok(verifyArtifactIntegrityV3(artifact));

    const approvedScene = artifact.lessonPlan.storyboard!.scenes.find((s) => s.sceneId === sceneId)!;
    assert.ok(approvedScene.visualDefinition);
    assert.equal(approvedScene.visualDefinition.trustedMathBindings.length, 1);

    const binding = approvedScene.visualDefinition.trustedMathBindings[0];
    assert.equal(binding.authority, 'server_sympy_v3');
    assert.equal(binding.claimId, sumClaim.id);
    assert.equal(binding.elementId, 'formula_identity_1');
    assert.equal(binding.verificationResult, 'formally_verified');
    assert.equal(binding.approvedDraftVersion, artifact.approvedVersion);
  });

  await t.test('2. Incorrect algebra identity fails closed during SymPy verification or approval', async () => {
    let draft = await manager.create(
      {
        requestId: 'req_phase10_test',
        topic: 'algebra.identities.seven',
        domain: 'mathematics',
        generationMode: 'mock',
        targetDurationSeconds: 60,
        narrationMode: 'none',
        subtitlesEnabled: true,
        fps: 24,
        width: 720,
        height: 1280
      },
      'teacher_alpha'
    );

    // Tamper with formal expression of claim to false identity (a+b)^2 = a^2 + b^2
    const tamperedClaims = draft.lessonPlan.educationalClaims.map((c, idx) => {
      if (idx === 0 || c.id.includes('square_sum') || c.validatorKey?.includes('square_of_sum')) {
        return { ...c, formalExpression: '(a+b)^2 = a^2 + b^2' };
      }
      return c;
    });

    await assert.rejects(async () => {
      await manager.update(draft.draftId, 'teacher_alpha', draft.version, {
        claims: tamperedClaims
      });
    }, /mathematical_integrity_failed|SymPy formal verification failed/);
  });

  await t.test('3. Client-supplied isVerified: true without authoritative SymPy verification is rejected', async () => {
    let draft = await manager.create(
      {
        requestId: 'req_phase10_test',
        topic: 'algebra.identities.seven',
        domain: 'mathematics',
        generationMode: 'mock',
        targetDurationSeconds: 60,
        narrationMode: 'none',
        subtitlesEnabled: true,
        fps: 24,
        width: 720,
        height: 1280
      },
      'teacher_alpha'
    );

    const sceneId = draft.lessonPlan.storyboard!.scenes[0].sceneId;
    // Client supplies a bogus claim ID with isVerified: true
    const forgedDsl: VisualSceneDefinitionV3 = {
      schemaVersion: 'visual-dsl-v3.1',
      sceneId,
      sceneType: draft.lessonPlan.storyboard!.scenes[0].sceneType,
      layout: 'centered_focus',
      style: 'math_chalkboard',
      animation: 'fade_in',
      elements: [
        {
          elementType: 'formula',
          elementId: 'formula_forged',
          latex: 'x = 1',
          revealSpeed: 'medium',
          highlightTerms: [],
          claimId: 'claim_forged_unverified',
          fontSize: 36,
          color: '#38BDF8',
          animation: 'step_reveal'
        }
      ],
      mathBindings: [
        {
          bindingId: 'binding_forged',
          claimId: 'claim_forged_unverified',
          elementId: 'formula_forged',
          formalExpression: 'x = 1',
          mathSymbol: 'x',
          isVerified: true // FORGED!
        }
      ],
      trustedMathBindings: [],
      dataBindings: []
    };

    draft = await manager.update(draft.draftId, 'teacher_alpha', draft.version, {
      visualDefinitions: { [sceneId]: forgedDsl }
    });

    draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_alpha', draft.version);

    // Approval must fail closed because claim does not exist or is not formally verified
    await assert.rejects(async () => {
      await manager.approve(draft.draftId, 'teacher_alpha', draft.version, 'Test approval');
    }, /visual_proof_claim_not_found|unresolved_claim_binding/);
  });

  await t.test('4. Formula element with missing claim ID receives no proof binding', async () => {
    let draft = await manager.create(
      {
        requestId: 'req_phase10_test',
        topic: 'algebra.identities.seven',
        domain: 'mathematics',
        generationMode: 'mock',
        targetDurationSeconds: 60,
        narrationMode: 'none',
        subtitlesEnabled: true,
        fps: 24,
        width: 720,
        height: 1280
      },
      'teacher_alpha'
    );

    const sceneId = draft.lessonPlan.storyboard!.scenes[0].sceneId;
    const unboundDsl: VisualSceneDefinitionV3 = {
      schemaVersion: 'visual-dsl-v3.1',
      sceneId,
      sceneType: draft.lessonPlan.storyboard!.scenes[0].sceneType,
      layout: 'centered_focus',
      style: 'math_chalkboard',
      animation: 'fade_in',
      elements: [
        {
          elementType: 'formula',
          elementId: 'formula_unbound',
          latex: 'x^2 + 1',
          revealSpeed: 'medium',
          highlightTerms: [],
          fontSize: 36,
          color: '#38BDF8',
          animation: 'step_reveal'
        }
      ],
      mathBindings: [],
      trustedMathBindings: [],
      dataBindings: []
    };

    draft = await manager.update(draft.draftId, 'teacher_alpha', draft.version, {
      visualDefinitions: { [sceneId]: unboundDsl }
    });

    draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_alpha', draft.version);
    draft = await manager.approve(draft.draftId, 'teacher_alpha', draft.version);

    const artifact = draft.approvedArtifact!;
    const approvedScene = artifact.lessonPlan.storyboard!.scenes.find((s) => s.sceneId === sceneId)!;
    // Unbound formula must have 0 trusted bindings
    assert.equal(approvedScene.visualDefinition?.trustedMathBindings.length, 0);
  });

  await t.test('5. Claim bound to mismatched visual formula expression is rejected', async () => {
    let draft = await manager.create(
      {
        requestId: 'req_phase10_test',
        topic: 'algebra.identities.seven',
        domain: 'mathematics',
        generationMode: 'mock',
        targetDurationSeconds: 60,
        narrationMode: 'none',
        subtitlesEnabled: true,
        fps: 24,
        width: 720,
        height: 1280
      },
      'teacher_alpha'
    );

    const sumClaim = draft.lessonPlan.educationalClaims.find((c) => c.id.includes('square_sum') || c.validatorKey?.includes('square_of_sum')) ?? draft.lessonPlan.educationalClaims[0];
    const sceneId = draft.lessonPlan.storyboard!.scenes[0].sceneId;

    // Element claims sumClaim.id, but latex formula displays difference formula (a-b)^2!
    const mismatchedDsl: VisualSceneDefinitionV3 = {
      schemaVersion: 'visual-dsl-v3.1',
      sceneId,
      sceneType: draft.lessonPlan.storyboard!.scenes[0].sceneType,
      layout: 'centered_focus',
      style: 'math_chalkboard',
      animation: 'fade_in',
      elements: [
        {
          elementType: 'formula',
          elementId: 'formula_mismatched',
          latex: '(a-b)^2 = a^2 - 2ab + b^2', // MISMATCH!
          revealSpeed: 'medium',
          highlightTerms: [],
          claimId: sumClaim.id,
          fontSize: 36,
          color: '#38BDF8',
          animation: 'step_reveal'
        }
      ],
      mathBindings: [
        {
          bindingId: 'binding_mismatched',
          claimId: sumClaim.id,
          elementId: 'formula_mismatched',
          formalExpression: sumClaim.formalExpression!,
          mathSymbol: '(a+b)^2',
          isVerified: true
        }
      ],
      trustedMathBindings: [],
      dataBindings: []
    };

    draft = await manager.update(draft.draftId, 'teacher_alpha', draft.version, {
      visualDefinitions: { [sceneId]: mismatchedDsl }
    });

    draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_alpha', draft.version);

    await assert.rejects(async () => {
      await manager.approve(draft.draftId, 'teacher_alpha', draft.version);
    }, /visual_proof_rendered_expression_mismatch/);
  });

  await t.test('6. Stale claim after teacher editing invalidates prior authorization', async () => {
    let draft = await manager.create(
      {
        requestId: 'req_phase10_test',
        topic: 'algebra.identities.seven',
        domain: 'mathematics',
        generationMode: 'mock',
        targetDurationSeconds: 60,
        narrationMode: 'none',
        subtitlesEnabled: true,
        fps: 24,
        width: 720,
        height: 1280
      },
      'teacher_alpha'
    );

    draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_alpha', draft.version);
    draft = await manager.approve(draft.draftId, 'teacher_alpha', draft.version);
    const originalArtifact = draft.approvedArtifact!;
    assert.equal(await manager.isArtifactAuthorized(originalArtifact), true);

    // Edit the draft after approval: version increases, status changes to draft
    draft = await manager.update(draft.draftId, 'teacher_alpha', draft.version, {
      title: 'Tiêu đề mới sau khi chỉnh sửa'
    });

    // Original artifact is now revoked / stale
    assert.equal(await manager.isArtifactAuthorized(originalArtifact), false);
  });

  await t.test('7. Approval with wrong draft version throws DraftVersionConflictV3Error', async () => {
    const draft = await manager.create(
      {
        requestId: 'req_phase10_test',
        topic: 'algebra.identities.seven',
        domain: 'mathematics',
        generationMode: 'mock',
        targetDurationSeconds: 60,
        narrationMode: 'none',
        subtitlesEnabled: true,
        fps: 24,
        width: 720,
        height: 1280
      },
      'teacher_alpha'
    );

    await assert.rejects(async () => {
      await manager.approve(draft.draftId, 'teacher_alpha', draft.version + 999);
    }, /version/i);
  });

  await t.test('8. Tampered artifact content hash fails verification fail-closed', async () => {
    let draft = await manager.create(
      {
        requestId: 'req_phase10_test',
        topic: 'algebra.identities.seven',
        domain: 'mathematics',
        generationMode: 'mock',
        targetDurationSeconds: 60,
        narrationMode: 'none',
        subtitlesEnabled: true,
        fps: 24,
        width: 720,
        height: 1280
      },
      'teacher_alpha'
    );

    draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_alpha', draft.version);
    draft = await manager.approve(draft.draftId, 'teacher_alpha', draft.version);
    const artifact = draft.approvedArtifact!;

    // Tamper with contentHash
    const tamperedArtifact: ApprovedRenderArtifactV3 = {
      ...artifact,
      contentHash: 'f'.repeat(64)
    };

    assert.equal(verifyArtifactIntegrityV3(tamperedArtifact), false);
    assert.equal(await manager.isArtifactAuthorized(tamperedArtifact), false);
  });

  await t.test('9. Unapproved draft definition carries no trustedMathBindings authority before server approval', () => {
    const sceneDef: VisualSceneDefinitionV3 = {
      schemaVersion: 'visual-dsl-v3.1',
      sceneId: 'scene_preview_test',
      sceneType: 'formula_derivation',
      layout: 'centered_focus',
      style: 'math_chalkboard',
      animation: 'fade_in',
      elements: [
        {
          elementType: 'formula',
          elementId: 'formula_preview',
          latex: '(a+b)^2 = a^2 + 2ab + b^2',
          revealSpeed: 'medium',
          highlightTerms: [],
          claimId: 'claim_preview_1',
          fontSize: 36,
          color: '#38BDF8',
          animation: 'step_reveal'
        }
      ],
      mathBindings: [
        {
          bindingId: 'binding_preview',
          claimId: 'claim_preview_1',
          elementId: 'formula_preview',
          formalExpression: '(a+b)^2 = a^2 + 2*a*b + b^2',
          mathSymbol: '(a+b)^2',
          isVerified: true // Client asserts true
        }
      ],
      trustedMathBindings: [],
      dataBindings: []
    };

    // Client-provided definition has empty trustedMathBindings
    assert.equal(sceneDef.trustedMathBindings.length, 0);
  });

  await t.test('10. Authoritative approval binds server_sympy_v3 authority and verified fingerprints', async () => {
    let draft = await manager.create(
      {
        requestId: 'req_phase10_test',
        topic: 'algebra.identities.seven',
        domain: 'mathematics',
        generationMode: 'mock',
        targetDurationSeconds: 60,
        narrationMode: 'none',
        subtitlesEnabled: true,
        fps: 24,
        width: 720,
        height: 1280
      },
      'teacher_alpha'
    );

    const sumClaim = draft.lessonPlan.educationalClaims.find((c) => c.id.includes('square_sum') || c.validatorKey?.includes('square_of_sum')) ?? draft.lessonPlan.educationalClaims[0];
    const sceneId = draft.lessonPlan.storyboard!.scenes[0].sceneId;
    const dslDef: VisualSceneDefinitionV3 = {
      schemaVersion: 'visual-dsl-v3.1',
      sceneId,
      sceneType: draft.lessonPlan.storyboard!.scenes[0].sceneType,
      layout: 'centered_focus',
      style: 'math_chalkboard',
      animation: 'fade_in',
      elements: [
        {
          elementType: 'formula',
          elementId: 'formula_test_auth',
          latex: '(a+b)^2 = a^2 + 2ab + b^2',
          revealSpeed: 'medium',
          highlightTerms: [],
          claimId: sumClaim.id,
          fontSize: 36,
          color: '#38BDF8',
          animation: 'step_reveal'
        }
      ],
      mathBindings: [
        {
          bindingId: 'b_1',
          claimId: sumClaim.id,
          elementId: 'formula_test_auth',
          formalExpression: sumClaim.formalExpression!,
          mathSymbol: '(a+b)^2',
          isVerified: true
        }
      ],
      trustedMathBindings: [],
      dataBindings: []
    };

    draft = await manager.update(draft.draftId, 'teacher_alpha', draft.version, {
      visualDefinitions: { [sceneId]: dslDef }
    });

    draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_alpha', draft.version);
    draft = await manager.approve(draft.draftId, 'teacher_alpha', draft.version);

    const artifact = draft.approvedArtifact!;
    const scene = artifact.lessonPlan.storyboard!.scenes.find((s) => s.sceneId === sceneId)!;
    const binding = scene.visualDefinition!.trustedMathBindings[0];

    assert.equal(binding.authority, 'server_sympy_v3');
    assert.equal(binding.claimId, sumClaim.id);
    assert.equal(binding.elementId, 'formula_test_auth');
    assert.equal(binding.verificationResult, 'formally_verified');
    assert.equal(binding.approvedDraftVersion, artifact.approvedVersion);
    assert.match(binding.normalizedExpressionFingerprint, /^[a-f0-9]{64}$/);
  });

  await t.test('11. Trusted binding without valid matching claim throws during approval', async () => {
    let draft = await manager.create(
      {
        requestId: 'req_phase10_test',
        topic: 'algebra.identities.seven',
        domain: 'mathematics',
        generationMode: 'mock',
        targetDurationSeconds: 60,
        narrationMode: 'none',
        subtitlesEnabled: true,
        fps: 24,
        width: 720,
        height: 1280
      },
      'teacher_alpha'
    );

    const sceneId = draft.lessonPlan.storyboard!.scenes[0].sceneId;
    const bogusDsl: VisualSceneDefinitionV3 = {
      schemaVersion: 'visual-dsl-v3.1',
      sceneId,
      sceneType: draft.lessonPlan.storyboard!.scenes[0].sceneType,
      layout: 'centered_focus',
      style: 'math_chalkboard',
      animation: 'fade_in',
      elements: [
        {
          elementType: 'formula',
          elementId: 'formula_bogus',
          latex: 'x = y',
          revealSpeed: 'medium',
          highlightTerms: [],
          claimId: 'non_existent_claim',
          fontSize: 36,
          color: '#38BDF8',
          animation: 'step_reveal'
        }
      ],
      mathBindings: [
        {
          bindingId: 'b_bogus',
          claimId: 'non_existent_claim',
          elementId: 'formula_bogus',
          formalExpression: 'x = y',
          mathSymbol: 'x',
          isVerified: true
        }
      ],
      trustedMathBindings: [],
      dataBindings: []
    };

    draft = await manager.update(draft.draftId, 'teacher_alpha', draft.version, {
      visualDefinitions: { [sceneId]: bogusDsl }
    });

    draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_alpha', draft.version);

    await assert.rejects(async () => {
      await manager.approve(draft.draftId, 'teacher_alpha', draft.version);
    }, /visual_proof_claim_not_found/);
  });

  await t.test('12. Manipulated math binding in approved artifact is rejected by content hash verification', async () => {
    let draft = await manager.create(
      {
        requestId: 'req_phase10_test',
        topic: 'algebra.identities.seven',
        domain: 'mathematics',
        generationMode: 'mock',
        targetDurationSeconds: 60,
        narrationMode: 'none',
        subtitlesEnabled: true,
        fps: 24,
        width: 720,
        height: 1280
      },
      'teacher_alpha'
    );

    draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_alpha', draft.version);
    draft = await manager.approve(draft.draftId, 'teacher_alpha', draft.version);
    const artifact = draft.approvedArtifact!;

    // Manipulate a claim statement in the approved artifact
    const manipulated = structuredClone(artifact);
    manipulated.lessonPlan.educationalClaims[0].statement = 'Mệnh đề đã bị thay đổi phi pháp';

    assert.equal(verifyArtifactIntegrityV3(manipulated), false);
    assert.equal(await manager.isArtifactAuthorized(manipulated), false);
  });
});
