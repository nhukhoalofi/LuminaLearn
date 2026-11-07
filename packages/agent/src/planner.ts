import { MathSceneSchema, type MathScene } from '@luminalearn/scene-schema';
import type { GeminiAdapter } from './adapter';
import { mathLessonDraftJsonSchema, mathSceneJsonSchema } from './json-schemas';
import { MathLessonDraftSchema, PlannerRequestSchema, type LessonPlanningResult, type MathLessonDraft, type PlannerRequest } from './contracts';

const SUPPORTED_TOPIC_PATTERNS = [/đạo hàm/i, /dao ham/i, /derivative/i, /secant.*tangent/i, /cát tuyến.*tiếp tuyến/i];
export function recognizesDerivativeTopic(topic: string): boolean { return SUPPORTED_TOPIC_PATTERNS.some((pattern) => pattern.test(topic)); }

export class MathLessonPlanner {
  constructor(private readonly adapter: GeminiAdapter) {}
  async plan(input: PlannerRequest): Promise<LessonPlanningResult> {
    const request = PlannerRequestSchema.parse(input);
    if (!recognizesDerivativeTopic(request.topic)) return { status: 'unsupported_topic', reason: 'Phase 3 only supports calculus.derivative.intuition' };
    const raw = await this.adapter.generateStructured({ purpose: 'lesson_plan', jsonSchema: mathLessonDraftJsonSchema, prompt: [
      'You are the LuminaLearn Math Lesson Planner. Return data only, never source code.', 'Build intuition before formulas. Every mathematical claim will be checked by SymPy.',
      `Topic: ${request.topic}`, `Audience: ${request.targetAudience}`, `Language: ${request.language}`, `Duration: ${request.durationSeconds} seconds`
    ].join('\n') });
    return { status: 'ready', draft: MathLessonDraftSchema.parse(raw) };
  }
}

export class VisualStoryboardDirector {
  constructor(private readonly adapter: GeminiAdapter) {}
  async direct(draft: MathLessonDraft): Promise<MathScene> {
    const verifiedDraft = MathLessonDraftSchema.parse(draft);
    const raw = await this.adapter.generateStructured({ purpose: 'visual_storyboard', jsonSchema: mathSceneJsonSchema, prompt: [
      'You are the LuminaLearn Visual Storyboard Director.', 'Choose only the approved secant_to_tangent template. Never emit code, module names, or paths.',
      'Use polynomial coefficients as bounded data and keep h strictly above zero.', JSON.stringify(verifiedDraft)
    ].join('\n') });
    return MathSceneSchema.parse(raw);
  }
}

