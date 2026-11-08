import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  GeminiRequestBudget,
  LessonPlanV2Schema,
  type LessonPlanV2,
  type LessonRequestV2
} from '@luminalearn/scene-schema';
import {
  DocumentAnalyst,
  DocumentGroundingService,
  DocumentStore,
  LessonDraftManager,
  LessonOrchestrator,
  LiveGeminiAIProvider,
  MathVerificationService,
  verifyNarrationAndStoryboardMathConsistency
} from '../src/index';

function buildValidLivePlanJson(overrides: Partial<LessonPlanV2> = {}): LessonPlanV2 {
  const claimId = 'claim_polynomial_deriv';
  return LessonPlanV2Schema.parse({
    schemaVersion: 'lesson-v2',
    lessonId: 'lesson_budget_test',
    topicId: 'calculus.derivative.intuition',
    title: 'Đạo hàm của hàm bậc hai',
    learningObjectives: ['Hiểu đạo hàm của x^2 là 2x'],
    prerequisites: ['Hàm số bậc hai'],
    keyConcepts: ['Đạo hàm', 'Tiếp tuyến'],
    mathematicalClaims: [
      {
        id: claimId,
        statement: 'Đạo hàm của hàm f(x) = x^2 là 2x',
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
      boundClaimIds: [claimId]
    },
    sourceEvidence: [],
    pedagogicalSequence: [
      {
        stepNumber: 1,
        pedagogicalGoal: 'Quan sát cát tuyến',
        intuitiveConcept: 'Cát tuyến tiến dần về tiếp tuyến',
        targetDurationSeconds: 20
      }
    ],
    summary: 'Đạo hàm của x^2 bằng 2x.',
    ...overrides
  });
}

describe('Phase 1 — Gemini Request Budget & Retry Safety', () => {
  it('conservatively preserves an in-flight started attempt across restart hydration', () => {
    const beforeRestart = new GeminiRequestBudget({
      maxRequestsPerJob: 3,
      maxCurriculumRequests: 2,
      maxNarrationRequests: 2
    });
    const inFlightAttempt = beforeRestart.consume('narration_planning', 'fake-live-gemini');
    const persisted = beforeRestart.getSummary();
    assert.equal(persisted.attempts.find((attempt) => attempt.attemptId === inFlightAttempt)?.status, 'started');

    const afterRestart = new GeminiRequestBudget({ initialSummary: persisted });
    assert.equal(afterRestart.getSummary().counts.narrationPlanning, 1);
    assert.equal(afterRestart.getSummary().attempts[0].status, 'started');
    const retryAttempt = afterRestart.consume('narration_planning', 'fake-live-gemini');
    afterRestart.completeAttempt(retryAttempt, 'succeeded');

    const final = afterRestart.getSummary();
    assert.equal(final.counts.narrationPlanning, 2);
    assert.deepEqual(final.attempts.map((attempt) => attempt.status), ['started', 'succeeded']);
  });

  it('fails immediately on 401 and 403 without retrying and redacts API keys', async () => {
    const secretKey = 'AIzaSyFakeSecretTestKey123456789';
    let calls401 = 0;
    const budget401 = new GeminiRequestBudget({ maxRequestsPerJob: 4 });
    const provider401 = new LiveGeminiAIProvider({
      apiKey: secretKey,
      maxRetries: 2,
      requestBudget: budget401,
      transport: async () => {
        calls401 += 1;
        const err = new Error(`Invalid API key ${secretKey}`) as Error & { status?: number };
        err.status = 401;
        throw err;
      }
    });

    await assert.rejects(
      async () =>
        provider401.generateStructured({
          purpose: 'curriculum_planning',
          userPrompt: 'test',
          validator: (d) => d
        }),
      (err: Error) => {
        assert.match(err.message, /^gemini_authentication_failed:/);
        assert.ok(!err.message.includes(secretKey), 'API key must be redacted from error messages');
        assert.match(err.message, /\[REDACTED\]/);
        return true;
      }
    );
    assert.equal(calls401, 1);
    assert.equal(budget401.getSummary().counts.totalAllRequests, 1);

    let calls403 = 0;
    const budget403 = new GeminiRequestBudget({ maxRequestsPerJob: 4 });
    const provider403 = new LiveGeminiAIProvider({
      apiKey: secretKey,
      maxRetries: 2,
      requestBudget: budget403,
      transport: async () => {
        calls403 += 1;
        const err = new Error('Permission denied for project') as Error & { status?: number };
        err.status = 403;
        throw err;
      }
    });

    await assert.rejects(
      async () =>
        provider403.generateStructured({
          purpose: 'curriculum_planning',
          userPrompt: 'test',
          validator: (d) => d
        }),
      /gemini_permission_denied:/
    );
    assert.equal(calls403, 1);
    assert.equal(budget403.getSummary().counts.totalAllRequests, 1);
  });

  it('fails immediately on 429 quota exceeded without nested retry amplification', async () => {
    let transportCalls = 0;
    const budget = new GeminiRequestBudget({ maxRequestsPerJob: 4 });
    const provider = new LiveGeminiAIProvider({
      apiKey: 'fake-key',
      maxRetries: 2,
      requestBudget: budget,
      transport: async () => {
        transportCalls += 1;
        const err = new Error('Resource has been exhausted (e.g. check quota).') as Error & { status?: number };
        err.status = 429;
        throw err;
      }
    });

    const orchestrator = new LessonOrchestrator({
      aiProvider: provider,
      maxRetries: 2,
      requestBudget: budget
    });

    const result = await orchestrator.orchestrate({
      requestId: 'req_quota_429',
      inputMode: 'topic_prompt',
      sourceDocumentIds: [],
      topic: 'Bản chất đạo hàm của x^2',
      audience: 'Học sinh lớp 11',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'live',
      narrationMode: 'none',
      aspectRatio: '9:16'
    });

    assert.equal(result.stage, 'failed');
    assert.equal(result.error?.code, 'gemini_quota_exceeded');
    assert.equal(transportCalls, 1, '429 must fail immediately after exactly 1 transport call');
    assert.equal(result.requestBudget?.counts.totalAllRequests, 1);
  });

  it('retries transient 503 errors with bounded backoff and succeeds within budget', async () => {
    let calls = 0;
    const budget = new GeminiRequestBudget({ maxRequestsPerJob: 4, maxCurriculumRequests: 2 });
    const validPlan = buildValidLivePlanJson();

    const provider = new LiveGeminiAIProvider({
      apiKey: 'fake-key',
      maxRetries: 1,
      retryBaseDelayMs: 5,
      requestBudget: budget,
      randomFn: () => 0.5,
      transport: async () => {
        calls += 1;
        if (calls === 1) {
          const err = new Error('Service temporarily unavailable') as Error & {
            status?: number;
            headers?: Record<string, string>;
          };
          err.status = 503;
          err.headers = { 'retry-after': '0' };
          throw err;
        }
        return {
          text: JSON.stringify(validPlan),
          usage: { promptTokens: 100, candidatesTokens: 50 }
        };
      }
    });

    const res = await provider.generateStructured({
      purpose: 'curriculum_planning',
      userPrompt: 'Plan lesson',
      validator: (d) => LessonPlanV2Schema.parse(d)
    });

    assert.equal(calls, 2);
    assert.equal(res.attempts, 2);
    assert.equal(budget.getSummary().counts.totalAllRequests, 2);
    assert.equal(budget.getSummary().attempts[0].status, 'failed');
    assert.equal(budget.getSummary().attempts[1].status, 'succeeded');
  });

  it('prevents invalid JSON/schema from exceeding GEMINI_MAX_REQUESTS_PER_JOB', async () => {
    let transportCalls = 0;
    const budget = new GeminiRequestBudget({
      maxRequestsPerJob: 2,
      maxCurriculumRequests: 2,
      maxNarrationRequests: 2
    });

    const provider = new LiveGeminiAIProvider({
      apiKey: 'fake-key',
      maxRetries: 2, // Even if maxRetries is 2, schema errors must not be retried inside provider
      requestBudget: budget,
      transport: async () => {
        transportCalls += 1;
        return { text: '{"invalid_schema": true}' };
      }
    });

    const orchestrator = new LessonOrchestrator({
      aiProvider: provider,
      maxRetries: 5, // Even if orchestrator maxRetries is 5, budget cap (2) must stop calls
      requestBudget: budget
    });

    const result = await orchestrator.orchestrate({
      requestId: 'req_budget_cap',
      inputMode: 'topic_prompt',
      sourceDocumentIds: [],
      topic: 'Bản chất đạo hàm của x^2',
      audience: 'Học sinh lớp 11',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'live',
      narrationMode: 'none',
      aspectRatio: '9:16'
    });

    assert.equal(result.stage, 'failed');
    assert.equal(transportCalls, 2, 'Provider calls must stop strictly at the budget limit of 2');
    assert.equal(result.requestBudget?.counts.totalAllRequests, 2);
  });
});

describe('Phase 2 — Mathematical Statement Consistency (Cases A–F)', () => {
  const verifier = new MathVerificationService();

  it('Case A & Case C: verifies matching derivative (2*x) and integral (1/3) statements as formal_match', async () => {
    // Case A: f(x) = x^2, expected derivative 2*x, matching statement
    const derivReport = await verifier.verifyClaims('calculus.derivative.intuition', [
      {
        id: 'claim_a',
        statement: 'Đạo hàm của hàm f(x) = x^2 là 2x',
        validatorKey: 'polynomial_derivative',
        expectedExpression: '2*x',
        verificationStatus: 'unverified'
      }
    ]);
    assert.equal(derivReport.allVerified, true);
    assert.equal(derivReport.claims[0].verificationStatus, 'verified');
    assert.equal(derivReport.claims[0].statementVerification, 'formal_match');
    assert.ok(derivReport.claims[0].canonicalStatement?.includes('2*x'));

    // Case C: integral_0^1 x^2 dx = 1/3
    const integralReport = await verifier.verifyClaims('calculus.integral.riemann_sum', [
      {
        id: 'claim_c',
        statement: 'Tích phân xác định của x^2 trên đoạn [0, 1] bằng 1/3',
        validatorKey: 'definite_integral',
        expectedExpression: '1/3',
        verificationStatus: 'unverified'
      }
    ]);
    assert.equal(integralReport.allVerified, true);
    assert.equal(integralReport.claims[0].verificationStatus, 'verified');
    assert.equal(integralReport.claims[0].statementVerification, 'formal_match');
  });

  it('Case B: rejects conflicting statement ("Đạo hàm của x² bằng 999x") even when expectedExpression is "2*x"', async () => {
    const report = await verifier.verifyClaims('calculus.derivative.intuition', [
      {
        id: 'claim_b',
        statement: 'Đạo hàm của x² bằng 999x',
        validatorKey: 'polynomial_derivative',
        expectedExpression: '2*x',
        verificationStatus: 'unverified'
      }
    ]);

    assert.equal(report.allVerified, false);
    assert.equal(report.result.status, 'failed');
    assert.equal(report.claims[0].verificationStatus, 'failed');
    assert.equal(report.claims[0].statementVerification, 'conflict_detected');
  });

  it('Case D: flags subtitle/narration saying 1/2 when verified integral is 1/3', async (t) => {
    const storageRoot = mkdtempSync(join(tmpdir(), 'lumina-case-d-'));
    t.after(() => rmSync(storageRoot, { recursive: true, force: true }));
    const draftManager = new LessonDraftManager({ artifactsDir: storageRoot });

    const draft = await draftManager.createDraft({
      requestId: 'req_case_d',
      inputMode: 'topic_prompt',
      sourceDocumentIds: [],
      topic: 'Tổng Riemann và tích phân của x^2',
      audience: 'Học sinh lớp 12',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16'
    });

    assert.equal(draft.context.mathVerification?.status, 'verified');

    // Inject conflicting value 1/2 into subtitleText of a scene bound to definite_integral (1/3)
    const lastSeg = draft.context.narrationPlan!.segments.at(-1)!;
    await draftManager.updateDraft(draft.draftId, {
      narrationTexts: {
        [lastSeg.segmentId]: {
          text: lastSeg.text,
          subtitleText: 'Kết quả tích phân xác định của x² trên đoạn [0, 1] bằng 1/2.'
        }
      }
    });

    const consistency = verifyNarrationAndStoryboardMathConsistency({
      claims: draft.context.lessonPlan!.mathematicalClaims,
      storyboard: draft.context.storyboard,
      narrationPlan: draft.context.narrationPlan
    });
    assert.equal(consistency.valid, false);
    assert.ok(consistency.conflicts.some((c) => c.includes('narration_math_conflict')));

    await assert.rejects(
      async () => draftManager.approveDraft(draft.draftId),
      /narration_math_conflict/
    );
  });

  it('Case E & Case F: allows editing non-mathematical prose, invalidates approval when math statement changes, and requires semantic review confirmation for prose_unverified', async (t) => {
    const storageRoot = mkdtempSync(join(tmpdir(), 'lumina-case-ef-'));
    t.after(() => rmSync(storageRoot, { recursive: true, force: true }));
    const draftManager = new LessonDraftManager({ artifactsDir: storageRoot });

    const draft = await draftManager.createDraft({
      requestId: 'req_case_ef',
      inputMode: 'topic_prompt',
      sourceDocumentIds: [],
      topic: 'Bản chất hình học của đạo hàm',
      audience: 'Học sinh lớp 11',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16'
    });

    // Case E: Non-mathematical explanatory sentence in summary/narration remains editable
    const firstSeg = draft.context.narrationPlan!.segments[0];
    await draftManager.updateDraft(draft.draftId, {
      summary: 'Bài học giúp học sinh hình dung trực quan sự dịch chuyển của đường cát tuyến.',
      narrationTexts: {
        [firstSeg.segmentId]: {
          text: 'Chào mừng các bạn học sinh đến với bài học trực quan về tiếp tuyến và chuyển động.',
          subtitleText: 'Chào mừng các bạn đến với bài học trực quan về tiếp tuyến.'
        }
      }
    });

    const approved = await draftManager.approveDraft(draft.draftId);
    assert.equal(approved.status, 'approved');
    assert.ok(approved.approvedArtifact);

    // Case F: User edits a previously approved mathematical statement -> approval invalidated
    const claims = structuredClone(approved.context.lessonPlan!.mathematicalClaims);
    claims[0].statement = 'Đạo hàm của x^2 bằng 999x';
    const afterInvalidEdit = await draftManager.updateDraft(draft.draftId, {
      mathematicalClaims: claims
    });

    assert.equal(afterInvalidEdit.status, 'reviewing');
    assert.equal(afterInvalidEdit.approvedArtifact, undefined);
    assert.equal(afterInvalidEdit.context.mathVerification?.status, 'failed');
    await assert.rejects(
      async () => draftManager.approveDraft(draft.draftId),
      /Cannot approve draft/
    );

    // Edit statement to prose without explicit formula -> prose_unverified -> requires confirmSemanticReview
    claims[0].statement = 'Đạo hàm biểu diễn tốc độ biến thiên tức thời của hàm số đã cho';
    claims[0].humanSemanticReviewConfirmed = false;
    await draftManager.updateDraft(draft.draftId, {
      mathematicalClaims: claims
    });

    assert.equal(draft.context.mathVerification?.status, 'needs_review');
    await assert.rejects(
      async () => draftManager.approveDraft(draft.draftId),
      /Cannot approve draft/
    );

    // Confirm semantic review -> approval succeeds
    const reapproved = await draftManager.approveDraft(draft.draftId, 'Teacher reviewed prose', {
      confirmSemanticReview: true
    });
    assert.equal(reapproved.status, 'approved');
    assert.ok(reapproved.approvedArtifact);
  });
});

describe('Phase 3 — True Document Grounding & Multi-Chunk Relevance', () => {
  it('does NOT fabricate derivative 2*x when source document only mentions x^2 without stating its derivative', async () => {
    const store = new DocumentStore();
    store.saveDocument({
      documentId: 'doc_mentions_only',
      title: 'Giới thiệu đồ thị parabol',
      chunks: [
        {
          chunkId: 'chunk_parabola_1',
          documentId: 'doc_mentions_only',
          documentTitle: 'Giới thiệu đồ thị parabol',
          pageNumber: 1,
          contentType: 'text/plain',
          tokenEstimate: 20,
          metadata: {},
          text: 'Trong bài này chúng ta khảo sát đồ thị hàm số f(x) = x^2 và ý nghĩa của đạo hàm trong vật lý.'
        }
      ]
    });

    const grounding = new DocumentGroundingService(store);
    const analyst = new DocumentAnalyst(store, grounding);
    const analysis = analyst.analyze(['doc_mentions_only'], 'Đạo hàm của x^2');

    assert.equal(analysis.candidateClaims.length, 0, 'Must not fabricate 2*x claim when derivative result is not stated');
    assert.equal(analysis.evidence.length, 1);
    assert.equal(analysis.evidence[0].quoteExists, true);
    assert.equal(analysis.evidence[0].claimExtracted, false);
    assert.equal(analysis.evidence[0].supportStatus, 'needs_review');

    const orchestrator = new LessonOrchestrator({ documentStore: store });
    const result = await orchestrator.orchestrate({
      requestId: 'req_ambiguous_doc',
      inputMode: 'source_document',
      sourceDocumentIds: ['doc_mentions_only'],
      topic: 'Đạo hàm của x^2',
      audience: 'Học sinh lớp 11',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16'
    });

    assert.equal(result.stage, 'needs_review');
    assert.equal(result.error?.code, 'source_claim_unsupported');
  });

  it('selects late-appearing relevant chunks (e.g. chunk 18 of 22) and excludes unrelated documents in DocumentStore', () => {
    const store = new DocumentStore();
    const relevantChunks = Array.from({ length: 22 }, (_, index) => {
      const page = index + 1;
      const isTargetPage = page === 18;
      return {
        chunkId: `chunk_calc_${page}`,
        documentId: 'doc_large_calculus',
        documentTitle: 'Giáo trình Giải tích Toàn tập',
        pageNumber: page,
        contentType: 'text/plain' as const,
        tokenEstimate: 25,
        metadata: {},
        text: isTargetPage
          ? 'Định lý cơ bản: Đạo hàm của hàm số f(x) = x^2 là f\'(x) = 2x tại mọi điểm x.'
          : `Chương giới thiệu chung trang ${page}: Lịch sử phát triển ký hiệu toán học thế kỷ XVII.`
      };
    });

    store.saveDocument({
      documentId: 'doc_large_calculus',
      title: 'Giáo trình Giải tích Toàn tập',
      chunks: relevantChunks
    });

    // Save an unrelated document in the same store
    store.saveDocument({
      documentId: 'doc_unrelated_biology',
      title: 'Sinh học phân tử',
      chunks: [
        {
          chunkId: 'chunk_bio_1',
          documentId: 'doc_unrelated_biology',
          documentTitle: 'Sinh học phân tử',
          pageNumber: 1,
          contentType: 'text/plain',
          tokenEstimate: 20,
          metadata: {},
          text: 'Quá trình nhân đôi ADN diễn ra trong pha S của chu kỳ tế bào.'
        }
      ]
    });

    const grounding = new DocumentGroundingService(store);
    const analyst = new DocumentAnalyst(store, grounding);
    const analysis = analyst.analyze(['doc_large_calculus'], 'Đạo hàm của f(x) = x^2');
    const bundle = analyst.buildSourceContextBundle(['doc_large_calculus'], analysis, {
      maxExcerpts: 8,
      topicQuery: 'Đạo hàm của f(x) = x^2'
    });

    assert.ok(
      bundle.excerpts.some((ex) => ex.chunkId === 'chunk_calc_18' && ex.pageNumber === 18),
      'Chunk 18 containing the actual derivative evidence must be selected into the context bundle'
    );
    assert.ok(
      bundle.excerpts.every((ex) => ex.documentId === 'doc_large_calculus'),
      'Unrelated documents in DocumentStore must never be included in sourceContext'
    );
  });
});

describe('Phase 4 — Web Configuration & Approved Artifact Consistency', () => {
  it('propagates renderMode, narrationMode, visualStyleId, and subtitlesEnabled=false through draft, artifact, and manifest', async (t) => {
    const storageRoot = mkdtempSync(join(tmpdir(), 'lumina-config-sync-'));
    t.after(() => rmSync(storageRoot, { recursive: true, force: true }));
    const draftManager = new LessonDraftManager({ artifactsDir: storageRoot });

    const draft = await draftManager.createDraft({
      requestId: 'req_config_sync',
      inputMode: 'topic_prompt',
      sourceDocumentIds: [],
      topic: 'Bản chất hình học của đạo hàm',
      audience: 'Học sinh lớp 11',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16',
      visualStyleId: 'clean_educational_infographic',
      subtitlesEnabled: true
    });

    await draftManager.updateDraft(draft.draftId, {
      visualStyleId: 'math_chalkboard',
      subtitlesEnabled: false,
      narrationMode: 'none',
      renderMode: 'mock'
    });

    const approved = await draftManager.approveDraft(draft.draftId, 'Approve with subtitles disabled');
    assert.ok(approved.approvedArtifact);
    assert.equal(approved.approvedArtifact.renderConfig.visualStyleId, 'math_chalkboard');
    assert.equal(approved.approvedArtifact.renderConfig.subtitlesEnabled, false);
    assert.equal(approved.approvedArtifact.renderConfig.narrationMode, 'none');
    assert.equal(approved.context.manifest?.subtitleTrack, undefined, 'Subtitle track must be omitted when subtitlesEnabled is false');
    assert.ok(
      approved.context.manifest?.timeline.every((s) => s.parameters.visualStyleId === 'math_chalkboard'),
      'Timeline scenes must carry the selected visualStyleId'
    );
  });
});
