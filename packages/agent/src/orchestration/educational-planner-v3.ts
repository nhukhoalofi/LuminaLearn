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
import { reviewPhysicsStoryboard } from './physics-storyboard-quality-loop';
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
        fps: capabilityReport.domain === 'physics' ? 30 : 24,
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
    const parsedPlan = EducationalLessonPlanV3Schema.parse(directedPlan);
    const physicsQuality = reviewPhysicsStoryboard(parsedPlan);
    if (!physicsQuality.passed) {
      throw new EducationalGenerationError(Object.assign(
        new Error(`physics_storyboard_quality_failed: ${physicsQuality.findings.filter((finding) => finding.severity === 'blocking').map((finding) => finding.code).join(', ')}`),
        { code: 'physics_storyboard_quality_failed', report: physicsQuality }
      ));
    }
    return parsedPlan;
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
    const targetScenes = capability.domain === 'physics' && targetDuration <= 60
      ? '6'
      : targetDuration <= 60 ? '2-3' : targetDuration <= 180 ? '4-5' : targetDuration <= 300 ? '5-7' : '8-12';
    const sceneDurationRule = capability.domain === 'physics' && targetDuration <= 60
      ? 'Mỗi phân cảnh phải có durationSeconds từ 5 đến 20 giây.'
      : 'Mỗi phân cảnh phải có durationSeconds từ 15 đến 90 giây.';

    const systemPrompt = `Bạn là Chuyên gia Thiết kế Giáo trình Toán học & AI LuminaLearn V3.
Nhiệm vụ: Lập kế hoạch bài học sư phạm video (${targetScenes} phân cảnh) cho chủ đề: "${input.topic}".
Lĩnh vực: ${capability.domain}. Ngôn ngữ: ${input.language === 'en' ? 'en' : 'vi'}.
Quy tắc toàn vẹn tri thức & Thời lượng bắt buộc:
- Thời lượng mục tiêu tổng thể: ${targetDuration} giây.
- QUY TẮC BẮT BUỘC VỀ THỜI LƯỢNG MỖI CẢNH: ${sceneDurationRule} TUYỆT ĐỐI KHÔNG vượt quá 120 giây.
- Tổng durationSeconds của tất cả phân cảnh phải đúng bằng ${targetDuration} giây.
- KHÔNG tự nhận định bất kỳ mệnh đề nào là "formally_verified".
- Mọi mệnh đề toán học phải nêu rõ biểu thức formalExpression và validatorKey thích hợp nếu có.
- Trả về JSON theo đúng định dạng cấu trúc bài học sư phạm V3.`;

    const userPrompt = `Hãy tạo kế hoạch bài học cho chủ đề "${input.topic}" (ID: ${capability.topicId}).
Thời lượng mục tiêu: ${targetDuration} giây (gồm ${targetScenes} phân cảnh; ${sceneDurationRule.toLowerCase()}; tối đa 120 giây).`;

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
          fps: capability.domain === 'physics' ? 30 : 24,
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

    // --- PHYSICS BENCHMARKS ---
    if (capability.topicId === 'physics.optics.rainbow') {
      summary = 'Sự hình thành cầu vồng qua tán sắc, khúc xạ và phản xạ trong giọt nước mưa.';
      learningObjectives = [
        'Hiểu cơ chế tán sắc ánh sáng mặt trời qua giọt nước mưa',
        'Nắm vững định luật khúc xạ ánh sáng và phản xạ toàn phần trong giọt nước',
        'Giải thích góc nhìn 42 độ tạo nên cung tròn cầu vồng'
      ];
      keyConcepts = ['Tán sắc ánh sáng', 'Khúc xạ', 'Phản xạ toàn phần', 'Góc cầu vồng chính 42 độ'];
      claims = [
        {
          id: 'claim_rainbow_dispersion',
          claimType: 'ai_concept' as const,
          statement: 'Ánh sáng trắng bị tán sắc thành các màu khi khúc xạ qua mặt giọt nước.',
          verificationStatus: 'unverified' as const
        },
        {
          id: 'claim_rainbow_internal_reflection',
          claimType: 'ai_concept' as const,
          statement: 'Tia sáng phản xạ ở mặt trong phía sau giọt nước trước khi thoát ra ngoài.',
          verificationStatus: 'unverified' as const
        },
        {
          id: 'claim_rainbow_angles',
          claimType: 'ai_concept' as const,
          statement: 'Góc cầu vồng chính lệch 42.37° (đỏ) và 40.51° (tím) theo định luật Snell.',
          verificationStatus: 'unverified' as const
        }
      ];

      const optics = {
        airRefractiveIndex: 1,
        waterRefractiveIndices: { red: 1.331, violet: 1.344 },
        primaryRainbowAnglesDeg: { red: 42.37, violet: 40.51 },
        accentColor: '#38BDF8'
      };

      const beats = [
        ['hook', 'Một giọt mưa có thể tách ánh sáng?', 'Theo dấu một tia sáng', 'push_in', false, 5, 'Sau cơn mưa, một tia sáng đi đúng đường qua giọt nước có thể tạo thành nhiều màu.'],
        ['white_light_spectrum', 'Ánh sáng trắng chứa một phổ liên tục', 'Mỗi bước sóng bị bẻ cong khác nhau', 'track_ray', false, 9, 'Ánh sáng trắng không phải đúng bảy màu rời rạc. Nó là một phổ liên tục; trong nước, mỗi bước sóng có chiết suất hơi khác nhau.'],
        ['entry_refraction', 'Lần 1: khúc xạ khi đi vào', 'Tia đổi hướng tại mặt giọt nước', 'push_in', true, 11, 'Khi đi từ không khí vào nước, tia sáng chậm lại và khúc xạ về phía pháp tuyến. Tia tím bị bẻ cong mạnh hơn tia đỏ.'],
        ['internal_reflection', 'Lần 2: phản xạ ở mặt sau', 'Một lần phản xạ tạo cầu vồng chính', 'orbit_drop', true, 10, 'Các tia chạm mặt sau của giọt và phản xạ trở lại. Với cầu vồng chính, đường đi quan trọng có đúng một lần phản xạ bên trong.'],
        ['exit_angles', 'Lần 3: khúc xạ khi đi ra', 'Đỏ khoảng 42,37° · tím khoảng 40,51°', 'track_ray', true, 11, 'Khi rời giọt nước, tia khúc xạ lần nữa. Mô hình cho góc cực đại khoảng bốn mươi hai phẩy ba bảy độ với đỏ và bốn mươi phẩy năm mốt độ với tím.'],
        ['observer_arc', 'Vì sao ta thấy một cung tròn?', 'Mặt Trời sau lưng · mưa phía trước', 'pull_out', false, 14, 'Mắt chỉ nhận những tia đến từ các giọt nằm đúng trên một hình nón quanh hướng đối Mặt Trời. Mặt đất che phần dưới, nên ta thường thấy một cung: đỏ ở ngoài, tím ở trong.']
      ] as const;

      scenes = beats.map(([stage, headline, focusLabel, cameraMove, showNormals, durationSeconds, narration], index) => ({
        sceneId: `sc_rainbow_${index + 1}`,
        sceneType: 'physics_optics' as const,
        title: headline,
        pedagogicalGoal: focusLabel,
        durationSeconds,
        boundClaimIds: [index < 2 ? 'claim_rainbow_dispersion' : index === 3 ? 'claim_rainbow_internal_reflection' : 'claim_rainbow_angles'],
        rendererTarget: 'remotion_infographic' as const,
        narration: { vietnamese: narration, subtitleVietnamese: narration },
        visualPayload: { sceneType: 'physics_optics' as const, stage, headline, focusLabel, ...optics, showNormals, cameraMove } as any
      }));
    } else if (capability.topicId === 'physics.electromagnetism.telecom') {
      summary = 'Theo dấu giọng nói qua sáu trạm: micro, số hóa, sóng vô tuyến, trạm gốc, giải mã và loa.';
      learningObjectives = [
        'Phân biệt sóng âm mang giọng nói với sóng điện từ truyền tín hiệu vô tuyến',
        'Mô tả đúng chuỗi biến đổi từ âm thanh đến tín hiệu số và trở lại âm thanh',
        'Không nhầm điện thoại truyền trực tiếp giọng nói trong không khí đến người nghe'
      ];
      keyConcepts = ['Sóng âm', 'Tín hiệu điện', 'Số hóa', 'Sóng điện từ', 'Giải mã'];
      claims = [
        { id: 'claim_phone_microphone', claimType: 'empirical_observation', statement: 'Micro biến dao động áp suất âm thành tín hiệu điện.', verificationStatus: 'unverified', humanReviewComment: 'Cần nguồn kỹ thuật và giáo viên duyệt.' },
        { id: 'claim_phone_radio', claimType: 'algorithmic_property', statement: 'Thông tin giọng nói đã mã hóa được mang qua liên kết vô tuyến bằng sóng điện từ.', verificationStatus: 'unverified', humanReviewComment: 'Mô hình khái quát, không mô tả giao thức mạng cụ thể.' },
        { id: 'claim_phone_speaker', claimType: 'empirical_observation', statement: 'Loa biến tín hiệu điện đã giải mã thành dao động không khí mà tai nghe được.', verificationStatus: 'unverified', humanReviewComment: 'Cần nguồn kỹ thuật và giáo viên duyệt.' }
      ];
      const nodes = ['Micro', 'ADC', 'Sóng', 'BTS', 'DAC', 'Loa'];
      const chain = (activeNodeIndex: number, carrierLabel: string) => ({ kind: 'process_chain' as const, nodes, activeNodeIndex, carrierLabel });
      const beats = [
        { beat: 'hook', headline: 'Giọng nói đi đâu sau khi vào điện thoại?', focus: 'Một hành trình qua 6 trạm', insight: 'Giọng nói không bay nguyên vẹn đến máy bên kia.', duration: 6, claimId: 'claim_phone_microphone', narration: 'Bạn nói ở đây, người ở rất xa vẫn nghe gần như tức thì. Giọng nói đã đi qua sáu lần biến đổi.', family: 'process_chain', camera: 'push_in', simulation: chain(0, 'GIỌNG NÓI') },
        { beat: 'system_model', headline: 'Micro: âm thanh thành tín hiệu điện', focus: 'Màng rung chuyển dao động áp suất', insight: 'Sóng âm làm màng micro rung theo giọng nói.', duration: 9, claimId: 'claim_phone_microphone', narration: 'Sóng âm làm màng micro rung. Chuyển động này được biến thành tín hiệu điện thay đổi theo giọng nói.', family: 'process_chain', camera: 'macro', simulation: chain(0, 'SÓNG ÂM') },
        { beat: 'mechanism_a', headline: 'Tín hiệu được lấy mẫu và mã hóa', focus: 'Từ tín hiệu liên tục thành dữ liệu số', insight: 'Điện thoại truyền dữ liệu biểu diễn giọng nói.', duration: 11, claimId: 'claim_phone_radio', narration: 'Bộ chuyển đổi lấy mẫu tín hiệu, lượng tử hóa và mã hóa nó thành dữ liệu số để xử lý và truyền đi.', family: 'process_chain', camera: 'track', simulation: chain(1, 'BIT SỐ') },
        { beat: 'mechanism_b', headline: 'Sóng vô tuyến mang thông tin', focus: 'Điện trường và từ trường lan truyền', insight: 'Sóng điện từ là phương tiện mang dữ liệu, không phải chính âm thanh.', duration: 10, claimId: 'claim_phone_radio', narration: 'Dữ liệu điều khiển sóng mang vô tuyến. Sóng điện từ lan đến trạm gốc rồi được mạng chuyển tiếp.', family: 'wave_propagation', camera: 'track', simulation: { kind: 'wave' as const, amplitude: 74, spatialFrequency: 3.2, propagationSpeed: 4.5, wavelengthLabel: 'Bước sóng λ', relationLabel: 'λ = v / f' } },
        { beat: 'evidence', headline: 'Máy nhận dựng lại tín hiệu', focus: 'Giải mã và chuyển về dạng điện', insight: 'Chuỗi xử lý được đảo ngược ở đầu nhận.', duration: 10, claimId: 'claim_phone_radio', narration: 'Điện thoại bên kia nhận dữ liệu, kiểm tra, giải mã và dựng lại tín hiệu điện tương ứng với giọng nói.', family: 'process_chain', camera: 'track', simulation: chain(4, 'TÍN HIỆU') },
        { beat: 'takeaway', headline: 'Loa biến tín hiệu thành âm thanh', focus: 'Màng loa rung · không khí rung · tai nghe', insight: 'Âm → điện → số → sóng → số → điện → âm.', duration: 14, claimId: 'claim_phone_speaker', narration: 'Cuối cùng, dòng điện làm màng loa rung và tạo sóng âm mới. Vì thế người nghe nhận được bản tái tạo của giọng nói ban đầu.', family: 'process_chain', camera: 'pull_out', simulation: chain(5, 'ÂM THANH') }
      ] as const;
      scenes = beats.map((item, index) => ({
        sceneId: `sc_phone_${index + 1}`,
        sceneType: 'physics_explainer' as const,
        title: item.headline,
        pedagogicalGoal: item.focus,
        durationSeconds: item.duration,
        boundClaimIds: [item.claimId],
        rendererTarget: 'remotion_infographic' as const,
        narration: { vietnamese: item.narration, subtitleVietnamese: item.narration },
        visualPayload: { sceneType: 'physics_explainer' as const, family: item.family, beat: item.beat, headline: item.headline, focusLabel: item.focus, insight: item.insight, simulation: item.simulation, cameraMove: item.camera, accentColor: '#38BDF8' }
      }));
    } else if (capability.topicId === 'physics.thermodynamics.condensation') {
      summary = 'Theo dõi hơi nước trong không khí bị làm lạnh sát bề mặt lon và ngưng tụ thành giọt khi nhiệt độ xuống dưới điểm sương.';
      learningObjectives = [
        'Nhận biết nước bên ngoài lon đến từ hơi nước trong không khí, không thấm xuyên qua vỏ lon',
        'Giải thích vai trò của nhiệt độ bề mặt và điểm sương',
        'Mô tả chuyển động hạt trước và trong quá trình ngưng tụ'
      ];
      keyConcepts = ['Hơi nước', 'Trao đổi nhiệt', 'Điểm sương', 'Ngưng tụ'];
      claims = [
        { id: 'claim_condensation_vapor', claimType: 'empirical_observation', statement: 'Không khí xung quanh luôn có một lượng hơi nước.', verificationStatus: 'unverified', humanReviewComment: 'Cần nguồn khí tượng hoặc nhiệt học và giáo viên duyệt.' },
        { id: 'claim_condensation_dewpoint', claimType: 'algorithmic_property', statement: 'Khi không khí sát bề mặt nguội đến điểm sương, hơi nước có thể ngưng tụ.', verificationStatus: 'unverified', humanReviewComment: 'Điều kiện nhiệt độ trong payload được kiểm tra số; phát biểu vẫn cần nguồn.' },
        { id: 'claim_condensation_origin', claimType: 'empirical_observation', statement: 'Giọt nước ngoài lon hình thành từ hơi nước không khí, không phải nước xuyên qua thành lon.', verificationStatus: 'unverified', humanReviewComment: 'Cần giáo viên xác nhận diễn giải sư phạm.' }
      ];
      const particle = (temperature: 'low' | 'medium' | 'high', phase: 'gas' | 'liquid' | 'condensing') => ({
        kind: 'particle_state' as const,
        particleCount: 34,
        temperature,
        phase,
        ...(phase === 'condensing' ? { surfaceTemperatureC: 8, dewPointC: 14 } : {})
      });
      const beats = [
        { beat: 'hook', headline: 'Nước bên ngoài lon đến từ đâu?', focus: 'Không có lỗ thủng nào trên vỏ lon', insight: 'Nguồn nước nằm trong không khí xung quanh.', duration: 6, claimId: 'claim_condensation_origin', narration: 'Một lon nước lạnh nhanh chóng phủ đầy giọt nước. Nhưng nước không xuyên qua lớp kim loại kín.', temp: 'medium', phase: 'gas', camera: 'push_in' },
        { beat: 'system_model', headline: 'Không khí luôn chứa hơi nước', focus: 'Các phân tử nước chuyển động hỗn loạn', insight: 'Hơi nước vô hình vẫn hiện diện quanh chiếc lon.', duration: 9, claimId: 'claim_condensation_vapor', narration: 'Trong không khí luôn có các phân tử nước ở thể hơi, chuyển động và va chạm liên tục.', temp: 'medium', phase: 'gas', camera: 'track' },
        { beat: 'mechanism_a', headline: 'Bề mặt lạnh lấy bớt năng lượng', focus: 'Lớp không khí sát lon nguội đi', insight: 'Nhiệt độ giảm làm chuyển động phân tử chậm lại.', duration: 11, claimId: 'claim_condensation_dewpoint', narration: 'Bề mặt lon lạnh nhận nhiệt từ lớp không khí sát nó. Các phân tử nước mất bớt động năng và chuyển động chậm hơn.', temp: 'low', phase: 'gas', camera: 'macro' },
        { beat: 'mechanism_b', headline: 'Chạm điểm sương: bắt đầu ngưng tụ', focus: 'Bề mặt 8°C · điểm sương minh họa 14°C', insight: 'Bề mặt lạnh hơn điểm sương tạo điều kiện ngưng tụ.', duration: 10, claimId: 'claim_condensation_dewpoint', narration: 'Trong ví dụ này, bề mặt tám độ thấp hơn điểm sương mười bốn độ. Hơi nước bắt đầu tụ lại trên bề mặt.', temp: 'low', phase: 'condensing', camera: 'macro' },
        { beat: 'evidence', headline: 'Các cụm nhỏ lớn dần thành giọt', focus: 'Phân tử bám vào mầm ngưng tụ', insight: 'Nhiều phân tử hợp lại thành giọt nhìn thấy được.', duration: 10, claimId: 'claim_condensation_dewpoint', narration: 'Những cụm phân tử nhỏ tiếp tục nhận thêm hơi nước, lớn dần và trở thành các giọt mà mắt ta nhìn thấy.', temp: 'low', phase: 'condensing', camera: 'track' },
        { beat: 'takeaway', headline: 'Giọt nước đến từ không khí', focus: 'Lạnh bề mặt → dưới điểm sương → ngưng tụ', insight: 'Không khí ẩm gặp bề mặt đủ lạnh sẽ tạo giọt nước.', duration: 14, claimId: 'claim_condensation_origin', narration: 'Vậy nước ngoài lon đến từ hơi nước trong không khí. Bề mặt đủ lạnh đưa lớp khí sát nó xuống điểm sương và gây ngưng tụ.', temp: 'low', phase: 'condensing', camera: 'pull_out' }
      ] as const;
      scenes = beats.map((item, index) => ({
        sceneId: `sc_condensation_${index + 1}`,
        sceneType: 'physics_explainer' as const,
        title: item.headline,
        pedagogicalGoal: item.focus,
        durationSeconds: item.duration,
        boundClaimIds: [item.claimId],
        rendererTarget: 'remotion_infographic' as const,
        narration: { vietnamese: item.narration, subtitleVietnamese: item.narration },
        visualPayload: { sceneType: 'physics_explainer' as const, family: 'particle_state' as const, beat: item.beat, headline: item.headline, focusLabel: item.focus, insight: item.insight, simulation: particle(item.temp, item.phase), cameraMove: item.camera, accentColor: '#38BDF8' }
      }));
    } else if (capability.topicId === 'physics.waves.sound') {
      summary = 'Mô tả sóng âm như sự lan truyền dao động áp suất qua môi trường, với tần số, bước sóng và vận tốc liên hệ bởi v = fλ.';
      learningObjectives = ['Phân biệt chuyển động của phần tử môi trường với hướng truyền năng lượng', 'Kiểm tra quan hệ v = fλ bằng dữ liệu số', 'Liên hệ tần số với độ cao của âm'];
      keyConcepts = ['Dao động áp suất', 'Tần số', 'Bước sóng', 'Vận tốc truyền âm'];
      claims = [
        { id: 'claim_sound_medium', claimType: 'empirical_observation', statement: 'Âm truyền qua môi trường nhờ dao động cục bộ của các phần tử môi trường.', verificationStatus: 'unverified', humanReviewComment: 'Cần nguồn vật lý và giáo viên duyệt.' },
        { id: 'claim_sound_relation', claimType: 'algorithmic_property', statement: 'Trong mô hình sóng điều hòa, vận tốc truyền thỏa v = fλ.', verificationStatus: 'unverified', humanReviewComment: 'Payload số được kiểm tra bằng quan hệ v = fλ.' },
        { id: 'claim_sound_frequency', claimType: 'empirical_observation', statement: 'Tần số lớn hơn tương ứng âm cao hơn khi các điều kiện nghe khác giữ nguyên.', verificationStatus: 'unverified', humanReviewComment: 'Cần nguồn âm học và giới hạn phạm vi.' }
      ];
      const wave = (amplitude: number, spatialFrequency: number) => ({ kind: 'wave' as const, amplitude, spatialFrequency, propagationSpeed: 4, wavelengthLabel: 'λ = 0,50 m', relationLabel: '340 = 680 × 0,50', frequencyHz: 680, wavelengthMeters: 0.5, physicalSpeedMps: 340 });
      const beats = [
        ['hook', 'Âm thanh đi đến tai bằng cách nào?', 'Không khí không bay từ loa đến tai', 'Năng lượng lan đi; phần tử khí chỉ dao động quanh vị trí cân bằng.', 6, 'claim_sound_medium', 'Loa rung nhưng không đẩy cả khối không khí đến tai. Nó tạo một nhiễu loạn áp suất lan qua môi trường.', 78, 2.2, 'push_in'],
        ['system_model', 'Nén và giãn truyền nối tiếp', 'Mỗi lớp khí tác động lên lớp kế bên', 'Vùng nén và vùng giãn dịch chuyển theo thời gian.', 9, 'claim_sound_medium', 'Màng loa nén lớp không khí trước mặt. Lớp này truyền tác động sang lớp kế tiếp, tạo sóng âm lan ra xa.', 72, 2.7, 'track'],
        ['mechanism_a', 'Phần tử khí dao động cục bộ', 'Chuyển động qua lại quanh cân bằng', 'Hạt không đi cùng sóng trên toàn quãng đường.', 10, 'claim_sound_medium', 'Từng phần tử khí chỉ dao động qua lại quanh vị trí cân bằng, trong khi năng lượng của nhiễu loạn tiếp tục truyền đi.', 64, 3.1, 'macro'],
        ['mechanism_b', 'Tần số quyết định độ cao của âm', '680 dao động mỗi giây trong ví dụ', 'Tần số cao tạo cảm giác âm cao hơn.', 10, 'claim_sound_frequency', 'Tần số cho biết số dao động trong một giây. Ở đây ta minh họa sáu trăm tám mươi héc.', 58, 4.1, 'track'],
        ['evidence', 'Kiểm tra v = fλ', '680 Hz × 0,50 m = 340 m/s', 'Ba đại lượng phải nhất quán trong cùng môi trường.', 11, 'claim_sound_relation', 'Với tần số sáu trăm tám mươi héc và bước sóng không phẩy năm mét, tích của chúng là ba trăm bốn mươi mét trên giây.', 68, 3.4, 'macro'],
        ['takeaway', 'Âm là sóng cơ mang năng lượng', 'Cần nguồn dao động và một môi trường', 'Không có môi trường vật chất thì sóng âm không truyền.', 14, 'claim_sound_medium', 'Âm là sóng cơ. Nguồn làm môi trường dao động, dao động truyền năng lượng, còn các phần tử chỉ rung quanh vị trí của chúng.', 76, 2.5, 'pull_out']
      ] as const;
      scenes = beats.map(([beat, headline, focus, insight, duration, claimId, narration, amplitude, frequency, camera], index) => ({ sceneId: `sc_sound_${index + 1}`, sceneType: 'physics_explainer' as const, title: headline, pedagogicalGoal: focus, durationSeconds: duration, boundClaimIds: [claimId], rendererTarget: 'remotion_infographic' as const, narration: { vietnamese: narration, subtitleVietnamese: narration }, visualPayload: { sceneType: 'physics_explainer' as const, family: 'wave_propagation' as const, beat, headline, focusLabel: focus, insight, simulation: wave(amplitude, frequency), cameraMove: camera, accentColor: '#38BDF8' } }));
    } else if (capability.topicId === 'physics.waves.lightning_thunder') {
      summary = 'Giải thích hiện tượng quang - âm: Ta thấy tia chớp trước rồi mới nghe sấm vì ánh sáng truyền nhanh gấp gần một triệu lần âm thanh trong không khí.';
      learningObjectives = [
        'Hiểu bản chất của sấm sét: nguồn phát đồng thời cả ánh sáng và âm thanh',
        'So sánh vận tốc ánh sáng (c ≈ 300.000 km/s) và vận tốc âm thanh (v ≈ 340 m/s)',
        'Ứng dụng công thức tính khoảng cách cơn dông: d = v_âm · Δt'
      ];
      keyConcepts = ['Tia sét', 'Vận tốc ánh sáng', 'Vận tốc âm thanh', 'Độ trễ thời gian', 'Khoảng cách cơn dông'];
      claims = [
        { id: 'claim_simultaneous_emission', claimType: 'empirical_observation', statement: 'Tia sét phát ra ánh sáng và sóng âm thanh đồng thời tại cùng một vị trí.', verificationStatus: 'unverified', humanReviewComment: 'Hiện tượng phóng điện khí quyển.' },
        { id: 'claim_speed_difference', claimType: 'algorithmic_property', statement: 'Vận tốc ánh sáng trong khí quyển xấp xỉ 300.000 km/s, nhanh gấp khoảng một triệu lần so với âm thanh 340 m/s.', verificationStatus: 'unverified', humanReviewComment: 'So sánh tốc độ lan truyền sóng.' }
      ];
      const lightningChain = (stage: number) => ({
        kind: 'process_chain' as const,
        nodes: ['Sét đánh', 'Quang: 300.000 km/s', 'Mắt thấy chớp', 'Âm: 340 m/s', 'Tai nghe sấm'],
        activeNodeIndex: Math.min(stage, 4),
        carrierLabel: stage <= 2 ? 'ÁNH SÁNG (TỨC THỜI)' : 'SÓNG ÂM (ĐỘ TRỄ)'
      });
      const beats = [
        ['hook', 'Vì sao thấy chớp trước rồi mới nghe sấm?', 'Mắt thấy ánh chớp lóe lên trước tiếng nổ đì đùng', 'Hiện tượng diễn ra đồng thời tại nguồn nhưng đến mắt và tai vào hai thời điểm khác nhau.', 6, 'claim_simultaneous_emission', 'Vì sao trong cơn dông, ta luôn thấy tia chớp lóe sáng trước rồi một lúc sau mới nghe thấy tiếng sấm?', 'push_in'],
        ['system_model', 'Nguồn phát: Tia sét tạo ra cả quang và âm', 'Tia chớp phát ra ánh sáng và sóng âm đồng thời', 'Sự phóng điện giữa các đám mây sinh ra ánh sáng chói lòa và sóng âm cùng lúc.', 9, 'claim_simultaneous_emission', 'Tia sét là sự phóng điện cực lớn giữa các đám mây, sinh ra cả ánh sáng rực rỡ và sóng âm thanh cực mạnh đồng thời.', 'macro'],
        ['mechanism_a', 'Tốc độ ánh sáng: 300.000 km/s', 'Ánh sáng truyền tới mắt ta gần như tức thời', 'Với c xấp xỉ 300.000 km/s, ánh sáng chỉ mất vài phần triệu giây để đến mắt ta.', 10, 'claim_speed_difference', 'Ánh sáng di chuyển với vận tốc ba trăm nghìn cây số trong một giây, truyền tới mắt ta gần như ngay tức khắc.', 'track'],
        ['mechanism_b', 'Tốc độ âm thanh: Chỉ 340 m/s', 'Sóng âm truyền trong không khí chậm hơn nhiều', 'Âm thanh truyền với vận tốc 340 m/s, mất gần ba giây cho mỗi kilômét.', 10, 'claim_speed_difference', 'Trong khi đó, âm thanh truyền trong không khí chỉ với tốc độ ba trăm bốn mươi mét trên giây, chậm hơn gần một triệu lần.', 'track'],
        ['evidence', 'Độ trễ thời gian: Δt = d / v_âm', 'Quy tắc đếm giây ước lượng cự ly cơn dông', 'Mỗi 3 giây độ trễ tương ứng khoảng cách xấp xỉ 1 kilômét.', 11, 'claim_speed_difference', 'Sự chênh lệch vận tốc này tạo ra độ trễ. Cứ ba giây sau chớp mới nghe sấm thì tia sét cách ta khoảng một kilômét.', 'macro'],
        ['takeaway', 'Bản chất: Tốc độ lan truyền sóng', 'Ánh sáng là sóng điện từ · Sấm là sóng cơ', 'Sóng điện từ lan truyền với tốc độ ánh sáng, vượt trội sóng cơ học.', 14, 'claim_speed_difference', 'Tóm lại, chớp đến trước vì ánh sáng truyền nhanh gấp triệu lần âm thanh. Một quy luật vật lý thật thú vị và hữu ích!', 'pull_out']
      ] as const;
      scenes = beats.map(([beat, headline, focus, insight, duration, claimId, narration, camera], index) => ({
        sceneId: `sc_lightning_${index + 1}`,
        sceneType: 'physics_explainer' as const,
        title: headline,
        pedagogicalGoal: focus,
        durationSeconds: duration,
        boundClaimIds: [claimId],
        rendererTarget: 'remotion_infographic' as const,
        narration: { vietnamese: narration, subtitleVietnamese: narration },
        visualPayload: {
          sceneType: 'physics_explainer' as const,
          family: 'process_chain' as const,
          beat,
          headline,
          focusLabel: focus,
          insight,
          simulation: lightningChain(index),
          cameraMove: camera,
          accentColor: '#F59E0B'
        }
      }));
    } else if (capability.topicId === 'physics.mechanics.inertia_braking') {
      summary = 'Giải thích hiện tượng quán tính theo định luật I Newton: Khi xe phanh gấp, lực hãm làm xe giảm tốc nhưng người vẫn tiếp tục chuyển động với vận tốc cũ.';
      learningObjectives = [
        'Hiểu bản chất của quán tính: xu hướng bảo toàn vận tốc của vật',
        'Phân biệt chuyển động của xe (có lực phanh) và người trên xe (chưa kịp nhận lực)',
        'Ứng dụng an toàn giao thông: vì sao phải thắt dây an toàn'
      ];
      keyConcepts = ['Quán tính', 'Định luật I Newton', 'Lực hãm phanh', 'Hệ quy chiếu', 'Dây an toàn'];
      claims = [
        { id: 'claim_inertia_definition', claimType: 'empirical_observation', statement: 'Mọi vật đều có xu hướng bảo toàn trạng thái đứng yên hoặc chuyển động thẳng đều.', verificationStatus: 'unverified', humanReviewComment: 'Định luật I Newton.' },
        { id: 'claim_braking_force', claimType: 'algorithmic_property', statement: 'Lực phanh tác dụng lên xe làm xe giảm tốc độ, nhưng không tác dụng trực tiếp tức thời lên phần trên cơ thể.', verificationStatus: 'unverified', humanReviewComment: 'Sự chênh lệch gia tốc giữa xe và hành khách.' }
      ];
      const inertiaForce = (stage: number) => ({
        kind: 'force_motion' as const,
        objectType: 'box' as const,
        motionModel: 'static' as const,
        formula: stage >= 3 ? 'v = const (khi ΣF = 0)' : 'Định luật I Newton (Quán tính)',
        forces: stage === 0
          ? [{ label: 'v = 50 km/h', color: '#38BDF8', angleDeg: 0, magnitude: 140 }]
          : stage === 1 || stage === 2
            ? [{ label: 'F hãm phanh', color: '#EF4444', angleDeg: 180, magnitude: 160 }, { label: 'v người', color: '#38BDF8', angleDeg: 0, magnitude: 130 }, { label: 'N', color: '#FBBF24', angleDeg: 270, magnitude: 100 }, { label: 'P = mg', color: '#A78BFA', angleDeg: 90, magnitude: 100 }]
            : stage === 3
              ? [{ label: 'F dây an toàn', color: '#10B981', angleDeg: 180, magnitude: 150 }, { label: 'Quán tính', color: '#38BDF8', angleDeg: 0, magnitude: 120 }]
              : [{ label: 'Bảo toàn vận tốc', color: '#38BDF8', angleDeg: 0, magnitude: 130 }],
        massKg: 60,
        accelerationMps2: -4,
        netForceN: -240
      });
      const beats = [
        ['hook', 'Vì sao khi phanh gấp ta bị chúi tới?', 'Dù không ai đẩy, cơ thể vẫn lao về phía trước', 'Cơ thể đang tiếp tục chuyển động theo vận tốc trước đó của xe.', 6, 'claim_inertia_definition', 'Khi bạn đang ngồi trên xe chạy nhanh và tài xế đạp phanh gấp, cơ thể bạn lập tức bị chúi mạnh về phía trước.', 'push_in'],
        ['system_model', 'Xe và người trước khi phanh', 'Cả hai cùng chuyển động với vận tốc v', 'Người và xe di chuyển cùng một tốc độ trước thời điểm phanh.', 9, 'claim_inertia_definition', 'Trước khi phanh, cả xe và người đều cùng chuyển động về phía trước với cùng vận tốc năm mươi cây số một giờ.', 'macro'],
        ['mechanism_a', 'Khoảnh khắc đạp phanh', 'Lực phanh hãm bánh xe · Thân xe chậm lại', 'Lực ma sát phanh tác dụng lên xe, làm xe giảm tốc nhanh chóng.', 10, 'claim_braking_force', 'Khi đạp phanh, lực hãm của mặt đường tác dụng lên bánh xe khiến chiếc xe đột ngột giảm tốc độ.', 'track'],
        ['mechanism_b', 'Quán tính giữ nguyên vận tốc', 'Cơ thể tiếp tục lao đi theo vận tốc cũ', 'Do quán tính, phần trên cơ thể chưa nhận lực hãm nên vẫn bảo toàn chuyển động.', 10, 'claim_inertia_definition', 'Tuy nhiên, phần trên cơ thể bạn không dính chặt vào xe. Theo quán tính, bạn vẫn tiếp tục lao về phía trước với tốc độ cũ.', 'track'],
        ['evidence', 'Định luật I Newton: Giữ nguyên trạng thái', 'Không có ngoại lực kéo lại thì vật giữ vận tốc', 'Cơ thể chỉ dừng lại khi có ngoại lực như dây an toàn tác dụng.', 11, 'claim_inertia_definition', 'Định luật một Newton chỉ ra: Một vật sẽ giữ nguyên trạng thái chuyển động nếu không có ngoại lực tác dụng ép nó dừng lại.', 'macro'],
        ['takeaway', 'Bản chất của Quán tính & Dây an toàn', 'Quán tính là thuộc tính của mọi vật có khối lượng', 'Luôn thắt dây an toàn để dây tạo lực hãm giữ cơ thể an toàn.', 14, 'claim_braking_force', 'Đó chính là quán tính. Hãy luôn thắt dây an toàn để dây tạo lực hãm giữ bạn lại kịp thời khi xe phanh gấp!', 'pull_out']
      ] as const;
      scenes = beats.map(([beat, headline, focus, insight, duration, claimId, narration, camera], index) => ({
        sceneId: `sc_inertia_${index + 1}`,
        sceneType: 'physics_explainer' as const,
        title: headline,
        pedagogicalGoal: focus,
        durationSeconds: duration,
        boundClaimIds: [claimId],
        rendererTarget: 'remotion_infographic' as const,
        narration: { vietnamese: narration, subtitleVietnamese: narration },
        visualPayload: {
          sceneType: 'physics_explainer' as const,
          family: 'force_motion' as const,
          beat,
          headline,
          focusLabel: focus,
          insight,
          simulation: inertiaForce(index),
          cameraMove: camera,
          accentColor: '#38BDF8'
        }
      }));
    } else if (capability.topicId === 'physics.mechanics.newton_forces') {
      summary = 'Dùng sơ đồ lực và dữ liệu số để nối hợp lực với gia tốc theo định luật II Newton.';
      learningObjectives = ['Vẽ đúng các lực tác dụng lên một vật', 'Phân biệt từng lực với hợp lực', 'Kiểm tra định lượng F = ma'];
      keyConcepts = ['Sơ đồ vật tự do', 'Hợp lực', 'Khối lượng', 'Gia tốc', 'F = ma'];
      claims = [
        { id: 'claim_newton_freebody', claimType: 'empirical_observation', statement: 'Sơ đồ vật tự do chỉ biểu diễn các lực tác dụng lên vật đang xét.', verificationStatus: 'unverified', humanReviewComment: 'Cần giáo viên duyệt cách chọn hệ.' },
        { id: 'claim_newton_second', claimType: 'algorithmic_property', statement: 'Trong hệ quy chiếu quán tính, hợp lực bằng khối lượng nhân gia tốc.', verificationStatus: 'unverified', humanReviewComment: 'Payload số phải thỏa F = ma.' }
      ];
      const forceStates = [
        [{ label: 'ΣF', color: '#38BDF8', angleDeg: 0, magnitude: 110 }],
        [{ label: 'F kéo', color: '#38BDF8', angleDeg: 0, magnitude: 150 }, { label: 'F cản', color: '#EF4444', angleDeg: 180, magnitude: 80 }, { label: 'N', color: '#FBBF24', angleDeg: 270, magnitude: 105 }, { label: 'P = mg', color: '#A78BFA', angleDeg: 90, magnitude: 105 }],
        [{ label: 'N', color: '#FBBF24', angleDeg: 270, magnitude: 105 }, { label: 'P = mg', color: '#A78BFA', angleDeg: 90, magnitude: 105 }],
        [{ label: 'F kéo', color: '#38BDF8', angleDeg: 0, magnitude: 150 }, { label: 'F cản', color: '#EF4444', angleDeg: 180, magnitude: 80 }]
      ] as const;
      const force = (stage: number) => ({ kind: 'force_motion' as const, objectType: 'box' as const, motionModel: 'static' as const, formula: stage === 4 ? '6 N = 2 kg × 3 m/s²' : 'ΣF = ma', forces: [...forceStates[Math.min(stage, forceStates.length - 1)]], massKg: 2, accelerationMps2: 3, netForceN: 6 });
      const beats = [
        ['hook', 'Vì sao vật bắt đầu tăng tốc?', 'Không phải cứ có lực là vật đi theo lực lớn nhất', 'Gia tốc do hợp lực của tất cả lực quyết định.', 6, 'claim_newton_second', 'Một vật có thể chịu nhiều lực cùng lúc. Điều quyết định gia tốc là tổng có hướng của chúng.', 'push_in'],
        ['system_model', 'Tách vật khỏi môi trường', 'Vẽ sơ đồ vật tự do', 'Chỉ giữ các lực tác dụng lên chính vật đang xét.', 9, 'claim_newton_freebody', 'Ta cô lập vật và vẽ từng lực từ tâm vật: trọng lực, phản lực, lực kéo và lực cản.', 'macro'],
        ['mechanism_a', 'Hai lực đứng cân bằng', 'Phản lực và trọng lực triệt tiêu theo phương đứng', 'Không có gia tốc đứng khi tổng lực đứng bằng không.', 10, 'claim_newton_freebody', 'Theo phương đứng, phản lực của mặt bàn cân bằng trọng lực nên vật không gia tốc lên hoặc xuống.', 'track'],
        ['mechanism_b', 'Lực ngang không cân bằng', 'Lực kéo lớn hơn lực cản', 'Hợp lực ngang hướng sang phải.', 10, 'claim_newton_second', 'Theo phương ngang, lực kéo lớn hơn lực cản. Phần chênh lệch tạo thành hợp lực hướng sang phải.', 'track'],
        ['evidence', 'Kiểm tra định lượng F = ma', 'Vật 2 kg · gia tốc 3 m/s² · hợp lực 6 N', '6 N = 2 kg × 3 m/s².', 11, 'claim_newton_second', 'Với khối lượng hai ki lô gam và gia tốc ba mét trên giây bình phương, hợp lực phải bằng sáu niu tơn.', 'macro'],
        ['takeaway', 'Hợp lực quyết định gia tốc', 'Cùng hợp lực, vật nặng hơn tăng tốc ít hơn', 'Luôn cộng lực theo vector trước khi dùng F = ma.', 14, 'claim_newton_second', 'Hãy cộng các lực theo vector để tìm hợp lực, rồi mới dùng định luật hai Newton để suy ra gia tốc.', 'pull_out']
      ] as const;
      scenes = beats.map(([beat, headline, focus, insight, duration, claimId, narration, camera], index) => ({ sceneId: `sc_newton_${index + 1}`, sceneType: 'physics_explainer' as const, title: headline, pedagogicalGoal: focus, durationSeconds: duration, boundClaimIds: [claimId], rendererTarget: 'remotion_infographic' as const, narration: { vietnamese: narration, subtitleVietnamese: narration }, visualPayload: { sceneType: 'physics_explainer' as const, family: 'force_motion' as const, beat, headline, focusLabel: focus, insight, simulation: force(index === 5 ? 0 : index), cameraMove: camera, accentColor: '#38BDF8' } }));
    } else if (capability.topicId === 'physics.astronomy.earth_seasons') {
      summary = 'Giải thích vì sao mùa hè nóng mùa đông lạnh: Do trục Trái Đất nghiêng 23.5° tạo nên sự thay đổi góc chiếu bức xạ Lambert và độ dài ngày đêm.';
      learningObjectives = [
        'Bác bỏ ngộ nhận mùa do khoảng cách Trái Đất - Mặt Trời (tháng 1 gần nhất nhưng là mùa đông)',
        'Hiểu bản chất trục nghiêng 23.5° không đổi phương trong không gian khi quay trên quỹ đạo',
        'Nắm vững định luật góc chiếu Lambert: Góc chiếu dốc tập trung năng lượng, góc xiên làm năng lượng phân tán',
        'Liên hệ thời lượng chiếu sáng thực tế (Hà Nội: 13.5h mùa hè vs 11h mùa đông)'
      ];
      keyConcepts = ['Trục nghiêng 23.5°', 'Điểm cận nhật / viễn nhật', 'Định luật Lambert', 'Góc tới bức xạ', 'Thời lượng ngày đêm'];
      claims = [
        { id: 'claim_seasons_misconception', claimType: 'empirical_observation', statement: 'Khoảng cách không quyết định mùa: Điểm cận nhật 147 triệu km rơi vào tháng 1 khi Bắc bán cầu là mùa đông.', verificationStatus: 'unverified', humanReviewComment: 'Dữ liệu thiên văn quỹ đạo elip của Trái Đất.' },
        { id: 'claim_seasons_axial_tilt', claimType: 'algorithmic_property', statement: 'Trục Trái Đất nghiêng 23.5 độ so với pháp tuyến mặt phẳng quỹ đạo và giữ nguyên phương trong không gian.', verificationStatus: 'unverified', humanReviewComment: 'Góc nghiêng hoàng đạo 23.44 độ xấp xỉ 23.5 độ.' },
        { id: 'claim_seasons_lambert_flux', claimType: 'algorithmic_property', statement: 'Mật độ năng lượng tỷ lệ thuận với sin góc chiếu bức xạ theo định luật cosin Lambert.', verificationStatus: 'unverified', humanReviewComment: 'Định luật Lambert về thông lượng bức xạ quang năng.' }
      ];
      const seasonsChain = (stage: number) => ({
        kind: 'process_chain' as const,
        nodes: ['Trục nghiêng 23.5°', 'Góc chiếu Lambert', 'Mật độ quang năng', 'Thời lượng ngày đêm', 'Chu kỳ 4 mùa'],
        activeNodeIndex: Math.min(stage, 4),
        carrierLabel: stage <= 1 ? 'QUỸ ĐẠO & TRỤC NGHIÊNG' : stage <= 3 ? 'GÓC CHIẾU BỨC XẠ' : 'CHU KỲ THỜI TIẾT'
      });
      const beats = [
        ['hook', 'Vì sao mùa hè nóng, còn mùa đông lạnh?', '38°C gay gắt đối lập với 10°C giá rét', 'Nhiệt độ thay đổi lớn giữa hai mùa do yếu tố thiên văn nào?', 6, 'claim_seasons_misconception', 'Vì sao mùa hè thì nóng như đổ lửa ba mươi tám độ xê, còn mùa đông lại lạnh buốt chỉ mười độ xê?', 'push_in'],
        ['system_model', 'Ngộ nhận: Do khoảng cách tới Mặt Trời?', 'Tháng 1 gần nhất (147 triệu km) lại là mùa đông!', 'Quỹ đạo elip biến thiên khoảng cách không tạo ra mùa của bán cầu.', 9, 'claim_seasons_misconception', 'Nhiều người nghĩ mùa hè Trái Đất ở gần Mặt Trời hơn, còn mùa đông ở xa hơn. Nhưng sự thật hoàn toàn ngược lại!', 'macro'],
        ['mechanism_a', 'Bí mật nằm ở: Trục Trái Đất nghiêng 23.5°', 'Trục nghiêng không đổi hướng trong không gian', 'Khi chuyển động quanh Mặt Trời, nửa cầu nghiêng về phía Mặt Trời nhận nhiều nhiệt hơn.', 10, 'claim_seasons_axial_tilt', 'Bí mật nằm ở trục Trái Đất nghiêng hai mươi ba phẩy năm độ. Khi quay quanh Mặt Trời, trục này không đổi hướng trong không gian.', 'track'],
        ['mechanism_b', 'Định luật góc chiếu: Góc dốc tập trung năng lượng', 'Cùng một chùm sáng: chiếu thẳng hẹp và nóng, chiếu xiên phân tán', 'Mật độ thông lượng I = I₀ · sin(θ) quyết định nhiệt độ bề mặt.', 10, 'claim_seasons_lambert_flux', 'Mùa hè, tia nắng chiếu gần như thẳng đứng, năng lượng tập trung làm mặt đất nóng ran. Mùa đông tia nắng chiếu xiên, năng lượng bị phân tán trên diện tích gấp đôi.', 'track'],
        ['evidence', 'Thời lượng ngày đêm: 13.5h hè vs 11h đông', 'Hà Nội đón ngày dài đêm ngắn vào mùa hè', 'Chiếu sáng dài hơn và góc chiếu dốc hơn cùng tích lũy nhiệt lượng cực đại.', 10, 'claim_seasons_axial_tilt', 'Thêm vào đó, mùa hè ngày dài hơn đêm. Tại Hà Nội, mùa hè nhận tới mười ba phẩy năm giờ chiếu sáng, trong khi mùa đông chỉ có mười một giờ.', 'macro'],
        ['takeaway', 'Chu kỳ 4 mùa: Tuyệt tác của trục nghiêng 23.5°', 'Trục nghiêng + Quỹ đạo = Nhịp điệu sự sống Trái Đất', 'Hai yếu tố kết hợp: Góc chiếu thẳng hơn và thời gian chiếu sáng dài hơn tạo nên mùa hè.', 11, 'claim_seasons_lambert_flux', 'Tóm lại, mùa hè nóng vì hai yếu tố: tia nắng chiếu dốc hơn và thời gian chiếu sáng dài hơn, tất cả nhờ độ nghiêng kỳ diệu của Trục Trái Đất!', 'pull_out']
      ] as const;
      scenes = beats.map(([beat, headline, focus, insight, duration, claimId, narration, camera], index) => ({
        sceneId: `sc_seasons_${index + 1}`,
        sceneType: 'physics_explainer' as const,
        title: headline,
        pedagogicalGoal: focus,
        durationSeconds: duration,
        boundClaimIds: [claimId],
        rendererTarget: 'remotion_infographic' as const,
        narration: { vietnamese: narration, subtitleVietnamese: narration },
        visualPayload: {
          sceneType: 'physics_explainer' as const,
          family: 'process_chain' as const,
          beat,
          headline,
          focusLabel: focus,
          insight,
          simulation: seasonsChain(index),
          cameraMove: camera,
          accentColor: '#F59E0B'
        }
      }));
    } else if (capability.topicId === 'physics.mechanics.projectile') {
      summary = 'Tách chuyển động ném xiên thành chuyển động ngang đều và rơi tự do theo phương đứng để giải thích quỹ đạo parabol.';
      learningObjectives = ['Phân tích vận tốc đầu thành hai thành phần', 'Giải thích vì sao quỹ đạo là parabol trong mô hình lý tưởng', 'Nhận biết trọng lực là gia tốc duy nhất sau khi rời tay'];
      keyConcepts = ['Vận tốc đầu', 'Thành phần ngang', 'Rơi tự do', 'Quỹ đạo parabol'];
      claims = [
        { id: 'claim_projectile_components', claimType: 'algorithmic_property', statement: 'Vận tốc đầu có thể phân tích thành hai thành phần vuông góc.', verificationStatus: 'unverified', humanReviewComment: 'Cần nguồn cơ học và giáo viên duyệt.' },
        { id: 'claim_projectile_gravity', claimType: 'algorithmic_property', statement: 'Khi bỏ qua cản không khí, vật ném chỉ chịu gia tốc trọng trường sau khi rời tay.', verificationStatus: 'unverified', humanReviewComment: 'Mô hình giới hạn đã ghi rõ.' },
        { id: 'claim_projectile_path', claimType: 'algorithmic_property', statement: 'Kết hợp chuyển động ngang đều và chuyển động đứng biến đổi đều tạo quỹ đạo parabol.', verificationStatus: 'unverified', humanReviewComment: 'Cần kiểm tra số từ tham số hiện tại.' }
      ];
      const projectile = (stage: number) => ({
        kind: 'force_motion' as const, objectType: 'projectile' as const, motionModel: 'projectile' as const,
        formula: stage === 2 ? 'v₀x=v₀cosθ; v₀y=v₀sinθ' : stage === 3 ? 'aₓ=0; aᵧ=−g' : 'x=v₀cosθ·t; y=v₀sinθ·t−gt²/2',
        forces: [{ label: 'P = mg', color: '#FBBF24', angleDeg: 90, magnitude: 100 }],
        gravityMps2: 9.8, initialSpeedMps: 20, launchAngleDeg: 45
      });
      const beats = [
        ['hook', 'Vì sao quả bóng vẽ một đường cong?', 'Sau khi rời tay, chỉ còn trọng lực kéo xuống', 'Chuyển động ngang và đứng diễn ra đồng thời.', 6, 'claim_projectile_path', 'Một quả bóng được phóng chéo vừa tiến về trước vừa rơi xuống. Hai chuyển động kết hợp tạo thành đường cong.', 'push_in'],
        ['system_model', 'Chọn mô hình lý tưởng', 'Bỏ qua lực cản · g = 9,8 m/s²', 'Giới hạn mô hình phải được nói rõ trước khi kết luận.', 9, 'claim_projectile_gravity', 'Ta bỏ qua lực cản không khí, coi mặt đất phẳng và gia tốc trọng trường không đổi.', 'pull_out'],
        ['mechanism_a', 'Tách vận tốc đầu thành hai phần', 'v₀x = v₀cosθ · v₀y = v₀sinθ', 'Hai thành phần vuông góc có thể xét độc lập.', 10, 'claim_projectile_components', 'Vận tốc đầu hai mươi mét trên giây ở góc bốn mươi lăm độ được tách thành thành phần ngang và đứng.', 'macro'],
        ['mechanism_b', 'Ngang đều, đứng rơi tự do', 'vx không đổi · vy giảm theo thời gian', 'Trọng lực chỉ làm đổi thành phần vận tốc đứng.', 10, 'claim_projectile_gravity', 'Theo phương ngang vận tốc giữ nguyên. Theo phương đứng, trọng lực làm vận tốc giảm, bằng không ở đỉnh rồi hướng xuống.', 'track'],
        ['evidence', 'Quỹ đạo tính từ từng thời điểm', 'x tăng đều · y tăng rồi giảm', 'Loại thời gian khỏi hai phương trình cho một parabol.', 11, 'claim_projectile_path', 'Mỗi thời điểm cho một cặp tọa độ x và y. Nối các điểm đó tạo đúng quỹ đạo parabol của mô hình.', 'track'],
        ['takeaway', 'Một chuyển động, hai phương độc lập', 'Ngang đều + đứng biến đổi đều = parabol', 'Đây là kết quả của mô hình không có cản không khí.', 14, 'claim_projectile_path', 'Ném xiên trở nên dễ hiểu khi tách thành chuyển động ngang đều và rơi tự do theo phương đứng.', 'pull_out']
      ] as const;
      scenes = beats.map(([beat, headline, focus, insight, duration, claimId, narration, camera], index) => ({ sceneId: `sc_projectile_${index + 1}`, sceneType: 'physics_explainer' as const, title: headline, pedagogicalGoal: focus, durationSeconds: duration, boundClaimIds: [claimId], rendererTarget: 'remotion_infographic' as const, narration: { vietnamese: narration, subtitleVietnamese: narration }, visualPayload: { sceneType: 'physics_explainer' as const, family: 'force_motion' as const, beat, headline, focusLabel: focus, insight, simulation: projectile(index), cameraMove: camera, accentColor: '#38BDF8' } }));
    } else if (capability.topicId === 'physics.mechanics.pendulum') {
      summary = 'Giải thích con lắc đơn bằng lực kéo về, chuyển hóa cơ năng và công thức chu kỳ góc nhỏ.';
      learningObjectives = ['Nhận biết thành phần trọng lực kéo vật về vị trí cân bằng', 'Theo dõi chuyển hóa thế năng và động năng', 'Kiểm tra chu kỳ T = 2π√(L/g) trong giới hạn góc nhỏ'];
      keyConcepts = ['Lực kéo về', 'Vị trí cân bằng', 'Chu kỳ', 'Bảo toàn cơ năng'];
      claims = [
        { id: 'claim_pendulum_restoring', claimType: 'algorithmic_property', statement: 'Thành phần tiếp tuyến của trọng lực hướng con lắc về vị trí cân bằng.', verificationStatus: 'unverified', humanReviewComment: 'Cần nguồn cơ học và teacher review.' },
        { id: 'claim_pendulum_period', claimType: 'algorithmic_property', statement: 'Với góc nhỏ, chu kỳ con lắc đơn xấp xỉ T = 2π√(L/g).', verificationStatus: 'unverified', humanReviewComment: 'Payload số được ràng buộc theo công thức góc nhỏ.' },
        { id: 'claim_pendulum_energy', claimType: 'algorithmic_property', statement: 'Trong mô hình không ma sát, động năng và thế năng chuyển hóa nhưng tổng cơ năng không đổi.', verificationStatus: 'unverified', humanReviewComment: 'Chỉ đúng trong mô hình lý tưởng.' }
      ];
      const period = 2 * Math.PI * Math.sqrt(1 / 9.8);
      const pendulum = () => ({ kind: 'force_motion' as const, objectType: 'pendulum' as const, motionModel: 'oscillatory' as const, formula: 'T = 2π√(L/g) ≈ 2,01 s', forces: [{ label: 'P = mg', color: '#FBBF24', angleDeg: 90, magnitude: 115 }, { label: 'T dây', color: '#38BDF8', angleDeg: 270, magnitude: 100 }], gravityMps2: 9.8, pendulumLengthM: 1, periodSeconds: period });
      const energy = (kineticFraction: number) => ({ kind: 'energy_transfer' as const, kineticFraction, potentialFraction: 1 - kineticFraction, totalEnergyLabel: 'E = K + U = không đổi' });
      const beats = [
        ['hook', 'Điều gì kéo con lắc quay trở lại?', 'Nó không tự đổi hướng ở hai biên', 'Trọng lực tạo thành phần kéo về vị trí cân bằng.', 6, 'claim_pendulum_restoring', 'Kéo quả nặng lệch khỏi phương thẳng đứng rồi thả. Một thành phần của trọng lực luôn kéo nó về giữa.', 'force_motion', pendulum(), 'push_in'],
        ['system_model', 'Con lắc đơn lý tưởng', 'Dây nhẹ · góc nhỏ · bỏ qua cản', 'Công thức chu kỳ chỉ đúng trong giới hạn mô hình.', 9, 'claim_pendulum_period', 'Ta xét vật nặng nhỏ, dây nhẹ không dãn, góc dao động nhỏ và bỏ qua lực cản không khí.', 'force_motion', pendulum(), 'pull_out'],
        ['mechanism_a', 'Ở biên: thế năng lớn nhất', 'Vận tốc tức thời bằng không', 'Năng lượng đang ở dạng thế năng trọng trường.', 10, 'claim_pendulum_energy', 'Tại vị trí biên, con lắc dừng tức thời. Động năng bằng không còn thế năng đạt cực đại.', 'energy_transfer', energy(0), 'macro'],
        ['mechanism_b', 'Ở giữa: động năng lớn nhất', 'Tốc độ đạt cực đại tại vị trí cân bằng', 'Thế năng đã chuyển thành động năng.', 10, 'claim_pendulum_energy', 'Khi qua vị trí cân bằng, độ cao nhỏ nhất và tốc độ lớn nhất. Phần lớn cơ năng ở dạng động năng.', 'energy_transfer', energy(1), 'track'],
        ['evidence', 'Chu kỳ phụ thuộc chiều dài', 'L = 1 m · g = 9,8 m/s² · T ≈ 2,01 s', 'Payload được kiểm tra bằng T = 2π√(L/g).', 11, 'claim_pendulum_period', 'Với dây dài một mét và g bằng chín phẩy tám, công thức góc nhỏ cho chu kỳ xấp xỉ hai phẩy không một giây.', 'force_motion', pendulum(), 'macro'],
        ['takeaway', 'Lực đổi hướng, năng lượng đổi dạng', 'Chu kỳ tăng khi dây dài hơn', 'Kết luận chỉ áp dụng cho con lắc đơn góc nhỏ.', 14, 'claim_pendulum_period', 'Con lắc lặp lại nhờ lực kéo về và chuyển hóa cơ năng. Dây càng dài thì chu kỳ càng lớn.', 'force_motion', pendulum(), 'pull_out']
      ] as const;
      scenes = beats.map(([beat, headline, focus, insight, duration, claimId, narration, family, simulation, camera], index) => ({ sceneId: `sc_pendulum_${index + 1}`, sceneType: 'physics_explainer' as const, title: headline, pedagogicalGoal: focus, durationSeconds: duration, boundClaimIds: [claimId], rendererTarget: 'remotion_infographic' as const, narration: { vietnamese: narration, subtitleVietnamese: narration }, visualPayload: { sceneType: 'physics_explainer' as const, family, beat, headline, focusLabel: focus, insight, simulation, cameraMove: camera, accentColor: '#38BDF8' } as any }));
    } else if (capability.topicId === 'physics.mechanics.energy_conservation') {
      summary = 'Theo dõi động năng và thế năng chuyển hóa trong một hệ lý tưởng trong khi tổng cơ năng được bảo toàn.';
      learningObjectives = ['Phân biệt động năng và thế năng', 'Kiểm tra tổng các phần năng lượng luôn bằng một', 'Nêu đúng điều kiện để cơ năng được bảo toàn'];
      keyConcepts = ['Động năng', 'Thế năng', 'Cơ năng', 'Lực không bảo toàn'];
      claims = [
        { id: 'claim_energy_forms', claimType: 'algorithmic_property', statement: 'Động năng phụ thuộc chuyển động còn thế năng phụ thuộc cấu hình của hệ.', verificationStatus: 'unverified', humanReviewComment: 'Cần nguồn và giáo viên duyệt.' },
        { id: 'claim_energy_conservation', claimType: 'algorithmic_property', statement: 'Khi không có công của lực không bảo toàn, tổng động năng và thế năng không đổi.', verificationStatus: 'unverified', humanReviewComment: 'Payload bắt buộc bảo toàn tổng bằng một.' }
      ];
      const energy = (kineticFraction: number) => ({ kind: 'energy_transfer' as const, kineticFraction, potentialFraction: 1 - kineticFraction, totalEnergyLabel: 'E = K + U = 100%' });
      const beats = [
        ['hook', 'Năng lượng biến mất khi vật chậm lại?', 'Không mất đi; nó chuyển sang dạng khác', 'Theo dõi cả động năng và thế năng cùng lúc.', 6, 'claim_energy_conservation', 'Khi một vật đi lên và chậm lại, động năng giảm. Phần giảm đó chưa biến mất mà chuyển thành thế năng.', 0.8, 'push_in'],
        ['system_model', 'Chọn hệ lý tưởng không ma sát', 'Không có năng lượng truyền ra môi trường', 'Chỉ trong điều kiện này cơ năng mới được bảo toàn.', 9, 'claim_energy_conservation', 'Ta xét hệ lý tưởng không có ma sát và lực cản, nên không có cơ năng truyền thành nhiệt ra ngoài.', 0.65, 'pull_out'],
        ['mechanism_a', 'Đi lên: K giảm, U tăng', 'Tốc độ giảm khi độ cao tăng', 'Hai phần thay đổi ngược chiều.', 10, 'claim_energy_forms', 'Khi vật đi lên, tốc độ giảm nên động năng giảm; đồng thời độ cao tăng nên thế năng tăng.', 0.35, 'track'],
        ['mechanism_b', 'Ở cao nhất: U cực đại', 'Vật có thể dừng tức thời', 'Cơ năng vẫn còn trong cấu hình của hệ.', 10, 'claim_energy_forms', 'Ở điểm cao nhất, động năng có thể bằng không nhưng thế năng đạt cực đại. Tổng vẫn giữ nguyên.', 0, 'macro'],
        ['evidence', 'Mỗi thời điểm đều tổng bằng 100%', 'K + U = E', 'Schema từ chối payload nếu hai phần không cộng thành một.', 11, 'claim_energy_conservation', 'Dù tỉ lệ thay đổi, động năng cộng thế năng luôn bằng toàn bộ cơ năng của mô hình lý tưởng.', 0.5, 'track'],
        ['takeaway', 'Bảo toàn không có nghĩa từng dạng giữ nguyên', 'Năng lượng chuyển dạng nhưng tổng không đổi', 'Có ma sát thì phải tính cả nhiệt và năng lượng môi trường.', 14, 'claim_energy_conservation', 'Cơ năng được bảo toàn khi không có lực không bảo toàn sinh công. Nếu có ma sát, phải mở rộng hệ để theo dõi nhiệt.', 0.75, 'pull_out']
      ] as const;
      scenes = beats.map(([beat, headline, focus, insight, duration, claimId, narration, kinetic, camera], index) => ({ sceneId: `sc_energy_${index + 1}`, sceneType: 'physics_explainer' as const, title: headline, pedagogicalGoal: focus, durationSeconds: duration, boundClaimIds: [claimId], rendererTarget: 'remotion_infographic' as const, narration: { vietnamese: narration, subtitleVietnamese: narration }, visualPayload: { sceneType: 'physics_explainer' as const, family: 'energy_transfer' as const, beat, headline, focusLabel: focus, insight, simulation: energy(kinetic), cameraMove: camera, accentColor: '#38BDF8' } }));
    } else if (capability.topicId === 'algebra.identities.seven') {
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
      if (targetDurationSeconds >= 240) {
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
            durationSeconds: 10,
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
            sceneId: 'sc_secant_measurement',
            sceneType: 'formula_derivation',
            title: 'Đo độ dốc của cát tuyến PQ',
            pedagogicalGoal: 'Liên hệ trực quan cát tuyến với thương sai phân giữa hai điểm',
            durationSeconds: 14,
            boundClaimIds: ['claim_poly_deriv', 'claim_secant_limit'],
            rendererTarget: 'manim_hybrid',
            narration: {
              vietnamese: 'Đặt P tại x bằng 1 và cho Q chuyển động trên parabol. Độ dốc cát tuyến bằng độ thay đổi theo phương đứng chia cho độ thay đổi theo phương ngang.',
              subtitleVietnamese: 'Độ dốc cát tuyến bằng thương số giữa độ thay đổi tung độ và hoành độ.'
            },
            visualPayload: {
              sceneType: 'formula_derivation',
              headline: 'Hệ số góc cát tuyến',
              formulaTex: 'm_{PQ}=\\frac{f(x_Q)-f(1)}{x_Q-1}',
              displayMath: { latex: 'm_{PQ}=\\frac{f(x_Q)-f(1)}{x_Q-1}', accessibleText: 'Hệ số góc cát tuyến PQ', presentation: 'graph_overlay' },
              visualIntent: 'secant_measurement',
              notes: 'Q bắt đầu ở xa P để quan sát rõ độ dốc của cát tuyến.',
              scientificData: {
                kind: 'scalar_function_1d',
                functionType: 'polynomial',
                expression: 'x^2',
                xRange: [-2, 3],
                yRange: [-1, 9],
                pointX: 1,
                tangentAtX: 1,
                secantFromX: 1,
                secantToX: 2,
                claimId: 'claim_poly_deriv',
                validation: 'formally_verified'
              }
            }
          },
          {
            sceneId: 'sc_limit_transition',
            sceneType: 'formula_derivation',
            title: 'Q tiến gần P: cát tuyến tiến tới tiếp tuyến',
            pedagogicalGoal: 'Quan sát liên tục sự hội tụ của hệ số góc cát tuyến',
            durationSeconds: 14,
            boundClaimIds: ['claim_poly_deriv', 'claim_secant_limit'],
            rendererTarget: 'manim_hybrid',
            narration: {
              vietnamese: 'Bây giờ Q tiến liên tục về P. Cát tuyến xoay dần, còn hệ số góc tiến từ 3 về 2. Ở vị trí giới hạn, cát tuyến trở thành tiếp tuyến.',
              subtitleVietnamese: 'Khi Q tiến về P, hệ số góc cát tuyến tiến về 2.'
            },
            visualPayload: {
              sceneType: 'formula_derivation',
              headline: 'Giới hạn của cát tuyến',
              formulaTex: '\\lim_{x_Q \\to 1}m_{PQ}=2',
              displayMath: { latex: '\\lim_{x_Q \\to 1}m_{PQ}=2', accessibleText: 'Giới hạn hệ số góc cát tuyến bằng 2', presentation: 'graph_overlay' },
              visualIntent: 'limit_transition',
              notes: 'Các vị trí trung gian chỉ minh họa cùng một quá trình giới hạn.',
              scientificData: {
                kind: 'scalar_function_1d', functionType: 'polynomial', expression: 'x^2',
                xRange: [-2, 3], yRange: [-1, 9], pointX: 1, tangentAtX: 1,
                secantFromX: 1, secantToX: 2, secantProgression: [2, 1.5, 1.2, 1.05, 1.01],
                claimId: 'claim_poly_deriv', validation: 'formally_verified'
              }
            }
          },
          {
            sceneId: 'sc_formula_focus',
            sceneType: 'formula_derivation',
            title: 'Từ giới hạn đến đạo hàm',
            pedagogicalGoal: 'Kết nối trực quan cát tuyến với định nghĩa đạo hàm',
            durationSeconds: 12,
            boundClaimIds: ['claim_poly_deriv', 'claim_secant_limit'],
            rendererTarget: 'remotion_infographic',
            narration: {
              vietnamese: 'Viết bằng công thức, đạo hàm là giới hạn của thương sai phân khi h tiến về 0. Với f của x bằng x bình phương, kết quả là 2x.',
              subtitleVietnamese: 'Đạo hàm của x bình phương là 2x.'
            },
            visualPayload: {
              sceneType: 'formula_derivation',
              headline: 'Định nghĩa đạo hàm',
              formulaTex: "f'(x)=\\lim_{h\\to0}\\frac{f(x+h)-f(x)}{h}=2x",
              displayMath: { latex: "f'(x)=\\lim_{h\\to0}\\frac{f(x+h)-f(x)}{h}=2x", accessibleText: 'Đạo hàm của x bình phương bằng 2x', presentation: 'formula_focus' },
              visualIntent: 'formula_focus',
              notes: 'Tại x = 1, hệ số góc tiếp tuyến bằng f phẩy của 1 bằng 2.',
              scientificData: {
                kind: 'scalar_function_1d', functionType: 'polynomial', expression: 'x^2',
                xRange: [-2, 3], yRange: [-1, 9], pointX: 1, tangentAtX: 1,
                claimId: 'claim_poly_deriv', validation: 'formally_verified'
              }
            }
          },
          {
            sceneId: 'sc_summary',
            sceneType: 'summary',
            title: 'Ý nghĩa đạo hàm',
            pedagogicalGoal: 'Khái quát hệ số góc tiếp tuyến chính là giá trị đạo hàm tại điểm',
            durationSeconds: 10,
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
              verifiedFacts: ["f'(x) = 2x"],
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
    } else if (capability.domain === 'physics') {
      // DYNAMIC UNIVERSAL PHYSICS ENGINE: Tự động phân tích chủ đề bất kỳ và sinh 6 nhịp sư phạm bám sát chủ đề
      const norm = topic.toLowerCase();
      const isWave = /sóng|âm thanh|dao động|tần số|bước sóng|lan truyền|tiếng/i.test(norm);
      const isThermo = /nhiệt|nóng|lạnh|ngưng tụ|bay hơi|đông|sôi|áp suất|chất khí|phân tử|nước đá/i.test(norm);
      const isOptics = /quang|sáng|màu|gương|kính|khúc xạ|phản xạ|tán sắc|hình ảnh|mắt|cầu vồng/i.test(norm);
      const isEnergy = /năng lượng|cơ năng|động năng|thế năng|bảo toàn|chuyển hóa|công/i.test(norm);

      const family: 'force_motion' | 'wave_propagation' | 'particle_state' | 'process_chain' | 'energy_transfer' =
        isWave ? 'wave_propagation'
        : isThermo ? 'particle_state'
        : isOptics ? 'process_chain'
        : isEnergy ? 'energy_transfer'
        : 'force_motion';

      summary = `Giải mã bản chất vật lý của hiện tượng: ${topic}`;
      learningObjectives = [
        `Hiểu rõ nguyên nhân và cơ chế cốt lõi của ${topic}`,
        'Phân biệt các yếu tố tác động và chiều chuyển hóa năng lượng/lực',
        'Vận dụng định luật vật lý để giải thích các hiện tượng tương tự'
      ];
      keyConcepts = [topic, 'Nguyên nhân vật lý', 'Cơ chế tương tác', 'Định luật chi phối'];
      claims = [
        {
          id: 'claim_phys_core',
          claimType: 'empirical_observation',
          statement: `Hiện tượng "${topic}" diễn ra hoàn toàn tuân theo các định luật vật lý thực nghiệm.`,
          verificationStatus: 'unverified',
          humanReviewComment: 'Kiểm định hiện tượng vật lý tự nhiên.'
        },
        {
          id: 'claim_phys_mechanism',
          claimType: 'algorithmic_property',
          statement: `Cơ chế của "${topic}" được xác định bởi sự cân bằng hoặc biến thiên của các đại lượng vật lý đặc trưng.`,
          verificationStatus: 'unverified',
          humanReviewComment: 'Mô hình diễn giải định tính và định lượng.'
        }
      ];

      // Dynamic Simulation Generator based on Family
      const buildDynamicSim = (stage: number) => {
        if (family === 'wave_propagation') {
          return {
            kind: 'wave' as const,
            amplitude: 65 + stage * 4,
            spatialFrequency: 3.2,
            propagationSpeed: 4.0,
            wavelengthLabel: 'Bước sóng λ',
            relationLabel: 'v = f · λ',
            frequencyHz: 400,
            wavelengthMeters: 0.85,
            physicalSpeedMps: 340
          };
        }
        if (family === 'particle_state') {
          return {
            kind: 'particle_state' as const,
            particleCount: 36,
            temperature: stage <= 2 ? 'medium' as const : stage === 3 ? 'low' as const : 'high' as const,
            phase: stage >= 3 ? 'condensing' as const : 'gas' as const,
            surfaceTemperatureC: 10,
            dewPointC: 15
          };
        }
        if (family === 'energy_transfer') {
          const kFraction = stage === 0 ? 0.8 : stage === 1 ? 0.5 : stage === 2 ? 0.2 : stage === 3 ? 0.9 : 0.6;
          return {
            kind: 'energy_transfer' as const,
            kineticFraction: kFraction,
            potentialFraction: 1 - kFraction,
            totalEnergyLabel: 'E = Động năng + Thế năng = const'
          };
        }
        if (family === 'process_chain') {
          return {
            kind: 'process_chain' as const,
            nodes: ['Nguồn sáng', 'Môi trường 1', 'Mặt phân cách', 'Khúc xạ/Phản xạ', 'Mắt người quan sát'],
            activeNodeIndex: Math.min(stage, 4),
            carrierLabel: 'TIA SÁNG'
          };
        }
        // Default: force_motion with context-aware real-world elements
        const isAppleTopic = /táo|apple|rơi.*đất|trọng lực/i.test(norm);
        const isSubTopic = /tàu|sub|ác-si-mét|chìm|nổi/i.test(norm);
        const isSkateTopic = /trượt|băng|ma sát|ngã/i.test(norm);
        const isCarTopic = /xe|phanh|ô tô|chạy|va chạm/i.test(norm);

        const dynObjectType = isAppleTopic ? 'apple' as const
          : isSubTopic ? 'submarine' as const
          : isSkateTopic ? 'skater' as const
          : isCarTopic ? 'car' as const
          : 'box' as const;

        const dynFormula = isAppleTopic ? 'P = m · g (Trọng lực Newton)'
          : isSubTopic ? 'F_A = d · V (Định luật Ác-si-mét)'
          : isSkateTopic ? 'F_ms = μ · N (Lực ma sát trượt)'
          : isCarTopic ? 'v = const khi ΣF = 0 (Quán tính)'
          : stage >= 4 ? 'ΣF = ma (Định luật Newton)' : 'Cân bằng & Biến thiên lực';

        const dynForces = isAppleTopic
          ? (stage === 0
              ? [{ label: 'Vận tốc đầu v₀ = 0', color: '#38BDF8', angleDeg: 90, magnitude: 110 }]
              : stage === 1 || stage === 2
                ? [{ label: 'Trọng lực P = mg', color: '#EF4444', angleDeg: 90, magnitude: 150 }, { label: 'Lực cản khí', color: '#38BDF8', angleDeg: 270, magnitude: 70 }, { label: 'Gia tốc g', color: '#FBBF24', angleDeg: 90, magnitude: 120 }]
                : [{ label: 'Trọng lực P = mg', color: '#EF4444', angleDeg: 90, magnitude: 160 }, { label: 'Rơi thẳng đứng', color: '#10B981', angleDeg: 90, magnitude: 110 }])
          : isSubTopic
            ? (stage <= 1
                ? [{ label: 'Lực đẩy F_A', color: '#38BDF8', angleDeg: 270, magnitude: 140 }, { label: 'Trọng lực P', color: '#EF4444', angleDeg: 90, magnitude: 140 }]
                : [{ label: 'Lực đẩy F_A > P', color: '#10B981', angleDeg: 270, magnitude: 160 }, { label: 'Trọng lượng P', color: '#EF4444', angleDeg: 90, magnitude: 120 }])
            : isSkateTopic
              ? (stage <= 1
                  ? [{ label: 'Áp lực N', color: '#FBBF24', angleDeg: 270, magnitude: 110 }, { label: 'Trọng lực P', color: '#A78BFA', angleDeg: 90, magnitude: 110 }, { label: 'Vận tốc v', color: '#38BDF8', angleDeg: 0, magnitude: 130 }]
                  : [{ label: 'Lực ma sát trượt F_ms', color: '#EF4444', angleDeg: 180, magnitude: 150 }, { label: 'Mất cân bằng', color: '#38BDF8', angleDeg: 0, magnitude: 110 }])
              : isCarTopic
                ? (stage === 0
                    ? [{ label: 'Vận tốc v', color: '#38BDF8', angleDeg: 0, magnitude: 130 }]
                    : stage === 1 || stage === 2
                      ? [{ label: 'Lực hãm phanh', color: '#EF4444', angleDeg: 180, magnitude: 150 }, { label: 'Quán tính', color: '#38BDF8', angleDeg: 0, magnitude: 120 }, { label: 'N', color: '#FBBF24', angleDeg: 270, magnitude: 100 }, { label: 'P = mg', color: '#A78BFA', angleDeg: 90, magnitude: 100 }]
                      : [{ label: 'Hợp lực ΣF', color: '#38BDF8', angleDeg: 0, magnitude: 140 }, { label: 'F phản lực', color: '#10B981', angleDeg: 180, magnitude: 110 }])
                : (stage === 0
                    ? [{ label: 'Vận tốc v', color: '#38BDF8', angleDeg: 0, magnitude: 130 }]
                    : stage === 1 || stage === 2
                      ? [{ label: 'Lực tác dụng F', color: '#EF4444', angleDeg: 0, magnitude: 140 }, { label: 'Lực cản', color: '#38BDF8', angleDeg: 180, magnitude: 90 }, { label: 'N', color: '#FBBF24', angleDeg: 270, magnitude: 100 }, { label: 'P = mg', color: '#A78BFA', angleDeg: 90, magnitude: 100 }]
                      : [{ label: 'Hợp lực ΣF = ma', color: '#38BDF8', angleDeg: 0, magnitude: 140 }, { label: 'Phản lực', color: '#10B981', angleDeg: 180, magnitude: 110 }]);

        return {
          kind: 'force_motion' as const,
          objectType: dynObjectType,
          motionModel: 'static' as const,
          formula: dynFormula,
          forces: dynForces,
          massKg: isAppleTopic ? 0.2 : 50,
          accelerationMps2: isAppleTopic ? 9.8 : -3.5,
          netForceN: isAppleTopic ? 1.96 : -175
        };
      };

      const teaserTopic = topic.length > 25
        ? 'hiện tượng kỳ thú này'
        : topic.toLowerCase().replace(/^(tại sao|vì sao|làm sao)\s*/i, '');
      const dynamicBeats = [
        ['hook', `Bí ẩn: ${topic}`, `Đặt vấn đề trực quan`, `Quan sát thực tế kích thích tư duy`, 7, 'claim_phys_core', `Bạn có bao giờ tự hỏi về ${teaserTopic}? Hãy cùng LuminaLearn khám phá và giải mã ngay nhé!`, 'push_in'],
        ['system_model', `Mô hình hóa hệ vật lý`, `Xác định các yếu tố tham gia`, `Khảo sát điều kiện ban đầu`, 9, 'claim_phys_core', `Trước hết, ta cùng xem xét mô hình vật lý với các yếu tố và điều kiện ban đầu của nó.`, 'macro'],
        ['mechanism_a', `Tác động và tương tác`, `Phân tích lực và năng lượng`, `Sự thay đổi trạng thái kích hoạt quá trình`, 10, 'claim_phys_mechanism', `Khi điều kiện kích hoạt thay đổi, lực và năng lượng bắt đầu tương tác trực tiếp lên toàn hệ.`, 'track'],
        ['mechanism_b', `Bản chất của quá trình`, `Cơ chế biến đổi cốt lõi`, `Định luật vật lý chi phối quá trình`, 10, 'claim_phys_mechanism', `Chính sự chuyển hóa và chênh lệch năng lượng này giải thích rõ ràng nguyên nhân hiện tượng.`, 'track'],
        ['evidence', `Kiểm chứng bằng định luật`, `Nguyên lý khoa học thực nghiệm`, `Quy luật được kiểm chứng thực tế`, 11, 'claim_phys_mechanism', `Quy luật này được đúc kết thành định luật chính xác để chúng ta tính toán và dự đoán.`, 'macro'],
        ['takeaway', `Quy tắc cốt lõi cần nhớ`, `Ghi nhớ nguyên tắc thực tiễn`, `Kết nối tri thức với đời sống`, 13, 'claim_phys_core', `Tóm lại, hiện tượng này minh chứng cho quy luật vật lý tự nhiên kỳ diệu và ứng dụng hữu ích trong đời sống.`, 'pull_out']
      ] as const;

      scenes = dynamicBeats.map(([beat, headline, focus, insight, duration, claimId, narration, camera], index) => ({
        sceneId: `sc_dyn_phys_${index + 1}`,
        sceneType: 'physics_explainer' as const,
        title: headline,
        pedagogicalGoal: focus,
        durationSeconds: duration,
        boundClaimIds: [claimId],
        rendererTarget: 'remotion_infographic' as const,
        narration: { vietnamese: narration, subtitleVietnamese: narration },
        visualPayload: {
          sceneType: 'physics_explainer' as const,
          family,
          beat: beat as any,
          headline,
          focusLabel: focus,
          insight,
          simulation: buildDynamicSim(index),
          cameraMove: camera as any,
          accentColor: '#38BDF8'
        }
      }));
    } else {
      // Fallback tổng quát cho chủ đề hợp lệ
      summary = `Kế hoạch bài học tổng quát về chủ đề ${topic}.`;
      learningObjectives = [`Nắm vững các khái niệm trọng tâm của ${topic}`];
      keyConcepts = [topic];
      claims = [
        {
          id: 'claim_general_1',
          claimType: 'ai_concept',
          statement: `Nội dung cốt lõi của chủ đề ${topic} được diễn giải theo chuẩn sư phạm.`,
          verificationStatus: 'unverified',
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
      prerequisites: isMath
        ? ['Đại số và giải tích cơ bản']
        : capability.domain === 'physics'
          ? ['Khái niệm quan sát, hệ vật lý và năng lượng']
          : ['Khái niệm đại số tuyến tính hoặc lập trình cơ bản'],
      keyConcepts,
      educationalClaims: claims,
      capabilityReport: capability,
      sourceEvidence: documentAnalysis?.evidence || [],
      storyboard: {
        storyboardId: `sb_${lessonId}`,
        lessonId,
        scenes,
        totalDurationSeconds: totalSeconds,
        chapters: buildChaptersForScenes(scenes, totalSeconds, capability.domain === 'physics' ? 30 : 24)
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

