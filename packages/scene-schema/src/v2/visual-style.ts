import { z } from 'zod';
import { SafeIdString } from './document';

export const VisualStyleIdSchema = z.enum([
  'math_chalkboard',
  'clean_educational_infographic'
]);
export type VisualStyleId = z.infer<typeof VisualStyleIdSchema>;

export const VisualStyleDefinitionSchema = z.object({
  id: VisualStyleIdSchema,
  displayName: z.string().min(1),
  background: z.string().min(1),
  foreground: z.string().min(1),
  accent: z.string().min(1),
  minimumBodyFontPx: z.number().int().min(20),
  safeAreaPaddingPx: z.number().int().min(24),
  principles: z.array(z.string().min(1)).min(1)
}).strict();
export type VisualStyleDefinition = z.infer<typeof VisualStyleDefinitionSchema>;

export const VISUAL_STYLE_REGISTRY: Readonly<Record<VisualStyleId, VisualStyleDefinition>> = Object.freeze({
  math_chalkboard: Object.freeze({
    id: 'math_chalkboard',
    displayName: 'Bảng phấn toán học',
    background: '#102A24',
    foreground: '#F5F1DF',
    accent: '#F2C94C',
    minimumBodyFontPx: 26,
    safeAreaPaddingPx: 48,
    principles: ['Một bảng sạch cho mỗi ý', 'Giới hạn màu phấn', 'Góc máy phẳng, công thức là trọng tâm']
  }),
  clean_educational_infographic: Object.freeze({
    id: 'clean_educational_infographic',
    displayName: 'Đồ họa giáo dục tinh gọn',
    background: '#070B14',
    foreground: '#F8FAFC',
    accent: '#22D3EE',
    minimumBodyFontPx: 25,
    safeAreaPaddingPx: 48,
    principles: ['Một ý chính mỗi cảnh', 'Dữ liệu và tỷ lệ phải trung thực', 'Phân cấp chữ rõ ràng']
  })
});

export const TeachingShotV2Schema = z.object({
  sceneId: SafeIdString,
  sceneType: z.enum(['intro', 'concept', 'animation', 'formula', 'summary']),
  pedagogicalPurpose: z.string().min(1).max(500),
  approvedComponent: z.enum(['concept_title_reveal', 'step_formula_reveal', 'before_after_comparison', 'manim_verified_clip']),
  lockedClaimIds: z.array(SafeIdString),
  durationFrames: z.number().int().positive()
}).strict();

export const TeachingTreatmentV2Schema = z.object({
  treatmentId: SafeIdString,
  lessonId: SafeIdString,
  lessonObjective: z.string().min(1).max(500),
  visualStyleId: VisualStyleIdSchema,
  shots: z.array(TeachingShotV2Schema).min(1),
  lockedClaimIds: z.array(SafeIdString).min(1),
  contentAuthority: z.literal('teacher_approved_lesson')
}).strict();
export type TeachingTreatmentV2 = z.infer<typeof TeachingTreatmentV2Schema>;

export function listVisualStyles(): VisualStyleDefinition[] {
  return Object.values(VISUAL_STYLE_REGISTRY).map((style) => ({ ...style, principles: [...style.principles] }));
}
