import {
  compileStoryboardV2,
  defaultTemplateRegistry,
  LessonRequestV2Schema,
  type LessonRequestV2,
  type MathTemplateRegistry
} from '@luminalearn/scene-schema';
import { CurriculumPlanner } from './curriculum-planner';
import { DocumentAnalyst, DocumentGroundingService, DocumentStore } from './document-grounding';
import { MathVerificationService } from './math-verifier';
import { type AIProvider, MockAIProvider, LiveGeminiAIProvider } from './ai-provider';
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
    this.maxRetries = options.maxRetries ?? 2;
  }

  public async orchestrate(rawRequest: unknown): Promise<OrchestrationContext> {
    const startTime = Date.now();
    const logs: OrchestrationLogEntry[] = [];

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
        error: { code: 'invalid_request', message: err instanceof Error ? err.message : String(err) }
      };
    }

    const context: OrchestrationContext = {
      request,
      stage: 'normalized',
      logs,
      retryCount: 0,
      maxRetries: this.maxRetries
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
      log('document_analysis', 'analyzed', 'success', `Đã phân tích ${docAnalysis.totalChunks} đoạn tài liệu, trích xuất ${docAnalysis.extractedConcepts.length} khái niệm`);
    }

    // Stage 4: Lập kế hoạch sư phạm (Curriculum Planning)
    let effectiveAiProvider = this.aiProvider;
    if (request.renderMode === 'live' && effectiveAiProvider.isMock) {
      if (!process.env.GEMINI_API_KEY) {
        log('curriculum_planning', 'failed', 'error', 'live_mode_unavailable: GEMINI_API_KEY is not configured');
        context.stage = 'failed';
        context.error = { code: 'live_mode_unavailable', message: 'GEMINI_API_KEY is required for live renderMode' };
        return context;
      }
      effectiveAiProvider = new LiveGeminiAIProvider();
    }

    try {
      const plan = await this.curriculumPlanner.plan({
        lessonId: `lesson_${request.requestId}`,
        topicInfo,
        audience: request.audience,
        targetDurationSeconds: request.targetDurationSeconds,
        documentAnalysis: context.documentAnalysis,
        aiProvider: effectiveAiProvider
      });
      const aiMode = effectiveAiProvider.isMock ? 'deterministic_mock' : 'ai_generated_live';
      context.lessonPlan = plan;
      log('curriculum_planning', 'planned', 'success', `Đã lập kế hoạch bài học với ${plan.pedagogicalSequence.length} bước sư phạm`, { aiMode });
    } catch (err) {
      log('curriculum_planning', 'failed', 'error', `Lập kế hoạch bài học thất bại: ${err instanceof Error ? err.message : String(err)}`);
      context.stage = 'failed';
      context.error = { code: 'planning_failed', message: err instanceof Error ? err.message : String(err) };
      return context;
    }

    // Stage 5: Xác minh toán học hình thức (Mathematical Validation Gate)
    // Quy tắc fail-closed: Gọi MathVerificationService thực thụ (SymPy / injected verifier)
    try {
      const verifyReport = await this.verifier.verifyClaims(
        topicInfo.topicId,
        context.lessonPlan.mathematicalClaims,
        { timeoutMs: 20_000, mathSpec: context.lessonPlan.mathSpec }
      );
      context.lessonPlan.mathematicalClaims = verifyReport.claims;
      context.mathVerification = {
        status: verifyReport.allVerified ? 'verified' : 'failed',
        checkedClaims: verifyReport.claims,
        verificationDetails: verifyReport.result.checks
      };

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
      const narrationPlan = await this.narrationPlanner.plan({
        planId: `narr_${request.requestId}`,
        lessonPlan: context.lessonPlan,
        storyboard: context.storyboard,
        language: request.language,
        aiProvider: effectiveAiProvider
      });
      const aiMode = effectiveAiProvider.isMock ? 'deterministic_mock' : 'ai_generated_live';
      context.narrationPlan = narrationPlan;
      log('narration_planning', 'narrated', 'success', `Đã tạo kế hoạch lời dẫn gồm ${narrationPlan.segments.length} phân đoạn (${narrationPlan.totalWords} từ)`, { aiMode });
    } catch (err) {
      log('narration_planning', 'failed', 'error', `Sinh lời dẫn thất bại: ${err instanceof Error ? err.message : String(err)}`);
      context.stage = 'failed';
      context.error = { code: 'narration_failed', message: err instanceof Error ? err.message : String(err) };
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
        verifiedClaims: context.lessonPlan.mathematicalClaims
      });
      context.manifest = manifest;
      context.stage = 'ready_to_render';
      log('manifest_compilation', 'ready_to_render', 'success', `Bản kê RenderManifestV2 đã hoàn tất (${manifest.totalFrames} frames, sẵn sàng render)`);
    } catch (err) {
      log('manifest_compilation', 'failed', 'error', `Biên dịch manifest thất bại: ${err instanceof Error ? err.message : String(err)}`);
      context.stage = 'failed';
      context.error = { code: 'compilation_failed', message: err instanceof Error ? err.message : String(err) };
      return context;
    }

    return context;
  }
}

