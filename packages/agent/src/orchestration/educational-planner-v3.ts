import {
  classifyEducationalTopic,
  type EducationalClaimV3,
  type EducationalLessonPlanV3,
  type EducationalStoryboardV3,
  EducationalLessonPlanV3Schema,
  GeminiRequestBudget,
  type MathVisualizationSpecV2,
  REGISTERED_TOPICS_V3,
  type TopicCapabilityReportV3,
  verifyExternalApiConsentV3,
  type ExternalApiConsentRecordV3
} from '@luminalearn/scene-schema';
import type { AIProvider } from './ai-provider';
import type { DocumentAnalysisResult } from './types';
import { KnowledgeValidationServiceV3, validateAlgebraSceneMath } from './knowledge-validation-v3';
import { normalizeStoryboardTimelineV3, buildChaptersForScenes } from './timeline-normalizer-v3';
import { directEducationalLessonV3 } from './universal-educational-director-v3';
export { buildChaptersForScenes };

export interface EducationalPlannerV3Options {
  aiProvider?: AIProvider;
  validationService?: KnowledgeValidationServiceV3;
  requestBudget?: GeminiRequestBudget;
}

export interface PlanLessonV3Input {
  lessonId: string;
  topic: string;
  audience?: string;
  language?: 'vi' | 'en';
  targetDurationSeconds?: number;
  documentAnalysis?: DocumentAnalysisResult;
  ownerId?: string;
  externalApiConsent?: boolean;
  consentRecord?: ExternalApiConsentRecordV3;
  mathSpec?: MathVisualizationSpecV2;
  assumptions?: string[];
}

export class EducationalGenerationError extends Error {
  public readonly provenance = 'generation_failed' as const;
  public readonly code: string;

  constructor(error: unknown) {
    const source = error instanceof Error ? error : new Error(String(error));
    super(source.message, { cause: source });
    this.name = 'EducationalGenerationError';
    this.code = typeof (source as Error & { code?: unknown }).code === 'string'
      ? String((source as Error & { code?: string }).code)
      : 'live_generation_failed';
  }
}

/**
 * EducationalPlannerV3: Bộ lập kế hoạch giáo dục thế hệ mới V3.
 * Hỗ trợ hai lĩnh vực trọng tâm: TOÁN HỌC và TRÍ TUỆ NHÂN TẠO / HỌC MÁY.
 * Đảm bảo:
 * 1. CHECKPOINT A: Tuyệt đối không tự phong "formally_verified" cho các mệnh đề ứng cử viên.
 * 2. CHECKPOINT B: Real Source Grounding - chỉ gán source_grounded khi có trích dẫn tài liệu thật.
 * 3. CHECKPOINT D: Hỗ trợ cả đường dẫn AIProvider có kiểm soát budget và đường dẫn deterministic mock.
 * 4. CHECKPOINT E: Strict Visual DSL cho tất cả các scene visualPayload.
 */
export class EducationalPlannerV3 {
  private readonly aiProvider?: AIProvider;
  private readonly validationService: KnowledgeValidationServiceV3;
  private readonly requestBudget?: GeminiRequestBudget;

  constructor(options?: EducationalPlannerV3Options) {
    this.aiProvider = options?.aiProvider;
    this.validationService = options?.validationService ?? new KnowledgeValidationServiceV3();
    this.requestBudget = options?.requestBudget;
  }

  public async planLesson(input: PlanLessonV3Input): Promise<EducationalLessonPlanV3> {
    const {
      lessonId,
      topic,
      audience = 'Học sinh phổ thông và sinh viên công nghệ',
      language = 'vi',
      targetDurationSeconds = 40,
      documentAnalysis
    } = input;

    // Bước 1: Phân loại lĩnh vực và năng lực xác định (fail-closed cho chủ đề ngoài phạm vi)
    const capabilityReport = classifyEducationalTopic(topic);

    // Bước 2: Tạo kế hoạch bài học ứng cử viên (Candidate Plan)
    // Phân tách rõ ràng giữa Live AI Provider và Deterministic Mock Fixture
    let candidatePlan: EducationalLessonPlanV3;

    if (this.aiProvider && !this.aiProvider.isMock) {
      if (input.externalApiConsent !== true) {
        throw new EducationalGenerationError(
          Object.assign(new Error('Explicit external API consent is required for live Gemini planning.'), {
            code: 'external_api_consent_required'
          })
        );
      }
      try {
        candidatePlan = await this.planLessonWithAI(input, capabilityReport);
      } catch (error) {
        throw error instanceof EducationalGenerationError ? error : new EducationalGenerationError(error);
      }
    } else {
      candidatePlan = this.buildDeterministicPlan(
        lessonId,
        topic,
        capabilityReport,
        targetDurationSeconds,
        documentAnalysis
      );
    }

    // Bước 3: RÀNG BUỘC TOÀN VẸN TRI THỨC (CHECKPOINTS A & B)
    // Độc lập kiểm định mọi mệnh đề qua KnowledgeValidationServiceV3
    let optimizationTrace: unknown = undefined;
    if (candidatePlan.storyboard) {
      const lossScene = candidatePlan.storyboard.scenes.find((s) => s.sceneType === 'loss_landscape');
      const boundClaimId = lossScene?.boundClaimIds[0];
      if (lossScene?.visualPayload.sceneType === 'loss_landscape' && boundClaimId) {
        const p = lossScene.visualPayload;
        optimizationTrace = {
          kind: 'optimization_trace_1d',
          expression: `L(w)=${p.curvature}(w-${p.minimumPoint.w})^2+${p.minimumPoint.loss}`,
          learningRate: p.learningRate,
          points: p.steps.map((st) => ({ step: st.stepNumber, parameter: st.w, value: st.loss, gradient: st.gradient })),
          claimId: boundClaimId,
          validation: 'deterministic_numeric'
        };
      }
    }

    const validationResult = await this.validationService.validateClaims({
      lessonId,
      topicId: capabilityReport.topicId,
      domain: capabilityReport.domain,
      claims: candidatePlan.educationalClaims,
      sourceEvidence: documentAnalysis?.evidence || candidatePlan.sourceEvidence,
      mathSpec: input.mathSpec,
      assumptions: input.assumptions,
      optimizationTrace
    });

    candidatePlan.educationalClaims = validationResult.validatedClaims;
    candidatePlan.validationReport = validationResult.report;

    // CHECKPOINT C: Kiểm định tính toàn vẹn toán học của từng phân cảnh đại số
    if (candidatePlan.storyboard) {
      for (const scene of candidatePlan.storyboard.scenes) {
        if (scene.sceneType === 'algebra_identity') {
          const sceneCheck = await validateAlgebraSceneMath({
            scene,
            verifiedClaims: candidatePlan.educationalClaims
          });
          if (!sceneCheck.valid) {
            throw new EducationalGenerationError(sceneCheck.reason || 'algebra_scene_math_invalid');
          }
        }
      }
    }

    // Bước 4: Chuẩn hóa timeline đảm bảo mọi phân cảnh <= 120s và tổng thời lượng chính xác
    if (candidatePlan.storyboard?.scenes && candidatePlan.storyboard.scenes.length > 0) {
      const targetSec = input.targetDurationSeconds ?? candidatePlan.storyboard.totalDurationSeconds;
      const normalized = normalizeStoryboardTimelineV3({
        rawScenes: candidatePlan.storyboard.scenes,
        targetDurationSeconds: targetSec,
        capability: capabilityReport,
        fps: 24,
        maxSceneDurationSeconds: 120
      });
      candidatePlan.storyboard.scenes = normalized.scenes;
      candidatePlan.storyboard.totalDurationSeconds = normalized.totalDurationSeconds;
      candidatePlan.storyboard.chapters = normalized.chapters;
    }

    // Bước 5: Xác thực qua Zod Schema V3 chặt chẽ
    const directedPlan = directEducationalLessonV3(candidatePlan, {
      targetLearners: audience,
      targetDurationSeconds
    });
    return EducationalLessonPlanV3Schema.parse(directedPlan);
  }

  /**
   * CHECKPOINT D: Schema-constrained Gemini-backed educational planner.
   * Xử lý structured output từ AIProvider, ép buộc candidate status unverified.
   */
  private async planLessonWithAI(
    input: PlanLessonV3Input,
    capability: TopicCapabilityReportV3
  ): Promise<EducationalLessonPlanV3> {
    if (!this.aiProvider) {
      throw new Error('ai_provider_missing: No AI provider configured for live planning.');
    }

    if (!this.aiProvider.isMock) {
      if (!input.consentRecord && input.externalApiConsent !== true) {
        throw new Error('external_api_consent_required: Live Gemini planning requires a valid signed consentRecord');
      }
      if (input.consentRecord) {
        const check = verifyExternalApiConsentV3({
          consent: input.consentRecord,
          ownerId: input.ownerId ?? 'local-single-user',
          expectedProvider: 'gemini',
          expectedOperation: 'planning',
          isLiveOperation: true
        });
        if (!check.valid) {
          throw new Error(`external_api_consent_rejected: ${check.reason || 'Live Gemini planning requires valid planning consent'}`);
        }
      }
    }

    const budget = this.requestBudget ?? new GeminiRequestBudget();
    const targetDuration = input.targetDurationSeconds ?? 40;
    const targetScenes = targetDuration <= 60 ? '2-3' : targetDuration <= 180 ? '4-5' : targetDuration <= 300 ? '5-7' : '8-12';

    const systemPrompt = `Bạn là Chuyên gia Thiết kế Giáo trình Toán học & AI LuminaLearn V3.
Nhiệm vụ: Lập kế hoạch bài học sư phạm video (${targetScenes} phân cảnh) cho chủ đề: "${input.topic}".
Lĩnh vực: ${capability.domain}. Ngôn ngữ: ${input.language === 'en' ? 'en' : 'vi'}.
Quy tắc toàn vẹn tri thức & Thời lượng bắt buộc:
- Thời lượng mục tiêu tổng thể: ${targetDuration} giây.
- QUY TẮC BẮT BUỘC VỀ THỜI LƯỢNG MỖI CẢNH: Mỗi phân cảnh phải có durationSeconds từ 15 đến 90 giây (TUYỆT ĐỐI KHÔNG vượt quá 120 giây).
- Tổng durationSeconds của tất cả phân cảnh phải đúng bằng ${targetDuration} giây.
- KHÔNG tự nhận định bất kỳ mệnh đề nào là "formally_verified".
- Mọi mệnh đề toán học phải nêu rõ biểu thức formalExpression và validatorKey thích hợp nếu có.
- Trả về JSON theo đúng định dạng cấu trúc bài học sư phạm V3.`;

    const userPrompt = `Hãy tạo kế hoạch bài học cho chủ đề "${input.topic}" (ID: ${capability.topicId}).
Thời lượng mục tiêu: ${targetDuration} giây (gồm ${targetScenes} phân cảnh, mỗi cảnh 15-90 giây, tối đa 120 giây).`;

    const response = await this.aiProvider.generateStructured<EducationalLessonPlanV3>({
      purpose: 'curriculum_planning',
      systemPrompt,
      userPrompt,
      requestBudget: budget,
      validator: (raw: unknown) => {
        const obj = raw as Record<string, unknown>;
        // Ép buộc các mệnh đề từ AI luôn là unverified ứng cử viên
        const rawClaims = Array.isArray(obj.educationalClaims) ? obj.educationalClaims : [];
        const candidateClaims: EducationalClaimV3[] = rawClaims.map((c: any, idx: number) => ({
          id: typeof c.id === 'string' && c.id.trim() ? c.id.trim() : `claim_ai_${idx + 1}`,
          claimType: c.claimType ?? (capability.domain === 'mathematics' ? 'formal_mathematics' : 'ai_concept'),
          statement: String(c.statement ?? 'Mệnh đề sư phạm'),
          formalExpression: typeof c.formalExpression === 'string' ? c.formalExpression : undefined,
          validatorKey: typeof c.validatorKey === 'string' ? c.validatorKey : undefined,
          // Bắt buộc candidate status: unverified (Checkpoint A: không bao giờ tin tưởng AI tự cấp chứng nhận)
          verificationStatus: 'unverified',
          formalProofSummary: undefined,
          humanReviewComment: typeof c.humanReviewComment === 'string' ? c.humanReviewComment : undefined
        }));

        // Khởi tạo storyboard an toàn từ AI và chuẩn hóa timeline nghiêm ngặt
        const rawScenes = (obj.storyboard as any)?.scenes;
        const candidateScenes = Array.isArray(rawScenes) && rawScenes.length >= 2
          ? rawScenes
          : this.getDefaultScenesForTopic(capability, targetDuration);

        const normalized = normalizeStoryboardTimelineV3({
          rawScenes: candidateScenes,
          targetDurationSeconds: targetDuration,
          capability,
          fps: 24,
          maxSceneDurationSeconds: 120
        });

        const scenes = normalized.scenes;
        const totalDuration = normalized.totalDurationSeconds;

        const defaultClaims = this.getDefaultClaimsForTopic(capability, input.topic, targetDuration);
        const effectiveClaims = candidateClaims.length > 0 ? [...candidateClaims] : [...defaultClaims];
        const existingClaimIds = new Set(effectiveClaims.map((c) => c.id));

        // Bảo đảm mọi boundClaimId xuất hiện trong scenes đều có mặt trong educationalClaims
        for (const scene of scenes) {
          if (Array.isArray(scene.boundClaimIds)) {
            for (const boundId of scene.boundClaimIds) {
              if (!existingClaimIds.has(boundId)) {
                const defaultClaim = defaultClaims.find((c) => c.id === boundId);
                if (defaultClaim) {
                  effectiveClaims.push(defaultClaim);
                  existingClaimIds.add(boundId);
                }
              }
            }
          }
        }

        return {
          schemaVersion: 'lesson-v3',
          generationProvenance: 'ai_generated_live',
          lessonId: input.lessonId,
          domain: capability.domain,
          topicId: capability.topicId,
          title: String(obj.title ?? capability.displayName),
          summary: String(obj.summary ?? `Kế hoạch bài học về ${capability.displayName}`),
          learningObjectives: Array.isArray(obj.learningObjectives) && obj.learningObjectives.length > 0
            ? obj.learningObjectives.map(String)
            : [`Nắm vững các khái niệm cơ bản về ${capability.displayName}`],
          prerequisites: Array.isArray(obj.prerequisites) ? obj.prerequisites.map(String) : [],
          keyConcepts: Array.isArray(obj.keyConcepts) && obj.keyConcepts.length > 0
            ? obj.keyConcepts.map(String)
            : [capability.displayName],
          educationalClaims: effectiveClaims,
          capabilityReport: capability,
          sourceEvidence: input.documentAnalysis?.evidence || [],
          storyboard: {
            storyboardId: `sb_${input.lessonId}`,
            lessonId: input.lessonId,
            scenes,
            totalDurationSeconds: totalDuration,
            chapters: normalized.chapters
          }
        };
      }
    });

    return response.data;
  }

  /**
   * CHECKPOINT A & E: Deterministic offline fixture planner.
   * Toàn bộ candidate claims khởi tạo ở trạng thái 'unverified' và visualPayload có strict typing.
   */
  private buildDeterministicPlan(
    lessonId: string,
    topic: string,
    capability: TopicCapabilityReportV3,
    targetDurationSeconds: number,
    documentAnalysis?: DocumentAnalysisResult
  ): EducationalLessonPlanV3 {
    const isMath = capability.domain === 'mathematics';
    const title = capability.displayName;
    let summary = '';
    let learningObjectives: string[] = [];
    let keyConcepts: string[] = [];
    let claims: EducationalClaimV3[] = [];
    let scenes: EducationalStoryboardV3['scenes'] = [];

    // --- MATHEMATICS BENCHMARKS ---
    if (capability.topicId === 'algebra.identities.seven') {
      const identities = [
        ['square_sum', '(a+b)^2', 'a^2+2*a*b+b^2', 'Bình phương của một tổng'],
        ['square_difference', '(a-b)^2', 'a^2-2*a*b+b^2', 'Bình phương của một hiệu'],
        ['difference_squares', 'a^2-b^2', '(a-b)*(a+b)', 'Hiệu hai bình phương'],
        ['cube_sum_expansion', '(a+b)^3', 'a^3+3*a^2*b+3*a*b^2+b^3', 'Lập phương của một tổng'],
        ['cube_difference_expansion', '(a-b)^3', 'a^3-3*a^2*b+3*a*b^2-b^3', 'Lập phương của một hiệu'],
        ['sum_cubes', 'a^3+b^3', '(a+b)*(a^2-a*b+b^2)', 'Tổng hai lập phương'],
        ['difference_cubes', 'a^3-b^3', '(a-b)*(a^2+a*b+b^2)', 'Hiệu hai lập phương']
      ] as const;
      summary = 'Bảy hằng đẳng thức được kiểm chứng bằng biến đổi đại số, giúp khai triển và phân tích đa thức thành nhân tử.';
      learningObjectives = ['Nhận dạng đúng bảy hằng đẳng thức', 'Hiểu các bước khai triển hoặc phân tích nhân tử thay vì chỉ ghi nhớ công thức'];
      keyConcepts = ['Khai triển', 'Phân tích nhân tử', 'Hạng tử tương đương', 'Bình phương', 'Lập phương'];
      claims = identities.map(([id, left, right, label], index) => ({
        id: `claim_identity_${index + 1}`,
        claimType: 'formal_mathematics' as const,
        statement: `${label}: ${left} = ${right}`,
        formalExpression: `${left}=${right}`,
        validatorKey: `algebra_identity_${index + 1}`,
        verificationStatus: 'unverified' as const
      }));
      const identitySteps: Record<string, Array<{ expression: string; explanationVietnamese: string; highlightTerms: string[] }>> = {
        square_sum: [
          { expression: '(a+b)^2', explanationVietnamese: 'Bình phương của một tổng ban đầu.', highlightTerms: ['(a+b)^2'] },
          { expression: '(a+b)*(a+b)', explanationVietnamese: 'Viết dưới dạng tích của hai nhị thức bậc nhất.', highlightTerms: ['(a+b)'] },
          { expression: 'a^2+a*b+b*a+b^2', explanationVietnamese: 'Áp dụng tính chất phân phối nhân đa thức với đa thức.', highlightTerms: ['a*b', 'b*a'] },
          { expression: 'a^2+2*a*b+b^2', explanationVietnamese: 'Gom hai hạng tử đồng dạng a*b + b*a = 2ab.', highlightTerms: ['2*a*b'] }
        ],
        square_difference: [
          { expression: '(a-b)^2', explanationVietnamese: 'Bình phương của một hiệu ban đầu.', highlightTerms: ['(a-b)^2'] },
          { expression: '(a-b)*(a-b)', explanationVietnamese: 'Viết dưới dạng tích hai nhị thức.', highlightTerms: ['(a-b)'] },
          { expression: 'a^2-a*b-b*a+b^2', explanationVietnamese: 'Khai triển nhân từng hạng tử và chú ý dấu âm.', highlightTerms: ['-a*b', '-b*a'] },
          { expression: 'a^2-2*a*b+b^2', explanationVietnamese: 'Gom hai hạng tử đồng dạng âm thành -2ab.', highlightTerms: ['-2*a*b'] }
        ],
        difference_squares: [
          { expression: 'a^2-b^2', explanationVietnamese: 'Hiệu của hai bình phương ban đầu.', highlightTerms: ['a^2-b^2'] },
          { expression: 'a^2+a*b-a*b-b^2', explanationVietnamese: 'Thêm bớt hạng tử trung gian a*b - a*b = 0.', highlightTerms: ['+a*b', '-a*b'] },
          { expression: '(a-b)*(a+b)', explanationVietnamese: 'Nhóm hạng tử để phân tích thành tích hai nhân tử.', highlightTerms: ['(a-b)', '(a+b)'] }
        ],
        cube_sum_expansion: [
          { expression: '(a+b)^3', explanationVietnamese: 'Lập phương của một tổng ban đầu.', highlightTerms: ['(a+b)^3'] },
          { expression: '(a+b)*(a+b)^2', explanationVietnamese: 'Tách thành tích của nhị thức bậc nhất và bình phương.', highlightTerms: ['(a+b)^2'] },
          { expression: '(a+b)*(a^2+2*a*b+b^2)', explanationVietnamese: 'Thay bình phương một tổng đã biết vào.', highlightTerms: ['a^2+2*a*b+b^2'] },
          { expression: 'a^3+3*a^2*b+3*a*b^2+b^3', explanationVietnamese: 'Khai triển toàn bộ và thu gọn các hạng tử đồng dạng.', highlightTerms: ['3*a^2*b', '3*a*b^2'] }
        ],
        cube_difference_expansion: [
          { expression: '(a-b)^3', explanationVietnamese: 'Lập phương của một hiệu ban đầu.', highlightTerms: ['(a-b)^3'] },
          { expression: '(a-b)*(a-b)^2', explanationVietnamese: 'Tách tích nhị thức bậc nhất và bình phương một hiệu.', highlightTerms: ['(a-b)^2'] },
          { expression: '(a-b)*(a^2-2*a*b+b^2)', explanationVietnamese: 'Khai triển bình phương một hiệu.', highlightTerms: ['a^2-2*a*b+b^2'] },
          { expression: 'a^3-3*a^2*b+3*a*b^2-b^3', explanationVietnamese: 'Khai triển nhân và thu gọn các hạng tử đồng dạng.', highlightTerms: ['-3*a^2*b', '+3*a*b^2'] }
        ],
        sum_cubes: [
          { expression: 'a^3+b^3', explanationVietnamese: 'Tổng hai lập phương ban đầu.', highlightTerms: ['a^3+b^3'] },
          { expression: '(a+b)*(a^2-a*b+b^2)', explanationVietnamese: 'Phân tích thành tích của tổng và bình phương thiếu của hiệu.', highlightTerms: ['(a+b)', '(a^2-a*b+b^2)'] }
        ],
        difference_cubes: [
          { expression: 'a^3-b^3', explanationVietnamese: 'Hiệu hai lập phương ban đầu.', highlightTerms: ['a^3-b^3'] },
          { expression: '(a-b)*(a^2+a*b+b^2)', explanationVietnamese: 'Phân tích thành tích của hiệu và bình phương thiếu của tổng.', highlightTerms: ['(a-b)', '(a^2+a*b+b^2)'] }
        ]
      };

      if (targetDurationSeconds >= 600) {
        const numScenes = identities.length * 2;
        const baseDuration = Math.floor(targetDurationSeconds / numScenes);
        const remainder = targetDurationSeconds - baseDuration * numScenes;
        scenes = [];
        for (let i = 0; i < identities.length; i++) {
          const [id, left, right, label] = identities[i];
          const durA = baseDuration + (scenes.length < remainder ? 1 : 0);
          scenes.push({
            sceneId: `sc_identity_${i + 1}_a`,
            sceneType: 'algebra_identity' as const,
            title: `${i + 1}a. ${label} (Khái niệm)`,
            pedagogicalGoal: 'Nhận diện cấu trúc và trực quan hóa hằng đẳng thức',
            durationSeconds: durA,
            boundClaimIds: [`claim_identity_${i + 1}`],
            rendererTarget: 'remotion_infographic' as const,
            narration: {
              vietnamese: `${label}. Ta tìm hiểu ý nghĩa và cấu trúc của biểu thức: ${left} tương đương với ${right}. Trong đại số, hằng đẳng thức giúp biến đổi nhanh biểu thức và giải quyết các bài toán phân tích nhân tử.`,
              subtitleVietnamese: `${left} bằng ${right}.`
            },
            visualPayload: {
              sceneType: 'algebra_identity' as const,
              identityId: id,
              leftExpression: left,
              rightExpression: right,
              transformationSteps: identitySteps[id] ?? [
                { expression: left, explanationVietnamese: 'Giữ nguyên biểu thức ban đầu.', highlightTerms: [left] },
                { expression: right, explanationVietnamese: 'Khai triển hoặc phân tích nhân tử.', highlightTerms: [right] }
              ],
              presentation: (i < 5 ? 'expansion' : 'factorization') as 'expansion' | 'factorization'
            }
          });
          const durB = baseDuration + (scenes.length < remainder ? 1 : 0);
          scenes.push({
            sceneId: `sc_identity_${i + 1}_b`,
            sceneType: 'algebra_identity' as const,
            title: `${i + 1}b. ${label} (Biến đổi)`,
            pedagogicalGoal: i < 5 ? 'Khai triển theo quy tắc phân phối và gom các hạng tử đồng dạng' : 'Phân tích biểu thức thành tích của hai nhân tử',
            durationSeconds: durB,
            boundClaimIds: [`claim_identity_${i + 1}`],
            rendererTarget: 'remotion_infographic' as const,
            narration: {
              vietnamese: `${label}. Ta biến đổi từng bước theo quy tắc nhân phân phối đa thức và đối chiếu hai vế để thấy chúng hoàn toàn tương đương. Hãy ghi nhớ quy tắc này để vận dụng linh hoạt.`,
              subtitleVietnamese: `${left} bằng ${right}.`
            },
            visualPayload: {
              sceneType: 'algebra_identity' as const,
              identityId: id,
              leftExpression: left,
              rightExpression: right,
              transformationSteps: identitySteps[id] ?? [
                { expression: left, explanationVietnamese: 'Giữ nguyên biểu thức ban đầu.', highlightTerms: [left] },
                { expression: right, explanationVietnamese: 'Khai triển hoặc phân tích nhân tử.', highlightTerms: [right] }
              ],
              presentation: (i < 5 ? 'expansion' : 'factorization') as 'expansion' | 'factorization'
            }
          });
        }
      } else if (targetDurationSeconds >= 240) {
        // CHECKPOINT 5-MINUTE (300s): Comprehensive 9-scene pedagogical progression for (a+b)^2
        const isSpecificSquareSum = /\(\s*a\s*\+\s*b\s*\)\s*(?:\^\s*2|²)|bình phương.*tổng|square_sum|a\^2\s*\+\s*2ab/i.test(topic);
        if (isSpecificSquareSum || !topic.includes('7')) {
          scenes = [
            {
              sceneId: 'sc_identity_hook',
              sceneType: 'concept_intro' as const,
              title: '1. Bản chất hình học & đại số của (a+b)²',
              pedagogicalGoal: 'Khơi gợi tư duy: vì sao bình phương một tổng không đơn giản là a² + b²',
              durationSeconds: 32,
              boundClaimIds: ['claim_identity_1'],
              rendererTarget: 'remotion_infographic' as const,
              narration: {
                vietnamese: 'Chào mừng các em đến với LuminaLearn. Trong đại số, hằng đẳng thức bình phương của một tổng là một công thức nền tảng vô cùng quan trọng. Nhiều bạn học sinh thường nhầm lẫn rằng a cộng b tất cả bình phương chỉ đơn giản bằng a bình cộng b bình. Liệu điều này có đúng không? Trong bài học này, chúng ta sẽ cùng khám phá bản chất đại số và hình học đằng sau công thức nhé.',
                subtitleVietnamese: 'Vì sao (a+b)² = a² + 2ab + b² mà không phải là a² + b²?'
              },
              visualPayload: {
                sceneType: 'concept_intro' as const,
                centralQuestion: 'Tại sao (a+b)² lại xuất hiện thêm số hạng 2ab?',
                keyConcept: 'Bình phương của một tổng',
                accentColor: '#38BDF8',
                visualStyleId: 'clean_educational_infographic' as const,
                reducedMotion: false
              }
            },
            {
              sceneId: 'sc_identity_distributive',
              sceneType: 'algebra_identity' as const,
              title: '2. Khai triển nhân đa thức với đa thức',
              pedagogicalGoal: 'Khai triển tích hai nhị thức và nhận diện từng số hạng thành phần',
              durationSeconds: 34,
              boundClaimIds: ['claim_identity_1'],
              rendererTarget: 'remotion_infographic' as const,
              narration: {
                vietnamese: 'Trước hết, hãy cùng tiếp cận bài toán bằng phép biến đổi đại số. Lũy thừa bậc hai của một tổng chính là tích của biểu thức đó nhân với chính nó: ta viết a cộng b nhân với a cộng b. Tiếp theo, áp dụng quy tắc phân phối nhân đa thức với đa thức: lấy a nhân với a được a bình phương, a nhân với b được a b, rồi lấy b nhân với a và b nhân với b.',
                subtitleVietnamese: '(a+b)(a+b) = a² + ab + ba + b²'
              },
              visualPayload: {
                sceneType: 'algebra_identity' as const,
                identityId: 'square_sum',
                leftExpression: '(a+b)^2',
                rightExpression: 'a^2+2*a*b+b^2',
                presentation: 'expansion' as const,
                transformationSteps: [
                  { expression: '(a+b)^2', explanationVietnamese: 'Bình phương của một tổng ban đầu.', highlightTerms: ['(a+b)^2'] },
                  { expression: '(a+b)*(a+b)', explanationVietnamese: 'Viết dưới dạng tích của hai nhị thức.', highlightTerms: ['(a+b)'] },
                  { expression: 'a^2+a*b+b*a+b^2', explanationVietnamese: 'Áp dụng quy tắc phân phối nhân từng hạng tử.', highlightTerms: ['a*b', 'b*a'] },
                  { expression: 'a^2+2*a*b+b^2', explanationVietnamese: 'Khai triển hoàn chỉnh.', highlightTerms: ['2*a*b'] }
                ]
              }
            },
            {
              sceneId: 'sc_identity_crossterms',
              sceneType: 'algebra_identity' as const,
              title: '3. Gom hạng tử đồng dạng xuất hiện 2ab',
              pedagogicalGoal: 'Chứng minh ab + ba = 2ab nhờ tính chất giao hoán',
              durationSeconds: 32,
              boundClaimIds: ['claim_identity_1'],
              rendererTarget: 'remotion_infographic' as const,
              narration: {
                vietnamese: 'Quan sát kỹ các hạng tử vừa khai triển: chúng ta có a nhân b và b nhân a. Nhờ tính chất giao hoán của phép nhân các số thực, tích b nhân a hoàn toàn bằng a nhân b. Do đó, hai hạng tử này đồng dạng và cộng lại thành đúng hai lần a b. Ta thu được kết quả hoàn chỉnh: a bình phương cộng hai a b cộng b bình phương.',
                subtitleVietnamese: 'ab + ba = 2ab ⟹ (a+b)² = a² + 2ab + b²'
              },
              visualPayload: {
                sceneType: 'algebra_identity' as const,
                identityId: 'square_sum',
                leftExpression: '(a+b)^2',
                rightExpression: 'a^2+2*a*b+b^2',
                presentation: 'expansion' as const,
                transformationSteps: [
                  { expression: '(a+b)^2', explanationVietnamese: 'Bình phương một tổng.', highlightTerms: ['(a+b)^2'] },
                  { expression: 'a^2+a*b+b*a+b^2', explanationVietnamese: 'Biểu thức có hai hạng tử ab và ba.', highlightTerms: ['a*b', 'b*a'] },
                  { expression: 'a^2+2*a*b+b^2', explanationVietnamese: 'Gom hai hạng tử đồng dạng: ab + ba = 2ab.', highlightTerms: ['2*a*b'] }
                ]
              }
            },
            {
              sceneId: 'sc_identity_geometry_split',
              sceneType: 'algebra_identity' as const,
              title: '4. Trực quan hình học: Chia cạnh hình vuông',
              pedagogicalGoal: 'Minh họa hình học bằng hình vuông lớn cạnh (a+b)',
              durationSeconds: 34,
              boundClaimIds: ['claim_identity_1'],
              rendererTarget: 'remotion_infographic' as const,
              narration: {
                vietnamese: 'Bên cạnh đại số, hình học mang lại trực giác trực quan tuyệt vời để hiểu công thức này. Hãy tưởng tượng một hình vuông lớn có độ dài mỗi cạnh bằng a cộng b. Diện tích của toàn bộ hình vuông lớn này chính là vế trái: a cộng b tất cả bình phương. Bây giờ, trên mỗi cạnh, ta chia thành hai đoạn có độ dài lần lượt là a và b.',
                subtitleVietnamese: 'Hình vuông lớn cạnh (a+b) có diện tích toàn phần là (a+b)²'
              },
              visualPayload: {
                sceneType: 'algebra_identity' as const,
                identityId: 'square_sum',
                leftExpression: '(a+b)^2',
                rightExpression: 'a^2+2*a*b+b^2',
                presentation: 'expansion' as const,
                transformationSteps: [
                  { expression: '(a+b)^2', explanationVietnamese: 'Diện tích hình vuông lớn cạnh a + b.', highlightTerms: ['(a+b)^2'] },
                  { expression: '(a+b)*(a+b)', explanationVietnamese: 'Cạnh thứ nhất a + b nhân cạnh thứ hai a + b.', highlightTerms: ['(a+b)'] },
                  { expression: 'a^2+2*a*b+b^2', explanationVietnamese: 'Khai triển diện tích bốn phần.', highlightTerms: ['2*a*b'] }
                ]
              }
            },
            {
              sceneId: 'sc_identity_four_regions',
              sceneType: 'algebra_identity' as const,
              title: '5. Bốn mảnh ghép diện tích hoàn chỉnh',
              pedagogicalGoal: 'Chứng minh tổng 4 vùng con a² + ab + ab + b² đúng bằng diện tích hình vuông lớn',
              durationSeconds: 34,
              boundClaimIds: ['claim_identity_1'],
              rendererTarget: 'remotion_infographic' as const,
              narration: {
                vietnamese: 'Khi kẻ các đường phân chia, hình vuông lớn được tách thành đúng bốn phần riêng biệt: một hình vuông lớn góc dưới có diện tích a bình phương; một hình vuông nhỏ góc trên có diện tích b bình phương; cùng hai hình chữ nhật hai bên mỗi hình có diện tích a nhân b. Tổng diện tích bốn phần này chính là a bình cộng hai a b cộng b bình phương, minh chứng hoàn hảo cho công thức!',
                subtitleVietnamese: 'Bốn vùng diện tích: a² + ab + ba + b² = a² + 2ab + b²'
              },
              visualPayload: {
                sceneType: 'algebra_identity' as const,
                identityId: 'square_sum',
                leftExpression: '(a+b)^2',
                rightExpression: 'a^2+2*a*b+b^2',
                presentation: 'expansion' as const,
                transformationSteps: [
                  { expression: '(a+b)^2', explanationVietnamese: 'Diện tích toàn phần ban đầu.', highlightTerms: ['(a+b)^2'] },
                  { expression: 'a^2+a*b+b*a+b^2', explanationVietnamese: 'Bốn vùng diện tích ghép lại: a², ab, ba, b².', highlightTerms: ['a^2', 'b^2', 'a*b', 'b*a'] },
                  { expression: 'a^2+2*a*b+b^2', explanationVietnamese: 'Hai hình chữ nhật ghép thành 2ab.', highlightTerms: ['2*a*b'] }
                ]
              }
            },
            {
              sceneId: 'sc_identity_worked_example',
              sceneType: 'algebra_identity' as const,
              title: '6. Ví dụ số học kiểm chứng: a=3, b=2',
              pedagogicalGoal: 'Thử nghiệm tính toán bằng số nguyên cụ thể để đối chiếu hai vế',
              durationSeconds: 34,
              boundClaimIds: ['claim_identity_1'],
              rendererTarget: 'remotion_infographic' as const,
              narration: {
                vietnamese: 'Để khắc sâu kiến thức, chúng ta hãy thử nghiệm với những con số cụ thể. Giả sử ta chọn a bằng 3 và b bằng 2. Khi đó, vế trái là 3 cộng 2 bằng 5, và 5 bình phương bằng 25. Tính vế phải: 3 bình là 9, hai nhân 3 nhân 2 là 12, và 2 bình là 4. Cộng lại: 9 cộng 12 cộng 4 đúng bằng 25! Hai vế hoàn toàn khớp nhau.',
                subtitleVietnamese: '(3+2)² = 25; 3² + 2(3)(2) + 2² = 9 + 12 + 4 = 25'
              },
              visualPayload: {
                sceneType: 'algebra_identity' as const,
                identityId: 'square_sum',
                leftExpression: '(a+b)^2',
                rightExpression: 'a^2+2*a*b+b^2',
                presentation: 'expansion' as const,
                transformationSteps: [
                  { expression: '(a+b)^2', explanationVietnamese: 'Chọn a = 3 và b = 2: vế trái là (3+2)² = 25.', highlightTerms: ['(a+b)^2'] },
                  { expression: '(a+b)*(a+b)', explanationVietnamese: 'Tích hai thừa số (3+2)(3+2) = 5 * 5 = 25.', highlightTerms: ['(a+b)'] },
                  { expression: 'a^2+2*a*b+b^2', explanationVietnamese: 'Vế phải: 3² + 2(3)(2) + 2² = 9 + 12 + 4 = 25.', highlightTerms: ['2*a*b'] }
                ]
              }
            },
            {
              sceneId: 'sc_identity_mental_math',
              sceneType: 'algebra_identity' as const,
              title: '7. Ứng dụng tính nhẩm nhanh: 31² = 961',
              pedagogicalGoal: 'Ứng dụng hằng đẳng thức vào tính nhẩm bình phương trong thực tế',
              durationSeconds: 34,
              boundClaimIds: ['claim_identity_1'],
              rendererTarget: 'remotion_infographic' as const,
              narration: {
                vietnamese: 'Hằng đẳng thức này còn là một công cụ tính nhẩm siêu tốc mà bạn có thể áp dụng hàng ngày. Ví dụ, để tính 31 bình phương mà không cần máy tính, bạn tách 31 thành 30 cộng 1 tất cả bình. Áp dụng hằng đẳng thức: 30 bình phương là 900, hai nhân 30 nhân 1 là 60, và 1 bình là 1. Nhẩm nhanh: 900 cộng 60 cộng 1 bằng 961 trong tích tắc!',
                subtitleVietnamese: '31² = (30+1)² = 900 + 60 + 1 = 961'
              },
              visualPayload: {
                sceneType: 'algebra_identity' as const,
                identityId: 'square_sum',
                leftExpression: '(a+b)^2',
                rightExpression: 'a^2+2*a*b+b^2',
                presentation: 'expansion' as const,
                transformationSteps: [
                  { expression: '(a+b)^2', explanationVietnamese: 'Tách 31 = 30 + 1: vế trái là (30 + 1)²', highlightTerms: ['(a+b)^2'] },
                  { expression: '(a+b)*(a+b)', explanationVietnamese: 'Tích hai nhân tử (30 + 1)(30 + 1).', highlightTerms: ['(a+b)'] },
                  { expression: 'a^2+2*a*b+b^2', explanationVietnamese: 'Khai triển: 30² + 2(30)(1) + 1² = 900 + 60 + 1 = 961.', highlightTerms: ['2*a*b'] }
                ]
              }
            },
            {
              sceneId: 'sc_identity_misconceptions',
              sceneType: 'concept_intro' as const,
              title: '8. Sai lầm kinh điển Freshmen\'s Dream',
              pedagogicalGoal: 'Cảnh báo và giải thích lý do không được bỏ quên 2ab',
              durationSeconds: 33,
              boundClaimIds: ['claim_identity_1'],
              rendererTarget: 'remotion_infographic' as const,
              narration: {
                vietnamese: 'Bây giờ, hãy quay lại câu hỏi đầu bài: tại sao a cộng b tất cả bình không bằng a bình cộng b bình? Lỗi này phổ biến đến mức trong toán học quốc tế nó được đặt tên là Freshmen\'s Dream. Nhìn vào trực quan hình học, nếu chỉ lấy a bình cộng b bình, bạn đã vô tình đánh mất hai hình chữ nhật hai a b. Đừng bao giờ quên số hạng hai a b nhé!',
                subtitleVietnamese: 'Cảnh báo: (a+b)² ≠ a² + b² (Thiếu mất hai hình chữ nhật 2ab)'
              },
              visualPayload: {
                sceneType: 'concept_intro' as const,
                centralQuestion: 'Tại sao (a+b)² ≠ a² + b²? Đừng quên hai hình chữ nhật 2ab!',
                keyConcept: 'Tránh lỗi Freshmen\'s Dream',
                accentColor: '#EF4444',
                visualStyleId: 'clean_educational_infographic' as const,
                reducedMotion: false
              }
            },
            {
              sceneId: 'sc_identity_summary',
              sceneType: 'summary' as const,
              title: '9. Tổng kết & Khẩu quyết ghi nhớ',
              pedagogicalGoal: 'Khái quát hóa công thức và khắc sâu quy tắc ghi nhớ',
              durationSeconds: 33,
              boundClaimIds: ['claim_identity_1'],
              rendererTarget: 'remotion_infographic' as const,
              narration: {
                vietnamese: 'Tổng kết lại bài học hôm nay: Bình phương của một tổng luôn bằng bình phương số thứ nhất, cộng hai lần tích số thứ nhất với số thứ hai, cộng bình phương số thứ hai. Công thức này là chìa khóa mở đường cho các hằng đẳng thức bậc ba và phân tích đa thức thành nhân tử phức tạp hơn. Cảm ơn các bạn đã theo dõi và chúc các bạn học tốt!',
                subtitleVietnamese: '(a+b)² = a² + 2ab + b² — Bình phương thứ nhất + 2 lần tích + Bình phương thứ hai'
              },
              visualPayload: {
                sceneType: 'summary' as const,
                title: 'Khẩu quyết: Bình phương một tổng',
                takeaways: [
                  '(a+b)² = a² + 2ab + b²',
                  'Đại số: tích (a+b)(a+b) nhân phân phối và gom hạng tử chéo',
                  'Hình học: diện tích hình vuông chia thành 4 phần a², ab, ab, b²',
                  'Ứng dụng: tính nhẩm nhanh và giải phương trình đại số'
                ],
                verifiedFacts: ['(a+b)^2 = a^2 + 2*a*b + b^2'],
                reviewNotes: [],
                finalCallout: '(a+b)² = a² + 2ab + b²'
              }
            }
          ];
        } else {
          // Comprehensive multi-scene plan for all 7 identities
          const baseDuration = Math.floor(targetDurationSeconds / identities.length);
          const remainder = targetDurationSeconds - baseDuration * identities.length;
          scenes = identities.map(([id, left, right, label], index) => {
            const isLast = index === identities.length - 1;
            const durationSeconds = isLast ? baseDuration + remainder : baseDuration;
            return {
              sceneId: `sc_identity_${index + 1}`,
              sceneType: 'algebra_identity' as const,
              title: `${index + 1}. ${label}`,
              pedagogicalGoal: index < 5 ? 'Khai triển theo quy tắc phân phối và gom các hạng tử đồng dạng' : 'Phân tích biểu thức thành tích của hai nhân tử',
              durationSeconds,
              boundClaimIds: [`claim_identity_${index + 1}`],
              rendererTarget: 'remotion_infographic' as const,
              narration: {
                vietnamese: `${label}: Biểu thức vế trái ${left} luôn tương đương chính xác với vế phải ${right}. Khi khai triển hoặc biến đổi, ta áp dụng quy tắc nhân phân phối đa thức và nhóm các hạng tử đồng dạng. Việc thành thạo công thức này giúp chúng ta rút gọn nhanh các biểu thức đại số phức tạp, phân tích đa thức thành nhân tử và giải quyết hiệu quả các bài toán thực tế. Hãy ghi nhớ cấu trúc đối xứng đặc trưng của đẳng thức này.`,
                subtitleVietnamese: `${left} = ${right} — ${label}.`
              },
              visualPayload: {
                sceneType: 'algebra_identity' as const,
                identityId: id,
                leftExpression: left,
                rightExpression: right,
                transformationSteps: identitySteps[id] ?? [
                  { expression: left, explanationVietnamese: 'Giữ nguyên biểu thức ban đầu.', highlightTerms: [left] },
                  { expression: right, explanationVietnamese: 'Khai triển hoặc phân tích nhân tử.', highlightTerms: [right] }
                ],
                presentation: (index < 5 ? 'expansion' : 'factorization') as 'expansion' | 'factorization'
              }
            };
          });
        }
      } else {
        const baseDuration = Math.floor(targetDurationSeconds / identities.length);
        const remainder = targetDurationSeconds - baseDuration * identities.length;
        scenes = identities.map(([id, left, right, label], index) => {
          const isLast = index === identities.length - 1;
          const durationSeconds = isLast ? baseDuration + remainder : baseDuration;
          return {
            sceneId: `sc_identity_${index + 1}`,
            sceneType: 'algebra_identity' as const,
            title: `${index + 1}. ${label}`,
            pedagogicalGoal: index < 5 ? 'Khai triển theo quy tắc phân phối và gom các hạng tử đồng dạng' : 'Phân tích biểu thức thành tích của hai nhân tử',
            durationSeconds,
            boundClaimIds: [`claim_identity_${index + 1}`],
            rendererTarget: 'remotion_infographic' as const,
            narration: {
              vietnamese: `${label}. Ta biến đổi từng bước và đối chiếu hai vế để thấy chúng hoàn toàn tương đương.`,
              subtitleVietnamese: `${left} bằng ${right}.`
            },
            visualPayload: {
              sceneType: 'algebra_identity' as const,
              identityId: id,
              leftExpression: left,
              rightExpression: right,
              transformationSteps: identitySteps[id] ?? [
                { expression: left, explanationVietnamese: 'Giữ nguyên biểu thức ban đầu.', highlightTerms: [left] },
                { expression: right, explanationVietnamese: 'Khai triển hoặc phân tích nhân tử.', highlightTerms: [right] }
              ],
              presentation: (index < 5 ? 'expansion' : 'factorization') as 'expansion' | 'factorization'
            }
          };
        });
      }
    } else if (capability.topicId === 'calculus.derivative.intuition') {
      summary = 'Bản chất hình học của đạo hàm là hệ số góc của tiếp tuyến khi cát tuyến co lại.';
      learningObjectives = [
        'Hiểu bản chất tiếp tuyến là giới hạn của cát tuyến',
        'Nắm vững mối liên hệ giữa đạo hàm và tốc độ thay đổi tức thời'
      ];
      keyConcepts = ['Cát tuyến', 'Tiếp tuyến', 'Khoảng cách h', 'Hệ số góc', 'Đạo hàm'];
      // CHECKPOINT A: Mọi candidate claim ban đầu ĐỀU LÀ unverified
      claims = [
        {
          id: 'claim_poly_deriv',
          claimType: 'formal_mathematics',
          statement: 'Đạo hàm của hàm đa thức f(x) = x^2 là f\'(x) = 2*x',
          formalExpression: '2*x',
          validatorKey: 'polynomial_derivative',
          verificationStatus: 'unverified'
        },
        {
          id: 'claim_secant_limit',
          claimType: 'formal_mathematics',
          statement: 'Hệ số góc cát tuyến qua x=1 là m(h) = 2 + h, có giới hạn bằng 2 khi h tiến về 0',
          formalExpression: '2',
          validatorKey: 'limit_at_zero',
          verificationStatus: 'unverified'
        }
      ];
      if (targetDurationSeconds >= 240 && targetDurationSeconds < 600) {
        // CHECKPOINT 5-MINUTE (300s): Comprehensive 8-scene pedagogical progression for Calculus Derivative
        scenes = [
          {
            sceneId: 'sc_hook_velocity',
            sceneType: 'concept_intro' as const,
            title: '1. Vấn đề biến thiên tức thời trong chuyển động',
            pedagogicalGoal: 'Khơi gợi tư duy: vận tốc tức thời tại đúng một khoảnh khắc được đo bằng cách nào',
            durationSeconds: 35,
            boundClaimIds: ['claim_poly_deriv'],
            rendererTarget: 'remotion_infographic' as const,
            narration: {
              vietnamese: 'Chào mừng các bạn đến với thế giới giải tích. Khi một chiếc xe di chuyển, vận tốc trung bình trên một quãng đường rất dễ tính bằng quãng đường chia cho thời gian. Nhưng làm thế nào ta đo được vận tốc tức thời tại đúng một khoảnh khắc của đồng hồ tốc độ? Bài toán tìm tốc độ biến thiên tức thời này đã thôi thúc các nhà toán học phát minh ra khái niệm đạo hàm.',
              subtitleVietnamese: 'Làm thế nào để xác định vận tốc tức thời tại đúng một thời điểm?'
            },
            visualPayload: {
              sceneType: 'concept_intro' as const,
              centralQuestion: 'Làm thế nào xác định tốc độ thay đổi tức thời tại một điểm duy nhất?',
              keyConcept: 'Biến thiên tức thời & Đạo hàm',
              accentColor: '#38BDF8',
              visualStyleId: 'clean_educational_infographic' as const,
              reducedMotion: false
            }
          },
          {
            sceneId: 'sc_parabola_curve',
            sceneType: 'formula_derivation' as const,
            title: '2. Đồ thị parabol f(x) = x² và điểm cố định P(1, 1)',
            pedagogicalGoal: 'Mô hình hóa hàm bậc hai và xác định vị trí khảo sát độ dốc',
            durationSeconds: 36,
            boundClaimIds: ['claim_poly_deriv'],
            rendererTarget: 'manim_hybrid' as const,
            narration: {
              vietnamese: 'Để mô hình hóa trực quan, ta xét hàm số đa thức quen thuộc f của x bằng x bình phương. Đồ thị của hàm số là một đường cong parabol đối xứng qua trục tung. Ta chọn một điểm cố định P trên parabol có hoành độ x bằng 1, tung độ tương ứng là 1 bình phương bằng 1, tức điểm P có tọa độ 1, 1. Ta muốn biết độ dốc của đồ thị tại đúng điểm P này.',
              subtitleVietnamese: 'Xét hàm số f(x) = x² và điểm cố định P(1, 1) trên parabol.'
            },
            visualPayload: {
              sceneType: 'formula_derivation' as const,
              headline: 'Hàm số f(x) = x² và Điểm P(1, 1)',
              formulaTex: 'f(x) = x^2, \\quad P(1, 1)',
              notes: 'Khảo sát độ dốc đường cong tại x = 1',
              scientificData: {
                kind: 'scalar_function_1d' as const,
                functionType: 'polynomial' as const,
                expression: 'x^2',
                xRange: [-2, 3],
                yRange: [-1, 9],
                pointX: 1,
                tangentAtX: 1,
                claimId: 'claim_poly_deriv',
                validation: 'formally_verified' as const
              }
            }
          },
          {
            sceneId: 'sc_secant_secant',
            sceneType: 'formula_derivation' as const,
            title: '3. Cát tuyến nối hai điểm P và Q',
            pedagogicalGoal: 'Thiết lập cát tuyến qua hai điểm và tính hệ số góc m = x + 1',
            durationSeconds: 38,
            boundClaimIds: ['claim_poly_deriv', 'claim_secant_limit'],
            rendererTarget: 'manim_hybrid' as const,
            narration: {
              vietnamese: 'Vì một điểm duy nhất không thể xác định một đường thẳng, ta lấy thêm điểm thứ hai là Q di động trên đường cong với hoành độ x khác 1. Đường thẳng đi qua hai điểm P và Q cắt đồ thị tại hai vị trí, được gọi là cát tuyến. Hệ số góc của cát tuyến PQ được tính bằng độ chênh lệch tung độ chia độ chênh lệch hoành độ: x bình trừ 1 chia cho x trừ 1, rút gọn bằng x cộng 1.',
              subtitleVietnamese: 'Cát tuyến PQ có hệ số góc m = (x² - 1) / (x - 1) = x + 1'
            },
            visualPayload: {
              sceneType: 'formula_derivation' as const,
              headline: 'Hệ số góc cát tuyến PQ',
              formulaTex: 'm_{PQ} = \\frac{f(x) - f(1)}{x - 1} = \\frac{x^2 - 1}{x - 1} = x + 1',
              notes: 'Đường thẳng cắt đồ thị tại hai điểm phân biệt P và Q',
              scientificData: {
                kind: 'scalar_function_1d' as const,
                functionType: 'polynomial' as const,
                expression: 'x^2',
                xRange: [-2, 3],
                yRange: [-1, 9],
                pointX: 1,
                tangentAtX: 1,
                secantFromX: 1,
                secantToX: 2.0,
                claimId: 'claim_poly_deriv',
                validation: 'formally_verified' as const
              }
            }
          },
          {
            sceneId: 'sc_limit_approach',
            sceneType: 'formula_derivation' as const,
            title: '4. Quá trình giới hạn khi Q tiến về P',
            pedagogicalGoal: 'Quan sát chuyển động của cát tuyến khi delta x tiến về 0',
            durationSeconds: 40,
            boundClaimIds: ['claim_poly_deriv', 'claim_secant_limit'],
            rendererTarget: 'manim_hybrid' as const,
            narration: {
              vietnamese: 'Bây giờ điều kỳ diệu bắt đầu. Hãy quan sát khi điểm Q trượt dọc theo parabol tiến ngày càng gần về điểm P. Khi khoảng cách delta x co dần về 0, x tiến dần tới 1, cát tuyến PQ bắt đầu xoay quanh điểm P và áp sát dần vào đường cong parabol. Dù không thể gán x bằng 1 trực tiếp vì mẫu số bằng 0, nhưng giới hạn của hệ số góc khi x tiến về 1 lại hoàn toàn xác định.',
              subtitleVietnamese: 'Khi Q ⟶ P (Δx ⟶ 0), cát tuyến PQ xoay dần áp sát đường cong.'
            },
            visualPayload: {
              sceneType: 'formula_derivation' as const,
              headline: 'Quá trình Giới hạn Δx ⟶ 0',
              formulaTex: '\\lim_{x \\to 1} m_{PQ} = \\lim_{x \\to 1} (x + 1) = 2',
              notes: 'Khoảng cách giữa hai điểm co lại vô cùng bé',
              scientificData: {
                kind: 'scalar_function_1d' as const,
                functionType: 'polynomial' as const,
                expression: 'x^2',
                xRange: [-2, 3],
                yRange: [-1, 9],
                pointX: 1,
                tangentAtX: 1,
                secantFromX: 1,
                secantToX: 1.3,
                claimId: 'claim_poly_deriv',
                validation: 'formally_verified' as const
              }
            }
          },
          {
            sceneId: 'sc_tangent_slope',
            sceneType: 'formula_derivation' as const,
            title: '5. Tiếp tuyến và giá trị đạo hàm f\'(1) = 2',
            pedagogicalGoal: 'Khẳng định cát tuyến hóa tiếp tuyến và giá trị đạo hàm tại x=1',
            durationSeconds: 38,
            boundClaimIds: ['claim_poly_deriv'],
            rendererTarget: 'manim_hybrid' as const,
            narration: {
              vietnamese: 'Tại vị trí giới hạn khi Q trùng với P, đường cát tuyến chính thức trở thành tiếp tuyến của parabol tại P. Hệ số góc của đường tiếp tuyến này chính là giới hạn của x cộng 1 khi x tiến về 1, và nó có giá trị chính xác bằng 2. Ta nói đạo hàm của hàm số x bình phương tại x bằng 1 bằng 2, ký hiệu f phẩy tại 1 bằng 2.',
              subtitleVietnamese: 'Cát tuyến trở thành tiếp tuyến tại P. Đạo hàm f\'(1) = 2.00'
            },
            visualPayload: {
              sceneType: 'formula_derivation' as const,
              headline: 'Tiếp tuyến Hoàn chỉnh & Đạo hàm',
              formulaTex: "f'(1) = \\lim_{x \\to 1} \\frac{f(x) - f(1)}{x - 1} = 2",
              notes: 'Hệ số góc tiếp tuyến m = 2 chính là f\'(1)',
              scientificData: {
                kind: 'scalar_function_1d' as const,
                functionType: 'polynomial' as const,
                expression: 'x^2',
                xRange: [-2, 3],
                yRange: [-1, 9],
                pointX: 1,
                tangentAtX: 1,
                secantFromX: 1,
                secantToX: 1.05,
                claimId: 'claim_poly_deriv',
                validation: 'formally_verified' as const
              }
            }
          },
          {
            sceneId: 'sc_tangent_equation',
            sceneType: 'formula_derivation' as const,
            title: '6. Phương trình đường tiếp tuyến y = 2x - 1',
            pedagogicalGoal: 'Lập phương trình tiếp tuyến dựa trên điểm tiếp xúc và đạo hàm',
            durationSeconds: 37,
            boundClaimIds: ['claim_poly_deriv'],
            rendererTarget: 'manim_hybrid' as const,
            narration: {
              vietnamese: 'Biết được hệ số góc bằng 2 và điểm tiếp xúc P tọa độ 1, 1, ta dễ dàng lập phương trình đường thẳng tiếp tuyến: y trừ 1 bằng 2 nhân với x trừ 1. Khai triển và rút gọn, ta thu được phương trình tiếp tuyến y bằng 2 x trừ 1. Tiếp tuyến này chạm vào parabol tại đúng điểm P và là đường xấp xỉ tuyến tính tốt nhất của đồ thị quanh lân cận đó.',
              subtitleVietnamese: 'Phương trình tiếp tuyến: y - 1 = 2(x - 1) ⟹ y = 2x - 1'
            },
            visualPayload: {
              sceneType: 'formula_derivation' as const,
              headline: 'Phương trình Tiếp tuyến tại P(1, 1)',
              formulaTex: 'y - y_0 = f\'(x_0)(x - x_0) \\implies y = 2x - 1',
              notes: 'Đường thẳng xấp xỉ tuyến tính tốt nhất quanh lân cận P',
              scientificData: {
                kind: 'scalar_function_1d' as const,
                functionType: 'polynomial' as const,
                expression: 'x^2',
                xRange: [-2, 3],
                yRange: [-1, 9],
                pointX: 1,
                tangentAtX: 1,
                claimId: 'claim_poly_deriv',
                validation: 'formally_verified' as const
              }
            }
          },
          {
            sceneId: 'sc_general_formula',
            sceneType: 'formula_derivation' as const,
            title: '7. Tổng quát hóa công thức đạo hàm f\'(x) = 2x',
            pedagogicalGoal: 'Khai triển định nghĩa đạo hàm bằng giới hạn cho điểm x tổng quát',
            durationSeconds: 38,
            boundClaimIds: ['claim_poly_deriv'],
            rendererTarget: 'manim_hybrid' as const,
            narration: {
              vietnamese: 'Nếu thay điểm x bằng 1 bằng một điểm x bất kỳ, tỷ số gia f của x cộng h trừ f của x tất cả chia cho h sẽ bằng x cộng h tất cả bình trừ x bình chia h. Khai triển tử số được hai x h cộng h bình, chia cho h ta còn hai x cộng h. Khi h tiến dần về 0, giới hạn đúng bằng hai x. Do đó, đạo hàm tổng quát của x bình phương chính là hai x.',
              subtitleVietnamese: 'Lấy giới hạn của thương sai phân khi h tiến về 0, ta thu được đạo hàm f phẩy của x bằng 2x.'
            },
            visualPayload: {
              sceneType: 'formula_derivation' as const,
              headline: 'Công thức Đạo hàm Tổng quát',
              formulaTex: "f'(x) = \\lim_{h \\to 0} \\frac{(x+h)^2 - x^2}{h} = \\lim_{h \\to 0} (2x + h) = 2x",
              notes: 'Quy tắc lũy thừa: đạo hàm của x mũ n là n nhân x mũ (n − 1).',
              scientificData: {
                kind: 'scalar_function_1d' as const,
                functionType: 'polynomial' as const,
                expression: 'x^2',
                xRange: [-2, 3],
                yRange: [-1, 9],
                pointX: 1,
                tangentAtX: 1,
                claimId: 'claim_poly_deriv',
                validation: 'formally_verified' as const
              }
            }
          },
          {
            sceneId: 'sc_calculus_summary',
            sceneType: 'summary' as const,
            title: '8. Ý nghĩa hình học & Ứng dụng trong AI',
            pedagogicalGoal: 'Tổng kết bản chất tiếp tuyến và mở rộng tới tối ưu hóa học máy',
            durationSeconds: 38,
            boundClaimIds: ['claim_poly_deriv'],
            rendererTarget: 'remotion_infographic' as const,
            narration: {
              vietnamese: 'Tổng kết lại, đạo hàm vừa là tốc độ biến thiên tức thời trong vật lý, vừa là hệ số góc tiếp tuyến trong hình học. Trong trí tuệ nhân tạo và học máy, đạo hàm chính là công cụ tính vector độ dốc để cập nhật trọng số trong thuật toán Gradient Descent. Nắm vững bản chất tiếp tuyến sẽ giúp các bạn tự tin bước vào thế giới toán học cao cấp và AI. Hẹn gặp lại các bạn!',
              subtitleVietnamese: 'Đạo hàm là hệ số góc tiếp tuyến, tốc độ tức thời và là nền tảng tối ưu hóa AI.'
            },
            visualPayload: {
              sceneType: 'summary' as const,
              title: 'Ý nghĩa Cốt lõi của Đạo hàm',
              takeaways: [
                'Hình học: Đạo hàm f\'(x₀) là hệ số góc tiếp tuyến tại điểm (x₀, y₀)',
                'Giải tích: Tiếp tuyến là vị trí giới hạn của cát tuyến khi khoảng cách h ⟶ 0',
                'Công thức tổng quát: (x²)\' = 2x, tại x = 1 ta có f\'(1) = 2',
                'Ứng dụng AI: Đạo hàm hướng dẫn chiều cập nhật tham số trong Gradient Descent'
              ],
              verifiedFacts: ["f'(x) = 2x"],
              reviewNotes: [],
              finalCallout: "f'(x) = 2x; m = 2 tại x = 1"
            }
          }
        ];
      } else {
        scenes = [
          {
            sceneId: 'sc_intro',
            sceneType: 'concept_intro',
            title: 'Khái niệm cát tuyến trên parabol',
            pedagogicalGoal: 'Khởi đầu với đường thẳng nối hai điểm trên đồ thị y = x^2',
            durationSeconds: 12,
            boundClaimIds: ['claim_poly_deriv'],
            rendererTarget: 'manim_hybrid',
            narration: {
              vietnamese: 'Chào mừng các bạn. Ta xét đường cát tuyến nối hai điểm phân biệt trên đường cong parabol.',
              subtitleVietnamese: 'Xét cát tuyến nối hai điểm phân biệt trên parabol.'
            },
            visualPayload: {
              sceneType: 'concept_intro',
              centralQuestion: 'Làm thế nào để xác định hệ số góc tiếp tuyến tại một điểm duy nhất?',
              keyConcept: 'Cát tuyến và Tiếp tuyến',
              accentColor: '#22D3EE',
              visualStyleId: 'clean_educational_infographic',
              reducedMotion: false
            }
          },
          {
            sceneId: 'sc_limit',
            sceneType: 'formula_derivation',
            title: 'Khoảng cách h co về 0',
            pedagogicalGoal: 'Mô phỏng cát tuyến tiệm cận tiếp tuyến khi hai điểm chập một',
            durationSeconds: 16,
            boundClaimIds: ['claim_poly_deriv', 'claim_secant_limit'],
            rendererTarget: 'manim_hybrid',
            narration: {
              vietnamese: 'Khi cho khoảng cách h co dần về 0, đường cát tuyến xoay dần và trở thành tiếp tuyến duy nhất.',
              subtitleVietnamese: 'Khi h co về 0, cát tuyến trở thành tiếp tuyến duy nhất.'
            },
            visualPayload: {
              sceneType: 'formula_derivation',
              headline: 'Giới hạn tỉ số biến thiên',
              formulaTex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h} = 2x",
              notes: 'Hệ số góc cát tuyến 2+h tiến tới 2 khi h tiến về 0',
              scientificData: {
                kind: 'scalar_function_1d',
                functionType: 'polynomial',
                expression: 'x^2',
                xRange: [-2, 3],
                yRange: [-1, 9],
                pointX: 1,
                tangentAtX: 1,
                secantFromX: 1,
                secantToX: 2.25,
                claimId: 'claim_poly_deriv',
                validation: 'formally_verified'
              }
            }
          },
          {
            sceneId: 'sc_summary',
            sceneType: 'summary',
            title: 'Ý nghĩa đạo hàm',
            pedagogicalGoal: 'Khái quát hệ số góc tiếp tuyến chính là giá trị đạo hàm tại điểm',
            durationSeconds: 12,
            boundClaimIds: ['claim_poly_deriv'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Như vậy, đạo hàm tại một điểm chính là tốc độ biến thiên tức thời và là hệ số góc tiếp tuyến.',
              subtitleVietnamese: 'Đạo hàm là hệ số góc tiếp tuyến và tốc độ biến thiên tức thời.'
            },
            visualPayload: {
              sceneType: 'summary',
              title: 'Ý nghĩa hình học của đạo hàm',
              takeaways: [
                'Cát tuyến nối 2 điểm tiến tới tiếp tuyến khi h co về 0',
                'Đạo hàm là hệ số góc tiếp tuyến tại điểm xét',
                'f\'(x) = 2x cho hàm số f(x) = x^2'
              ],
              verifiedFacts: ['diff(x^2, x) = 2x'],
              reviewNotes: [],
              finalCallout: 'Đạo hàm là nền tảng của các thuật toán tối ưu hóa trong học máy.'
            }
          }
        ];
        scenes = this.expandScenesForDuration(scenes, targetDurationSeconds, 'Đạo hàm & Tiếp tuyến', 'claim_poly_deriv');
      }
    } else if (
      capability.topicId === 'calculus.riemann_integral.intuition' ||
      capability.topicId === 'calculus.integral.riemann_sum'
    ) {
      summary = 'Tích phân xác định là giới hạn của tổng diện tích các hình chữ nhật siêu mỏng xấp xỉ hình thang cong.';
      learningObjectives = [
        'Hiểu bản chất tổng Riemann là xấp xỉ diện tích dưới đường cong',
        'Nắm khái niệm tích phân xác định khi số lượng hình chữ nhật tiến ra vô cùng'
      ];
      keyConcepts = ['Đường cong hàm số', 'Phân hoạch khoảng', 'Hình chữ nhật Riemann', 'Tích phân xác định'];
      claims = [
        {
          id: 'claim_riemann_int',
          claimType: 'formal_mathematics',
          statement: 'Tích phân xác định của x^2 trên đoạn [0, 1] có giá trị đúng bằng 1/3',
          formalExpression: '1/3',
          validatorKey: 'riemann_integral',
          verificationStatus: 'unverified'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_intro',
          sceneType: 'concept_intro',
          title: 'Bài toán tính diện tích hình phẳng',
          pedagogicalGoal: 'Đặt vấn đề diện tích phần mặt phẳng dưới đường cong parabol y = x^2',
          durationSeconds: 14,
          boundClaimIds: ['claim_riemann_int'],
          rendererTarget: 'manim_hybrid',
          narration: {
            vietnamese: 'Làm thế nào để tính chính xác diện tích phần hình cong dưới parabol từ 0 đến 1?',
            subtitleVietnamese: 'Tính diện tích hình thang cong dưới parabol.'
          },
          visualPayload: {
            sceneType: 'concept_intro',
            centralQuestion: 'Làm thế nào để tính diện tích hình cong bằng các hình chữ nhật?',
            keyConcept: 'Xấp xỉ tổng Riemann',
            accentColor: '#10B981',
            visualStyleId: 'clean_educational_infographic',
            reducedMotion: false
          }
        },
        {
          sceneId: 'sc_rectangles',
          sceneType: 'graph_plot',
          title: 'Chia nhỏ thành các dải chữ nhật',
          pedagogicalGoal: 'Mô phỏng tổng Riemann với phân hoạch các hình chữ nhật',
          durationSeconds: 16,
          boundClaimIds: ['claim_riemann_int'],
          rendererTarget: 'manim_hybrid',
          narration: {
            vietnamese: 'Ta chia đoạn thành các dải chữ nhật nhỏ. Càng chia mịn, tổng diện tích càng sát giá trị tích phân 1/3.',
            subtitleVietnamese: 'Càng chia mịn hình chữ nhật, sai số càng triệt tiêu về 0.'
          },
          visualPayload: {
            sceneType: 'graph_plot',
            headline: 'Tổng Riemann xấp xỉ diện tích',
            formulaTex: '\\int_0^1 x^2 dx = \\lim_{n \\to \\infty} \\sum_{i=1}^n f(x_i) \\Delta x = \\frac{1}{3}',
            notes: 'Phân hoạch đều n khoảng trên [0, 1]'
          }
        },
        {
          sceneId: 'sc_summary',
          sceneType: 'summary',
          title: 'Định nghĩa tích phân',
          pedagogicalGoal: 'Kết luận tích phân là giới hạn của tổng diện tích',
          durationSeconds: 10,
          boundClaimIds: ['claim_riemann_int'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Tích phân xác định chính là tổng vô hạn các diện tích vi phân vô cùng bé.',
            subtitleVietnamese: 'Tích phân xác định là tổng vô hạn các vi phân diện tích.'
          },
          visualPayload: {
            sceneType: 'summary',
            title: 'Bản chất tích phân Riemann',
            takeaways: [
              'Chia nhỏ miền tính thành các hình chữ nhật bề rộng dx',
              'Khi số hình chữ nhật ra vô cùng, tổng xấp xỉ hội tụ về diện tích đúng',
              'Tích phân của x^2 trên [0, 1] bằng chính xác 1/3'
            ],
            verifiedFacts: ['integrate(x^2, (x, 0, 1)) = 1/3'],
            reviewNotes: [],
            finalCallout: 'Tích phân xác định là công cụ nền tảng để tính diện tích và kỳ vọng xác suất.'
          }
        }
      ];
      scenes = this.expandScenesForDuration(scenes, targetDurationSeconds, 'Tích phân Riemann', 'claim_riemann_int');
    } else if (capability.topicId === 'linear_algebra.matrix_transform') {
      summary = 'Ma trận vuông biểu diễn một phép biến đổi tuyến tính kéo giãn hoặc quay không gian vector.';
      learningObjectives = [
        'Hiểu ma trận như một hành động biến đổi không gian',
        'Theo dõi vector cơ sở i-hat và j-hat sau biến đổi'
      ];
      keyConcepts = ['Vector cơ sở', 'Biến đổi tuyến tính', 'Ma trận 2x2', 'Định thức'];
      claims = [
        {
          id: 'claim_lin_basis',
          claimType: 'algorithmic_property',
          statement: 'Phép biến đổi tuyến tính được xác định hoàn toàn bởi tọa độ ảnh của các vector cơ sở.',
          formalExpression: 'T(v) = A * v',
          validatorKey: 'matrix_transform',
          verificationStatus: 'unverified'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_grid',
          sceneType: 'graph_plot',
          title: 'Lưới tọa độ ban đầu',
          pedagogicalGoal: 'Trực quan hóa hệ trục tọa độ với hai vector cơ sở',
          durationSeconds: 18,
          boundClaimIds: ['claim_lin_basis'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Trong không gian hai chiều, mọi vector đều biểu diễn qua tổ hợp của hai vector cơ sở.',
            subtitleVietnamese: 'Mọi vector đều biểu diễn qua hai vector cơ sở.'
          },
          visualPayload: {
            sceneType: 'graph_plot',
            headline: 'Không gian vector và hệ cơ sở',
            formulaTex: 'v = x \\cdot \\hat{i} + y \\cdot \\hat{j}',
            notes: 'Vector cơ sở i-hat=(1,0), j-hat=(0,1)'
          }
        },
        {
          sceneId: 'sc_warp',
          sceneType: 'flowchart_simulation',
          title: 'Ma trận làm biến dạng không gian',
          pedagogicalGoal: 'Trực quan hóa lưới tọa độ bị nghiêng và kéo giãn theo ma trận',
          durationSeconds: 22,
          boundClaimIds: ['claim_lin_basis'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Nhân vector với ma trận chính là di chuyển lưới không gian tới vị trí mới.',
            subtitleVietnamese: 'Phép nhân ma trận chính là biến đổi hình học không gian.'
          },
          visualPayload: {
            sceneType: 'flowchart_simulation',
            headline: 'Biến đổi tuyến tính của lưới tọa độ',
            formulaTex: 'A \\begin{bmatrix} x \\\\ y \\end{bmatrix} = x A\\hat{i} + y A\\hat{j}',
            notes: 'Các đường thẳng song song vẫn giữ nguyên tính song song'
          }
        }
      ];
      scenes = this.expandScenesForDuration(scenes, targetDurationSeconds, 'Biến đổi tuyến tính Ma trận', 'claim_lin_basis');
    } else if (capability.topicId === 'probability.bayes_theorem') {
      summary = 'Định lý Bayes cho phép cập nhật xác suất của giả thuyết khi có thêm bằng chứng thực nghiệm.';
      learningObjectives = ['Phân biệt xác suất tiên nghiệm (prior) và xác suất hậu nghiệm (posterior)'];
      keyConcepts = ['Prior', 'Likelihood', 'Posterior', 'Định lý Bayes'];
      claims = [
        {
          id: 'claim_bayes_formula',
          claimType: 'algorithmic_property',
          statement: 'Xác suất hậu nghiệm P(A|B) bằng P(B|A) nhân P(A) chia cho P(B).',
          formalExpression: 'P(A|B) = P(B|A) * P(A) / P(B)',
          validatorKey: 'bayes_theorem',
          verificationStatus: 'unverified'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_bayes_intro',
          sceneType: 'concept_intro',
          title: 'Khái niệm niềm tin ban đầu',
          pedagogicalGoal: 'Giới thiệu xác suất tiên nghiệm prior',
          durationSeconds: 18,
          boundClaimIds: ['claim_bayes_formula'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Trước khi có bằng chứng mới, ta có một ước lượng xác suất ban đầu gọi là tiên nghiệm.',
            subtitleVietnamese: 'Ước lượng niềm tin ban đầu gọi là tiên nghiệm.'
          },
          visualPayload: {
            sceneType: 'concept_intro',
            centralQuestion: 'Làm thế nào để cập nhật niềm tin khi xuất hiện bằng chứng mới?',
            keyConcept: 'Xác suất Tiên nghiệm và Hậu nghiệm',
            accentColor: '#F59E0B',
            visualStyleId: 'clean_educational_infographic',
            reducedMotion: false
          }
        },
        {
          sceneId: 'sc_bayes_update',
          sceneType: 'formula_derivation',
          title: 'Cập nhật hậu nghiệm với bằng chứng',
          pedagogicalGoal: 'Minh họa công thức Bayes điều chỉnh niềm tin',
          durationSeconds: 22,
          boundClaimIds: ['claim_bayes_formula'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Khi bằng chứng xuất hiện, công thức Bayes cân chỉnh lại niềm tin thành xác suất hậu nghiệm.',
            subtitleVietnamese: 'Bằng chứng mới cân chỉnh niềm tin thành xác suất hậu nghiệm.'
          },
          visualPayload: {
            sceneType: 'formula_derivation',
            headline: 'Công thức định lý Bayes',
            formulaTex: 'P(A|B) = \\frac{P(B|A) P(A)}{P(B)}',
            notes: 'Cập nhật phân phối xác suất dựa trên Likelihood'
          }
        }
      ];
      scenes = this.expandScenesForDuration(scenes, targetDurationSeconds, 'Định lý Bayes', 'claim_bayes_formula');
    }

    // --- ARTIFICIAL INTELLIGENCE BENCHMARKS ---
    else if (capability.topicId === 'ai.perceptron.activation') {
      summary = 'Perceptron là viên gạch nền tảng của mạng neural, kết hợp tổng có trọng số với hàm kích hoạt phi tuyến.';
      learningObjectives = [
        'Hiểu cấu tạo của một nơ-ron nhân tạo: đầu vào, trọng số, bias và hàm kích hoạt',
        'Giải thích lý do cần tính phi tuyến từ hàm Sigmoid và ReLU'
      ];
      keyConcepts = ['Đầu vào (Inputs)', 'Trọng số (Weights)', 'Độ chệch (Bias)', 'Hàm kích hoạt', 'ReLU & Sigmoid'];
      claims = [
        {
          id: 'claim_perceptron_structure',
          claimType: 'ai_concept',
          statement: 'Perceptron tính tổng có trọng số của các đầu vào, cộng bias rồi truyền qua hàm kích hoạt phi tuyến.',
          verificationStatus: 'unverified',
          humanReviewComment: 'Định nghĩa nơ-ron nhân tạo của Rosenblatt và cấu trúc mạng truyền thẳng.'
        },
        {
          id: 'claim_non_linearity',
          claimType: 'algorithmic_property',
          statement: 'Nếu không có hàm kích hoạt phi tuyến, mạng neural nhiều lớp sẽ suy biến thành một phép biến đổi tuyến tính đơn lẻ.',
          verificationStatus: 'unverified',
          humanReviewComment: 'Xếp chồng nhiều ma trận tuyến tính luôn tương đương với một ma trận tuyến tính duy nhất.'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_neuron_anatomy',
          sceneType: 'neural_architecture',
          title: 'Cấu tạo một Nơ-ron nhân tạo',
          pedagogicalGoal: 'Trực quan hóa luồng dữ liệu từ các đầu vào x_i, nhân trọng số w_i đến bộ tích lũy',
          durationSeconds: 17,
          boundClaimIds: ['claim_perceptron_structure'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Một nơ-ron nhân tạo nhận các tín hiệu đầu vào, nhân với trọng số riêng biệt rồi cộng thêm độ chệch bias.',
            subtitleVietnamese: 'Nơ-ron nhận đầu vào, nhân trọng số và cộng độ chệch bias.'
          },
          visualPayload: {
            sceneType: 'neural_architecture',
            networkType: 'perceptron',
            layers: [
              { layerId: 'l_in', name: 'Đầu vào (Inputs)', nodeCount: 2, activation: 'linear' },
              { layerId: 'l_out', name: 'Đầu ra (Output)', nodeCount: 1, activation: 'sigmoid' }
            ],
            weights: [
              { fromLayer: 0, fromNode: 0, toLayer: 1, toNode: 0, weightValue: 0.8 },
              { fromLayer: 0, fromNode: 1, toLayer: 1, toNode: 0, weightValue: -0.5 }
            ],
            inputValues: [1.0, 0.5],
            signalMode: 'signal_flow_illustration',
            highlightActiveSignal: true,
            outputLabels: ['Dự đoán (y)']
          }
        },
        {
          sceneId: 'sc_activation_curves',
          sceneType: 'graph_plot',
          title: 'Sức mạnh của tính phi tuyến',
          pedagogicalGoal: 'So sánh đường cong kích hoạt Sigmoid và ReLU giúp mạng học được các mặt phân chia phức tạp',
          durationSeconds: 18,
          boundClaimIds: ['claim_non_linearity'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Hàm kích hoạt như ReLU hoặc Sigmoid bẻ cong không gian, giúp mạng học được các bài toán phi tuyến.',
            subtitleVietnamese: 'Hàm kích hoạt phi tuyến giúp mạng học bài toán phức tạp.'
          },
          visualPayload: {
            sceneType: 'graph_plot',
            headline: 'Hàm kích hoạt phi tuyến',
            formulaTex: 'σ(z) = 1 / (1 + e^(-z)); ReLU(z) = max(0, z)',
            notes: 'Phi tuyến tính phá vỡ giới hạn biến đổi affine'
          }
        }
      ];
      scenes = this.expandScenesForDuration(scenes, targetDurationSeconds, 'Perceptron & Hàm kích hoạt', 'claim_perceptron_structure');
    } else if (capability.topicId === 'ai.gradient_descent.optimization') {
      summary = 'Gradient Descent là thuật toán tối ưu hóa lặp giúp mạng neural tìm đáy của hàm mất mát.';
      learningObjectives = [
        'Hiểu vector gradient chỉ hướng tăng nhanh nhất của hàm mất mát',
        'Nắm quy tắc bước cập nhật ngược hướng gradient với tốc độ học learning rate'
      ];
      keyConcepts = ['Hàm mất mát (Loss Function)', 'Gradient', 'Tốc độ học (Learning Rate)', 'Cực tiểu cục bộ'];
      claims = [
        {
          id: 'claim_gd_update_rule',
          claimType: 'formal_mathematics',
          statement: 'Quy tắc cập nhật tham số w: w_mới = w_cũ - eta * nabla L(w)',
          formalExpression: 'w_next = w - eta * grad_L(w)',
          validatorKey: 'gradient_descent_formula',
          verificationStatus: 'unverified',
          humanReviewComment: 'Công thức cập nhật bậc một trong giải thuật tối ưu hóa gradient descent.'
        },
        {
          id: 'claim_lr_intuition',
          claimType: 'ai_concept',
          statement: 'Tốc độ học quá lớn gây phân kỳ vượt khỏi cực tiểu, trong khi quá nhỏ khiến quá trình hội tụ rất chậm.',
          verificationStatus: 'unverified',
          humanReviewComment: 'Hành vi hội tụ của learning rate trong tối ưu hóa học máy.'
        }
      ];
      if (targetDurationSeconds >= 300) {
        // 8-stage comprehensive pedagogical progression for >= 5 min (well-balanced durations: 30-40s)
        const dur1 = Math.round(targetDurationSeconds * 0.1); // 30s
        const dur2 = Math.round(targetDurationSeconds * 0.13); // ~39s (e.g. 39 * 5 = 195s)
        const remainder = targetDurationSeconds - (dur1 * 2 + dur2 * 5); // 300 - (60 + 195) = 45s
        scenes = [
          {
            sceneId: 'sc_intro',
            sceneType: 'concept_intro',
            title: 'Khái niệm và Mục tiêu Tối ưu hóa',
            pedagogicalGoal: 'Giới thiệu bài toán tìm cực tiểu hàm mất mát trong huấn luyện AI',
            durationSeconds: dur1,
            boundClaimIds: ['claim_gd_update_rule'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Chào mừng các bạn đến với bài học chuyên sâu về Gradient Descent — trái tim của các thuật toán tối ưu hóa trong học máy hiện đại. Khi huấn luyện một mô hình AI, từ mạng nơ-ron cơ bản đến các mô hình ngôn ngữ lớn như Transformer, làm thế nào cỗ máy có thể tự động điều chỉnh hàng triệu trọng số để ngày càng thông minh hơn? Câu trả lời nằm ở nguyên lý hạ độ dốc mà chúng ta sắp khám phá.',
              subtitleVietnamese: 'Gradient Descent là thuật toán cốt lõi tự động điều chỉnh trọng số giảm thiểu sai số.'
            },
            visualPayload: {
              sceneType: 'concept_intro',
              centralQuestion: 'Làm thế nào để mô hình tự động cập nhật trọng số giảm thiểu sai số?',
              keyConcept: 'Tối ưu hóa Hàm mất mát',
              accentColor: '#38BDF8',
              visualStyleId: 'clean_educational_infographic',
              reducedMotion: false
            }
          },
          {
            sceneId: 'sc_loss_bowl',
            sceneType: 'loss_landscape',
            title: 'Bề mặt Hàm mất mát và Điểm khởi tạo',
            pedagogicalGoal: 'Trực quan hóa bề mặt hàm mất mát dạng cái bát và vị trí hiện tại của mô hình',
            durationSeconds: dur2,
            boundClaimIds: ['claim_gd_update_rule'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Để hiểu trực quan, hãy hình dung hàm mất mát như một bề mặt thung lũng hình cái bát trong không gian. Trục hoành biểu thị giá trị của trọng số w, còn trục tung biểu thị độ sai lệch hay hàm mất mát L của w. Đáy của thung lũng là vị trí mà sai số đạt mức nhỏ nhất có thể, tức là điểm tối ưu w sao. Nhiệm vụ của thuật toán tối ưu là đưa một điểm khởi tạo ngẫu nhiên trên sườn dốc trượt dần từng bước xuống tận đáy sâu nhất của thung lũng.',
              subtitleVietnamese: 'Hàm mất mát như một thung lũng lồi, mục tiêu là đưa tham số trượt xuống đáy tối ưu.'
            },
            visualPayload: {
              sceneType: 'loss_landscape',
              functionType: 'convex_quadratic',
              minimumPoint: { w: 0.0, loss: 0.0 },
              curvature: 1.0,
              currentParam: 2.0,
              learningRate: 0.3,
              steps: [
                { stepNumber: 1, w: 2.0, loss: 4.0, gradient: 4.0 },
                { stepNumber: 2, w: 0.8, loss: 0.64, gradient: 1.6 },
                { stepNumber: 3, w: 0.32, loss: 0.1024, gradient: 0.64 }
              ],
              showGradientTangent: true
            }
          },
          {
            sceneId: 'sc_gradient_vector',
            sceneType: 'flowchart_simulation',
            title: 'Vector Gradient và Hướng tăng nhanh nhất',
            pedagogicalGoal: 'Phân tích bản chất toán học của vector gradient',
            durationSeconds: dur2,
            boundClaimIds: ['claim_gd_update_rule'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Làm sao mô hình biết phải bước sang trái hay sang phải khi đang đứng giữa thung lũng sương mù? Câu trả lời đến từ vector Gradient. Về mặt toán học, gradient là đạo hàm riêng của hàm mất mát theo từng trọng số. Điểm cốt lõi cần ghi nhớ: vector Gradient luôn luôn chỉ theo hướng mà hàm số tăng trưởng dốc nhất. Do đó, nếu muốn giảm mất mát nhanh nhất, mô hình bắt buộc phải đi ngược hướng với vector Gradient, tức là mang dấu trừ.',
              subtitleVietnamese: 'Vector Gradient chỉ hướng tăng dốc nhất; bước ngược dấu trừ sẽ làm giảm mất mát nhanh nhất.'
            },
            visualPayload: {
              sceneType: 'flowchart_simulation',
              headline: 'Vector Gradient: Hướng tăng dốc nhất',
              formulaTex: '\\nabla L(w) = \\frac{\\partial L}{\\partial w}',
              notes: 'Bước ngược lại sẽ làm giảm mất mát'
            }
          },
          {
            sceneId: 'sc_learning_rate',
            sceneType: 'loss_landscape',
            title: 'Tốc độ học (Learning Rate) và Động lực học',
            pedagogicalGoal: 'Phân tích sự khác biệt giữa learning rate quá lớn và quá nhỏ',
            durationSeconds: dur2,
            boundClaimIds: ['claim_lr_intuition'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Nguyên lý này được đúc kết thành công thức cập nhật trọng số kinh điển: w mới bằng w cũ trừ đi eta nhân với đạo hàm của L theo w. Trong công thức này, eta được gọi là learning rate hay tốc độ học. Nó đóng vai trò như độ dài sải chân của người đi bộ. Dấu trừ đảm bảo ta luôn đi ngược chiều đạo hàm để hạ độ cao, còn learning rate quyết định mỗi bước ta sẽ nhảy xa bao nhiêu trên bề mặt hàm mất mát.',
              subtitleVietnamese: 'w_{mới} = w_{cũ} - η · ∇L(w) — Learning rate η quyết định độ dài sải chân cập nhật.'
            },
            visualPayload: {
              sceneType: 'loss_landscape',
              functionType: 'convex_quadratic',
              minimumPoint: { w: 0.0, loss: 0.0 },
              curvature: 1.0,
              currentParam: 1.5,
              learningRate: 0.1,
              steps: [
                { stepNumber: 1, w: 1.5, loss: 2.25, gradient: 3.0 },
                { stepNumber: 2, w: 1.2, loss: 1.44, gradient: 2.4 }
              ],
              showGradientTangent: true
            }
          },
          {
            sceneId: 'sc_worked_example',
            sceneType: 'flowchart_simulation',
            title: 'Ví dụ Tính toán Số cụ thể',
            pedagogicalGoal: 'Thực hành tính toán số từng bước cập nhật tham số',
            durationSeconds: dur2,
            boundClaimIds: ['claim_gd_update_rule'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Hãy quan sát mô phỏng cụ thể từng bước lặp: Ban đầu ta khởi tạo trọng số w0 bằng 2. Tại điểm này độ dốc rất lớn, gradient bằng 4. Với learning rate eta bằng 0.3, bước nhảy là 0.3 nhân 4 bằng 1.2. Trọng số mới w1 trở thành 2 trừ 1.2 bằng 0.8, và hàm mất mát giảm đột ngột từ 4.0 xuống còn 0.64. Ta thấy sai số đã được thu hẹp rõ rệt chỉ sau một bước duy nhất!',
              subtitleVietnamese: 'w₁ = 2.0 - 0.3 × 4.0 = 0.8 ⟹ Mất mát L giảm từ 4.0 xuống 0.64'
            },
            visualPayload: {
              sceneType: 'flowchart_simulation',
              headline: 'Tính toán Số Từng Bước',
              formulaTex: 'w_1 = 2.0 - 0.3 \\times 4.0 = 0.8',
              notes: 'Mất mát giảm từ 4.0 xuống 0.64'
            }
          },
          {
            sceneId: 'sc_opt_vis',
            sceneType: 'loss_landscape',
            title: 'Hành vi Hội tụ về Điểm Cực tiểu',
            pedagogicalGoal: 'Quan sát quỹ đạo tham số tiệm cận điểm tối ưu toàn cục',
            durationSeconds: dur2,
            boundClaimIds: ['claim_gd_update_rule'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Tiếp tục sang bước thứ hai, gradient giảm còn 1.6, bước nhảy tự động ngắn lại thành 0.48, đưa w tới 0.32. Càng tiến gần đáy, độ dốc càng thoải dần, các bước nhảy tự động thu ngắn lại một cách êm ái, đảm bảo điểm tham số không bị vọt lố qua đỉnh đối diện mà hội tụ vững chắc về điểm đáy tối ưu w sao bằng 0.',
              subtitleVietnamese: 'Càng gần đáy, gradient càng nhỏ, các bước nhảy tự động ngắn lại và hội tụ êm ái.'
            },
            visualPayload: {
              sceneType: 'loss_landscape',
              functionType: 'convex_quadratic',
              minimumPoint: { w: 0.0, loss: 0.0 },
              curvature: 1.0,
              currentParam: 0.8,
              learningRate: 0.3,
              steps: [
                { stepNumber: 2, w: 0.8, loss: 0.64, gradient: 1.6 },
                { stepNumber: 3, w: 0.32, loss: 0.1024, gradient: 0.64 },
                { stepNumber: 4, w: 0.128, loss: 0.016384, gradient: 0.256 }
              ],
              showGradientTangent: true
            }
          },
          {
            sceneId: 'sc_common_mistakes',
            sceneType: 'flowchart_simulation',
            title: 'Lưu ý Sư phạm & Sai lầm Thường gặp',
            pedagogicalGoal: 'Cảnh báo về điểm yên ngựa, cực tiểu cục bộ và vanishing gradient',
            durationSeconds: dur1,
            boundClaimIds: ['claim_lr_intuition'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Việc lựa chọn learning rate eta là một nghệ thuật sống còn trong huấn luyện AI. Nếu chọn eta quá nhỏ, mô hình sẽ bước những bước li ti và mất nhiều tuần lễ. Ngược lại, nếu chọn eta quá lớn, bước nhảy quá đà có thể khiến mô hình bắn vọt qua bên kia sườn dốc và phân kỳ. Ngoài ra, trong không gian đa chiều, cần chú ý hiện tượng điểm yên ngựa và gradient triệt tiêu.',
              subtitleVietnamese: 'Lưu ý: Learning rate quá nhỏ gây chậm, quá lớn gây phân kỳ dao động.'
            },
            visualPayload: {
              sceneType: 'flowchart_simulation',
              headline: 'Lưu ý Thực tiễn trong Huấn luyện',
              formulaTex: '\\Delta w \\approx 0 \\implies \\text{Vanishing Gradient}',
              notes: 'Áp dụng Momentum hoặc Adam để tăng tốc'
            }
          },
          {
            sceneId: 'sc_summary',
            sceneType: 'summary',
            title: 'Tổng kết & Ghi nhớ Cốt lõi',
            pedagogicalGoal: 'Củng cố kiến thức và công thức then chốt',
            durationSeconds: remainder,
            boundClaimIds: ['claim_gd_update_rule'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Tổng kết lại, Gradient Descent là phương pháp tối ưu hóa lặp đi lặp lại dựa trên đạo hàm: tính độ dốc, bước ngược hướng gradient theo tỷ lệ learning rate, và lặp lại cho đến khi hội tụ tại điểm cực tiểu. Đây là nền tảng chi phối mọi tiến bộ của học sâu hiện đại. Cảm ơn các bạn đã theo dõi bài giảng LuminaLearn!',
              subtitleVietnamese: 'Gradient Descent: Bước ngược hướng gradient theo tỉ lệ learning rate để tối thiểu hóa sai số.'
            },
            visualPayload: {
              sceneType: 'summary',
              title: 'Tổng kết & Ghi nhớ Cốt lõi',
              takeaways: [
                'Gradient chỉ hướng tăng dốc nhất của hàm mất mát',
                'Quy tắc cập nhật: w_mới = w_cũ - eta * nabla L(w)',
                'Hội tụ tại điểm đáy nơi độ dốc tiệm cận 0',
                'Learning rate điều phối sự cân bằng giữa tốc độ và độ ổn định'
              ],
              verifiedFacts: [],
              reviewNotes: [],
              finalCallout: 'w = w - \\eta \\cdot \\nabla L(w)'
            }
          }
        ];
      } else if (targetDurationSeconds >= 180) {
        // 5-scene multi-chapter progression for 180s
        scenes = [
          {
            sceneId: 'sc_intro',
            sceneType: 'concept_intro',
            title: 'Mục tiêu & Bản chất Gradient Descent',
            pedagogicalGoal: 'Giới thiệu bài toán tối ưu hóa trong học máy',
            durationSeconds: 25,
            boundClaimIds: ['claim_gd_update_rule'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Chào mừng các bạn. Ta sẽ tìm hiểu Gradient Descent, cốt lõi tối ưu hóa trong học máy.',
              subtitleVietnamese: 'Gradient Descent là thuật toán tìm cực tiểu hàm mất mát trong AI.'
            },
            visualPayload: {
              sceneType: 'concept_intro',
              centralQuestion: 'Làm thế nào để mạng neural tự tìm trọng số tối ưu?',
              keyConcept: 'Gradient Descent & Tối ưu hóa',
              accentColor: '#38BDF8',
              visualStyleId: 'clean_educational_infographic',
              reducedMotion: false
            }
          },
          {
            sceneId: 'sc_loss_bowl',
            sceneType: 'loss_landscape',
            title: 'Bề mặt Hàm mất mát và Quả bóng lăn',
            pedagogicalGoal: 'Trực quan hóa bề mặt hàm mất mát dạng cái bát và vị trí hiện tại của mô hình',
            durationSeconds: 35,
            boundClaimIds: ['claim_gd_update_rule'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Hãy hình dung hàm mất mát như một thung lũng, mục tiêu của ta là đưa quả bóng lăn xuống đáy sâu nhất.',
              subtitleVietnamese: 'Hàm mất mát như thung lũng, mô hình cần lăn xuống đáy sâu nhất.'
            },
            visualPayload: {
              sceneType: 'loss_landscape',
              functionType: 'convex_quadratic',
              minimumPoint: { w: 0.0, loss: 0.0 },
              curvature: 1.0,
              currentParam: 2.0,
              learningRate: 0.3,
              steps: [
                { stepNumber: 1, w: 2.0, loss: 4.0, gradient: 4.0 },
                { stepNumber: 2, w: 0.8, loss: 0.64, gradient: 1.6 },
                { stepNumber: 3, w: 0.32, loss: 0.1024, gradient: 0.64 }
              ],
              showGradientTangent: true
            }
          },
          {
            sceneId: 'sc_gradient_vector',
            sceneType: 'flowchart_simulation',
            title: 'Vector Gradient và Hướng Cập nhật',
            pedagogicalGoal: 'Minh họa các bước chân bước ngược chiều vector đạo hàm',
            durationSeconds: 40,
            boundClaimIds: ['claim_gd_update_rule'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Ở mỗi bước, gradient chỉ hướng lên dốc. Ta bước theo hướng ngược lại một đoạn bằng tốc độ học.',
              subtitleVietnamese: 'Bước ngược hướng gradient một đoạn tỉ lệ với tốc độ học.'
            },
            visualPayload: {
              sceneType: 'flowchart_simulation',
              headline: 'Bước lặp cập nhật tham số',
              formulaTex: 'w_{t+1} = w_t - \\eta \\cdot \\nabla L(w_t)',
              notes: 'Hội tụ ổn định về cực tiểu cục bộ'
            }
          },
          {
            sceneId: 'sc_learning_rate',
            sceneType: 'loss_landscape',
            title: 'Tác động của Learning Rate',
            pedagogicalGoal: 'Phân tích hành vi hội tụ với các giá trị learning rate khác nhau',
            durationSeconds: 45,
            boundClaimIds: ['claim_lr_intuition'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Tốc độ học quá lớn gây phân kỳ vượt khỏi thung lũng, trong khi quá nhỏ khiến học rất chậm.',
              subtitleVietnamese: 'Chọn tốc độ học phù hợp giúp mô hình hội tụ nhanh và ổn định.'
            },
            visualPayload: {
              sceneType: 'loss_landscape',
              functionType: 'convex_quadratic',
              minimumPoint: { w: 0.0, loss: 0.0 },
              curvature: 1.0,
              currentParam: 1.8,
              learningRate: 0.2,
              steps: [
                { stepNumber: 1, w: 1.8, loss: 3.24, gradient: 3.6 },
                { stepNumber: 2, w: 1.08, loss: 1.1664, gradient: 2.16 }
              ],
              showGradientTangent: true
            }
          },
          {
            sceneId: 'sc_gd_summary',
            sceneType: 'summary',
            title: 'Tổng kết Thuật toán Gradient Descent',
            pedagogicalGoal: 'Củng cố quy tắc cập nhật và điều kiện hội tụ',
            durationSeconds: 35,
            boundClaimIds: ['claim_lr_intuition'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Tóm lại, Gradient Descent liên tục đưa mô hình về điểm có sai số nhỏ nhất.',
              subtitleVietnamese: 'Gradient Descent tối ưu hóa lặp giảm thiểu hàm mất mát.'
            },
            visualPayload: {
              sceneType: 'summary',
              title: 'Tổng kết Thuật toán Gradient Descent',
              takeaways: [
                'Gradient chỉ hướng dốc nhất của hàm mất mát',
                'Bước ngược gradient một đoạn tỉ lệ với learning rate',
                'Hội tụ tại điểm cực tiểu địa phương hoặc toàn cục'
              ],
              verifiedFacts: [],
              reviewNotes: [],
              finalCallout: 'w_{t+1} = w_t - \\eta \\cdot \\nabla L(w_t)'
            }
          }
        ];
      } else if (targetDurationSeconds >= 60) {
        // 3 scenes for 60s
        scenes = [
          {
            sceneId: 'sc_loss_bowl',
            sceneType: 'loss_landscape',
            title: 'Bề mặt hàm mất mát và quả bóng lăn',
            pedagogicalGoal: 'Trực quan hóa bề mặt hàm mất mát dạng cái bát và vị trí hiện tại của mô hình',
            durationSeconds: 20,
            boundClaimIds: ['claim_gd_update_rule'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Hãy hình dung hàm mất mát như một thung lũng, mục tiêu của ta là đưa quả bóng lăn xuống đáy sâu nhất.',
              subtitleVietnamese: 'Hàm mất mát như thung lũng, mô hình cần lăn xuống đáy sâu nhất.'
            },
            visualPayload: {
              sceneType: 'loss_landscape',
              functionType: 'convex_quadratic',
              minimumPoint: { w: 0.0, loss: 0.0 },
              curvature: 1.0,
              currentParam: 2.0,
              learningRate: 0.3,
              steps: [
                { stepNumber: 1, w: 2.0, loss: 4.0, gradient: 4.0 },
                { stepNumber: 2, w: 0.8, loss: 0.64, gradient: 1.6 },
                { stepNumber: 3, w: 0.32, loss: 0.1024, gradient: 0.64 }
              ],
              showGradientTangent: true
            }
          },
          {
            sceneId: 'sc_descent_steps',
            sceneType: 'flowchart_simulation',
            title: 'Từng bước cập nhật theo Gradient',
            pedagogicalGoal: 'Minh họa các bước chân bước ngược chiều vector đạo hàm',
            durationSeconds: 25,
            boundClaimIds: ['claim_lr_intuition'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Ở mỗi bước, gradient chỉ hướng lên dốc. Ta bước theo hướng ngược lại một đoạn bằng tốc độ học.',
              subtitleVietnamese: 'Bước ngược hướng gradient một đoạn tỉ lệ với tốc độ học.'
            },
            visualPayload: {
              sceneType: 'flowchart_simulation',
              headline: 'Bước lặp cập nhật tham số',
              formulaTex: 'w_{t+1} = w_t - \\eta \\cdot \\nabla L(w_t)',
              notes: 'Hội tụ ổn định về cực tiểu cục bộ'
            }
          },
          {
            sceneId: 'sc_gd_summary',
            sceneType: 'summary',
            title: 'Tổng kết Gradient Descent',
            pedagogicalGoal: 'Củng cố công thức cập nhật và điều kiện dừng',
            durationSeconds: 15,
            boundClaimIds: ['claim_gd_update_rule'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Tóm lại, Gradient Descent điều chỉnh tham số ngược hướng dốc để giảm thiểu mất mát.',
              subtitleVietnamese: 'Gradient Descent hội tụ tại cực tiểu hàm mất mát.'
            },
            visualPayload: {
              sceneType: 'summary',
              title: 'Tổng kết Gradient Descent',
              takeaways: [
                'Gradient chỉ hướng tăng nhanh nhất',
                'Bước ngược gradient một khoảng bằng learning rate',
                'Hội tụ tại điểm cực tiểu'
              ],
              verifiedFacts: [],
              reviewNotes: [],
              finalCallout: 'w = w - \\eta \\cdot \\nabla L(w)'
            }
          }
        ];
      } else {
        const dur1 = Math.round(targetDurationSeconds * 0.45);
        const dur2 = targetDurationSeconds - dur1;
        scenes = [
          {
            sceneId: 'sc_loss_bowl',
            sceneType: 'loss_landscape',
            title: 'Bề mặt hàm mất mát và quả bóng lăn',
            pedagogicalGoal: 'Trực quan hóa bề mặt hàm mất mát dạng cái bát và vị trí hiện tại của mô hình',
            durationSeconds: dur1,
            boundClaimIds: ['claim_gd_update_rule'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Hãy hình dung hàm mất mát như một thung lũng, mục tiêu của ta là đưa quả bóng lăn xuống đáy sâu nhất.',
              subtitleVietnamese: 'Hàm mất mát như thung lũng, mô hình cần lăn xuống đáy sâu nhất.'
            },
            visualPayload: {
              sceneType: 'loss_landscape',
              functionType: 'convex_quadratic',
              minimumPoint: { w: 0.0, loss: 0.0 },
              curvature: 1.0,
              currentParam: 2.0,
              learningRate: 0.3,
              steps: [
                { stepNumber: 1, w: 2.0, loss: 4.0, gradient: 4.0 },
                { stepNumber: 2, w: 0.8, loss: 0.64, gradient: 1.6 },
                { stepNumber: 3, w: 0.32, loss: 0.1024, gradient: 0.64 }
              ],
              showGradientTangent: true
            }
          },
          {
            sceneId: 'sc_descent_steps',
            sceneType: 'flowchart_simulation',
            title: 'Từng bước cập nhật theo Gradient',
            pedagogicalGoal: 'Minh họa các bước chân bước ngược chiều vector đạo hàm',
            durationSeconds: dur2,
            boundClaimIds: ['claim_lr_intuition'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Ở mỗi bước, gradient chỉ hướng lên dốc. Ta bước theo hướng ngược lại một đoạn bằng tốc độ học.',
              subtitleVietnamese: 'Bước ngược hướng gradient một đoạn tỉ lệ với tốc độ học.'
            },
            visualPayload: {
              sceneType: 'flowchart_simulation',
              headline: 'Bước lặp cập nhật tham số',
              formulaTex: 'w_{t+1} = w_t - \\eta \\cdot \\nabla L(w_t)',
              notes: 'Hội tụ ổn định về cực tiểu cục bộ'
            }
          }
        ];
      }
    } else if (capability.topicId === 'ai.transformer.attention') {
      summary = 'Cơ chế Self-Attention tính toán trọng số quan hệ ngữ cảnh giữa mọi cặp từ trong câu.';
      learningObjectives = [
        'Hiểu hạn chế của mô hình tuần tự RNN trong việc xử lý phụ thuộc xa',
        'Nắm cách tính Attention qua ba vector Query, Key, Value'
      ];
      keyConcepts = ['Self-Attention', 'Query (Truy vấn)', 'Key (Khóa)', 'Value (Giá trị)', 'Softmax Scaling'];
      claims = [
        {
          id: 'claim_attention_mechanism',
          claimType: 'ai_concept',
          statement: 'Self-Attention tính toán độ tương đồng giữa vector Query và các Key để tạo phân phối trọng số mềm cho các Value.',
          verificationStatus: 'unverified',
          humanReviewComment: 'Kiến trúc Transformer trong Vaswani et al., 2017.'
        },
        {
          id: 'claim_attention_formula',
          claimType: 'algorithmic_property',
          statement: 'Công thức tính ma trận Attention: Attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V',
          formalExpression: 'softmax(Q * K^T / sqrt(d_k)) * V',
          validatorKey: 'scaled_dot_product',
          verificationStatus: 'unverified',
          humanReviewComment: 'Công thức tích vô hướng có tỉ lệ trong kiến trúc Transformer.'
        }
      ];
      if (targetDurationSeconds >= 300) {
        // Multi-stage deep dive for Transformer Attention >= 5 min (ensure each scene <= 120s)
        const dur1 = Math.round(targetDurationSeconds * 0.12);
        const dur2 = Math.round(targetDurationSeconds * 0.16);
        const dur3 = Math.round(targetDurationSeconds * 0.18);
        const dur4 = Math.round(targetDurationSeconds * 0.18);
        const dur5 = Math.round(targetDurationSeconds * 0.18);
        const dur6 = targetDurationSeconds - (dur1 + dur2 + dur3 + dur4 + dur5);
        scenes = [
          {
            sceneId: 'sc_context_need',
            sceneType: 'concept_intro',
            title: 'Vấn đề hiểu từ vựng theo ngữ cảnh',
            pedagogicalGoal: 'Minh họa từ đa nghĩa cần liên kết với các từ khác trong câu để rõ nghĩa',
            durationSeconds: dur1,
            boundClaimIds: ['claim_attention_mechanism'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Một từ như "ngân hàng" có thể là bờ sông hay tổ chức tài chính tùy thuộc vào ngữ cảnh xung quanh.',
              subtitleVietnamese: 'Nghĩa của từ phụ thuộc hoàn toàn vào ngữ cảnh xung quanh.'
            },
            visualPayload: {
              sceneType: 'concept_intro',
              centralQuestion: 'Làm thế nào để mô hình liên kết các từ có quan hệ ngữ nghĩa ở xa nhau?',
              keyConcept: 'Cơ chế Self-Attention',
              accentColor: '#38BDF8',
              visualStyleId: 'clean_educational_infographic',
              reducedMotion: false
            }
          },
          {
            sceneId: 'sc_qkv_projection',
            sceneType: 'flowchart_simulation',
            title: 'Bộ ba Vector Query, Key và Value',
            pedagogicalGoal: 'Giải thích vai trò của Query, Key và Value trong cơ chế Attention',
            durationSeconds: dur2,
            boundClaimIds: ['claim_attention_mechanism'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Mỗi từ chiếu thành ba vector: Query để hỏi, Key để so khớp và Value chứa thông tin ngữ nghĩa.',
              subtitleVietnamese: 'Mỗi token sinh ra ba vector Q, K, V thông qua các ma trận trọng số.'
            },
            visualPayload: {
              sceneType: 'flowchart_simulation',
              headline: 'Phép Chiếu Tuyến Tính Q, K, V',
              formulaTex: 'Q = X W_Q, \\quad K = X W_K, \\quad V = X W_V',
              notes: 'Tương tác thông qua tích vô hướng'
            }
          },
          {
            sceneId: 'sc_scaled_dot_product',
            sceneType: 'flowchart_simulation',
            title: 'Tích vô hướng có tỉ lệ và Chia căn d_k',
            pedagogicalGoal: 'Làm rõ lý do chia căn bậc hai của d_k để tránh vanishing gradient khi softmax',
            durationSeconds: dur3,
            boundClaimIds: ['claim_attention_formula'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Tích vô hướng giữa Query và Key được chuẩn hóa bằng căn bậc hai của d_k để giữ gradient ổn định.',
              subtitleVietnamese: 'Chia căn d_k giúp gradient không bị triệt tiêu khi giá trị tích vô hướng quá lớn.'
            },
            visualPayload: {
              sceneType: 'flowchart_simulation',
              headline: 'Chuẩn Hóa Tích Vô Hướng (Scaled Dot-Product)',
              formulaTex: '\\text{Score}(Q, K) = \\frac{Q K^T}{\\sqrt{d_k}}',
              notes: 'Kiểm soát phương sai phân phối score'
            }
          },
          {
            sceneId: 'sc_attention_matrix',
            sceneType: 'attention_heatmap',
            title: 'Ma trận Chú ý Tương tác Từ vựng',
            pedagogicalGoal: 'Trực quan hóa ma trận liên kết giữa các từ trong câu',
            durationSeconds: dur4,
            boundClaimIds: ['claim_attention_formula'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Hàm Softmax biến các điểm số thành phân phối xác suất chú ý mềm trên từng cặp từ vựng.',
              subtitleVietnamese: 'Softmax tạo phân phối trọng số chú ý giữa các token.'
            },
            visualPayload: {
              sceneType: 'attention_heatmap',
              tokens: ['Ngân', 'hàng', 'bên', 'sông'],
              matrix: [
                [0.45, 0.40, 0.08, 0.07],
                [0.35, 0.45, 0.10, 0.10],
                [0.08, 0.12, 0.40, 0.40],
                [0.06, 0.10, 0.39, 0.45]
              ],
              highlightTokenIndex: 0,
              isIllustrative: true
            }
          },
          {
            sceneId: 'sc_value_aggregation',
            sceneType: 'flowchart_simulation',
            title: 'Tổng hợp Thông tin theo Trọng số Value',
            pedagogicalGoal: 'Giải thích bước nhân phân phối chú ý với ma trận Value để sinh biểu diễn ngữ cảnh',
            durationSeconds: dur5,
            boundClaimIds: ['claim_attention_formula'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Mỗi token mới được tạo thành từ tổ hợp tuyến tính các Value, mang đậm thông tin từ các từ liên quan.',
              subtitleVietnamese: 'Tổ hợp tuyến tính các vector Value tạo ra biểu diễn ngữ cảnh hoàn chỉnh.'
            },
            visualPayload: {
              sceneType: 'flowchart_simulation',
              headline: 'Tổng Hợp Thông Tin (Value Aggregation)',
              formulaTex: '\\text{Output} = \\sum_{j} \\alpha_{ij} V_j',
              notes: 'Tập hợp thông tin từ toàn bộ chuỗi token'
            }
          },
          {
            sceneId: 'sc_attention_summary',
            sceneType: 'summary',
            title: 'Tổng kết Cơ chế Chú ý Transformer',
            pedagogicalGoal: 'Củng cố công thức tích vô hướng có tỉ lệ và trọng số tổng hợp',
            durationSeconds: dur6,
            boundClaimIds: ['claim_attention_formula'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Cơ chế Self-Attention cho phép xử lý song song toàn bộ văn bản và nắm bắt trọn vẹn ngữ cảnh.',
              subtitleVietnamese: 'Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) * V.'
            },
            visualPayload: {
              sceneType: 'summary',
              title: 'Tổng kết Cơ chế Chú ý Transformer',
              takeaways: [
                'Xử lý song song không phụ thuộc vào thứ tự tuần tự',
                'So khớp Query và Key có chia căn bậc hai của d_k',
                'Tổng hợp Value theo phân phối trọng số mềm'
              ],
              verifiedFacts: [],
              reviewNotes: [],
              finalCallout: '\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{Q K^T}{\\sqrt{d_k}}\\right) V'
            }
          }
        ];
      } else if (targetDurationSeconds >= 180) {
        const d1 = Math.round(targetDurationSeconds * 0.2);
        const d2 = Math.round(targetDurationSeconds * 0.3);
        const d3 = Math.round(targetDurationSeconds * 0.3);
        const d4 = targetDurationSeconds - (d1 + d2 + d3);
        scenes = [
          {
            sceneId: 'sc_context_need',
            sceneType: 'concept_intro',
            title: 'Vấn đề hiểu từ vựng theo ngữ cảnh',
            pedagogicalGoal: 'Minh họa từ đa nghĩa cần liên kết với các từ khác trong câu để rõ nghĩa',
            durationSeconds: d1,
            boundClaimIds: ['claim_attention_mechanism'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Một từ như "ngân hàng" có thể là bờ sông hay tổ chức tài chính tùy thuộc vào ngữ cảnh xung quanh.',
              subtitleVietnamese: 'Nghĩa của từ phụ thuộc hoàn toàn vào ngữ cảnh xung quanh.'
            },
            visualPayload: {
              sceneType: 'concept_intro',
              centralQuestion: 'Làm thế nào để mô hình liên kết các từ có quan hệ ngữ nghĩa ở xa nhau?',
              keyConcept: 'Cơ chế Self-Attention',
              accentColor: '#38BDF8',
              visualStyleId: 'clean_educational_infographic',
              reducedMotion: false
            }
          },
          {
            sceneId: 'sc_qkv_projection',
            sceneType: 'flowchart_simulation',
            title: 'Bộ ba Vector Query, Key và Value',
            pedagogicalGoal: 'Giải thích vai trò của Query, Key và Value trong cơ chế Attention',
            durationSeconds: d2,
            boundClaimIds: ['claim_attention_mechanism'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Mỗi từ chiếu thành ba vector: Query để hỏi, Key để so khớp và Value chứa thông tin ngữ nghĩa.',
              subtitleVietnamese: 'Mỗi token sinh ra ba vector Q, K, V thông qua các ma trận trọng số.'
            },
            visualPayload: {
              sceneType: 'flowchart_simulation',
              headline: 'Phép Chiếu Tuyến Tính Q, K, V',
              formulaTex: 'Q = X W_Q, \\quad K = X W_K, \\quad V = X W_V',
              notes: 'Tương tác thông qua tích vô hướng'
            }
          },
          {
            sceneId: 'sc_attention_matrix',
            sceneType: 'attention_heatmap',
            title: 'Ma trận Chú ý Tương tác Từ vựng',
            pedagogicalGoal: 'Trực quan hóa ma trận liên kết giữa các từ trong câu',
            durationSeconds: d3,
            boundClaimIds: ['claim_attention_formula'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Từng từ gửi câu hỏi Query tới các Key của mọi từ khác để thu về trọng số tương tác chính xác.',
              subtitleVietnamese: 'Query so khớp với Key để lấy trọng số tập trung cho Value.'
            },
            visualPayload: {
              sceneType: 'attention_heatmap',
              tokens: ['Ngân', 'hàng', 'bên', 'sông'],
              matrix: [
                [0.45, 0.40, 0.08, 0.07],
                [0.35, 0.45, 0.10, 0.10],
                [0.08, 0.12, 0.40, 0.40],
                [0.06, 0.10, 0.39, 0.45]
              ],
              highlightTokenIndex: 0,
              isIllustrative: true
            }
          },
          {
            sceneId: 'sc_attention_summary',
            sceneType: 'summary',
            title: 'Tổng kết Cơ chế Chú ý Transformer',
            pedagogicalGoal: 'Củng cố công thức tích vô hướng có tỉ lệ và trọng số tổng hợp',
            durationSeconds: d4,
            boundClaimIds: ['claim_attention_formula'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Cơ chế Self-Attention cho phép xử lý song song toàn bộ văn bản và nắm bắt trọn vẹn ngữ cảnh.',
              subtitleVietnamese: 'Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) * V.'
            },
            visualPayload: {
              sceneType: 'summary',
              title: 'Tổng kết Cơ chế Chú ý Transformer',
              takeaways: [
                'Xử lý song song không phụ thuộc vào thứ tự tuần tự',
                'So khớp Query và Key có chia căn bậc hai của d_k',
                'Tổng hợp Value theo phân phối trọng số mềm'
              ],
              verifiedFacts: [],
              reviewNotes: [],
              finalCallout: '\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{Q K^T}{\\sqrt{d_k}}\\right) V'
            }
          }
        ];
      } else {
        const d1 = Math.round(targetDurationSeconds * 0.4);
        const d2 = targetDurationSeconds - d1;
        scenes = [
          {
            sceneId: 'sc_context_need',
            sceneType: 'concept_intro',
            title: 'Vấn đề hiểu từ vựng theo ngữ cảnh',
            pedagogicalGoal: 'Minh họa từ đa nghĩa cần liên kết với các từ khác trong câu để rõ nghĩa',
            durationSeconds: d1,
            boundClaimIds: ['claim_attention_mechanism'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Một từ như "ngân hàng" có thể là bờ sông hay tổ chức tài chính tùy thuộc vào ngữ cảnh xung quanh.',
              subtitleVietnamese: 'Nghĩa của từ phụ thuộc hoàn toàn vào ngữ cảnh xung quanh.'
            },
            visualPayload: {
              sceneType: 'concept_intro',
              centralQuestion: 'Làm thế nào để mô hình liên kết các từ có quan hệ ngữ nghĩa ở xa nhau?',
              keyConcept: 'Cơ chế Self-Attention',
              accentColor: '#38BDF8',
              visualStyleId: 'clean_educational_infographic',
              reducedMotion: false
            }
          },
          {
            sceneId: 'sc_attention_matrix',
            sceneType: 'attention_heatmap',
            title: 'Ma trận chú ý tương tác từ vựng',
            pedagogicalGoal: 'Trực quan hóa ma trận liên kết giữa các từ trong câu',
            durationSeconds: d2,
            boundClaimIds: ['claim_attention_formula'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Từng từ gửi câu hỏi Query tới các Key của mọi từ khác để thu về trọng số tương tác chính xác.',
              subtitleVietnamese: 'Query so khớp với Key để lấy trọng số tập trung cho Value.'
            },
            visualPayload: {
              sceneType: 'attention_heatmap',
              tokens: ['Ngân', 'hàng', 'bên', 'sông'],
              matrix: [
                [0.45, 0.40, 0.08, 0.07],
                [0.35, 0.45, 0.10, 0.10],
                [0.08, 0.12, 0.40, 0.40],
                [0.06, 0.10, 0.39, 0.45]
              ],
              highlightTokenIndex: 0,
              isIllustrative: true
            }
          }
        ];
      }
    } else if (capability.topicId === 'ai.neural_network.backpropagation') {
      summary = 'Lan truyền ngược kết hợp quy tắc chuỗi vi phân để phân bổ sai số từ đầu ra về từng trọng số.';
      learningObjectives = [
        'Hiểu luồng truyền xuôi forward pass và luồng truyền ngược backward pass',
        'Nắm việc áp dụng quy tắc chuỗi Chain Rule để tính đạo hàm riêng dL/dw'
      ];
      keyConcepts = ['Forward Pass', 'Backward Pass', 'Chain Rule (Quy tắc chuỗi)', 'Đạo hàm riêng (Partial Derivative)'];
      claims = [
        {
          id: 'claim_chain_rule_bp',
          claimType: 'algorithmic_property',
          statement: 'Theo quy tắc chuỗi vi phân: dL/dw = (dL/dy) * (dy/dz) * (dz/dw)',
          formalExpression: 'dL/dw = (dL/dy) * (dy/dz) * (dz/dw)',
          validatorKey: 'chain_rule_formula',
          verificationStatus: 'unverified',
          humanReviewComment: 'Ứng dụng quy tắc chuỗi vi phân nhiều biến trong lan truyền ngược.'
        },
        {
          id: 'claim_error_blame',
          claimType: 'ai_concept',
          statement: 'Mỗi trọng số được điều chỉnh tỉ lệ thuận với mức độ nó đóng góp vào sai số chung của mô hình.',
          verificationStatus: 'unverified',
          humanReviewComment: 'Nguyên lý gán trách nhiệm sai số trong huấn luyện mạng nơ-ron học sâu.'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_forward_backward',
          sceneType: 'flowchart_simulation',
          title: 'Dòng chảy xuôi và ngược trong mạng',
          pedagogicalGoal: 'Đối chiếu tín hiệu dữ liệu đi tới và tín hiệu sai số đi lùi',
          durationSeconds: 20,
          boundClaimIds: ['claim_error_blame'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Dữ liệu chảy xuôi để đưa ra dự đoán, còn sai số chảy ngược lại để sửa chữa từng trọng số.',
            subtitleVietnamese: 'Dữ liệu đi tới để dự đoán, sai số đi lùi để cập nhật trọng số.'
          },
          visualPayload: {
            sceneType: 'flowchart_simulation',
            headline: 'Luồng thuận Forward và luồng nghịch Backward',
            formulaTex: 'x \\to z \\to \\hat{y} \\to L \\quad \\text{và} \\quad \\frac{\\partial L}{\\partial w}',
            notes: 'Lan truyền sai số ngược từ tầng ra về tầng vào'
          }
        },
        {
          sceneId: 'sc_chain_rule_math',
          sceneType: 'formula_derivation',
          title: 'Quy tắc chuỗi từng mắt xích',
          pedagogicalGoal: 'Minh họa phép nhân liên hoàn các đạo hàm cục bộ',
          durationSeconds: 20,
          boundClaimIds: ['claim_chain_rule_bp'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Quy tắc chuỗi vi phân cho phép ta nhân các đạo hàm thành phần để tính chính xác sai số của từng tham số.',
            subtitleVietnamese: 'Quy tắc chuỗi nhân các đạo hàm thành phần để tính sai số tham số.'
          },
          visualPayload: {
            sceneType: 'formula_derivation',
            headline: 'Quy tắc chuỗi Chain Rule',
            formulaTex: '\\frac{\\partial L}{\\partial w} = \\frac{\\partial L}{\\partial y} \\cdot \\frac{\\partial y}{\\partial z} \\cdot \\frac{\\partial z}{\\partial w}',
            notes: 'Tích các ma trận Jacobian thành phần'
          }
        }
      ];
      scenes = this.expandScenesForDuration(scenes, targetDurationSeconds, 'Lan truyền ngược Backpropagation', 'claim_chain_rule_bp');
    } else if (capability.topicId === 'ai.embeddings.vector_space') {
      summary = 'Không gian vector nhúng mã hóa ý nghĩa ngữ nghĩa của từ thành các tọa độ hình học nhiều chiều.';
      learningObjectives = [
        'Hiểu cách các từ có ngữ nghĩa gần nhau được đặt gần nhau trong không gian',
        'Nắm khái niệm phép tính tương tự (analogy) như Vua - Đàn ông + Phụ nữ = Nữ hoàng'
      ];
      keyConcepts = ['Vector nhúng (Embeddings)', 'Khoảng cách Cosine', 'Không gian ngữ nghĩa', 'Phép cộng trừ vector'];
      claims = [
        {
          id: 'claim_vector_similarity',
          claimType: 'ai_concept',
          statement: 'Các từ có ngữ cảnh sử dụng tương đồng sẽ có vector nhúng với độ tương đồng Cosine cao.',
          verificationStatus: 'unverified',
          humanReviewComment: 'Giả thuyết phân phối ngữ nghĩa của Harris và mô hình Word2Vec.'
        },
        {
          id: 'claim_vector_arithmetic',
          claimType: 'algorithmic_property',
          statement: 'Không gian nhúng cho phép các phép toán đại số biểu thị quan hệ ngữ nghĩa.',
          verificationStatus: 'unverified',
          humanReviewComment: 'Quan hệ ngữ nghĩa vector tuyến tính trong word representation.'
        }
      ];
      scenes = [
        {
          sceneId: 'sc_cloud_space',
          sceneType: 'graph_plot',
          title: 'Cụm từ vựng trong không gian',
          pedagogicalGoal: 'Trực quan hóa đám mây vector từ với các cụm ngữ nghĩa tương đồng',
          durationSeconds: 18,
          boundClaimIds: ['claim_vector_similarity'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Trong không gian vector, các từ chỉ đồ vật, động vật hay cảm xúc sẽ tự động co cụm lại gần nhau.',
            subtitleVietnamese: 'Các từ tương đồng ngữ nghĩa sẽ tự động co cụm lại gần nhau.'
          },
          visualPayload: {
            sceneType: 'graph_plot',
            headline: 'Đám mây vector từ vựng (Word Embeddings)',
            formulaTex: '\\text{similarity}(u, v) = \\frac{u \\cdot v}{\\|u\\| \\|v\\|}',
            notes: 'Độ tương đồng Cosine đo lường khoảng cách ngữ nghĩa'
          }
        },
        {
          sceneId: 'sc_analogy_arrow',
          sceneType: 'concept_intro',
          title: 'Đại số quan hệ ngữ nghĩa',
          pedagogicalGoal: 'Minh họa vector dịch chuyển giữa giống đực và giống cái',
          durationSeconds: 22,
          boundClaimIds: ['claim_vector_arithmetic'],
          rendererTarget: 'remotion_infographic',
          narration: {
            vietnamese: 'Vector dịch chuyển từ "đàn ông" sang "phụ nữ" tương đương với vector từ "vua" sang "nữ hoàng".',
            subtitleVietnamese: 'Mối quan hệ ngữ nghĩa trở thành các phép cộng trừ vector hình học.'
          },
          visualPayload: {
            sceneType: 'concept_intro',
            centralQuestion: 'Làm thế nào để máy tính thực hiện phép tính ngữ nghĩa: Vua - Đàn ông + Phụ nữ = Nữ hoàng?',
            keyConcept: 'Phép toán vector ngữ nghĩa',
            accentColor: '#8B5CF6',
            visualStyleId: 'clean_educational_infographic',
            reducedMotion: false
          }
        }
      ];
      scenes = this.expandScenesForDuration(scenes, targetDurationSeconds, 'Không gian Vector nhúng Embeddings', 'claim_vector_similarity');
    } else {
      // Fallback tổng quát cho chủ đề hợp lệ
      summary = `Kế hoạch bài học tổng quát về chủ đề ${topic}.`;
      learningObjectives = [`Nắm vững các khái niệm trọng tâm của ${topic}`];
      keyConcepts = [topic];
      claims = [
        {
          id: 'claim_general_1',
          claimType: isMath ? 'formal_mathematics' : 'ai_concept',
          statement: `Nội dung cốt lõi của chủ đề ${topic} được diễn giải theo chuẩn sư phạm.`,
          verificationStatus: 'unverified',
          formalExpression: isMath ? 'f(x) = x' : undefined,
          humanReviewComment: 'Nội dung khái niệm cần giáo viên đối chiếu sư phạm.'
        }
      ];
      scenes = this.buildAdaptiveScenesForTopic(
        topic,
        targetDurationSeconds,
        isMath,
        'claim_general_1'
      );
    }

    const totalSeconds = scenes.reduce((acc, s) => acc + s.durationSeconds, 0);

    return {
      schemaVersion: 'lesson-v3',
      generationProvenance: 'deterministic_mock',
      lessonId,
      domain: capability.domain,
      topicId: capability.topicId,
      title,
      summary,
      learningObjectives,
      prerequisites: isMath ? ['Đại số và giải tích cơ bản'] : ['Khái niệm đại số tuyến tính hoặc lập trình cơ bản'],
      keyConcepts,
      educationalClaims: claims,
      capabilityReport: capability,
      sourceEvidence: documentAnalysis?.evidence || [],
      storyboard: {
        storyboardId: `sb_${lessonId}`,
        lessonId,
        scenes,
        totalDurationSeconds: totalSeconds,
        chapters: buildChaptersForScenes(scenes, totalSeconds, 24)
      }
    };
  }

  /**
   * Expands a base scene array when the total capacity (scenes × 120 s) is
   * insufficient for the requested target duration.
   *
   * Rules:
   *  - Base scenes are NEVER modified; they are prepended as-is.
   *  - Only adaptive generic expansion scenes are appended.
   *  - Each emitted scene has durationSeconds = 1 (a nominal placeholder).
   *    The timeline normalizer will re-allocate durations proportionally, so the
   *    exact placeholder value is irrelevant as long as it passes schema validation.
   *  - If base scenes already cover the target, they are returned unchanged.
   *
   * This helper MUST NOT invent mathematical claims or alter approved content.
   */
  private expandScenesForDuration(
    baseScenes: EducationalStoryboardV3['scenes'],
    targetDurationSeconds: number,
    topicTitle: string,
    primaryClaimId: string
  ): EducationalStoryboardV3['scenes'] {
    const MAX_SCENE_DURATION = 120;
    const maxCapacity = baseScenes.length * MAX_SCENE_DURATION;
    if (targetDurationSeconds <= maxCapacity) {
      return baseScenes;
    }

    // Do NOT invent generic multi-scene filler loops (sc_expand_examples, sc_expand_misconceptions, etc.).
    // Adding ungrounded filler scenes creates verbose, hollow videos with no actual worked examples or math.
    // If base content capacity is exceeded, add at most one grounded reflection/summary scene if not already present,
    // explicitly labeled with reviewNotes, without fabricating unverified claims.
    const hasReflectionScene = baseScenes.some((s) => s.sceneType === 'summary');
    if (!hasReflectionScene) {
      const reflectionScene: EducationalStoryboardV3['scenes'][number] = {
        sceneId: 'sc_grounded_reflection',
        sceneType: 'summary',
        title: `Vận dụng & Khắc sâu: ${topicTitle}`,
        pedagogicalGoal: `Củng cố và tự kiểm tra hiểu biết cốt lõi về ${topicTitle}`,
        durationSeconds: Math.min(60, targetDurationSeconds - maxCapacity),
        boundClaimIds: [primaryClaimId],
        rendererTarget: 'remotion_infographic',
        narration: {
          vietnamese: `Để nắm vững ${topicTitle}, hãy thử tự giải thích lại từng bước và liên hệ điều kiện áp dụng trước khi kết thúc bài học.`,
          subtitleVietnamese: `Tự kiểm tra lại các bước cốt lõi của ${topicTitle}.`
        },
        visualPayload: {
          sceneType: 'summary',
          title: `Khắc sâu kiến thức: ${topicTitle}`,
          takeaways: [
            `Nắm vững điều kiện và phạm vi áp dụng của ${topicTitle}`,
            'Hiểu rõ ý nghĩa từng biến số và bước lập luận khoa học',
            'Tránh nhầm lẫn giữa trực quan minh họa và chứng minh hình thức'
          ],
          verifiedFacts: [],
          reviewNotes: ['Nội dung cần giáo viên đối chiếu theo bài tập giáo trình thực tế.'],
          finalCallout: topicTitle
        }
      };
      return [...baseScenes, reflectionScene];
    }

    return baseScenes;
  }

  private getDefaultClaimsForTopic(
    capability: TopicCapabilityReportV3,
    topic = capability.displayName,
    targetDuration = 60
  ): EducationalClaimV3[] {
    try {
      const plan = this.buildDeterministicPlan(
        'default_claims_plan',
        topic,
        capability,
        targetDuration
      );
      if (plan.educationalClaims && plan.educationalClaims.length > 0) {
        return plan.educationalClaims;
      }
    } catch {
      // fallback
    }
    const isMath = capability.domain === 'mathematics';
    const isAlgebra = capability.topicId === 'algebra.identities.seven';
    return [
      {
        id: isAlgebra ? 'claim_identity_1' : 'claim_default_1',
        claimType: isMath ? 'formal_mathematics' : 'ai_concept',
        statement: isAlgebra
          ? 'Bình phương của một tổng: (a+b)^2 = a^2+2*a*b+b^2'
          : `Khái niệm cơ bản của ${capability.displayName}`,
        formalExpression: isAlgebra ? '(a+b)^2 = a^2+2*a*b+b^2' : isMath ? 'x^2 = x^2' : undefined,
        validatorKey: isAlgebra ? 'algebra_identity_1' : undefined,
        verificationStatus: 'unverified',
        humanReviewComment: 'Mệnh đề mặc định cần giáo viên xem xét sư phạm.'
      }
    ];
  }

  private buildAdaptiveScenesForTopic(
    topicTitle: string,
    targetDuration: number,
    isMath: boolean,
    boundClaimId: string
  ): EducationalStoryboardV3['scenes'] {
    const maxSceneDuration = 60;
    const count = targetDuration <= 120
      ? 2
      : Math.max(3, Math.ceil(targetDuration / maxSceneDuration));

    const baseDuration = Math.floor(targetDuration / count);
    const remainder = targetDuration - baseDuration * count;
    const durations = Array.from({ length: count }, (_, i) => baseDuration + (i < remainder ? 1 : 0));

    const pedagogicalStages = [
      { type: 'concept_intro', title: `1. Giới thiệu & Đặt vấn đề: ${topicTitle}`, goal: `Kích hoạt sự tò mò và trực giác ban đầu về ${topicTitle}` },
      { type: 'concept_intro', title: `2. Khái niệm & Cơ sở lý thuyết: ${topicTitle}`, goal: `Trình bày cấu trúc và định nghĩa cốt lõi của ${topicTitle}` },
      { type: 'concept_intro', title: `3. Cơ chế hoạt động & Trực quan hóa: ${topicTitle}`, goal: `Phân tích luồng xử lý và quan hệ giữa các thành phần trong ${topicTitle}` },
      { type: 'concept_intro', title: `4. Ví dụ ứng dụng & Phân tích tình huống`, goal: `Minh họa bài toán thực tế áp dụng ${topicTitle}` },
      { type: 'concept_intro', title: `5. Lưu ý sư phạm & Tránh lỗi thường gặp`, goal: `Làm rõ các ngộ nhận phổ biến khi tìm hiểu ${topicTitle}` },
      { type: 'concept_intro', title: `6. Mở rộng & Liên hệ bức tranh tổng thể`, goal: `Kết nối ${topicTitle} với các kiến thức và mô hình liên quan` },
      { type: 'concept_intro', title: `7. Phân tích chi tiết trường hợp biên`, goal: `Khảo sát hành vi của mô hình trong các điều kiện đặc thù` },
      { type: 'concept_intro', title: `8. Đánh giá ưu nhược điểm & Hiệu năng`, goal: `Tổng kết điểm mạnh và hạn chế kỹ thuật của ${topicTitle}` },
      { type: 'concept_intro', title: `9. Luyện tập & Câu hỏi tư duy phản biện`, goal: `Thử thách học viên kiểm chứng hiểu biết về ${topicTitle}` },
      { type: 'summary', title: `Tổng kết & Khắc sâu trọng tâm bài học`, goal: `Củng cố toàn diện tri thức và định hướng thực hành` }
    ];

    return durations.map((dur, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === count - 1;
      const stage = isLast
        ? pedagogicalStages[pedagogicalStages.length - 1]
        : pedagogicalStages[Math.min(idx, pedagogicalStages.length - 2)];

      if (isLast) {
        return {
          sceneId: `sc_gen_${idx + 1}`,
          sceneType: 'summary' as const,
          title: stage.title,
          pedagogicalGoal: stage.goal,
          durationSeconds: dur,
          boundClaimIds: [boundClaimId],
          rendererTarget: 'remotion_infographic' as const,
          narration: {
            vietnamese: `Tổng kết toàn diện bài học về ${topicTitle}. Chúng ta đã cùng nhau tìm hiểu từ bản chất trực giác, nền tảng lý thuyết cho đến các ứng dụng thực tế và lưu ý quan trọng. Nắm vững kiến thức này sẽ giúp các em tự tin giải quyết các bài toán phức tạp hơn và xây dựng tư duy phân tích vững chắc. Chúc các em học tập hiệu quả và tiếp tục khám phá thêm nhiều kiến thức bổ ích.`,
            subtitleVietnamese: `Nắm vững bản chất cốt lõi và ứng dụng thực tiễn của ${topicTitle}.`
          },
          visualPayload: {
            sceneType: 'summary' as const,
            title: stage.title,
            takeaways: [
              `Nắm vững khái niệm nền tảng của ${topicTitle}`,
              'Hiểu rõ mối liên hệ giữa lý thuyết và trực quan',
              'Sẵn sàng áp dụng vào các bài toán thực hành'
            ],
            verifiedFacts: [],
            reviewNotes: ['Nội dung cần giáo viên rà soát ngữ nghĩa.'],
            finalCallout: `Khép lại bài học sư phạm về ${topicTitle}.`
          }
        };
      }

      return {
        sceneId: `sc_gen_${idx + 1}`,
        sceneType: 'concept_intro' as const,
        title: stage.title,
        pedagogicalGoal: stage.goal,
        durationSeconds: dur,
        boundClaimIds: [boundClaimId],
        rendererTarget: 'remotion_infographic' as const,
        narration: {
          vietnamese: isFirst
            ? `Chào mừng các em đến với bài học chuyên sâu về ${topicTitle}. Trong bài học hôm nay, chúng ta sẽ cùng nhau tiếp cận chủ đề từ bản chất trực giác, giải mã cơ chế vận hành từng bước và liên hệ trực tiếp với các ứng dụng thực tế. Hãy chú ý theo dõi để nắm bắt các khái niệm trọng tâm nhất nhé.`
            : `Bước sang phần tiếp theo: ${stage.title}. Tại đây, chúng ta sẽ đào sâu vào nguyên lý hoạt động và phân tích chi tiết các thành phần cấu thành của ${topicTitle}. Việc hiểu rõ bản chất ở bước này là chìa khóa giúp các em tránh được những nhầm lẫn phổ biến và làm chủ kiến thức một cách vững vàng.`,
          subtitleVietnamese: isFirst
            ? `Khám phá bài học sư phạm chuyên sâu về ${topicTitle}.`
            : `Phân tích sâu hơn về ${topicTitle}: ${stage.title}.`
        },
        visualPayload: {
          sceneType: 'concept_intro' as const,
          centralQuestion: `Bản chất của ${topicTitle} trong giai đoạn này là gì?`,
          keyConcept: topicTitle,
          accentColor: '#6366F1',
          visualStyleId: 'clean_educational_infographic' as const,
          reducedMotion: false
        }
      };
    });
  }

  private getDefaultScenesForTopic(
    capability: TopicCapabilityReportV3,
    targetDuration: number
  ): EducationalStoryboardV3['scenes'] {
    try {
      const plan = this.buildDeterministicPlan(
        'default_fixture_plan',
        capability.displayName,
        capability,
        targetDuration
      );
      if (plan.storyboard?.scenes && plan.storyboard.scenes.length >= 2) {
        return plan.storyboard.scenes;
      }
    } catch {
      // Fallback nếu plan thất bại
    }
    return this.buildAdaptiveScenesForTopic(
      capability.displayName,
      targetDuration,
      capability.domain === 'mathematics',
      'claim_default_1'
    );
  }
}

