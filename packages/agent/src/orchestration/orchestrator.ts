import {
  compileStoryboardV2,
  defaultTemplateRegistry,
  GeminiRequestBudget,
  type GeminiRequestBudgetOptions,
  LessonRequestV2Schema,
  type LessonRequestV2,
  type MathTemplateRegistry
} from '@luminalearn/scene-schema';
import { CurriculumPlanner } from './curriculum-planner';
import { DocumentAnalyst, DocumentGroundingService, DocumentStore } from './document-grounding';
import { MathVerificationService } from './math-verifier';
import {
  type AIProvider,
  type AIStructuredRequest,
  type AIProviderResult,
  MockAIProvider,
  LiveGeminiAIProvider
} from './ai-provider';
import { NarrationPlannerV2 } from './narration-planner';
import { QualityReviewer } from './quality-reviewer';
import { TopicRouter } from './router';
import { VisualStoryboardDirectorV2 } from './storyboard-director';
import { EducationalFilmDirector } from './educational-film-director';
import type { OrchestrationContext, OrchestrationLogEntry, OrchestrationStage } from './types';

export interface LessonOrchestratorOptions {
  registry?: MathTemplateRegistry;
  documentStore?: DocumentStore;
  verifier?: MathVerificationService;
  aiProvider?: AIProvider;
  maxRetries?: number;
  requestBudget?: GeminiRequestBudget | GeminiRequestBudgetOptions;
}

class BudgetEnforcingProviderWrapper implements AIProvider {
  public readonly isMock: boolean;
  constructor(
    private readonly inner: AIProvider,
    private readonly budget: GeminiRequestBudget
  ) {
    this.isMock = inner.isMock;
  }

  public async generateStructured<T>(request: AIStructuredRequest<T>): Promise<AIProviderResult<T>> {
    if (this.inner.isMock || this.inner instanceof LiveGeminiAIProvider) {
      return this.inner.generateStructured({ ...request, requestBudget: this.budget });
    }
    const category = request.purpose === 'narration_planning' ? 'narration_planning' : 'curriculum_planning';
    const attemptId = this.budget.consume(category, 'custom-provider');
    try {
      const result = await this.inner.generateStructured({ ...request, requestBudget: this.budget });
      this.budget.completeAttempt(attemptId, 'succeeded');
      return result;
    } catch (error) {
      const code = error instanceof Error ? error.message.split(':', 1)[0] : 'provider_error';
      this.budget.completeAttempt(attemptId, 'failed', code);
      throw error;
    }
  }
}

function isNonRetryableProviderError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /^(gemini_authentication_failed|gemini_permission_denied|gemini_model_unavailable|gemini_quota_exceeded|gemini_budget_exceeded|gemini_timeout|gemini_transient_failed|gemini_api_key_missing|provider_self_verification_rejected)/.test(msg);
}

export class LessonOrchestrator {
  private readonly router: TopicRouter;
  private readonly documentStore: DocumentStore;
  private readonly groundingService: DocumentGroundingService;
  private readonly documentAnalyst: DocumentAnalyst;
  private readonly curriculumPlanner: CurriculumPlanner;
  private readonly verifier: MathVerificationService;
  private readonly aiProvider: AIProvider;
  private readonly storyboardDirector: VisualStoryboardDirectorV2;
  private readonly filmDirector: EducationalFilmDirector;
  private readonly narrationPlanner: NarrationPlannerV2;
  private readonly qualityReviewer: QualityReviewer;
  private readonly registry: MathTemplateRegistry;
  private readonly maxRetries: number;
  private readonly budgetOption?: GeminiRequestBudget | GeminiRequestBudgetOptions;

  constructor(options: LessonOrchestratorOptions = {}) {
    this.registry = options.registry ?? defaultTemplateRegistry;
    this.documentStore = options.documentStore ?? new DocumentStore();
    this.groundingService = new DocumentGroundingService(this.documentStore);
    this.documentAnalyst = new DocumentAnalyst(this.documentStore, this.groundingService);
    this.router = new TopicRouter();
    this.curriculumPlanner = new CurriculumPlanner();
    this.verifier = options.verifier ?? new MathVerificationService();
    this.aiProvider = options.aiProvider ?? new MockAIProvider();
    this.storyboardDirector = new VisualStoryboardDirectorV2(this.registry);
    this.filmDirector = new EducationalFilmDirector();
    this.narrationPlanner = new NarrationPlannerV2();
    this.qualityReviewer = new QualityReviewer(this.registry);
    this.maxRetries = options.maxRetries ?? 1;
    this.budgetOption = options.requestBudget;
  }

  private createJobBudget(): GeminiRequestBudget {
    if (this.budgetOption instanceof GeminiRequestBudget) {
      return this.budgetOption;
    }
    const defaultMaxCurriculum = Math.max(1, this.maxRetries + 1);
    const defaultMaxNarration = Math.max(1, this.maxRetries + 1);
    const defaultTotal = Math.max(4, defaultMaxCurriculum + defaultMaxNarration);
    return new GeminiRequestBudget({
      maxRequestsPerJob: this.budgetOption?.maxRequestsPerJob ?? (process.env.GEMINI_MAX_REQUESTS_PER_JOB ? undefined : defaultTotal),
      maxCurriculumRequests: this.budgetOption?.maxCurriculumRequests ?? defaultMaxCurriculum,
      maxNarrationRequests: this.budgetOption?.maxNarrationRequests ?? defaultMaxNarration,
      maxTtsRequestsPerJob: this.budgetOption?.maxTtsRequestsPerJob
    });
  }

  public async orchestrate(rawRequest: unknown): Promise<OrchestrationContext> {
    const startTime = Date.now();
    const logs: OrchestrationLogEntry[] = [];
    const jobBudget = this.createJobBudget();

    const log = (step: string, stage: OrchestrationStage, status: 'success' | 'warning' | 'error', message: string, details?: Record<string, unknown>) => {
      logs.push({
        step,
        stage,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        status,
        message,
        details
      });
    };

    // Stage 1: Chuẩn hóa đầu vào (Input Normalization)
    let request: LessonRequestV2;
    try {
      request = LessonRequestV2Schema.parse(rawRequest);
      log('normalize_input', 'normalized', 'success', 'Yêu cầu bài học V2 đã được xác thực schema');
    } catch (err) {
      log('normalize_input', 'failed', 'error', 'Xác thực LessonRequestV2 thất bại', { error: String(err) });
      return {
        request: rawRequest as LessonRequestV2,
        stage: 'failed',
        logs,
        retryCount: 0,
        maxRetries: this.maxRetries,
        requestBudget: jobBudget.getSummary(),
        error: { code: 'invalid_request', message: err instanceof Error ? err.message : String(err) }
      };
    }

    const context: OrchestrationContext = {
      request,
      stage: 'normalized',
      logs,
      retryCount: 0,
      maxRetries: this.maxRetries,
      providerCalls: [],
      requestBudget: jobBudget.getSummary()
    };

    // Stage 2: Phân loại chủ đề (Topic Classification & Routing)
    const topicInfo = this.router.route(request);
    context.topicInfo = topicInfo;

    if (!topicInfo.isSupported) {
      log('topic_routing', 'needs_review', 'warning', topicInfo.unsupportedReason || 'Chủ đề chưa được hỗ trợ');
      context.stage = 'needs_review';
      context.error = { code: 'unsupported_topic', message: topicInfo.unsupportedReason || 'Chủ đề chưa được hỗ trợ' };
      return context;
    }
    log('topic_routing', 'analyzed', 'success', `Chủ đề xác định: ${topicInfo.displayName} (${topicInfo.topicId})`);

    // Stage 3: Phân tích tài liệu nguồn nếu ở chế độ source_document (Document Analysis)
    if (request.inputMode === 'source_document') {
      const docAnalysis = this.documentAnalyst.analyze(request.sourceDocumentIds, request.topic);
      context.documentAnalysis = docAnalysis;
      if (docAnalysis.totalChunks === 0) {
        log('document_analysis', 'needs_review', 'warning', 'Không tìm thấy nội dung tài liệu trích xuất');
        context.stage = 'needs_review';
        context.error = { code: 'source_evidence_missing', message: 'Tài liệu nguồn rỗng hoặc chưa được trích xuất' };
        return context;
      }
      const unverifiedEv = docAnalysis.evidence.filter((ev) => !ev.evidenceFound);
      if (unverifiedEv.length > 0) {
        log('document_analysis', 'needs_review', 'warning', `Có ${unverifiedEv.length} trích dẫn nguồn không được xác thực nguyên văn trong tài liệu`);
        context.stage = 'needs_review';
        context.error = {
          code: 'source_evidence_unverified',
          message: `Found ${unverifiedEv.length} source references that could not be verified verbatim in the uploaded documents`
        };
        return context;
      }
      const unsupportedEv = docAnalysis.evidence.filter((ev) => ev.supportStatus && ev.supportStatus !== 'supported');
      if (unsupportedEv.length > 0 || docAnalysis.candidateClaims.length === 0) {
        const msg = docAnalysis.unverifiedClaimsReason || 'Tài liệu nguồn không chứa mệnh đề toán học tường minh hỗ trợ chủ đề yêu cầu';
        log('document_analysis', 'needs_review', 'warning', msg);
        context.stage = 'needs_review';
        context.error = {
          code: 'source_claim_unsupported',
          message: msg
        };
        return context;
      }
      context.sourceContext = this.documentAnalyst.buildSourceContextBundle(
        request.sourceDocumentIds,
        docAnalysis,
        { topicQuery: request.topic }
      );
      log('document_analysis', 'analyzed', 'success', `Đã phân tích ${docAnalysis.totalChunks} đoạn tài liệu, trích xuất ${docAnalysis.extractedConcepts.length} khái niệm`);
    }

    // Stage 4: Lập kế hoạch sư phạm (Curriculum Planning)
    let rawProvider = this.aiProvider;
    if (request.renderMode === 'live' && rawProvider.isMock) {
      if (!process.env.GEMINI_API_KEY) {
        log('curriculum_planning', 'failed', 'error', 'live_mode_unavailable: GEMINI_API_KEY is not configured');
        context.stage = 'failed';
        context.error = { code: 'live_mode_unavailable', message: 'GEMINI_API_KEY is required for live renderMode' };
        return context;
      }
      rawProvider = new LiveGeminiAIProvider({ requestBudget: jobBudget });
    }
    const effectiveAiProvider: AIProvider = rawProvider.isMock
      ? rawProvider
      : new BudgetEnforcingProviderWrapper(rawProvider, jobBudget);

    const runWithBoundedRevision = async <T>(
      step: string,
      category: 'curriculum_planning' | 'narration_planning',
      operation: () => Promise<T>
    ): Promise<T> => {
      while (true) {
        try {
          const res = await operation();
          context.requestBudget = jobBudget.getSummary();
          return res;
        } catch (error) {
          context.requestBudget = jobBudget.getSummary();
          if (
            effectiveAiProvider.isMock ||
            isNonRetryableProviderError(error) ||
            context.retryCount >= context.maxRetries ||
            !jobBudget.canConsume(category)
          ) {
            throw error;
          }
          context.retryCount += 1;
          log(step, context.stage, 'warning', `Provider output không hợp lệ; yêu cầu sửa lần ${context.retryCount}/${context.maxRetries}`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    };

    try {
      const plan = await runWithBoundedRevision('curriculum_revision', 'curriculum_planning', async () => {
        const candidate = await this.curriculumPlanner.plan({
          lessonId: `lesson_${request.requestId}`,
          topicInfo,
          audience: request.audience,
          targetDurationSeconds: request.targetDurationSeconds,
          documentAnalysis: context.documentAnalysis,
          sourceContext: context.sourceContext,
          aiProvider: effectiveAiProvider,
          requestBudget: jobBudget,
          onProviderCall: (trace) => context.providerCalls?.push(trace)
        });
        if (!candidate.mathSpec) throw new Error('math_spec_missing: provider must return the exact mathematical specification');
        if (candidate.mathSpec.topicId !== topicInfo.topicId) throw new Error('math_spec_topic_mismatch: provider MathSpec does not match routed topic');
        const claimIds = [...new Set(candidate.mathematicalClaims.map((claim) => claim.id))].sort();
        const boundClaimIds = [...new Set(candidate.mathSpec.boundClaimIds)].sort();
        if (JSON.stringify(claimIds) !== JSON.stringify(boundClaimIds)) {
          throw new Error('math_spec_claim_binding_mismatch: MathSpec must bind the complete claim set');
        }
        if (request.inputMode === 'source_document') {
          if (candidate.sourceEvidence.length === 0) throw new Error('source_evidence_missing: live source-document plan returned no citations');
          for (const evidence of candidate.sourceEvidence) {
            const reference = evidence.sourceReference;
            if (!request.sourceDocumentIds.includes(reference.documentId)) throw new Error(`fabricated_source_reference: ${reference.documentId}`);
            const match = this.groundingService.verifyQuoteInDocument(reference.documentId, reference.pageNumber, reference.exactQuote);
            if (!match.found || match.matchType !== 'exact') throw new Error(`fabricated_source_reference: ${reference.id}`);
            reference.chunkId = match.matchedChunkId;
            evidence.quoteExists = true;

            const linkedClaim = candidate.mathematicalClaims.find((c) => c.id === evidence.claimId);
            if (!linkedClaim) throw new Error(`invalid_evidence_claim_id: '${evidence.claimId}' does not identify a lesson claim`);
            {
              const support = this.groundingService.verifyClaimEvidenceAssociation(
                linkedClaim.validatorKey,
                linkedClaim.expectedExpression,
                reference.exactQuote
              );
              evidence.claimExtracted = support.claimExtracted;
              evidence.supportStatus = support.supportStatus;
              if (!support.claimExtracted || support.supportStatus !== 'supported') {
                throw new Error(`unsupported_source_claim: ${support.reason}`);
              }
              linkedClaim.sourceReferenceId = reference.id;
            }
          }
          const supportedClaimIds = new Set(
            candidate.sourceEvidence
              .filter((evidence) => evidence.supportStatus === 'supported' && evidence.quoteExists === true)
              .map((evidence) => evidence.claimId)
          );
          for (const claim of candidate.mathematicalClaims) {
            if (!supportedClaimIds.has(claim.id) || !claim.sourceReferenceId) {
              throw new Error(
                `source_evidence_missing_for_claim: Mathematical claim '${claim.id}' has no exact supported evidence from an authorized source document`
              );
            }
          }
        }
        return candidate;
      });
      const aiMode = effectiveAiProvider.isMock ? 'deterministic_mock' : 'ai_generated_live';
      context.lessonPlan = plan;
      log('curriculum_planning', 'planned', 'success', `Đã lập kế hoạch bài học với ${plan.pedagogicalSequence.length} bước sư phạm`, { aiMode, providerCall: context.providerCalls?.at(-1) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = message.startsWith('gemini_quota_exceeded')
        ? 'gemini_quota_exceeded'
        : message.startsWith('gemini_budget_exceeded')
        ? 'gemini_budget_exceeded'
        : message.startsWith('gemini_transient_failed')
        ? 'gemini_transient_failed'
        : message.startsWith('gemini_authentication_failed') || message.startsWith('gemini_permission_denied')
        ? 'gemini_authentication_failed'
        : message.startsWith('unsupported_source_claim')
        ? 'source_claim_unsupported'
        : 'planning_failed';
      log('curriculum_planning', 'failed', 'error', `Lập kế hoạch bài học thất bại: ${message}`);
      context.stage = 'failed';
      context.error = { code, message };
      return context;
    }

    // Stage 5: Xác minh toán học hình thức (Mathematical Validation Gate)
    try {
      const verifyReport = await this.verifier.verifyClaims(
        topicInfo.topicId,
        context.lessonPlan.mathematicalClaims,
        { timeoutMs: 20_000, mathSpec: context.lessonPlan.mathSpec }
      );
      context.lessonPlan.mathematicalClaims = verifyReport.claims;
      context.mathVerification = {
        status: verifyReport.result.status,
        checkedClaims: verifyReport.claims,
        verificationDetails: verifyReport.result.checks
      };

      if (verifyReport.result.status === 'needs_review') {
        const reviewClaims = verifyReport.claims
          .filter((c) => c.verificationStatus !== 'verified')
          .map((c) => `${c.id} (${c.statementVerification ?? c.verificationStatus})`)
          .join(', ');
        log('mathematical_validation', 'needs_review', 'warning', `Mệnh đề cần giáo viên xác nhận ngữ nghĩa: ${reviewClaims}`);
        context.stage = 'needs_review';
        context.error = {
          code: 'statement_requires_semantic_review',
          message: `Mathematical claims require explicit human semantic review: ${reviewClaims}`
        };
        return context;
      }

      if (!verifyReport.allVerified) {
        const failedClaims = verifyReport.claims
          .filter((c) => c.verificationStatus !== 'verified')
          .map((c) => `${c.id} (${c.validatorKey}: ${c.verificationStatus})`)
          .join(', ');
        log('mathematical_validation', 'failed', 'error', `Xác minh toán học thất bại với các mệnh đề: ${failedClaims}`);
        context.stage = 'failed';
        context.error = {
          code: 'mathematical_verification_failed',
          message: `Mathematical claims failed SymPy formal verification: ${failedClaims}`
        };
        return context;
      }

      log('mathematical_validation', 'verified', 'success', `Đã xác minh hình thức thành công ${verifyReport.claims.length} mệnh đề toán học`);
    } catch (err) {
      log('mathematical_validation', 'failed', 'error', `Tiến trình xác minh toán học gặp sự cố: ${err instanceof Error ? err.message : String(err)}`);
      context.stage = 'failed';
      context.error = {
        code: 'mathematical_verification_failed',
        message: err instanceof Error ? err.message : String(err)
      };
      return context;
    }

    // Stage 6: Đạo diễn trực quan (Visual Storyboard Directing)
    try {
      const storyboard = this.storyboardDirector.direct({
        storyboardId: `sb_${request.requestId}`,
        lessonPlan: context.lessonPlan,
        aspectRatio: request.aspectRatio,
        visualStyleId: request.visualStyleId
      });
      storyboard.sourceReferences = context.lessonPlan.sourceEvidence.map((ev) => ev.sourceReference.id);
      context.storyboard = storyboard;
      context.teachingTreatment = this.filmDirector.createTreatment({
        lessonPlan: context.lessonPlan,
        storyboard,
        visualStyleId: request.visualStyleId
      });
      log('storyboard_directing', 'storyboarded', 'success', `Đã tạo storyboard với ${storyboard.scenes.length} cảnh trực quan (${storyboard.estimatedDurationFrames} frames)`);
    } catch (err) {
      log('storyboard_directing', 'failed', 'error', `Đạo diễn storyboard thất bại: ${err instanceof Error ? err.message : String(err)}`);
      context.stage = 'failed';
      context.error = { code: 'storyboard_failed', message: err instanceof Error ? err.message : String(err) };
      return context;
    }

    // Stage 7: Sinh lời dẫn và phụ đề (Narration Planning)
    try {
      const verifiedLessonPlan = context.lessonPlan;
      const directedStoryboard = context.storyboard;
      if (!verifiedLessonPlan || !directedStoryboard) throw new Error('narration_context_missing: verified lesson plan or storyboard is absent');
      const narrationPlan = await runWithBoundedRevision('narration_revision', 'narration_planning', () => this.narrationPlanner.plan({
        planId: `narr_${request.requestId}`,
        lessonPlan: verifiedLessonPlan,
        storyboard: directedStoryboard,
        language: request.language,
        aiProvider: effectiveAiProvider,
        requestBudget: jobBudget,
        onProviderCall: (trace) => context.providerCalls?.push(trace)
      }));
      const aiMode = effectiveAiProvider.isMock ? 'deterministic_mock' : 'ai_generated_live';
      context.narrationPlan = narrationPlan;
      log('narration_planning', 'narrated', 'success', `Đã tạo kế hoạch lời dẫn gồm ${narrationPlan.segments.length} phân đoạn (${narrationPlan.totalWords} từ)`, { aiMode, providerCall: context.providerCalls?.at(-1) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = message.startsWith('gemini_quota_exceeded')
        ? 'gemini_quota_exceeded'
        : message.startsWith('gemini_budget_exceeded')
        ? 'gemini_budget_exceeded'
        : 'narration_failed';
      log('narration_planning', 'failed', 'error', `Sinh lời dẫn thất bại: ${message}`);
      context.stage = 'failed';
      context.error = { code, message };
      return context;
    }

    // Stage 8: Đánh giá chất lượng toàn diện (Quality Review Gate)
    const reviewResult = this.qualityReviewer.review(context);
    if (!reviewResult.valid) {
      log('quality_review', 'failed', 'error', `Đánh giá chất lượng không đạt: ${reviewResult.errors.join('; ')}`);
      context.stage = 'failed';
      context.error = { code: 'quality_review_failed', message: reviewResult.errors.join('; ') };
      return context;
    }
    log('quality_review', 'compiled', 'success', 'Bài học đã vượt qua toàn bộ các cổng kiểm định chất lượng');

    // Stage 9: Biên dịch bản kê kết xuất (Manifest Compilation)
    try {
      const manifest = compileStoryboardV2(context.storyboard, context.narrationPlan, {
        jobId: `job_${request.requestId}`,
        lessonTitle: context.lessonPlan.title,
        topicId: context.lessonPlan.topicId,
        fps: 24,
        aspectRatio: request.aspectRatio,
        visualStyleId: request.visualStyleId,
        subtitlesEnabled: request.subtitlesEnabled ?? true,
        verifiedClaims: context.lessonPlan.mathematicalClaims,
        sourceReferences: context.lessonPlan.sourceEvidence.map((ev) => ev.sourceReference)
      });
      context.manifest = manifest;
      context.stage = 'ready_to_render';
      context.requestBudget = jobBudget.getSummary();
      log('manifest_compilation', 'ready_to_render', 'success', `Bản kê RenderManifestV2 đã hoàn tất (${manifest.totalFrames} frames, sẵn sàng render)`);
    } catch (err) {
      log('manifest_compilation', 'failed', 'error', `Biên dịch manifest thất bại: ${err instanceof Error ? err.message : String(err)}`);
      context.stage = 'failed';
      context.error = { code: 'compilation_failed', message: err instanceof Error ? err.message : String(err) };
      return context;
    }

    return context;
  }

  /** Continue a persisted semantic-review draft without repeating curriculum planning. */
  public async resumeAfterSemanticReview(
    context: OrchestrationContext,
    options: { onBudgetChange?: (summary: NonNullable<OrchestrationContext['requestBudget']>) => void } = {}
  ): Promise<OrchestrationContext> {
    const lessonPlan = context.lessonPlan;
    const topicInfo = context.topicInfo;
    if (!lessonPlan || !topicInfo || context.mathVerification?.status !== 'verified' ||
        lessonPlan.mathematicalClaims.some((claim) => claim.verificationStatus !== 'verified')) {
      throw new Error('semantic_review_prerequisites_missing: complete SymPy verification is required before resume');
    }

    const request = context.request;
    const storyboard = this.storyboardDirector.direct({
      storyboardId: `sb_${request.requestId}`,
      lessonPlan,
      aspectRatio: request.aspectRatio,
      visualStyleId: request.visualStyleId
    });
    storyboard.sourceReferences = lessonPlan.sourceEvidence.map((evidence) => evidence.sourceReference.id);
    context.storyboard = storyboard;
    context.teachingTreatment = this.filmDirector.createTreatment({ lessonPlan, storyboard, visualStyleId: request.visualStyleId });

    const priorBudget = context.requestBudget;
    if (priorBudget && (
      priorBudget.counts.totalTextRequests >= priorBudget.limits.maxRequestsPerJob ||
      priorBudget.counts.narrationPlanning >= priorBudget.limits.maxNarrationRequests
    )) {
      throw new Error('gemini_budget_exceeded: No request budget remains for semantic-review resume');
    }
    const persistBudget = (summary: NonNullable<OrchestrationContext['requestBudget']>) => {
      context.requestBudget = summary;
      options.onBudgetChange?.(summary);
    };
    const budget = priorBudget
      ? new GeminiRequestBudget({ initialSummary: priorBudget, onChange: persistBudget })
      : new GeminiRequestBudget({
          maxRequestsPerJob: this.maxRetries + 3,
          maxCurriculumRequests: Math.max(1, this.maxRetries + 1),
          maxNarrationRequests: Math.max(1, this.maxRetries + 1),
          onChange: persistBudget
        });
    let provider = this.aiProvider;
    if (request.renderMode === 'live' && provider.isMock) {
      if (!process.env.GEMINI_API_KEY) throw new Error('live_mode_unavailable: GEMINI_API_KEY is required for live renderMode');
      provider = new LiveGeminiAIProvider({ requestBudget: budget });
    }
    const effectiveProvider: AIProvider = provider.isMock ? provider : new BudgetEnforcingProviderWrapper(provider, budget);
    context.narrationPlan = await this.narrationPlanner.plan({
      planId: `narr_${request.requestId}`,
      lessonPlan,
      storyboard,
      language: request.language,
      aiProvider: effectiveProvider,
      requestBudget: budget,
      onProviderCall: (trace) => context.providerCalls?.push(trace)
    });

    const review = this.qualityReviewer.review(context);
    if (!review.valid) throw new Error(`quality_review_failed: ${review.errors.join('; ')}`);
    context.manifest = compileStoryboardV2(storyboard, context.narrationPlan, {
      jobId: `job_${request.requestId}`,
      lessonTitle: lessonPlan.title,
      topicId: lessonPlan.topicId,
      fps: 24,
      aspectRatio: request.aspectRatio,
      visualStyleId: request.visualStyleId,
      subtitlesEnabled: request.subtitlesEnabled ?? true,
      verifiedClaims: lessonPlan.mathematicalClaims,
      sourceReferences: lessonPlan.sourceEvidence.map((evidence) => evidence.sourceReference)
    });
    context.stage = 'ready_to_render';
    context.error = undefined;
    context.requestBudget = budget.getSummary();
    return context;
  }
}
