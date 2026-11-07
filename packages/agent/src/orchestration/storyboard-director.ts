import {
  defaultTemplateRegistry,
  StoryboardV2Schema,
  type LessonPlanV2,
  type MathTemplateRegistry,
  type StoryboardV2,
  type SupportedAspectRatio,
  type VisualSceneSpecV2,
  type VisualStyleId
} from '@luminalearn/scene-schema';

export class VisualStoryboardDirectorV2 {
  constructor(private readonly registry: MathTemplateRegistry = defaultTemplateRegistry) {}

  public direct(options: {
    storyboardId: string;
    lessonPlan: LessonPlanV2;
    fps?: number;
    aspectRatio?: SupportedAspectRatio;
    visualStyleId?: VisualStyleId;
  }): StoryboardV2 {
    const { storyboardId, lessonPlan } = options;
    const fps = options.fps ?? 24;
    const aspectRatio = options.aspectRatio ?? '9:16';
    const visualStyleId = options.visualStyleId ?? 'clean_educational_infographic';

    const scenes: VisualSceneSpecV2[] = [];
    const usedTemplateIds = new Set<string>();

    const mathSpec = lessonPlan.mathSpec;
    const coefficients = mathSpec?.function.coefficients ?? [0, 0, 1];
    const pointX = mathSpec?.parameters.pointX ?? 1.0;
    const interval = mathSpec?.parameters.interval ?? [0, 1];
    const partitions = mathSpec?.parameters.partitions ?? [4, 8, 16];
    const hStart = mathSpec?.parameters.hStart ?? 2.0;
    const hEnd = mathSpec?.parameters.hEnd ?? 0.05;

    for (let index = 0; index < lessonPlan.pedagogicalSequence.length; index++) {
      const step = lessonPlan.pedagogicalSequence[index];
      const durationFrames = Math.round(step.targetDurationSeconds * fps);

      let templateId = 'function_graph';
      let sceneType: VisualSceneSpecV2['sceneType'] = 'concept';
      let parameters: Record<string, unknown> = {};
      const latexFormulas: string[] = step.formalFormula ? [step.formalFormula] : [];
      const boundClaimIds: string[] = [];

      if (index === 0) {
        templateId = 'function_graph';
        sceneType = 'intro';
        parameters = {
          title: step.pedagogicalGoal,
          body: step.intuitiveConcept,
          eyebrow: lessonPlan.topicId === 'calculus.integral.riemann_sum' ? 'TRỰC GIÁC TÍCH PHÂN' : 'ĐẠO HÀM TRỰC QUAN',
          coefficients,
          pointX
        };
      } else if (index === lessonPlan.pedagogicalSequence.length - 1) {
        templateId = 'function_graph';
        sceneType = 'summary';
        parameters = {
          title: step.pedagogicalGoal,
          body: step.intuitiveConcept,
          eyebrow: 'TỔNG KẾT BÀI HỌC',
          coefficients,
          pointX
        };
      } else if (
        lessonPlan.topicId === 'calculus.integral.riemann_sum' &&
        (index === 1 || /riemann|chữ nhật|phân hoạch|chia nhỏ|xấp xỉ/i.test(step.pedagogicalGoal + step.intuitiveConcept))
      ) {
        templateId = 'riemann_sum';
        sceneType = 'animation';
        parameters = {
          title: step.pedagogicalGoal,
          body: step.intuitiveConcept,
          eyebrow: 'MÔ PHỎNG HÌNH CHỮ NHẬT',
          functionExpression: mathSpec?.function.expression || 'x**2',
          coefficients,
          interval,
          partitionsStart: partitions[0] ?? 4,
          partitionsEnd: partitions[partitions.length - 1] ?? 16,
          partitions,
          method: mathSpec?.parameters.method ?? 'left'
        };
        const riemannClaim = lessonPlan.mathematicalClaims.find(
          (c) => c.validatorKey === 'riemann_sum_limit' || c.validatorKey === 'definite_integral'
        );
        if (riemannClaim) boundClaimIds.push(riemannClaim.id);
      } else if (step.formalFormula && /m\(h\)|cát tuyến|secant/i.test(step.intuitiveConcept + step.formalFormula)) {
        templateId = 'secant_to_tangent';
        sceneType = 'animation';
        parameters = {
          title: step.pedagogicalGoal,
          body: step.intuitiveConcept,
          eyebrow: 'CÁT TUYẾN BIẾN THÀNH TIẾP TUYẾN',
          coefficients,
          pointX,
          hStart,
          hEnd
        };
        const secantClaim = lessonPlan.mathematicalClaims.find((c) => c.validatorKey === 'secant_slope');
        if (secantClaim) boundClaimIds.push(secantClaim.id);
      } else {
        templateId = 'function_graph';
        sceneType = 'formula';
        parameters = {
          title: step.pedagogicalGoal,
          body: step.intuitiveConcept,
          coefficients,
          pointX
        };
      }

      // Xác thực template có tồn tại trong Registry không
      const templateDef = this.registry.getOrThrow(templateId);
      usedTemplateIds.add(templateId);

      scenes.push({
        sceneId: `scene_${index + 1}_${templateId}`,
        templateId,
        sceneType,
        visualStyleId,
        durationFrames,
        parameters,
        layout: {
          aspectRatio,
          safeAreaPadding: 48
        },
        mathematicalBinding: {
          boundClaimIds,
          latexFormulas
        },
        sourceReferenceIds: []
      });
    }

    const estimatedDurationFrames = scenes.reduce((sum, s) => sum + s.durationFrames, 0);

    const storyboard: StoryboardV2 = {
      storyboardId,
      lessonId: lessonPlan.lessonId,
      topicId: lessonPlan.topicId,
      scenes,
      visualTemplateIds: Array.from(usedTemplateIds),
      mathematicalData: {},
      narrationObjectives: lessonPlan.pedagogicalSequence.map((s) => s.pedagogicalGoal),
      estimatedDurationFrames,
      sourceReferences: []
    };

    return StoryboardV2Schema.parse(storyboard);
  }
}

