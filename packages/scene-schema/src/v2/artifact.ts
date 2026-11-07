import { z } from 'zod';
import { SafeIdString, SourceReferenceSchema } from './document';
import {
  LessonPlanV2Schema,
  NarrationPlanV2Schema,
  StoryboardV2Schema,
  SupportedAspectRatioSchema,
  SupportedNarrationModeSchema,
  SupportedRenderModeSchema,
  VerifiedClaimSchema
} from './contracts';
import { MathVisualizationSpecV2Schema } from './math-spec';

export const ARTIFACT_SCHEMA_VERSION_V2 = 'artifact-v2' as const;

/**
 * Cấu hình kết xuất bài học đã được phê duyệt
 */
export const ApprovedRenderConfigV2Schema = z.object({
  aspectRatio: SupportedAspectRatioSchema,
  fps: z.number().int().min(12).max(60).default(24),
  renderMode: SupportedRenderModeSchema,
  narrationMode: SupportedNarrationModeSchema,
  providedAudioPath: z.string().trim().min(1).max(1024).optional()
}).strict().superRefine((cfg, ctx) => {
  if (cfg.narrationMode === 'provided_audio' && !cfg.providedAudioPath) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['providedAudioPath'],
      message: 'provided_audio narration mode requires providedAudioPath'
    });
  }
});

export type ApprovedRenderConfigV2 = z.infer<typeof ApprovedRenderConfigV2Schema>;

/**
 * Bằng chứng kiểm định toán học hình thức đi kèm với bản phê duyệt
 */
export const VerificationProofV2Schema = z.object({
  status: z.literal('verified'),
  verifiedAt: z.string().datetime(),
  checkedClaimIds: z.array(SafeIdString).min(1),
  engine: z.string().trim().min(1).max(100).default('SymPy Python Engine')
}).strict();

export type VerificationProofV2 = z.infer<typeof VerificationProofV2Schema>;

/**
 * Bản kết xuất bất biến đã phê chuẩn (ApprovedRenderArtifactV2)
 * Mang chữ ký số / băm SHA-256 bảo đảm tính toàn vẹn (Integrity-Preserving).
 * Remotion & Manim sẽ render CHÍNH XÁC từ artifact này, loại bỏ hoàn toàn
 * lỗi trôi sửa đổi (Draft-to-Render Drift).
 */
export const ApprovedRenderArtifactV2Schema = z.object({
  schemaVersion: z.literal(ARTIFACT_SCHEMA_VERSION_V2),
  artifactId: SafeIdString,
  draftId: SafeIdString,
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  approvedAt: z.string().datetime(),
  approverNote: z.string().max(1000).optional(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/, 'Content hash must be a 64-character lowercase SHA-256 hex string'),
  lessonPlan: LessonPlanV2Schema,
  storyboard: StoryboardV2Schema,
  narrationPlan: NarrationPlanV2Schema,
  verifiedClaims: z.array(VerifiedClaimSchema).min(1),
  sourceReferences: z.array(SourceReferenceSchema).default([]),
  renderConfig: ApprovedRenderConfigV2Schema,
  mathSpec: MathVisualizationSpecV2Schema,
  verificationProof: VerificationProofV2Schema
}).strict();

export type ApprovedRenderArtifactV2 = z.infer<typeof ApprovedRenderArtifactV2Schema>;

