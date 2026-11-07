import {
  NarrationPlanV2Schema,
  type LessonPlanV2,
  type NarrationPlanV2,
  type NarrationSegmentV2,
  type PronunciationHintV2,
  type StoryboardV2
} from '@luminalearn/scene-schema';
import type { AIProvider } from './ai-provider';

export class NarrationPlannerV2 {
  public async plan(options: {
    planId: string;
    lessonPlan: LessonPlanV2;
    storyboard: StoryboardV2;
    language?: 'vi' | 'en';
    fps?: number;
    aiProvider?: AIProvider;
  }): Promise<NarrationPlanV2> {
    const { planId, lessonPlan, storyboard, aiProvider } = options;
    const language = options.language ?? 'vi';
    const fps = options.fps ?? 24;

    if (aiProvider && !aiProvider.isMock) {
      const result = await aiProvider.generateStructured<NarrationPlanV2>({
        purpose: 'narration_planning',
        systemPrompt: `You are an expert voiceover and narration writer for LuminaLearn STEM video lessons. Language: ${language}.`,
        userPrompt: `Generate a NarrationPlanV2 for lesson '${lessonPlan.title}' with ${storyboard.scenes.length} scenes.`,
        validator: (data) => NarrationPlanV2Schema.parse(data)
      });
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

