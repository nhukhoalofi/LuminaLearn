import { z } from 'zod';
import { NoExecutableString, SafeIdString } from '../v2/document';
import { EducationalLessonPlanV3Schema, KnowledgeValidationReportV3Schema } from './contracts';
import { EducationalDomainSchema } from './capability';

export const GenerationModeV3Schema = z.enum(['mock', 'live']);
export const DraftStatusV3Schema = z.enum([
  'draft', 'needs_review', 'ready_for_approval', 'approved',
  'queued', 'rendering', 'completed', 'failed'
]);

export const LessonRequestV3Schema = z.object({
  requestId: SafeIdString,
  topic: NoExecutableString,
  domain: EducationalDomainSchema,
  generationMode: GenerationModeV3Schema,
  targetDurationSeconds: z.number().int().min(20).max(600).default(35),
  narrationMode: z.enum(['none', 'provided_audio', 'gemini_tts', 'google_cloud_tts', 'dutai_tts']).default('none'),
  subtitlesEnabled: z.boolean().default(true),
  // Phase 4 exposes one honest, fully tested vertical-video profile. Supporting
  // arbitrary values here would make the approved artifact disagree with the
  // fixed Remotion composition.
  fps: z.union([z.literal(24), z.literal(30)]).default(24),
  width: z.union([z.literal(720), z.literal(1080)]).default(720),
  height: z.union([z.literal(1280), z.literal(1920)]).default(1280)
}).strict().superRefine((request, ctx) => {
  const isStandard = request.fps === 24 && request.width === 720 && request.height === 1280;
  const isCinematicPhysics = request.fps === 30 && request.width === 1080 && request.height === 1920 && request.domain === 'physics';
  if (!isStandard && !isCinematicPhysics) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fps'],
      message: 'Profile được hỗ trợ: 720×1280@24fps, hoặc Physics 1080×1920@30fps.'
    });
  }
});
export type LessonRequestV3 = z.infer<typeof LessonRequestV3Schema>;

export const TeacherApprovalV3Schema = z.object({
  approvedBy: SafeIdString,
  approvedAt: z.string().datetime(),
  note: z.string().trim().max(500).optional(),
  semanticReviewConfirmed: z.literal(true)
}).strict();

const ArtifactCoreV3Schema = z.object({
  schemaVersion: z.literal('approved-render-artifact-v3'),
  artifactId: SafeIdString,
  draftId: SafeIdString,
  ownerId: SafeIdString,
  approvedVersion: z.number().int().positive(),
  request: LessonRequestV3Schema,
  lessonPlan: EducationalLessonPlanV3Schema,
  verificationReport: KnowledgeValidationReportV3Schema,
  teacherApproval: TeacherApprovalV3Schema,
  createdAt: z.string().datetime()
}).strict();

export const ApprovedRenderArtifactV3Schema = ArtifactCoreV3Schema.extend({
  contentHash: z.string().regex(/^[a-f0-9]{64}$/)
}).strict().superRefine((artifact, ctx) => {
  if (JSON.stringify(artifact.verificationReport) !== JSON.stringify(artifact.lessonPlan.validationReport)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['verificationReport'], message: 'Artifact verification report phải đúng snapshot trusted trong lesson plan' });
  }
  if (artifact.request.topic.trim().length === 0 || !artifact.lessonPlan.storyboard) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lessonPlan', 'storyboard'], message: 'Artifact render V3 phải có storyboard đã duyệt' });
  }
});
export type ApprovedRenderArtifactV3 = z.infer<typeof ApprovedRenderArtifactV3Schema>;
export type ApprovedRenderArtifactCoreV3 = z.infer<typeof ArtifactCoreV3Schema>;

