import {
  TeachingTreatmentV2Schema,
  VISUAL_STYLE_REGISTRY,
  type LessonPlanV2,
  type StoryboardV2,
  type TeachingTreatmentV2,
  type VisualStyleId
} from '@luminalearn/scene-schema';

/** Deterministic directing pass. It arranges approved content and never rewrites it. */
export class EducationalFilmDirector {
  public createTreatment(options: {
    lessonPlan: LessonPlanV2;
    storyboard: StoryboardV2;
    visualStyleId?: VisualStyleId;
  }): TeachingTreatmentV2 {
    const { lessonPlan, storyboard } = options;
    const visualStyleId = options.visualStyleId ?? 'clean_educational_infographic';
    if (!VISUAL_STYLE_REGISTRY[visualStyleId]) throw new Error(`Unsupported visual style: ${visualStyleId}`);

    const verifiedClaimIds = new Set(
      lessonPlan.mathematicalClaims.filter((claim) => claim.verificationStatus === 'verified').map((claim) => claim.id)
    );
    if (verifiedClaimIds.size !== lessonPlan.mathematicalClaims.length) {
      throw new Error('Treatment requires every mathematical claim to be verified');
    }

    const shots = storyboard.scenes.map((scene) => {
      for (const claimId of scene.mathematicalBinding.boundClaimIds) {
        if (!verifiedClaimIds.has(claimId)) throw new Error(`Scene ${scene.sceneId} binds an unverified claim: ${claimId}`);
      }
      const approvedComponent = scene.sceneType === 'intro'
        ? 'concept_title_reveal' as const
        : scene.sceneType === 'animation'
          ? 'manim_verified_clip' as const
          : scene.mathematicalBinding.latexFormulas.length > 0
            ? 'step_formula_reveal' as const
            : 'before_after_comparison' as const;
      return {
        sceneId: scene.sceneId,
        sceneType: scene.sceneType,
        pedagogicalPurpose: String(scene.parameters.title ?? scene.templateId),
        approvedComponent,
        lockedClaimIds: [...scene.mathematicalBinding.boundClaimIds],
        durationFrames: scene.durationFrames
      };
    });

    return TeachingTreatmentV2Schema.parse({
      treatmentId: `treatment_${storyboard.storyboardId}`,
      lessonId: lessonPlan.lessonId,
      lessonObjective: lessonPlan.learningObjectives[0],
      visualStyleId,
      shots,
      lockedClaimIds: [...verifiedClaimIds],
      contentAuthority: 'teacher_approved_lesson'
    });
  }
}
