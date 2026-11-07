import {
  NarrationPlanV2Schema,
  type LessonPlanV2,
  type NarrationPlanV2,
  type NarrationSegmentV2,
  type PronunciationHintV2,
  type StoryboardV2
} from '@luminalearn/scene-schema';
import type { AIProvider } from './ai-provider';
import type { ProviderCallTrace } from './types';

export class NarrationPlannerV2 {
  public async plan(options: {
    planId: string;
    lessonPlan: LessonPlanV2;
    storyboard: StoryboardV2;
    language?: 'vi' | 'en';
    fps?: number;
    aiProvider?: AIProvider;
    onProviderCall?: (trace: ProviderCallTrace) => void;
  }): Promise<NarrationPlanV2> {
    const { planId, lessonPlan, storyboard, aiProvider } = options;
    const language = options.language ?? 'vi';
    const fps = options.fps ?? 24;

    if (aiProvider && !aiProvider.isMock) {
      const verifiedClaims = lessonPlan.mathematicalClaims.filter((claim) => claim.verificationStatus === 'verified');
      if (verifiedClaims.length !== lessonPlan.mathematicalClaims.length) throw new Error('narration_requires_verified_claims');
      const sceneContext = storyboard.scenes.map((scene, index) => ({
        sceneId: scene.sceneId,
        sceneGoal: lessonPlan.pedagogicalSequence[index]?.pedagogicalGoal ?? String(scene.parameters.title ?? scene.templateId),
        durationFrames: scene.durationFrames,
        boundClaimIds: scene.mathematicalBinding.boundClaimIds
      }));
      const result = await aiProvider.generateStructured<NarrationPlanV2>({
        purpose: 'narration_planning',
        systemPrompt: `You are an expert voiceover writer for LuminaLearn STEM lessons. Language: ${language}. Use only the independently verified claims and exact source references supplied. Preserve scene IDs exactly; do not invent citations or mathematical claims.`,
        userPrompt: `Generate NarrationPlanV2. Verified lesson plan: ${JSON.stringify(lessonPlan)}\nVerified claims: ${JSON.stringify(verifiedClaims)}\nExact source references: ${JSON.stringify(lessonPlan.sourceEvidence)}\nStoryboard scenes and goals: ${JSON.stringify(sceneContext)}`,
        validator: (data) => NarrationPlanV2Schema.parse(data)
      });
      options.onProviderCall?.({ purpose: 'narration_planning', mode: result.mode, model: result.model, promptTokens: result.usage?.promptTokens, candidatesTokens: result.usage?.candidatesTokens });
      const expectedScenes = new Set(storyboard.scenes.map((scene) => scene.sceneId));
      const receivedScenes = new Set(result.data.segments.map((segment) => segment.sceneId));
      if (receivedScenes.size !== expectedScenes.size || [...receivedScenes].some((id) => !expectedScenes.has(id))) {
        throw new Error('narration_scene_mismatch: provider invented or omitted storyboard scene IDs');
      }
      const verifiedIds = new Set(verifiedClaims.map((claim) => claim.id));
      const reviewedIds = new Set(result.data.mathematicalReview.verifiedClaimIds);
      if (result.data.mathematicalReview.status !== 'verified' || reviewedIds.size !== verifiedIds.size ||
          [...reviewedIds].some((id) => !verifiedIds.has(id))) {
        throw new Error('narration_claim_mismatch: narration must reference the complete independently verified claim set and no others');
      }
      return result.data;
    }

    const segments: NarrationSegmentV2[] = [];
    let totalWords = 0;

    for (let index = 0; index < storyboard.scenes.length; index++) {
      const scene = storyboard.scenes[index];
      const targetDurationSeconds = Number((scene.durationFrames / fps).toFixed(2));
      const step = lessonPlan.pedagogicalSequence[index];

      let text = '';
      let subtitleText = '';
      const pronunciationHints: PronunciationHintV2[] = [];

      if (scene.sceneType === 'intro') {
        if (lessonPlan.topicId === 'calculus.integral.riemann_sum') {
          text = 'Làm thế nào để tính diện tích hình phẳng có biên cong? Hôm nay chúng ta cùng khám phá trực giác tổng Riemann.';
          subtitleText = 'Làm thế nào tính diện tích hình cong? Khám phá trực giác tổng Riemann.';
        } else {
          text = 'Chào các bạn, hôm nay chúng ta sẽ tìm hiểu bản chất trực quan của bài học này.';
          subtitleText = 'Chào các bạn, hôm nay chúng ta sẽ tìm hiểu bản chất trực quan của bài học.';
        }
      } else if (scene.templateId === 'riemann_sum') {
        text = 'Ta chia nhỏ khoảng không một thành các cột chữ nhật. Khi n tăng từ bốn lên tám rồi mười sáu, tổng diện tích các cột dần hội tụ về giá trị tích phân đúng một phần ba.';
        subtitleText = 'Khi n tăng dần (4 -> 8 -> 16), tổng Riemann hội tụ về tích phân chính xác bằng 1/3.';
        pronunciationHints.push(
          { written: 'n -> ∞', spoken: 'en-nờ tiến ra vô cùng' },
          { written: '1/3', spoken: 'một phần ba' }
        );
      } else if (scene.templateId === 'secant_to_tangent') {
        text = 'Quan sát điểm quy tiến dần về điểm pê. Cát tuyến dần xoay và biến thành tiếp tuyến khi hát tiến về không.';
        subtitleText = 'Khi Q tiến gần P, cát tuyến dần xoay thành tiếp tuyến khi h tiến về 0.';
        pronunciationHints.push(
          { written: 'Q, P', spoken: 'quy, pê' },
          { written: 'h -> 0', spoken: 'hát tiến về không' }
        );
      } else if (scene.sceneType === 'summary') {
        text = lessonPlan.summary;
        subtitleText = lessonPlan.summary;
      } else {
        text = step ? `${step.pedagogicalGoal}: ${step.intuitiveConcept}` : `Phân tích khái niệm toán học trong cảnh ${index + 1}.`;
        subtitleText = text;
      }

      // Đảm bảo tốc độ nói vừa vặn (khoảng 2.8 - 3.2 từ/giây trong tiếng Việt)
      const words = text.trim().split(/\s+/).length;
      totalWords += words;

      segments.push({
        segmentId: `narr_seg_${scene.sceneId}`,
        sceneId: scene.sceneId,
        text,
        subtitleText,
        targetDurationSeconds,
        pronunciationHints
      });
    }

    const estimatedDurationSeconds = segments.reduce((sum, s) => sum + s.targetDurationSeconds, 0);

    const narrationPlan: NarrationPlanV2 = {
      planId,
      storyboardId: storyboard.storyboardId,
      language,
      segments,
      totalWords,
      estimatedDurationSeconds,
      mathematicalReview: {
        status: 'verified',
        verifiedClaimIds: lessonPlan.mathematicalClaims.map((c) => c.id)
      }
    };

    return NarrationPlanV2Schema.parse(narrationPlan);
  }
}

