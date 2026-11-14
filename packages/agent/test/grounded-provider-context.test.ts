import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LessonPlanV2Schema,
  NarrationPlanV2Schema,
  StoryboardV2Schema,
  type LessonPlanV2,
  type NarrationPlanV2
} from '@luminalearn/scene-schema';
import { CurriculumPlanner } from '../src/orchestration/curriculum-planner';
import { NarrationPlannerV2 } from '../src/orchestration/narration-planner';
import { DocumentGroundingService, DocumentStore } from '../src/orchestration/document-grounding';
import { LessonOrchestrator } from '../src/orchestration/orchestrator';
import type { AIProvider, AIStructuredRequest, AIProviderResult } from '../src/orchestration/ai-provider';
import type { SourceContextBundle, TopicClassification } from '../src/orchestration/types';
import { LessonDraftManager } from '../src/orchestration/draft-manager';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

class CapturingProvider implements AIProvider {
  readonly isMock = false;
  readonly requests: AIStructuredRequest<unknown>[] = [];
  constructor(private readonly responses: Record<string, unknown>) {}
  async generateStructured<T>(request: AIStructuredRequest<T>): Promise<AIProviderResult<T>> {
    this.requests.push(request as AIStructuredRequest<unknown>);
    return {
      data: request.validator(this.responses[request.purpose]),
      mode: 'ai_generated_live', model: 'fake-gemini', usage: { promptTokens: 123, candidatesTokens: 45 }
    };
  }
}

class FailOnceNarrationProvider implements AIProvider {
  readonly isMock = false;
  readonly requests: AIStructuredRequest<unknown>[] = [];
  private narrationAttempts = 0;
  private retryStartedResolve!: () => void;
  private retryReleaseResolve!: () => void;
  readonly retryStarted = new Promise<void>((resolvePromise) => { this.retryStartedResolve = resolvePromise; });
  private readonly retryRelease = new Promise<void>((resolvePromise) => { this.retryReleaseResolve = resolvePromise; });
  constructor(private readonly curriculum: unknown, private readonly narration: unknown) {}
  releaseRetry(): void { this.retryReleaseResolve(); }
  async generateStructured<T>(request: AIStructuredRequest<T>): Promise<AIProviderResult<T>> {
    this.requests.push(request as AIStructuredRequest<unknown>);
    if (request.purpose === 'narration_planning' && this.narrationAttempts++ === 0) {
      throw new Error('fake_narration_failure_after_request');
    }
    if (request.purpose === 'narration_planning' && this.narrationAttempts === 2) {
      this.retryStartedResolve();
      await this.retryRelease;
    }
    const data = request.purpose === 'curriculum_planning' ? this.curriculum : this.narration;
    return { data: request.validator(data), mode: 'ai_generated_live', model: 'fake-live-gemini' };
  }
}

const topicInfo: TopicClassification = {
  topicId: 'calculus.derivative.intuition', displayName: 'Đạo hàm', domain: 'calculus', confidence: 1,
  supportedTemplates: ['function_graph', 'secant_to_tangent'],
  requiredValidators: ['polynomial_derivative'], isSupported: true
};

function plan(options: { expression?: string; verified?: boolean; quote?: string; documentId?: string } = {}): LessonPlanV2 {
  const claimId = 'claim_source';
  return LessonPlanV2Schema.parse({
    schemaVersion: 'lesson-v2', lessonId: 'lesson_source', topicId: topicInfo.topicId, title: 'Đạo hàm từ tài liệu',
    learningObjectives: ['Hiểu đạo hàm'], prerequisites: [], keyConcepts: ['Đạo hàm'],
    mathematicalClaims: [{ id: claimId, statement: 'Đạo hàm của x^2 là 2x', validatorKey: 'polynomial_derivative', expectedExpression: options.expression ?? '2*x', verificationStatus: options.verified ? 'verified' : 'unverified' }],
    mathSpec: { topicId: topicInfo.topicId, visualization: 'secant_to_tangent', function: { type: 'polynomial', coefficients: [0, 0, 1] }, parameters: { pointX: 1, hStart: 2, hEnd: 0.05 }, boundClaimIds: [claimId] },
    sourceEvidence: [{ evidenceId: 'ev_source', claimId, sourceReference: { id: 'ref_source', documentId: options.documentId ?? 'doc_source', pageNumber: 2, exactQuote: options.quote ?? 'Đạo hàm của x^2 là 2x.', relevanceScore: 1 }, evidenceFound: true, evidenceMatchConfidence: 1, matchType: 'exact', isExactQuote: true }],
    pedagogicalSequence: [{ stepNumber: 1, pedagogicalGoal: 'Giải thích', intuitiveConcept: 'Quan sát cát tuyến', targetDurationSeconds: 20 }, { stepNumber: 2, pedagogicalGoal: 'Kết luận', intuitiveConcept: 'Tiếp tuyến', targetDurationSeconds: 20 }], summary: 'Đạo hàm là độ dốc.'
  });
}

const sourceContext: SourceContextBundle = {
  trust: 'untrusted_document_content', documentIds: ['doc_source'],
  excerpts: [{ documentId: 'doc_source', chunkId: 'chunk_source', pageNumber: 2, text: 'Đạo hàm của x^2 là 2x.' }],
  candidateClaims: [{ claimStatement: 'Đạo hàm của x^2 là 2x', validatorKey: 'polynomial_derivative', expectedExpression: '2*x', quote: 'Đạo hàm của x^2 là 2x.', pageNumber: 2, documentId: 'doc_source' }],
  exactMatchEvidence: plan().sourceEvidence
};

test('live curriculum request contains bounded untrusted excerpts, routing constraints, and provider metadata', async () => {
  const provider = new CapturingProvider({ curriculum_planning: plan() });
  const traces: unknown[] = [];
  await new CurriculumPlanner().plan({ lessonId: 'lesson_source', topicInfo, audience: 'Học sinh', targetDurationSeconds: 40, documentAnalysis: { documentIds: ['doc_source'], totalChunks: 1, extractedConcepts: ['Đạo hàm'], candidateClaims: sourceContext.candidateClaims, evidence: sourceContext.exactMatchEvidence }, sourceContext, aiProvider: provider, onProviderCall: (trace) => traces.push(trace) });
  const request = provider.requests[0];
  assert.match(request.userPrompt, /UNTRUSTED SOURCE CONTEXT/);
  assert.match(request.userPrompt, /chunk_source/);
  assert.match(request.userPrompt, /secant_to_tangent/);
  assert.match(request.systemPrompt ?? '', /Never set mathematicalClaims\.verificationStatus to verified/);
  assert.deepEqual(traces, [{ purpose: 'curriculum_planning', mode: 'ai_generated_live', model: 'fake-gemini', promptTokens: 123, candidatesTokens: 45 }]);
});

test('Gemini cannot self-verify mathematical claims', async () => {
  const provider = new CapturingProvider({ curriculum_planning: plan({ verified: true }) });
  await assert.rejects(() => new CurriculumPlanner().plan({ lessonId: 'lesson_source', topicInfo, audience: 'Học sinh', targetDurationSeconds: 40, sourceContext, documentAnalysis: { documentIds: ['doc_source'], totalChunks: 1, extractedConcepts: [], candidateClaims: [], evidence: [] }, aiProvider: provider }), /provider_self_verification_rejected/);
});

test('live narration request receives verified claims, exact references, scene IDs, and goals', async () => {
  const verifiedPlan = plan({ verified: true });
  const storyboard = StoryboardV2Schema.parse({ storyboardId: 'sb_source', lessonId: verifiedPlan.lessonId, topicId: verifiedPlan.topicId, scenes: [
    { sceneId: 'scene_intro', templateId: 'function_graph', sceneType: 'intro', durationFrames: 240, parameters: { title: 'Mở bài' }, layout: { aspectRatio: '9:16', safeAreaPadding: 48 }, mathematicalBinding: { boundClaimIds: [], latexFormulas: [] }, sourceReferenceIds: [] },
    { sceneId: 'scene_summary', templateId: 'function_graph', sceneType: 'summary', durationFrames: 240, parameters: { title: 'Kết luận' }, layout: { aspectRatio: '9:16', safeAreaPadding: 48 }, mathematicalBinding: { boundClaimIds: ['claim_source'], latexFormulas: ['2x'] }, sourceReferenceIds: ['ref_source'] }
  ], visualTemplateIds: ['function_graph'], mathematicalData: {}, narrationObjectives: [], estimatedDurationFrames: 480, sourceReferences: ['ref_source'] });
  const narration: NarrationPlanV2 = NarrationPlanV2Schema.parse({ planId: 'narr_source', storyboardId: storyboard.storyboardId, language: 'vi', segments: [
    { segmentId: 'seg_intro', sceneId: 'scene_intro', text: 'Mở bài.', subtitleText: 'Mở bài.', targetDurationSeconds: 10, pronunciationHints: [] },
    { segmentId: 'seg_summary', sceneId: 'scene_summary', text: 'Đạo hàm là hai x.', subtitleText: 'f phẩy bằng 2x.', targetDurationSeconds: 10, pronunciationHints: [] }
  ], totalWords: 8, estimatedDurationSeconds: 20, mathematicalReview: { status: 'verified', verifiedClaimIds: ['claim_source'] } });
  const provider = new CapturingProvider({ narration_planning: narration });
  await new NarrationPlannerV2().plan({ planId: narration.planId, lessonPlan: verifiedPlan, storyboard, aiProvider: provider });
  assert.match(provider.requests[0].userPrompt, /claim_source/);
  assert.match(provider.requests[0].userPrompt, /ref_source/);
  assert.match(provider.requests[0].userPrompt, /scene_summary/);
  assert.match(provider.requests[0].userPrompt, /Kết luận/);
});

test('live narration rejects an incomplete independently verified claim review', async () => {
  const verifiedPlan = plan({ verified: true });
  const storyboard = StoryboardV2Schema.parse({ storyboardId: 'sb_claim_review', lessonId: verifiedPlan.lessonId, topicId: verifiedPlan.topicId, scenes: [
    { sceneId: 'scene_intro', templateId: 'function_graph', sceneType: 'intro', durationFrames: 240, parameters: { title: 'Mở bài' }, layout: { aspectRatio: '9:16', safeAreaPadding: 48 }, mathematicalBinding: { boundClaimIds: [], latexFormulas: [] }, sourceReferenceIds: [] },
    { sceneId: 'scene_only', templateId: 'function_graph', sceneType: 'summary', durationFrames: 240, parameters: { title: 'Kết luận' }, layout: { aspectRatio: '9:16', safeAreaPadding: 48 }, mathematicalBinding: { boundClaimIds: ['claim_source'], latexFormulas: ['2x'] }, sourceReferenceIds: ['ref_source'] }
  ], visualTemplateIds: ['function_graph'], mathematicalData: {}, narrationObjectives: [], estimatedDurationFrames: 480, sourceReferences: ['ref_source'] });
  const incomplete = NarrationPlanV2Schema.parse({ planId: 'narr_incomplete', storyboardId: storyboard.storyboardId, language: 'vi', segments: [
    { segmentId: 'seg_intro', sceneId: 'scene_intro', text: 'Mở bài.', subtitleText: 'Mở bài.', targetDurationSeconds: 10, pronunciationHints: [] },
    { segmentId: 'seg_only', sceneId: 'scene_only', text: 'Đạo hàm bằng hai x.', subtitleText: "f'(x)=2x", targetDurationSeconds: 10, pronunciationHints: [] }
  ], totalWords: 5, estimatedDurationSeconds: 10, mathematicalReview: { status: 'verified', verifiedClaimIds: [] } });
  await assert.rejects(
    () => new NarrationPlannerV2().plan({ planId: incomplete.planId, lessonPlan: verifiedPlan, storyboard, aiProvider: new CapturingProvider({ narration_planning: incomplete }) }),
    /narration_claim_mismatch/
  );
});

test('orchestration uses a real stored excerpt through planning, SymPy, storyboard, and narration', async () => {
  const store = new DocumentStore();
  store.addChunk({ chunkId: 'chunk_source', documentId: 'doc_source', documentTitle: 'Nguồn', pageNumber: 2, text: 'Đạo hàm của x^2 là 2x.', contentType: 'text/plain', tokenEstimate: 8, metadata: {} });
  const validPlan = plan();
  const integratedNarration = NarrationPlanV2Schema.parse({
    planId: 'narr_integrated', storyboardId: 'sb_req_integrated', language: 'vi',
    segments: [
      { segmentId: 'seg_intro', sceneId: 'scene_1_function_graph', text: 'Mở bài về đạo hàm.', subtitleText: 'Mở bài về đạo hàm.', targetDurationSeconds: 20, pronunciationHints: [] },
      { segmentId: 'seg_summary', sceneId: 'scene_2_function_graph', text: 'Đạo hàm của x bình phương bằng hai x.', subtitleText: "f'(x)=2x", targetDurationSeconds: 20, pronunciationHints: [] }
    ], totalWords: 14, estimatedDurationSeconds: 40,
    mathematicalReview: { status: 'verified', verifiedClaimIds: ['claim_source'] }
  });
  const provider = new CapturingProvider({ curriculum_planning: validPlan, narration_planning: integratedNarration });
  const result = await new LessonOrchestrator({ documentStore: store, aiProvider: provider }).orchestrate({
    requestId: 'req_integrated', inputMode: 'source_document', sourceDocumentIds: ['doc_source'], topic: 'Đạo hàm của x^2',
    audience: 'Học sinh', language: 'vi', targetDurationSeconds: 40, renderMode: 'live', narrationMode: 'none', aspectRatio: '9:16'
  });
  assert.equal(result.stage, 'ready_to_render');
  assert.equal(result.mathVerification?.status, 'verified');
  assert.equal(result.sourceContext?.excerpts[0].text, 'Đạo hàm của x^2 là 2x.');
  assert.deepEqual(provider.requests.map((request) => request.purpose), ['curriculum_planning', 'narration_planning']);
});

test('empty source and invalid provider schema fail closed with bounded revision attempts', async () => {
  const emptyProvider = new CapturingProvider({ curriculum_planning: plan() });
  const empty = await new LessonOrchestrator({ documentStore: new DocumentStore(), aiProvider: emptyProvider }).orchestrate({
    requestId: 'req_empty_source', inputMode: 'source_document', sourceDocumentIds: ['doc_empty'], topic: 'Đạo hàm',
    audience: 'Học sinh', language: 'vi', targetDurationSeconds: 40, renderMode: 'live', narrationMode: 'none', aspectRatio: '9:16'
  });
  assert.equal(empty.error?.code, 'source_evidence_missing');
  assert.equal(emptyProvider.requests.length, 0);

  const invalidProvider = new CapturingProvider({ curriculum_planning: { schemaVersion: 'not-a-lesson' } });
  const invalid = await new LessonOrchestrator({ aiProvider: invalidProvider, maxRetries: 2 }).orchestrate({
    requestId: 'req_invalid_schema', inputMode: 'topic_prompt', sourceDocumentIds: [], topic: 'Đạo hàm',
    audience: 'Học sinh', language: 'vi', targetDurationSeconds: 40, renderMode: 'live', narrationMode: 'none', aspectRatio: '9:16'
  });
  assert.equal(invalid.error?.code, 'planning_failed');
  assert.equal(invalid.retryCount, 2);
  assert.equal(invalidProvider.requests.length, 3);
});

test('orchestration rejects fabricated citations, invalid math, and unsupported topics before narration', async () => {
  const store = new DocumentStore();
  store.addChunk({ chunkId: 'chunk_source', documentId: 'doc_source', documentTitle: 'Nguồn', pageNumber: 2, text: 'Đạo hàm của x^2 là 2x.', contentType: 'text/plain', tokenEstimate: 8, metadata: {} });
  const baseRequest = { requestId: 'req_grounded', inputMode: 'source_document' as const, sourceDocumentIds: ['doc_source'], topic: 'Đạo hàm của x^2', audience: 'Học sinh', language: 'vi' as const, targetDurationSeconds: 40, renderMode: 'live' as const, narrationMode: 'none' as const, aspectRatio: '9:16' as const };

  const fabricated = await new LessonOrchestrator({ documentStore: store, aiProvider: new CapturingProvider({ curriculum_planning: plan({ quote: 'Trích dẫn không tồn tại.' }) }) }).orchestrate(baseRequest);
  assert.equal(fabricated.stage, 'failed');
  assert.match(fabricated.error?.message ?? '', /fabricated_source_reference/);

  const wrongSourceStore = new DocumentStore();
  wrongSourceStore.addChunk({ chunkId: 'chunk_source', documentId: 'doc_source', documentTitle: 'Nguồn sai', pageNumber: 2, text: 'Đạo hàm của x^2 là 3x.', contentType: 'text/plain', tokenEstimate: 8, metadata: {} });
  const invalidMath = await new LessonOrchestrator({ documentStore: wrongSourceStore, aiProvider: new CapturingProvider({ curriculum_planning: plan({ expression: '3*x', quote: 'Đạo hàm của x^2 là 3x.' }) }) }).orchestrate({ ...baseRequest, requestId: 'req_bad_math' });
  assert.equal(invalidMath.error?.code, 'mathematical_verification_failed');

  const invalidClaimBinding = plan();
  invalidClaimBinding.sourceEvidence[0].claimId = 'claim_not_in_lesson';
  const invalidBinding = await new LessonOrchestrator({ documentStore: store, aiProvider: new CapturingProvider({ curriculum_planning: invalidClaimBinding }) }).orchestrate({ ...baseRequest, requestId: 'req_bad_binding' });
  assert.equal(invalidBinding.stage, 'failed');
  assert.match(invalidBinding.error?.message ?? '', /invalid_evidence_claim_id/);

  const partiallyGrounded = plan();
  partiallyGrounded.mathematicalClaims.push({ id: 'claim_without_evidence', statement: "f'(1) = 2", validatorKey: 'value_at_point', expectedExpression: '2', verificationStatus: 'unverified' });
  partiallyGrounded.mathSpec!.boundClaimIds.push('claim_without_evidence');
  const missingEvidence = await new LessonOrchestrator({ documentStore: store, aiProvider: new CapturingProvider({ curriculum_planning: partiallyGrounded }) }).orchestrate({ ...baseRequest, requestId: 'req_missing_evidence' });
  assert.equal(missingEvidence.stage, 'failed');
  assert.match(missingEvidence.error?.message ?? '', /source_evidence_missing_for_claim/);

  const provider = new CapturingProvider({});
  const unsupported = await new LessonOrchestrator({ documentStore: store, aiProvider: provider }).orchestrate({ ...baseRequest, requestId: 'req_unsupported', inputMode: 'topic_prompt', sourceDocumentIds: [], topic: 'topology algebraic spectral sequence' });
  assert.equal(unsupported.stage, 'needs_review');
  assert.equal(provider.requests.length, 0);
});

test('grounding requires an explicit claim-to-result relation instead of token substring matching', () => {
  const grounding = new DocumentGroundingService(new DocumentStore());
  const ambiguous = grounding.verifyClaimEvidenceAssociation('polynomial_derivative', '2*x', 'Tài liệu chỉ nhắc đến x^2 và ví dụ riêng 2x.');
  assert.equal(ambiguous.supportStatus, 'needs_review');
  assert.equal(ambiguous.claimExtracted, false);
  const unrelatedFraction = grounding.verifyClaimEvidenceAssociation('definite_integral', '1/3', 'Ta sẽ học tích phân. Ở ví dụ xác suất không liên quan, phân số bằng 1/3.');
  assert.notEqual(unrelatedFraction.supportStatus, 'supported');
});

test('semantic needs_review persists across restart and resumes without repeating curriculum planning', async () => {
  const store = new DocumentStore();
  store.addChunk({ chunkId: 'chunk_source', documentId: 'doc_source', documentTitle: 'Nguồn', pageNumber: 2, text: 'Đạo hàm của x^2 là 2x.', contentType: 'text/plain', tokenEstimate: 8, metadata: {} });
  const reviewPlan = plan();
  reviewPlan.mathematicalClaims[0].statement = 'Đạo hàm biểu diễn tốc độ biến thiên tức thời của hàm số đã cho';
  const narration = NarrationPlanV2Schema.parse({
    planId: 'narr_review_resume', storyboardId: 'sb_req_review_resume', language: 'vi',
    segments: [
      { segmentId: 'seg_review_intro', sceneId: 'scene_1_function_graph', text: 'Mở bài về đạo hàm.', subtitleText: 'Mở bài về đạo hàm.', targetDurationSeconds: 20, pronunciationHints: [] },
      { segmentId: 'seg_review_summary', sceneId: 'scene_2_function_graph', text: 'Đạo hàm của x bình phương bằng hai x.', subtitleText: "f'(x)=2x", targetDurationSeconds: 20, pronunciationHints: [] }
    ], totalWords: 14, estimatedDurationSeconds: 40,
    mathematicalReview: { status: 'verified', verifiedClaimIds: ['claim_source'] }
  });
  const provider = new CapturingProvider({ curriculum_planning: reviewPlan, narration_planning: narration });
  const root = await mkdtemp(join(tmpdir(), 'lumina-review-'));
  try {
    const orchestrator = new LessonOrchestrator({ documentStore: store, aiProvider: provider });
    const manager = new LessonDraftManager({ orchestrator, artifactsDir: join(root, 'artifacts'), draftsDir: join(root, 'drafts') });
    const draft = await manager.createDraft({ requestId: 'req_review_resume', inputMode: 'source_document', sourceDocumentIds: ['doc_source'], topic: 'Đạo hàm của x^2', audience: 'Học sinh', language: 'vi', targetDurationSeconds: 40, renderMode: 'live', narrationMode: 'none', aspectRatio: '9:16' }, 'tok_aaaaaaaaaaaaaaaa');
    assert.equal(draft.context.stage, 'needs_review');
    assert.deepEqual(provider.requests.map((request) => request.purpose), ['curriculum_planning']);

    const restarted = new LessonDraftManager({ orchestrator, artifactsDir: join(root, 'artifacts'), draftsDir: join(root, 'drafts') });
    const resumed = await restarted.updateDraft(draft.draftId, { humanSemanticReviewConfirmed: true });
    assert.equal(resumed.context.stage, 'ready_to_render');
    assert.equal(resumed.context.mathVerification?.status, 'verified');
    assert.ok(resumed.context.storyboard);
    assert.ok(resumed.context.narrationPlan);
    assert.equal(resumed.context.requestBudget?.counts.totalTextRequests, 2);
    assert.deepEqual(provider.requests.map((request) => request.purpose), ['curriculum_planning', 'narration_planning']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('failed semantic-review provider attempts persist monotonically across restart and concurrent retries', async () => {
  const store = new DocumentStore();
  store.addChunk({ chunkId: 'chunk_budget', documentId: 'doc_budget', documentTitle: 'Nguồn', pageNumber: 2, text: 'Đạo hàm của x^2 là 2x.', contentType: 'text/plain', tokenEstimate: 8, metadata: {} });
  const reviewPlan = plan({ documentId: 'doc_budget', quote: 'Đạo hàm của x^2 là 2x.' });
  reviewPlan.mathematicalClaims[0].statement = 'Đạo hàm biểu diễn tốc độ biến thiên tức thời';
  const narration = NarrationPlanV2Schema.parse({
    planId: 'narr_budget', storyboardId: 'sb_req_budget', language: 'vi',
    segments: [
      { segmentId: 'seg_budget_1', sceneId: 'scene_1_function_graph', text: 'Mở bài.', subtitleText: 'Mở bài.', targetDurationSeconds: 20, pronunciationHints: [] },
      { segmentId: 'seg_budget_2', sceneId: 'scene_2_function_graph', text: 'Đạo hàm bằng hai x.', subtitleText: "f'(x)=2x", targetDurationSeconds: 20, pronunciationHints: [] }
    ], totalWords: 7, estimatedDurationSeconds: 40,
    mathematicalReview: { status: 'verified', verifiedClaimIds: ['claim_source'] }
  });
  const provider = new FailOnceNarrationProvider(reviewPlan, narration);
  const root = await mkdtemp(join(tmpdir(), 'lumina-budget-restart-'));
  try {
    const orchestrator = new LessonOrchestrator({ documentStore: store, aiProvider: provider });
    const manager = new LessonDraftManager({ orchestrator, artifactsDir: join(root, 'artifacts'), draftsDir: join(root, 'drafts') });
    const draft = await manager.createDraft({ requestId: 'req_budget', inputMode: 'source_document', sourceDocumentIds: ['doc_budget'], topic: 'Đạo hàm của x^2', audience: 'Học sinh', language: 'vi', targetDurationSeconds: 40, renderMode: 'live', narrationMode: 'none', aspectRatio: '9:16' }, 'tok_aaaaaaaaaaaaaaaa');
    const failed = await manager.updateDraft(draft.draftId, { humanSemanticReviewConfirmed: true });
    assert.equal(failed.context.stage, 'failed');
    assert.equal(failed.context.requestBudget?.counts.totalTextRequests, 2);
    assert.equal(failed.context.requestBudget?.counts.narrationPlanning, 1);
    assert.equal(failed.context.requestBudget?.attempts.at(-1)?.status, 'failed');

    const restarted = new LessonDraftManager({ orchestrator, artifactsDir: join(root, 'artifacts'), draftsDir: join(root, 'drafts') });
    assert.equal(restarted.getDraft(draft.draftId)?.context.requestBudget?.counts.totalTextRequests, 2);
    const firstOperation = restarted.updateDraft(draft.draftId, { humanSemanticReviewConfirmed: true });
    const secondOperation = restarted.updateDraft(draft.draftId, { humanSemanticReviewConfirmed: true });
    await provider.retryStarted;
    assert.equal(provider.requests.filter((request) => request.purpose === 'narration_planning').length, 2);
    provider.releaseRetry();
    const [firstRetry, concurrentRetry] = await Promise.all([firstOperation, secondOperation]);
    assert.equal(firstRetry.context.stage, 'ready_to_render');
    assert.equal(concurrentRetry.context.stage, 'ready_to_render');
    assert.equal(concurrentRetry.context.requestBudget?.counts.totalTextRequests, 3);
    assert.equal(concurrentRetry.context.requestBudget?.counts.narrationPlanning, 2);
    assert.deepEqual(provider.requests.map((request) => request.purpose), ['curriculum_planning', 'narration_planning', 'narration_planning']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
