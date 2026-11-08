import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LessonDraftManager,
  computeArtifactContentHash,
  computeVerificationBindingHash,
  verifyArtifactIntegrity,
  DocumentGroundingService,
  DocumentStore,
  DocumentExtractor,
  LessonOrchestrator
} from '../src/orchestration';
import {
  ApprovedRenderArtifactV2Schema,
  type LessonRequestV2
} from '@luminalearn/scene-schema';

describe('Draft-to-Render Integrity & Hardening (Phase 0)', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'lumina-integrity-test-'));

  it('preserves user edits into ApprovedRenderArtifactV2 with valid SHA-256 contentHash', async () => {
    const manager = new LessonDraftManager({ artifactsDir: tempDir });
    const request: LessonRequestV2 = {
      requestId: 'req_edit_01',
      inputMode: 'topic_prompt',
      sourceDocumentIds: [],
      topic: 'Bản chất hình học của đạo hàm',
      audience: 'Học sinh lớp 12',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16'
    };

    const draft = await manager.createDraft(request);
    assert.equal(draft.version, 1);

    // Edit title and narration
    const editedTitle = 'Đạo hàm: Góc nhìn tiếp tuyến tùy chỉnh bởi giáo viên';
    const firstSceneId = draft.context.storyboard?.scenes[0].sceneId!;
    const editedNarration = 'Chào các em, đây là lời dẫn tùy chỉnh đã được kiểm duyệt.';

    await manager.updateDraft(draft.draftId, {
      title: editedTitle,
      narrationTexts: {
        [firstSceneId]: { text: editedNarration, subtitleText: editedNarration }
      }
    });

    assert.equal(draft.version, 2);
    assert.equal(draft.context.lessonPlan?.title, editedTitle);

    // Approve draft
    const approvedDraft = await manager.approveDraft(draft.draftId, 'Approved by lead teacher');
    assert.equal(approvedDraft.status, 'approved');
    assert.ok(approvedDraft.approvedArtifact);

    const artifact = approvedDraft.approvedArtifact;
    assert.equal(artifact.lessonPlan.title, editedTitle);
    assert.equal(artifact.version, 2);
    assert.ok(artifact.contentHash);
    assert.equal(artifact.contentHash.length, 64);

    // Verify first narration segment has the edited text
    const seg = artifact.narrationPlan.segments.find((s) => s.sceneId === firstSceneId);
    assert.ok(seg);
    assert.equal(seg?.text, editedNarration);

    // Verify integrity validation succeeds
    assert.equal(verifyArtifactIntegrity(artifact), true);
  });

  it('rejects a legacy artifact whose claim set contains duplicate validator keys even with recomputed hashes', async () => {
    const manager = new LessonDraftManager({ artifactsDir: tempDir });
    const draft = await manager.createDraft({ requestId: 'req_duplicate_artifact', inputMode: 'topic_prompt', sourceDocumentIds: [], topic: 'Đạo hàm là gì?', audience: 'Học sinh', language: 'vi', targetDurationSeconds: 40, renderMode: 'mock', narrationMode: 'none', aspectRatio: '9:16' });
    const artifact = structuredClone((await manager.approveDraft(draft.draftId)).approvedArtifact!);
    const duplicate = { ...artifact.verifiedClaims[0], id: 'claim_duplicate_legacy' };
    artifact.verifiedClaims.push(duplicate);
    artifact.lessonPlan.mathematicalClaims.push({ ...duplicate });
    artifact.mathSpec.boundClaimIds.push(duplicate.id);
    artifact.verificationProof.checkedClaimIds.push(duplicate.id);
    artifact.verificationProof.verificationBindingHash = computeVerificationBindingHash({ topicId: artifact.lessonPlan.topicId, mathSpec: artifact.mathSpec, verifiedClaims: artifact.verifiedClaims });
    artifact.contentHash = computeArtifactContentHash({ draftId: artifact.draftId, version: artifact.version, lessonPlan: artifact.lessonPlan, storyboard: artifact.storyboard, narrationPlan: artifact.narrationPlan, verifiedClaims: artifact.verifiedClaims, renderConfig: artifact.renderConfig, mathSpec: artifact.mathSpec, sourceReferences: artifact.sourceReferences, verificationProof: artifact.verificationProof });
    assert.equal(verifyArtifactIntegrity(artifact), false);
  });

  it('invalidates approval when draft is updated after approval', async () => {
    const manager = new LessonDraftManager({ artifactsDir: tempDir });
    const request: LessonRequestV2 = {
      requestId: 'req_inval_01',
      inputMode: 'topic_prompt',
      sourceDocumentIds: [],
      topic: 'Bản chất hình học của đạo hàm',
      audience: 'Học sinh lớp 12',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16'
    };

    const draft = await manager.createDraft(request);
    await manager.approveDraft(draft.draftId, 'Initial approval');
    assert.equal(draft.status, 'approved');
    assert.ok(draft.approvedArtifact);

    // Editing after approval MUST invalidate approval!
    await manager.updateDraft(draft.draftId, {
      title: 'Tiêu đề sau khi đã duyệt'
    });

    assert.equal(draft.status, 'reviewing');
    assert.equal(draft.approvedArtifact, undefined);
    assert.equal(draft.version, 2); // 1 (create) + 1 (updated) = 2

    const lastHistory = draft.approvalHistory[draft.approvalHistory.length - 2];
    assert.equal(lastHistory.action, 'approval_invalidated');
  });

  it('detects artifact tampering when JSON content is modified without valid hash', async () => {
    const manager = new LessonDraftManager({ artifactsDir: tempDir });
    const request: LessonRequestV2 = {
      requestId: 'req_tamper_01',
      inputMode: 'topic_prompt',
      sourceDocumentIds: [],
      topic: 'Bản chất hình học của đạo hàm',
      audience: 'Học sinh lớp 12',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16'
    };

    const draft = await manager.createDraft(request);
    await manager.approveDraft(draft.draftId);
    const originalArtifact = draft.approvedArtifact!;

    // Tamper with title
    const tamperedArtifact = JSON.parse(JSON.stringify(originalArtifact));
    tamperedArtifact.lessonPlan.title = 'Hacked Untrusted Title';

    assert.equal(verifyArtifactIntegrity(tamperedArtifact), false);

    // Tamper with mathematical claims
    const tamperedClaims = JSON.parse(JSON.stringify(originalArtifact));
    tamperedClaims.verifiedClaims[0].expectedExpression = '999*x';
    assert.equal(verifyArtifactIntegrity(tamperedClaims), false);
  });

  it('fails closed when updated mathematical claim fails SymPy verification', async () => {
    const manager = new LessonDraftManager({ artifactsDir: tempDir });
    const request: LessonRequestV2 = {
      requestId: 'req_math_fail_01',
      inputMode: 'topic_prompt',
      sourceDocumentIds: [],
      topic: 'Bản chất hình học của đạo hàm',
      audience: 'Học sinh lớp 12',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16'
    };

    const draft = await manager.createDraft(request);
    assert.ok(draft.context.lessonPlan);

    // Submit a mathematically false claim: derivative of x^2 is claimed to be 99*x
    const badClaims = [
      {
        id: 'claim_bad_deriv',
        statement: 'Đạo hàm của x^2 là 99x',
        validatorKey: 'polynomial_derivative',
        expectedExpression: '99*x',
        verificationStatus: 'unverified' as const
      }
    ];

    const updated = await manager.updateDraft(draft.draftId, {
      mathematicalClaims: badClaims
    });

    assert.equal(updated.context.stage, 'failed');
    assert.equal(updated.context.mathVerification?.status, 'failed');

    // Attempting to approve must throw an error
    await assert.rejects(
      async () => manager.approveDraft(draft.draftId),
      /Mathematical claims are not verified/
    );
  });

  it('invalidates verification when only MathSpec changes from x squared to x cubed', async () => {
    const manager = new LessonDraftManager({ artifactsDir: tempDir });
    const draft = await manager.createDraft({
      requestId: 'req_mathspec_stale_01',
      inputMode: 'topic_prompt',
      sourceDocumentIds: [],
      topic: 'Bản chất hình học của đạo hàm',
      audience: 'Học sinh lớp 12',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16'
    });
    const previousSpec = draft.context.lessonPlan!.mathSpec!;

    const updated = await manager.updateDraft(draft.draftId, {
      mathSpec: {
        ...previousSpec,
        function: { type: 'polynomial', coefficients: [0, 0, 0, 1] }
      }
    });

    assert.equal(updated.context.mathVerification?.status, 'failed');
    assert.equal(updated.context.stage, 'failed');
    assert.deepEqual(updated.context.lessonPlan?.mathSpec?.function.coefficients, [0, 0, 1]);
    await assert.rejects(
      () => manager.approveDraft(draft.draftId),
      /Mathematical claims are not verified/
    );
  });

  it('protects source references and verification proof with the artifact hash', async () => {
    const manager = new LessonDraftManager({ artifactsDir: tempDir });
    const draft = await manager.createDraft({
      requestId: 'req_proof_hash_01',
      inputMode: 'topic_prompt',
      sourceDocumentIds: [],
      topic: 'Tổng tích phân Riemann',
      audience: 'Học sinh phổ thông',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16'
    });
    await manager.approveDraft(draft.draftId);
    const artifact = draft.approvedArtifact!;

    const tamperedProof = structuredClone(artifact);
    tamperedProof.verificationProof.engine = 'Untrusted verifier';
    assert.equal(verifyArtifactIntegrity(tamperedProof), false);

    const tamperedReferences = structuredClone(artifact);
    tamperedReferences.sourceReferences.push({
      id: 'ref_tampered',
      documentId: 'doc_tampered',
      pageNumber: 1,
      exactQuote: 'Nội dung không được phê duyệt',
      relevanceScore: 1
    });
    assert.equal(verifyArtifactIntegrity(tamperedReferences), false);
  });

  it('separates exact citation matching from semantic fuzzy matching', () => {
    const store = new DocumentStore();
    store.addChunk({
      chunkId: 'chunk_doc1_p1',
      documentId: 'doc_math101',
      documentTitle: 'Giáo trình Giải tích',
      pageNumber: 1,
      text: 'Định nghĩa đạo hàm: Đạo hàm của hàm số f tại điểm x0 là giới hạn của tỉ số số gia hàm số chia cho số gia đối số.',
      contentType: 'text/plain',
      tokenEstimate: 35,
      metadata: {}
    });

    const grounding = new DocumentGroundingService(store);

    // 1. Exact substring match
    const exactResult = grounding.verifyQuoteInDocument(
      'doc_math101',
      1,
      'Định nghĩa đạo hàm: Đạo hàm của hàm số'
    );
    assert.equal(exactResult.found, true);
    assert.equal(exactResult.confidence, 1.0);
    assert.equal(exactResult.matchType, 'exact');

    const exactEvidence = grounding.buildEvidence(
      'claim_def_deriv',
      'doc_math101',
      1,
      'Định nghĩa đạo hàm: Đạo hàm của hàm số'
    );
    assert.equal(exactEvidence.evidenceFound, true);
    assert.equal(exactEvidence.matchType, 'exact');
    assert.equal(exactEvidence.isExactQuote, true);

    // 2. Semantic fuzzy match (high word overlap but not exact substring)
    const fuzzyResult = grounding.verifyQuoteInDocument(
      'doc_math101',
      1,
      'Định nghĩa đạo hàm của hàm số f tại điểm x0 là giới hạn tỉ số gia'
    );
    assert.equal(fuzzyResult.found, false); // NOT exact
    assert.equal(fuzzyResult.matchType, 'semantic');
    assert.ok(fuzzyResult.confidence >= 0.85);

    const fuzzyEvidence = grounding.buildEvidence(
      'claim_fuzzy_deriv',
      'doc_math101',
      1,
      'Định nghĩa đạo hàm của hàm số f tại điểm x0 là giới hạn tỉ số gia'
    );
    assert.equal(fuzzyEvidence.evidenceFound, false);
    assert.equal(fuzzyEvidence.matchType, 'semantic');
    assert.equal(fuzzyEvidence.isExactQuote, false);
    assert.match(fuzzyEvidence.notes || '', /khớp ngữ nghĩa|tương tự/);

    // 3. Non-existent quote
    const noneResult = grounding.verifyQuoteInDocument('doc_math101', 1, 'Hàm số lượng giác sin cos');
    assert.equal(noneResult.found, false);
    assert.equal(noneResult.matchType, 'none');
  });

  it('rejects malformed DOCX and PDF buffers with descriptive error', () => {
    // Malformed DOCX: empty or truncated buffer
    assert.throws(
      () => DocumentExtractor.extractDocx(Buffer.from('not a zip file'), 'corrupt.docx'),
      /invalid_docx/
    );

    // Malformed PDF: missing %PDF- header
    assert.throws(
      () => DocumentExtractor.extractPdf(Buffer.from('random binary garbage'), 'corrupt.pdf'),
      /invalid_pdf/
    );
  });

  it('persists approved artifacts to disk and recovers them intact', async () => {
    const manager = new LessonDraftManager({ artifactsDir: tempDir });
    const request: LessonRequestV2 = {
      requestId: 'req_persist_01',
      inputMode: 'topic_prompt',
      sourceDocumentIds: [],
      topic: 'Tổng tích phân Riemann',
      audience: 'Học sinh phổ thông',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16'
    };

    const draft = await manager.createDraft(request);
    await manager.approveDraft(draft.draftId);
    const artifactId = draft.approvedArtifact!.artifactId;
    const approvedArtifact = draft.approvedArtifact!;

    // Simulate process restart: read from disk using a fresh manager instance
    const newManager = new LessonDraftManager({ artifactsDir: tempDir });
    const loaded = await newManager.loadArtifactFromDisk(artifactId);

    assert.ok(loaded);
    assert.equal(loaded?.artifactId, artifactId);
    assert.equal(loaded?.draftId, draft.draftId);
    assert.equal(loaded?.contentHash, draft.approvedArtifact!.contentHash);
    assert.equal(newManager.getDraft(draft.draftId)?.status, 'approved');
    assert.equal(newManager.isArtifactCurrentlyApproved(approvedArtifact), true);

    await newManager.updateDraft(draft.draftId, { title: 'Bản sửa đổi sau phê duyệt' });
    assert.equal(newManager.isArtifactCurrentlyApproved(approvedArtifact), false);

    const afterSecondRestart = new LessonDraftManager({ artifactsDir: tempDir });
    assert.equal(afterSecondRestart.getDraft(draft.draftId)?.status, 'reviewing');
    assert.equal(afterSecondRestart.isArtifactCurrentlyApproved(approvedArtifact), false);
  });
});
