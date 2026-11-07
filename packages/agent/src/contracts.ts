import { z } from 'zod';

const NoExecutableCodeString = z.string().min(1).max(2000).refine(
  (value) => !/```|\b(?:import|from|exec|eval)\s+[A-Za-z_]|(?:\.py|\.js)\b/i.test(value),
  'Executable source code is not allowed in lesson content'
);

export const PlannerRequestSchema = z.object({
  topic: z.string().min(3).max(300),
  targetAudience: z.string().min(2).max(120),
  language: z.enum(['vi', 'en']),
  durationSeconds: z.number().int().min(20).max(180)
}).strict();

export const MathematicalClaimSchema = z.object({
  id: z.string().regex(/^claim_[a-z0-9_]+$/),
  statement: NoExecutableCodeString,
  validatorKey: z.enum(['polynomial_derivative', 'secant_slope', 'limit_at_zero', 'value_at_point']),
  expectedExpression: z.string().regex(/^[0-9xh+*^(). /-]+$/i)
}).strict();

export const LessonSceneOutlineSchema = z.object({
  id: z.string().regex(/^step_[a-z0-9_]+$/),
  pedagogicalGoal: NoExecutableCodeString,
  narration: NoExecutableCodeString,
  visualization: z.enum(['function_graph', 'moving_point', 'secant_to_tangent', 'tangent_line', 'equation_reveal', 'concept_summary']),
  durationSeconds: z.number().int().min(2).max(30)
}).strict();

export const MathLessonDraftSchema = z.object({
  lessonTitle: NoExecutableCodeString,
  topicId: z.literal('calculus.derivative.intuition'),
  targetAudience: NoExecutableCodeString,
  language: z.enum(['vi', 'en']),
  learningObjectives: z.array(NoExecutableCodeString).min(2).max(5),
  intuitiveExplanation: NoExecutableCodeString,
  mathematicalClaims: z.array(MathematicalClaimSchema).min(4).max(8),
  sceneOutline: z.array(LessonSceneOutlineSchema).min(3).max(8),
  summary: NoExecutableCodeString
}).strict().superRefine((draft, ctx) => {
  const total = draft.sceneOutline.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  if (total < 20 || total > 180) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sceneOutline'], message: 'Total scene duration must be between 20 and 180 seconds' });
  }
});

export type PlannerRequest = z.infer<typeof PlannerRequestSchema>;
export type MathLessonDraft = z.infer<typeof MathLessonDraftSchema>;
export type LessonPlanningResult =
  | { status: 'ready'; draft: MathLessonDraft }
  | { status: 'unsupported_topic'; reason: string }
  | { status: 'needs_review'; reason: string };

