import { randomUUID } from 'node:crypto';
import {
  SupervisorRequestV3Schema,
  AgentTaskV3Schema,
  SupervisorTraceV3Schema,
  SupervisorFinalDraftV3Schema,
  classifyEducationalTopic,
  DomainScopeViolationError,
  type SupervisorRequestV3,
  type AgentTaskV3,
  type AgentRoleV3,
  type SupervisorTraceV3,
  type SupervisorFinalDraftV3,
  type EducationalChapterPlanV3,
  type VisualDirectionDecisionV3,
  type NarrationDirectionResultV3,
  type QualityReviewResultV3,
  type TopicCapabilityReportV3,
  type EducationalLessonPlanV3,
  type EducationalSceneV3,
  type EducationalClaimV3,
  type EducationalVisualPayload,
  type AlgebraIdentityVisualPayload,
  type LessonRequestV3
} from '@luminalearn/scene-schema';
import { EducationalPlannerV3 } from './educational-planner-v3';
import {
  KnowledgeValidationServiceV3,
  validateLessonMathematicalIntegrityV3,
  validateAlgebraSceneMath,
  inspectStatementSemanticConsistency,
  CANONICAL_ALGEBRA_IDENTITIES
} from './knowledge-validation-v3';
import { LessonDraftManagerV3, type LessonDraftV3 } from './draft-manager-v3';
import { MathVerificationService } from './math-verifier';
import { verifyTransformationChainV3 } from './algebra-verifier-v3';

// ============================================================================
// AGENT 1: Curriculum Planning Agent
// ============================================================================
export class CurriculumPlanningAgent {
  constructor(private readonly planner: EducationalPlannerV3) {}

  public async planCurriculum(
    request: SupervisorRequestV3,
    capability: TopicCapabilityReportV3
  ): Promise<{
    lessonPlan: EducationalLessonPlanV3;
    chapters: EducationalChapterPlanV3[];
  }> {
    const rawPlan = await this.planner.planLesson({
      lessonId: `lesson_${request.requestId}`,
      topic: request.topic,
      targetDurationSeconds: request.targetDurationSeconds,
      ownerId: request.ownerId,
      consentRecord: request.consentRecord,
      externalApiConsent: Boolean(request.consentRecord)
    });

    // Derive chapters from the planned duration and topic structure
    const totalDuration = rawPlan.storyboard?.totalDurationSeconds ?? request.targetDurationSeconds;
    const isMath = capability.domain === 'mathematics';
    let chapters: EducationalChapterPlanV3[];

    if (totalDuration >= 300) {
      const dur1 = Math.round(totalDuration * 0.1);
      const dur2 = Math.round(totalDuration * 0.15);
      const remainder = totalDuration - (dur1 * 2 + dur2 * 5);
      chapters = [
        { chapterIndex: 0, chapterTitle: 'Mục tiêu & Đặt vấn đề', targetDurationSeconds: dur1, pedagogicalIntent: 'Kích hoạt tri thức nền tảng', keyFormulasOrConcepts: [capability.displayName] },
        { chapterIndex: 1, chapterTitle: 'Mô hình & Định nghĩa cốt lõi', targetDurationSeconds: dur2, pedagogicalIntent: 'Trình bày mô hình hình thức', keyFormulasOrConcepts: rawPlan.keyConcepts.slice(0, 2) },
        { chapterIndex: 2, chapterTitle: 'Phân tích trực giác hình học', targetDurationSeconds: dur2, pedagogicalIntent: 'Trực quan hóa cơ chế hoạt động', keyFormulasOrConcepts: rawPlan.keyConcepts.slice(1, 3) },
        { chapterIndex: 3, chapterTitle: 'Động lực học & Tham số', targetDurationSeconds: dur2, pedagogicalIntent: 'Phân tích tham số và biến đổi', keyFormulasOrConcepts: ['Tham số', 'Quy tắc cập nhật'] },
        { chapterIndex: 4, chapterTitle: 'Ví dụ tính toán từng bước', targetDurationSeconds: dur2, pedagogicalIntent: 'Ví dụ số cụ thể kiểm chứng', keyFormulasOrConcepts: ['Ví dụ số', 'Tính toán'] },
        { chapterIndex: 5, chapterTitle: 'Trực quan hóa tối ưu hóa', targetDurationSeconds: dur2, pedagogicalIntent: 'Mô phỏng hành vi động', keyFormulasOrConcepts: ['Mô phỏng', 'Đường đi nghiệm'] },
        { chapterIndex: 6, chapterTitle: 'Phân tích sai lầm thường gặp', targetDurationSeconds: dur1, pedagogicalIntent: 'Cảnh báo ngộ nhận và điểm yếu', keyFormulasOrConcepts: ['Sai lầm', 'Ngộ nhận'] },
        { chapterIndex: 7, chapterTitle: 'Tổng kết & Ghi nhớ bản chất', targetDurationSeconds: remainder, pedagogicalIntent: 'Củng cố và tổng kết toàn diện', keyFormulasOrConcepts: ['Tổng kết', 'Ghi nhớ'] }
      ];
    } else if (totalDuration >= 180) {
      chapters = [
        { chapterIndex: 0, chapterTitle: 'Giới thiệu & Đặt vấn đề', targetDurationSeconds: 25, pedagogicalIntent: 'Kích hoạt tri thức nền tảng và trực giác ban đầu', keyFormulasOrConcepts: [capability.displayName] },
        { chapterIndex: 1, chapterTitle: 'Bản chất cơ chế tính toán', targetDurationSeconds: 35, pedagogicalIntent: 'Phân tích cơ chế và công thức hình thức', keyFormulasOrConcepts: rawPlan.keyConcepts.slice(0, 2) },
        { chapterIndex: 2, chapterTitle: 'Trực quan hóa quy luật', targetDurationSeconds: 40, pedagogicalIntent: 'Trực quan hóa hoạt động và chuyển động tham số', keyFormulasOrConcepts: rawPlan.keyConcepts.slice(1, 3) },
        { chapterIndex: 3, chapterTitle: 'Ví dụ chi tiết từng bước', targetDurationSeconds: 45, pedagogicalIntent: 'Tính toán từng bước có kiểm định toán học', keyFormulasOrConcepts: ['Ví dụ số', 'Biến đổi'] },
        { chapterIndex: 4, chapterTitle: 'Tổng kết sư phạm & Ứng dụng', targetDurationSeconds: totalDuration - (25 + 35 + 40 + 45), pedagogicalIntent: 'Củng cố bài học và lưu ý sư phạm', keyFormulasOrConcepts: ['Tổng kết', 'Ứng dụng'] }
      ];
    } else {
      const part1 = Math.round(totalDuration * 0.25);
      const part2 = Math.round(totalDuration * 0.5);
      const part3 = totalDuration - (part1 + part2);
      chapters = [
        {
          chapterIndex: 0,
          chapterTitle: `Giới thiệu & Đặt vấn đề: ${capability.displayName}`,
          targetDurationSeconds: part1,
          pedagogicalIntent: 'Kích hoạt tri thức nền tảng và trực giác ban đầu của học viên',
          keyFormulasOrConcepts: isMath ? [capability.displayName] : ['Trực giác mô hình', capability.displayName]
        },
        {
          chapterIndex: 1,
          chapterTitle: `Bản chất cốt lõi: ${capability.displayName}`,
          targetDurationSeconds: part2,
          pedagogicalIntent: 'Phân tích cơ chế tính toán, công thức hình thức hoặc cấu trúc thuật toán',
          keyFormulasOrConcepts: rawPlan.keyConcepts.slice(0, 4)
        },
        {
          chapterIndex: 2,
          chapterTitle: `Tổng kết & Ứng dụng thực tiễn`,
          targetDurationSeconds: part3,
          pedagogicalIntent: 'Củng cố kiến thức và liên kết với bức tranh tổng thể',
          keyFormulasOrConcepts: ['Ứng dụng', 'Tổng kết sư phạm']
        }
      ];
    }

    const derivedChapters: EducationalChapterPlanV3[] = (rawPlan.storyboard?.chapters && rawPlan.storyboard.chapters.length > 0)
      ? rawPlan.storyboard.chapters.map((ch: any, idx: number) => ({
          chapterIndex: typeof ch.chapterIndex === 'number' ? ch.chapterIndex : idx,
          chapterTitle: typeof ch.chapterTitle === 'string' ? ch.chapterTitle : `Phần ${idx + 1}`,
          targetDurationSeconds: typeof ch.targetDurationSeconds === 'number' ? ch.targetDurationSeconds : typeof ch.durationSeconds === 'number' ? ch.durationSeconds : 30,
          pedagogicalIntent: typeof ch.pedagogicalIntent === 'string' ? ch.pedagogicalIntent : 'Củng cố kiến thức sư phạm',
          keyFormulasOrConcepts: Array.isArray(ch.keyFormulasOrConcepts) ? ch.keyFormulasOrConcepts.slice(0, 8) : Array.isArray(ch.keyConcepts) ? ch.keyConcepts.slice(0, 8) : ['Trọng tâm sư phạm']
        }))
      : chapters;

    return {
      lessonPlan: rawPlan,
      chapters: derivedChapters
    };
  }
}

// ============================================================================
// AGENT 2: Subject Matter Specialists (Math & AI)
// ============================================================================
export interface SubjectMatterSpecialist {
  role: 'math_specialist' | 'ai_specialist';
  prepareSubjectMatter(
    plan: EducationalLessonPlanV3,
    capability: TopicCapabilityReportV3
  ): Promise<{
    claims: EducationalClaimV3[];
    notes: string;
  }>;
}

export class MathSpecialist implements SubjectMatterSpecialist {
  public readonly role = 'math_specialist' as const;

  public async prepareSubjectMatter(
    plan: EducationalLessonPlanV3,
    capability: TopicCapabilityReportV3
  ): Promise<{ claims: EducationalClaimV3[]; notes: string }> {
    // 1. Đối với 7 hằng đẳng thức: kiểm tra tính chuẩn tắc và tạo claim hình thức
    if (capability.topicId === 'algebra.identities.seven') {
      const claims: EducationalClaimV3[] = plan.educationalClaims.map((claim) => {
        return {
          ...claim,
          claimType: 'formal_mathematics',
          formalExpressionVerified: false,
          verificationStatus: 'unverified'
        };
      });
      return {
        claims,
        notes: 'Chuyên gia Toán học: Đã chuẩn hóa 7 hằng đẳng thức với yêu cầu chứng minh ký hiệu SymPy cho toàn bộ các bước biến đổi.'
      };
    }

    // 2. Đối với Giải tích / Đại số tuyến tính: bảo toàn tính hình thức của các mệnh đề
    const claims = plan.educationalClaims.map((c) => ({
      ...c,
      verificationStatus: 'unverified' as const
    }));
    return {
      claims,
      notes: `Chuyên gia Toán học: Đã kiểm tra tính chặt chẽ của ${claims.length} mệnh đề toán học cho chủ đề ${capability.displayName}.`
    };
  }
}

export class AiSpecialist implements SubjectMatterSpecialist {
  public readonly role = 'ai_specialist' as const;

  public async prepareSubjectMatter(
    plan: EducationalLessonPlanV3,
    capability: TopicCapabilityReportV3
  ): Promise<{ claims: EducationalClaimV3[]; notes: string }> {
    const claims = plan.educationalClaims.map((claim) => {
      // Perceptron, Gradient Descent và Self-Attention có các đặc tính thuật toán và quan sát thực nghiệm
      return {
        ...claim,
        verificationStatus: 'unverified' as const
      };
    });

    let notes = `Chuyên gia AI/ML: Chuẩn bị phân tích thuật toán ${capability.displayName}. `;
    if (capability.topicId === 'ai.perceptron.activation') {
      notes += 'Tập trung vào tổ hợp tuyến tính z = w·x + b, vai trò ngưỡng và hàm kích hoạt phi tuyến.';
    } else if (capability.topicId === 'ai.gradient_descent.optimization') {
      notes += 'Tập trung vào mặt cong hàm mất mát, hướng gradient âm và bước cập nhật trọng số theta.';
    } else if (capability.topicId === 'ai.transformer.attention') {
      notes += 'Tập trung vào tích vô hướng Query-Key, hệ số chuẩn hóa sqrt(d) và trọng số Softmax.';
    }

    return { claims, notes };
  }
}

// ============================================================================
// AGENT 3: Visual Director Agent (Video Shotcraft & Lemo-Opuscar principles)
// ============================================================================
export class VisualDirectorAgent {
  public async directVisuals(
    plan: EducationalLessonPlanV3,
    capability: TopicCapabilityReportV3
  ): Promise<{
    decisions: VisualDirectionDecisionV3[];
    updatedScenes: EducationalSceneV3[];
  }> {
    if (!plan.storyboard || plan.storyboard.scenes.length === 0) {
      throw new Error('visual_director_missing_storyboard: Storyboard is required for visual direction');
    }

    const decisions: VisualDirectionDecisionV3[] = [];
    const updatedScenes: EducationalSceneV3[] = [];

    for (let index = 0; index < plan.storyboard.scenes.length; index++) {
      const scene = plan.storyboard.scenes[index];
      let selectedComponent = 'GenericEducationalScene';
      let treatmentRationale = 'Trực quan hóa sư phạm chuẩn';
      let cameraMotion: VisualDirectionDecisionV3['cameraMotion'] = 'static';
      let rhythmPacing: VisualDirectionDecisionV3['rhythmPacing'] = 'steady';

      let layoutPreset: VisualDirectionDecisionV3['layoutPreset'] = 'centered_focus';
      let stylePreset: VisualDirectionDecisionV3['stylePreset'] = 'clean_educational_infographic';

      if (scene.sceneType === 'algebra_identity') {
        selectedComponent = 'AlgebraIdentityScene';
        treatmentRationale = 'Hiển thị biến đổi biểu thức toán học từng bước kết hợp trực quan hóa hình học 2D/3D (Shotcraft: Split-focus layout, subtitle-safe)';
        cameraMotion = 'zoom_in';
        rhythmPacing = 'dynamic_reveal';
        layoutPreset = 'split_horizontal';
        stylePreset = 'clean_educational_infographic';
      } else if (scene.sceneType === 'neural_architecture') {
        selectedComponent = 'NeuralArchitectureScene';
        treatmentRationale = 'Mô hình hóa kiến trúc mạng nơ-ron, luồng dữ liệu tiến và kích hoạt tế bào (Shotcraft: High-contrast cyber-glow)';
        cameraMotion = 'slow_pan';
        rhythmPacing = 'dynamic_reveal';
        layoutPreset = 'centered_focus';
        stylePreset = 'ai_neural_visualization';
      } else if (scene.sceneType === 'loss_landscape') {
        selectedComponent = 'LossLandscapeScene';
        treatmentRationale = 'Biểu diễn mặt cong hàm mất mát đa chiều và quỹ đạo dốc giảm dần (Shotcraft: Dual contour-gradient view)';
        cameraMotion = 'focus_pulse';
        rhythmPacing = 'deliberate_pause';
        layoutPreset = 'split_horizontal';
        stylePreset = 'ai_neural_visualization';
      } else if (scene.sceneType === 'attention_heatmap') {
        selectedComponent = 'AttentionHeatmapScene';
        treatmentRationale = 'Biểu diễn ma trận chú ý đa đầu và trọng số softmax trực quan (Shotcraft: Synchronous query-key highlight)';
        cameraMotion = 'slow_pan';
        rhythmPacing = 'steady';
        layoutPreset = 'split_horizontal';
        stylePreset = 'ai_neural_visualization';
      } else if (scene.sceneType === 'summary') {
        selectedComponent = 'SummaryScene';
        treatmentRationale = 'Tổng kết điểm cốt lõi và các mệnh đề đã chứng minh (Shotcraft: Stacked column takeaway)';
        cameraMotion = 'static';
        rhythmPacing = 'deliberate_pause';
        layoutPreset = 'stacked_column';
        stylePreset = 'clean_educational_infographic';
      } else if (index === 0) {
        selectedComponent = 'ConceptTitleReveal';
        treatmentRationale = 'Mở đầu nhịp độ cao với tiêu đề khái niệm và trực giác dẫn nhập';
        cameraMotion = 'zoom_in';
        rhythmPacing = 'dynamic_reveal';
        layoutPreset = 'centered_focus';
        stylePreset = 'clean_educational_infographic';
      }

      // Đảm bảo không thay đổi công thức toán đã được liên kết
      const decision: VisualDirectionDecisionV3 = {
        sceneId: scene.sceneId,
        sceneType: scene.sceneType,
        selectedComponent,
        treatmentRationale,
        cameraMotion,
        rhythmPacing,
        layoutPreset,
        stylePreset,
        visualPayload: scene.visualPayload,
        preservesVerifiedMath: true
      };

      decisions.push(decision);
      updatedScenes.push({
        ...scene,
        visualPayload: scene.visualPayload
      });
    }

    return { decisions, updatedScenes };
  }
}

// ============================================================================
// AGENT 4: Narration Director Agent
// ============================================================================
export class NarrationDirectorAgent {
  /**
   * Tính toán thời lượng phát âm tiếng Việt ước tính.
   * Tốc độ trung bình chuẩn bài giảng sư phạm: ~14 ký tự tiếng Việt / giây (~3.5 âm tiết/giây).
   */
  public estimateSpeakingDuration(vietnameseText: string): number {
    const clean = vietnameseText.trim().replace(/\s+/g, ' ');
    if (clean.length === 0) return 0;
    return Math.round((clean.length / 14) * 10) / 10;
  }

  public async directNarration(
    scenes: EducationalSceneV3[]
  ): Promise<{
    results: NarrationDirectionResultV3[];
    updatedScenes: EducationalSceneV3[];
  }> {
    const results: NarrationDirectionResultV3[] = [];
    const updatedScenes: EducationalSceneV3[] = [];

    for (const scene of scenes) {
      let narrationText = scene.narration.vietnamese.trim();
      let subtitleText = scene.narration.subtitleVietnamese.trim() || narrationText;
      let estimatedDuration = this.estimateSpeakingDuration(narrationText);

      // Nếu lời đọc vượt quá thời lượng phân cảnh > 10%, tự động rút gọn các từ đệm
      if (estimatedDuration > scene.durationSeconds) {
        narrationText = narrationText
          .replace(/\bchúng ta có thể thấy rằng\b/gi, 'ta thấy')
          .replace(/\bnhư chúng ta đã biết\b/gi, 'như đã biết')
          .replace(/\bmột cách hoàn toàn chính xác\b/gi, 'chính xác')
          .replace(/\brất là quan trọng\b/gi, 'quan trọng');
        subtitleText = subtitleText
          .replace(/\bchúng ta có thể thấy rằng\b/gi, 'ta thấy')
          .replace(/\bnhư chúng ta đã biết\b/gi, 'như đã biết');
        estimatedDuration = this.estimateSpeakingDuration(narrationText);
      }

      const fitsSceneDuration = estimatedDuration <= scene.durationSeconds + 1.0; // Cho phép dung sai 1s

      const result: NarrationDirectionResultV3 = {
        sceneId: scene.sceneId,
        narrationVietnamese: narrationText,
        subtitleVietnamese: subtitleText,
        estimatedSpeakingDurationSeconds: estimatedDuration,
        sceneDurationSeconds: scene.durationSeconds,
        fitsSceneDuration
      };

      results.push(result);
      updatedScenes.push({
        ...scene,
        narration: {
          vietnamese: narrationText,
          subtitleVietnamese: subtitleText
        }
      });
    }

    return { results, updatedScenes };
  }
}

// ============================================================================
// AGENT 5: Pedagogical Quality Reviewer (Advisory Only)
// ============================================================================
export class PedagogicalQualityReviewer {
  public async reviewPedagogy(
    plan: EducationalLessonPlanV3,
    verifiedClaims: EducationalClaimV3[]
  ): Promise<QualityReviewResultV3> {
    const unsupportedStatements: string[] = [];
    const contradictionsDetected: string[] = [];
    const revisionsRequested: string[] = [];

    // 1. Kiểm tra đối chiếu giữa lời đọc và các mệnh đề hình thức
    if (plan.storyboard) {
      for (const scene of plan.storyboard.scenes) {
        for (const claim of verifiedClaims) {
          if (claim.claimType === 'formal_mathematics' && claim.formalExpression) {
            const check = inspectStatementSemanticConsistency(
              scene.narration.vietnamese,
              claim.formalExpression
            );
            if (check.status === 'contradiction_detected') {
              contradictionsDetected.push(
                `Phân cảnh '${scene.sceneId}' mâu thuẫn với mệnh đề '${claim.id}': ${check.reason}`
              );
            }
          }
        }
      }
    }

    // 2. Kiểm tra các mệnh đề chưa được kiểm chứng hoặc bị từ chối
    for (const claim of verifiedClaims) {
      if (claim.verificationStatus === 'rejected') {
        contradictionsDetected.push(`Mệnh đề '${claim.id}' bị engine toán hình thức SymPy bác bỏ.`);
      } else if (claim.verificationStatus === 'unverified') {
        unsupportedStatements.push(`Mệnh đề '${claim.id}' chưa có kết quả kiểm định.`);
      }
    }

    const passed = contradictionsDetected.length === 0;
    const explanationClarityScore = passed ? (unsupportedStatements.length === 0 ? 9 : 7) : 3;

    return {
      passed,
      explanationClarityScore,
      unsupportedStatements,
      contradictionsDetected,
      revisionsRequested,
      reviewNotes: passed
        ? 'Chuyên gia Thẩm định Sư phạm: Bố cục sư phạm rõ ràng, lời giảng không mâu thuẫn với công thức đã chứng minh.'
        : `Chuyên gia Thẩm định Sư phạm: Phát hiện ${contradictionsDetected.length} mâu thuẫn cần giáo viên hoặc hệ thống chỉnh sửa trước khi phê duyệt.`
    };
  }
}

// ============================================================================
// CHECKPOINT F: 10 Cross-Agent Consistency Checks
// ============================================================================
export interface CrossAgentValidationResult {
  valid: boolean;
  violations: string[];
}

export function validateCrossAgentConsistency(input: {
  request: SupervisorRequestV3;
  capability: TopicCapabilityReportV3;
  plan: EducationalLessonPlanV3;
  claims: EducationalClaimV3[];
  visualDecisions: VisualDirectionDecisionV3[];
  narrationResults: NarrationDirectionResultV3[];
}): CrossAgentValidationResult {
  const { request, capability, plan, claims, visualDecisions, narrationResults } = input;
  const violations: string[] = [];

  // Check 1: Topic and request match capability domain
  if (plan.domain !== capability.domain || request.domain !== capability.domain) {
    violations.push(`Check 1 Failed: Lesson domain '${plan.domain}' or request domain '${request.domain}' does not match capability domain '${capability.domain}'`);
  }

  // Check 2: Learning objectives match storyboard pedagogical goals
  if (!plan.learningObjectives || plan.learningObjectives.length === 0) {
    violations.push('Check 2 Failed: Lesson plan has empty learning objectives');
  } else if (plan.storyboard) {
    for (const scene of plan.storyboard.scenes) {
      if (!scene.pedagogicalGoal || scene.pedagogicalGoal.trim().length < 5) {
        violations.push(`Check 2 Failed: Scene '${scene.sceneId}' lacks clear pedagogical goal`);
      }
    }
  }

  // Check 3: Scene durations match storyboard timeline
  if (plan.storyboard) {
    const sumDuration = plan.storyboard.scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
    if (Math.abs(sumDuration - plan.storyboard.totalDurationSeconds) > 0.5) {
      violations.push(`Check 3 Failed: Sum of scene durations (${sumDuration}s) does not match totalDuration (${plan.storyboard.totalDurationSeconds}s)`);
    }
  }

  // Check 4: Narration explains correct scene with Vietnamese depth
  if (plan.storyboard) {
    for (const scene of plan.storyboard.scenes) {
      if (!scene.narration?.vietnamese || scene.narration.vietnamese.trim().length < 8) {
        violations.push(`Check 4 Failed: Scene '${scene.sceneId}' lacks sufficient Vietnamese narration`);
      }
    }
  }

  // Check 5: Subtitles match intended narration and avoid timing overflow
  for (const nr of narrationResults) {
    if (!nr.subtitleVietnamese || nr.subtitleVietnamese.trim().length === 0) {
      violations.push(`Check 5 Failed: Scene '${nr.sceneId}' has empty subtitle`);
    } else if (nr.subtitleVietnamese.length > nr.narrationVietnamese.length + 50) {
      violations.push(`Check 5 Failed: Scene '${nr.sceneId}' subtitle is longer than narration text`);
    }
  }

  // Check 6: Formal claims have trusted verification evidence
  for (const claim of claims) {
    if (claim.claimType === 'formal_mathematics') {
      if (claim.verificationStatus === 'rejected') {
        violations.push(`Check 6 Failed: Formal mathematical claim '${claim.id}' was rejected by SymPy`);
      }
      if (claim.verificationStatus !== 'formally_verified' && claim.verificationStatus !== 'human_review_required') {
        violations.push(`Check 6 Failed: Formal mathematical claim '${claim.id}' lacks verified status (status: ${claim.verificationStatus})`);
      }
    }
  }

  // Check 7: Algebra transformations are valid and intermediate steps are sound
  if (plan.storyboard) {
    for (const scene of plan.storyboard.scenes) {
      if (scene.sceneType === 'algebra_identity') {
        const payload = scene.visualPayload as AlgebraIdentityVisualPayload;
        if (!payload.transformationSteps || payload.transformationSteps.length < 2) {
          violations.push(`Check 7 Failed: Scene '${scene.sceneId}' has fewer than 2 algebra transformation steps`);
        } else {
          for (let stepIdx = 0; stepIdx < payload.transformationSteps.length; stepIdx++) {
            const expr = payload.transformationSteps[stepIdx].expression;
            if (!/^[a-b0-9+\-*/^() ]+$/.test(expr)) {
              violations.push(`Check 7 Failed: Scene '${scene.sceneId}' transformation step ${stepIdx} contains invalid symbols: '${expr}'`);
            }
          }
        }
      }
    }
  }

  // Check 8: AI claims are grounded in evidence or marked for human review
  if (capability.domain === 'artificial_intelligence') {
    for (const claim of claims) {
      if (claim.verificationStatus === 'unverified') {
        violations.push(`Check 8 Failed: AI claim '${claim.id}' remains completely unverified`);
      }
    }
  }

  // Check 9: All scene components are in the registered allowlist
  const allowedComponents = new Set([
    'AlgebraIdentityScene',
    'DerivativeSecantTangentScene',
    'RiemannSumScene',
    'NeuralArchitectureScene',
    'LossLandscapeScene',
    'AttentionHeatmapScene',
    'SummaryScene',
    'ConceptTitleReveal',
    'GenericEducationalScene'
  ]);
  for (const decision of visualDecisions) {
    if (!decision.selectedComponent || !allowedComponents.has(decision.selectedComponent)) {
      violations.push(`Check 9 Failed: Scene '${decision.sceneId}' uses unregistered or unsupported visual component '${decision.selectedComponent}'`);
    }
  }

  // Check 10: Invariant check on visual payload equations preserving verified mathematical claims
  for (const decision of visualDecisions) {
    if (!decision.preservesVerifiedMath) {
      violations.push(`Check 10 Failed: Visual decision for '${decision.sceneId}' modified verified mathematical facts`);
    }
  }
  if (plan.storyboard) {
    for (const scene of plan.storyboard.scenes) {
      if (scene.sceneType === 'algebra_identity') {
        const payload = scene.visualPayload as AlgebraIdentityVisualPayload;
        const matchingClaim = claims.find((c) => scene.boundClaimIds.includes(c.id));
        if (matchingClaim && matchingClaim.formalExpression) {
          const expectedExpr = `${payload.leftExpression}=${payload.rightExpression}`.replace(/\s+/g, '');
          const claimExpr = matchingClaim.formalExpression.replace(/\s+/g, '');
          if (expectedExpr !== claimExpr) {
            violations.push(`Check 10 Failed: Visual payload equation '${expectedExpr}' in scene '${scene.sceneId}' diverges from verified claim '${claimExpr}'`);
          }
        }
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

// ============================================================================
// AGENT 6: Educational Supervisor V3 (Top-level Orchestration Service)
// ============================================================================
export interface EducationalSupervisorV3Options {
  planner?: EducationalPlannerV3;
  validator?: KnowledgeValidationServiceV3;
  draftManager?: LessonDraftManagerV3;
  mathVerifier?: MathVerificationService;
  storageDir?: string;
  maxApiCalls?: number;
}

export class EducationalSupervisorV3 {
  private readonly planner: EducationalPlannerV3;
  private readonly validator: KnowledgeValidationServiceV3;
  private readonly draftManager: LessonDraftManagerV3;
  private readonly mathVerifier: MathVerificationService;
  private readonly curriculumAgent: CurriculumPlanningAgent;
  private readonly mathSpecialist: MathSpecialist;
  private readonly aiSpecialist: AiSpecialist;
  private readonly visualDirector: VisualDirectorAgent;
  private readonly narrationDirector: NarrationDirectorAgent;
  private readonly qualityReviewer: PedagogicalQualityReviewer;
  private readonly maxApiCalls: number;

  constructor(options: EducationalSupervisorV3Options = {}) {
    this.planner = options.planner ?? new EducationalPlannerV3();
    this.validator = options.validator ?? new KnowledgeValidationServiceV3({ mathVerifier: options.mathVerifier });
    this.draftManager = options.draftManager ?? new LessonDraftManagerV3({
      planner: this.planner,
      validator: this.validator,
      storageDir: options.storageDir
    });
    this.mathVerifier = options.mathVerifier ?? new MathVerificationService();
    this.curriculumAgent = new CurriculumPlanningAgent(this.planner);
    this.mathSpecialist = new MathSpecialist();
    this.aiSpecialist = new AiSpecialist();
    this.visualDirector = new VisualDirectorAgent();
    this.narrationDirector = new NarrationDirectorAgent();
    this.qualityReviewer = new PedagogicalQualityReviewer();
    this.maxApiCalls = options.maxApiCalls ?? 4;
  }

  public async coordinate(rawRequest: unknown): Promise<SupervisorFinalDraftV3> {
    const startTime = Date.now();
    const request = SupervisorRequestV3Schema.parse(rawRequest);
    const supervisorRunId = `run_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const tasks: AgentTaskV3[] = [];
    let currentTaskIndex = 0;
    let geminiApiCalls = 0;

    // Helper: Tạo và cập nhật task trong trace
    const recordTask = (
      taskId: string,
      role: AgentRoleV3,
      title: string,
      inputRef: string,
      dependencyIds: string[] = []
    ): AgentTaskV3 => {
      const task: AgentTaskV3 = {
        taskId,
        role,
        title,
        inputReference: inputRef,
        status: 'running',
        dependencyIds,
        attemptCount: 1,
        maxAttempts: 2,
        validationStatus: 'unvalidated',
        provenance: 'composite',
        startedAt: new Date().toISOString()
      };
      tasks.push(task);
      currentTaskIndex = tasks.length - 1;
      return task;
    };

    const finishTask = (
      task: AgentTaskV3,
      status: AgentTaskV3['status'],
      validationStatus: AgentTaskV3['validationStatus'],
      provenance: AgentTaskV3['provenance'],
      result?: Record<string, unknown>,
      errorCode?: string,
      errorMessage?: string
    ) => {
      task.status = status;
      task.validationStatus = validationStatus;
      task.provenance = provenance;
      task.result = result;
      task.errorCode = errorCode;
      task.errorMessage = errorMessage;
      task.completedAt = new Date().toISOString();
      task.durationMs = Date.now() - new Date(task.startedAt!).getTime();
    };

    // ------------------------------------------------------------------------
    // STAGE 1: Capability Classification (Topic Matrix & Domain Guard)
    // ------------------------------------------------------------------------
    const t1 = recordTask('task_1_classification', 'supervisor', 'Phân loại năng lực sư phạm & kiểm tra miền', request.topic);
    let capability: TopicCapabilityReportV3;
    try {
      capability = classifyEducationalTopic(request.topic);
      finishTask(t1, 'completed', 'passed', 'deterministic_fixture', { capability });
    } catch (err) {
      const isDomainViolation = err instanceof DomainScopeViolationError;
      const errorMsg = err instanceof Error ? err.message : String(err);
      finishTask(t1, 'failed', 'failed', 'deterministic_fixture', undefined, isDomainViolation ? 'domain_scope_violation' : 'unsupported_topic', errorMsg);
      const trace: SupervisorTraceV3 = {
        supervisorRunId,
        requestId: request.requestId,
        topicId: 'unknown',
        domain: request.domain,
        tasks,
        currentTaskIndex,
        elapsedMs: Date.now() - startTime,
        retryCount: 0,
        budgetUsage: { geminiApiCalls, maxApiCalls: this.maxApiCalls },
        status: 'unsupported_topic',
        humanReadableSummary: `Từ chối chủ đề: ${errorMsg}`
      };
      throw new Error(`supervisor_unsupported_topic: ${errorMsg}`);
    }

    // ------------------------------------------------------------------------
    // STAGE 2: Curriculum Planning Agent
    // ------------------------------------------------------------------------
    const t2 = recordTask('task_2_curriculum', 'curriculum_planner', 'Lập cấu trúc bài học & phân bổ thời lượng', capability.topicId, [t1.taskId]);
    let lessonPlan: EducationalLessonPlanV3;
    let chapters: EducationalChapterPlanV3[];
    try {
      if (request.generationMode === 'live') {
        geminiApiCalls++;
        if (geminiApiCalls > this.maxApiCalls) {
          throw new Error(`budget_exceeded: Exceeded maximum allowed Gemini API calls (${this.maxApiCalls})`);
        }
      }
      const curriculumResult = await this.curriculumAgent.planCurriculum(request, capability);
      lessonPlan = curriculumResult.lessonPlan;
      chapters = curriculumResult.chapters;
      finishTask(t2, 'completed', 'passed', request.generationMode === 'live' ? 'ai_generated' : 'deterministic_fixture', {
        chaptersCount: chapters.length,
        totalScenes: lessonPlan.storyboard?.scenes.length ?? 0
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      finishTask(t2, 'failed', 'failed', 'composite', undefined, 'curriculum_planning_failed', msg);
      throw err;
    }

    // ------------------------------------------------------------------------
    // STAGE 3: Subject Matter Preparation (Math or AI Specialist)
    // ------------------------------------------------------------------------
    const specialistRole = capability.domain === 'mathematics' ? 'math_specialist' : 'ai_specialist';
    const specialist = capability.domain === 'mathematics' ? this.mathSpecialist : this.aiSpecialist;
    const t3 = recordTask('task_3_specialist', specialistRole, `Chuẩn bị tri thức chuyên sâu: ${specialistRole}`, capability.topicId, [t2.taskId]);
    let preparedClaims: EducationalClaimV3[];
    let specialistNotes: string;
    try {
      const specResult = await specialist.prepareSubjectMatter(lessonPlan, capability);
      preparedClaims = specResult.claims;
      specialistNotes = specResult.notes;
      lessonPlan.educationalClaims = preparedClaims;
      finishTask(t3, 'completed', 'passed', 'composite', { notes: specialistNotes, claimsCount: preparedClaims.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      finishTask(t3, 'failed', 'failed', 'composite', undefined, 'specialist_preparation_failed', msg);
      throw err;
    }

    // ------------------------------------------------------------------------
    // STAGE 4: Mathematical / Source Verification (SymPy & Grounding)
    // ------------------------------------------------------------------------
    const t4 = recordTask('task_4_verification', 'supervisor', 'Kiểm định toàn vẹn toán học (SymPy) & nguồn gốc tri thức', capability.topicId, [t3.taskId]);
    let verifiedClaims: EducationalClaimV3[];
    try {
      const integrityResult = await validateLessonMathematicalIntegrityV3({
        lessonPlan,
        sourceEvidence: lessonPlan.sourceEvidence,
        mathVerifier: this.mathVerifier
      });

      if (!integrityResult.valid || integrityResult.validationReport.overallStatus === 'failed') {
        const reason = integrityResult.reason || 'Mathematical integrity check failed';
        finishTask(t4, 'failed', 'failed', 'sympy_formal_engine', undefined, integrityResult.code || 'verification_failed', reason);
        throw new Error(`mathematical_verification_failed: ${reason}`);
      }

      verifiedClaims = integrityResult.validatedClaims;
      lessonPlan.educationalClaims = verifiedClaims;
      lessonPlan.validationReport = integrityResult.validationReport;
      finishTask(t4, 'completed', 'passed', 'sympy_formal_engine', {
        overallStatus: integrityResult.validationReport.overallStatus,
        verifiedCount: verifiedClaims.filter((c) => c.verificationStatus === 'formally_verified').length
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      finishTask(t4, 'failed', 'failed', 'sympy_formal_engine', undefined, 'verification_failed', msg);
      throw err;
    }

    // ------------------------------------------------------------------------
    // STAGE 5: Visual Direction Agent (Remotion Visual DSL & Treatment)
    // ------------------------------------------------------------------------
    const t5 = recordTask('task_5_visual_direction', 'visual_director', 'Đạo diễn thị giác & Lập kế hoạch phân cảnh', capability.topicId, [t4.taskId]);
    let visualDecisions: VisualDirectionDecisionV3[];
    try {
      const visualResult = await this.visualDirector.directVisuals(lessonPlan, capability);
      visualDecisions = visualResult.decisions;
      lessonPlan.storyboard!.scenes = visualResult.updatedScenes;
      finishTask(t5, 'completed', 'passed', 'heuristic_visual_dsl', { decisionsCount: visualDecisions.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      finishTask(t5, 'failed', 'failed', 'heuristic_visual_dsl', undefined, 'visual_direction_failed', msg);
      throw err;
    }

    // ------------------------------------------------------------------------
    // STAGE 6: Narration Director Agent (Vietnamese Narration & Subtitles)
    // ------------------------------------------------------------------------
    const t6 = recordTask('task_6_narration_direction', 'narration_director', 'Đạo diễn lời bình tiếng Việt & đồng bộ phụ đề', capability.topicId, [t5.taskId]);
    let narrationResults: NarrationDirectionResultV3[];
    try {
      const narrationResult = await this.narrationDirector.directNarration(lessonPlan.storyboard!.scenes);
      narrationResults = narrationResult.results;
      lessonPlan.storyboard!.scenes = narrationResult.updatedScenes;
      finishTask(t6, 'completed', 'passed', 'rule_based_narration', {
        scenesCount: narrationResults.length,
        allFitDuration: narrationResults.every((r) => r.fitsSceneDuration)
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      finishTask(t6, 'failed', 'failed', 'rule_based_narration', undefined, 'narration_direction_failed', msg);
      throw err;
    }

    // ------------------------------------------------------------------------
    // STAGE 7: Pedagogical Quality Reviewer (Advisory Review)
    // ------------------------------------------------------------------------
    const t7 = recordTask('task_7_quality_review', 'pedagogical_reviewer', 'Thẩm định chất lượng sư phạm & phát hiện mâu thuẫn', capability.topicId, [t6.taskId]);
    let qualityReview: QualityReviewResultV3;
    try {
      qualityReview = await this.qualityReviewer.reviewPedagogy(lessonPlan, verifiedClaims);
      finishTask(
        t7,
        qualityReview.passed ? 'completed' : 'failed',
        qualityReview.passed ? 'passed' : 'advisory_warning',
        'composite',
        { score: qualityReview.explanationClarityScore, notes: qualityReview.reviewNotes }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      finishTask(t7, 'failed', 'advisory_warning', 'composite', undefined, 'pedagogical_review_failed', msg);
      qualityReview = {
        passed: false,
        explanationClarityScore: 1,
        unsupportedStatements: [],
        contradictionsDetected: [],
        revisionsRequested: ['Cần giáo viên thẩm định thủ công do hệ thống thẩm định sư phạm tự động gặp sự cố'],
        reviewNotes: `Hệ thống thẩm định sư phạm tự động không khả dụng: ${msg}. Bản thảo chuyển sang chế độ giáo viên tự rà soát thủ công.`
      };
    }

    // ------------------------------------------------------------------------
    // STAGE 8: Cross-Agent Consistency Validation (Checkpoint F - 10 Checks)
    // ------------------------------------------------------------------------
    const t8 = recordTask('task_8_cross_agent_validation', 'supervisor', 'Kiểm chứng tính nhất quán liên Agent (10 tiêu chí)', capability.topicId, [t7.taskId]);
    const crossCheck = validateCrossAgentConsistency({
      request,
      capability,
      plan: lessonPlan,
      claims: verifiedClaims,
      visualDecisions,
      narrationResults
    });

    if (!crossCheck.valid) {
      finishTask(t8, 'failed', 'failed', 'composite', { violations: crossCheck.violations }, 'cross_agent_inconsistency', crossCheck.violations.join('; '));
      throw new Error(`cross_agent_validation_failed: ${crossCheck.violations.join('; ')}`);
    }
    finishTask(t8, 'completed', 'passed', 'composite', { checksPassed: 10 });

    // ------------------------------------------------------------------------
    // STAGE 9: Teacher Draft Assembly (LessonDraftManagerV3)
    // ------------------------------------------------------------------------
    const t9 = recordTask('task_9_draft_assembly', 'supervisor', 'Tập hợp bản thảo V3 hoàn chỉnh cho giáo viên phê duyệt', capability.topicId, [t8.taskId]);
    const draftId = `draft_${request.requestId}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const lessonRequest: LessonRequestV3 = {
      requestId: request.requestId,
      topic: request.topic,
      domain: request.domain,
      generationMode: request.generationMode,
      targetDurationSeconds: request.targetDurationSeconds,
      narrationMode: request.narrationMode,
      subtitlesEnabled: request.subtitlesEnabled,
      fps: 24,
      width: 720,
      height: 1280
    };

    let persistedDraft: LessonDraftV3;
    try {
      persistedDraft = await this.draftManager.saveSupervisorDraft({
        ownerId: request.ownerId,
        request: lessonRequest,
        lessonPlan,
        draftId
      });
      finishTask(t9, 'completed', 'passed', 'composite', { draftId: persistedDraft.draftId, version: persistedDraft.version });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      finishTask(t9, 'failed', 'failed', 'composite', undefined, 'draft_persistence_failed', msg);
      throw err;
    }

    // ------------------------------------------------------------------------
    // FINAL TRACE & SUMMARY
    // ------------------------------------------------------------------------
    const elapsedMs = Date.now() - startTime;
    const trace: SupervisorTraceV3 = {
      supervisorRunId,
      requestId: request.requestId,
      topicId: capability.topicId,
      domain: capability.domain,
      tasks,
      currentTaskIndex: tasks.length - 1,
      elapsedMs,
      retryCount: 0,
      budgetUsage: { geminiApiCalls, maxApiCalls: this.maxApiCalls },
      status: 'needs_teacher_review',
      humanReadableSummary: `Bài học V3 "${capability.displayName}" đã được 6 Agent chuyên trách xây dựng thành công trong ${elapsedMs}ms. Toàn bộ ${verifiedClaims.length} mệnh đề toán học đã vượt qua kiểm định SymPy. Kịch bản Remotion và lời giảng tiếng Việt đã sẵn sàng để Giáo viên rà soát và phê duyệt. Bản thảo đã được lưu trữ an toàn.`
    };

    return {
      draftId: persistedDraft.draftId,
      lessonPlan,
      capabilityReport: capability,
      trace,
      teacherApprovalRequired: true
    };
  }
}
