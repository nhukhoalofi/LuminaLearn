import { z } from 'zod';
import { GroundingEvidenceSchema, NoExecutableString, SafeIdString, SourceReferenceSchema } from './document';
import { MathVisualizationSpecV2Schema } from './math-spec';
import { VisualStyleIdSchema } from './visual-style';

export const LESSON_SCHEMA_VERSION_V2 = 'lesson-v2' as const;
export const MANIFEST_SCHEMA_VERSION_V2 = 'manifest-v2' as const;

export const SupportedLanguageSchema = z.enum(['vi', 'en']);
export const SupportedAspectRatioSchema = z.enum(['9:16', '16:9', '1:1']);
export type SupportedAspectRatio = z.infer<typeof SupportedAspectRatioSchema>;
export const SupportedRenderModeSchema = z.enum(['mock', 'live']);
export const SupportedNarrationModeSchema = z.enum(['none', 'provided_audio', 'google_cloud_tts', 'gemini_tts']);
export const SupportedInputModeSchema = z.enum(['topic_prompt', 'source_document']);

/**
 * Yêu cầu tạo bài học V2 (LessonRequestV2)
 */
export const LessonRequestV2Schema = z.object({
  requestId: SafeIdString,
  inputMode: SupportedInputModeSchema,
  topic: z.string().trim().min(3).max(500),
  sourceDocumentIds: z.array(SafeIdString).default([]),
  audience: z.string().trim().min(2).max(120).default('Học sinh phổ thông'),
  language: SupportedLanguageSchema.default('vi'),
  targetDurationSeconds: z.number().int().min(20).max(300).default(40),
  renderMode: SupportedRenderModeSchema.default('mock'),
  narrationMode: SupportedNarrationModeSchema.default('none'),
  aspectRatio: SupportedAspectRatioSchema.default('9:16'),
  visualStyleId: VisualStyleIdSchema.default('clean_educational_infographic'),
  providedAudioPath: z.string().trim().min(1).max(1024).optional()
}).strict().superRefine((req, ctx) => {
  if (req.inputMode === 'source_document' && req.sourceDocumentIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceDocumentIds'],
      message: 'source_document input mode requires at least one source document ID'
    });
  }
  if (req.narrationMode === 'provided_audio' && !req.providedAudioPath) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['providedAudioPath'],
      message: 'provided_audio narration mode requires providedAudioPath'
    });
  }
});

type ParsedLessonRequestV2 = z.infer<typeof LessonRequestV2Schema>;
/** Input-compatible type keeps the V2.3 request surface source-compatible; parsing supplies the default style. */
export type LessonRequestV2 = Omit<ParsedLessonRequestV2, 'visualStyleId'> & {
  visualStyleId?: ParsedLessonRequestV2['visualStyleId'];
};

/**
 * Mệnh đề toán học đã/chưa kiểm định (VerifiedClaim)
 */
export const MathVerificationStatusSchema = z.enum(['verified', 'unverified', 'failed']);

export const VerifiedClaimSchema = z.object({
  id: SafeIdString,
  statement: NoExecutableString,
  validatorKey: z.string().regex(/^[a-z0-9_]{3,64}$/),
  expectedExpression: z.string().regex(/^[0-9a-zA-Z\s+\-*^()./\\=><_{}\[\]]+$/, 'Mathematical expression contains forbidden characters'),
  verificationStatus: MathVerificationStatusSchema,
  sourceReferenceId: SafeIdString.optional()
}).strict();

export type VerifiedClaim = z.infer<typeof VerifiedClaimSchema>;

/**
 * Trình tự sư phạm cho từng phân đoạn
 */
export const PedagogicalStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  pedagogicalGoal: NoExecutableString,
  intuitiveConcept: NoExecutableString,
  formalFormula: z.string().max(200).optional(),
  targetDurationSeconds: z.number().positive().max(60)
}).strict();

export type PedagogicalStep = z.infer<typeof PedagogicalStepSchema>;

/**
 * Kế hoạch bài học toán học V2 (LessonPlanV2)
 */
export const LessonPlanV2Schema = z.object({
  schemaVersion: z.literal(LESSON_SCHEMA_VERSION_V2),
  lessonId: SafeIdString,
  topicId: z.string().regex(/^[a-z0-9_.-]{3,80}$/),
  title: NoExecutableString,
  learningObjectives: z.array(NoExecutableString).min(1).max(6),
  prerequisites: z.array(NoExecutableString).max(6).default([]),
  keyConcepts: z.array(NoExecutableString).min(1).max(8),
  mathematicalClaims: z.array(VerifiedClaimSchema).min(1).max(12),
  mathSpec: MathVisualizationSpecV2Schema.optional(),
  sourceEvidence: z.array(GroundingEvidenceSchema).default([]),
  pedagogicalSequence: z.array(PedagogicalStepSchema).min(1).max(10),
  summary: NoExecutableString
}).strict().superRefine((plan, ctx) => {
  const claimIds = new Set<string>();
  for (let i = 0; i < plan.mathematicalClaims.length; i++) {
    const claim = plan.mathematicalClaims[i];
    if (claimIds.has(claim.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mathematicalClaims', i, 'id'], message: `Duplicate claim ID: ${claim.id}` });
    }
    claimIds.add(claim.id);
  }
});

export type LessonPlanV2 = z.infer<typeof LessonPlanV2Schema>;

/**
 * Đặc tả cảnh trực quan V2 (VisualSceneSpecV2)
 */
export const SceneTypeSchema = z.enum(['intro', 'concept', 'animation', 'formula', 'summary']);

export const VisualSceneSpecV2Schema = z.object({
  sceneId: SafeIdString,
  templateId: z.string().regex(/^[a-z0-9_]{3,64}$/),
  sceneType: SceneTypeSchema,
  visualStyleId: VisualStyleIdSchema.optional(),
  durationFrames: z.number().int().positive().max(7200), // Tối đa 5 phút ở 24fps
  parameters: z.record(z.string(), z.any()),
  layout: z.object({
    aspectRatio: SupportedAspectRatioSchema,
    safeAreaPadding: z.number().nonnegative().max(100).default(32)
  }).strict().default({ aspectRatio: '9:16', safeAreaPadding: 32 }),
  mathematicalBinding: z.object({
    boundClaimIds: z.array(SafeIdString).default([]),
    latexFormulas: z.array(z.string().max(300)).default([])
  }).strict().default({ boundClaimIds: [], latexFormulas: [] }),
  sourceReferenceIds: z.array(SafeIdString).default([])
}).strict();

export type VisualSceneSpecV2 = z.infer<typeof VisualSceneSpecV2Schema>;

/**
 * Storyboard trực quan V2 (StoryboardV2)
 */
export const StoryboardV2Schema = z.object({
  storyboardId: SafeIdString,
  lessonId: SafeIdString,
  topicId: z.string().regex(/^[a-z0-9_.-]{3,80}$/),
  scenes: z.array(VisualSceneSpecV2Schema).min(2).max(12),
  visualTemplateIds: z.array(z.string()).min(1),
  mathematicalData: z.record(z.string(), z.any()).default({}),
  narrationObjectives: z.array(z.string().max(300)).default([]),
  estimatedDurationFrames: z.number().int().positive().max(7200),
  sourceReferences: z.array(SafeIdString).default([])
}).strict().superRefine((sb, ctx) => {
  const sumFrames = sb.scenes.reduce((sum, sc) => sum + sc.durationFrames, 0);
  if (Math.abs(sumFrames - sb.estimatedDurationFrames) > 5) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['estimatedDurationFrames'],
      message: `estimatedDurationFrames (${sb.estimatedDurationFrames}) does not match sum of scene durations (${sumFrames})`
    });
  }
});

export type StoryboardV2 = z.infer<typeof StoryboardV2Schema>;

/**
 * Gợi ý phát âm cho TTS V2
 */
export const PronunciationHintV2Schema = z.object({
  written: z.string().trim().min(1).max(100),
  spoken: z.string().trim().min(1).max(200)
}).strict();

export type PronunciationHintV2 = z.infer<typeof PronunciationHintV2Schema>;

/**
 * Phân đoạn lời dẫn (NarrationSegmentV2)
 */
export const NarrationSegmentV2Schema = z.object({
  segmentId: SafeIdString,
  sceneId: SafeIdString,
  text: NoExecutableString,
  subtitleText: NoExecutableString,
  targetDurationSeconds: z.number().positive().max(120),
  pronunciationHints: z.array(PronunciationHintV2Schema).default([]),
  sourceReferenceId: SafeIdString.optional()
}).strict();

export type NarrationSegmentV2 = z.infer<typeof NarrationSegmentV2Schema>;

/**
 * Kế hoạch lời dẫn V2 (NarrationPlanV2)
 */
export const NarrationPlanV2Schema = z.object({
  planId: SafeIdString,
  storyboardId: SafeIdString,
  language: SupportedLanguageSchema,
  segments: z.array(NarrationSegmentV2Schema).min(1).max(15),
  totalWords: z.number().int().positive(),
  estimatedDurationSeconds: z.number().positive(),
  mathematicalReview: z.object({
    status: MathVerificationStatusSchema,
    verifiedClaimIds: z.array(SafeIdString)
  }).strict()
}).strict();

export type NarrationPlanV2 = z.infer<typeof NarrationPlanV2Schema>;

/**
 * Cảnh trên timeline của RenderManifestV2
 */
export const TimelineSceneV2Schema = z.object({
  id: SafeIdString,
  sceneType: SceneTypeSchema,
  templateId: z.string().regex(/^[a-z0-9_]{3,64}$/),
  visualStyleId: VisualStyleIdSchema.optional(),
  startFrame: z.number().int().nonnegative(),
  durationFrames: z.number().int().positive(),
  assetId: SafeIdString.optional(),
  content: z.object({
    eyebrow: z.string().max(100).optional(),
    title: z.string().min(1).max(300),
    body: z.string().max(1500).optional(),
    formulas: z.array(z.string().max(300)).default([])
  }).strict(),
  parameters: z.record(z.string(), z.any()).default({})
}).strict();

export type TimelineSceneV2 = z.infer<typeof TimelineSceneV2Schema>;

export const SubtitleCueV2Schema = z.object({
  id: SafeIdString,
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
  text: z.string().min(1).max(500)
}).strict();

export type SubtitleCueV2 = z.infer<typeof SubtitleCueV2Schema>;

/**
 * Bản kê kết xuất V2 (RenderManifestV2)
 */
export const RenderManifestV2Schema = z.object({
  schemaVersion: z.literal(MANIFEST_SCHEMA_VERSION_V2),
  manifestId: SafeIdString,
  jobId: SafeIdString,
  topicId: z.string().regex(/^[a-z0-9_.-]{3,80}$/),
  lessonTitle: NoExecutableString,
  language: SupportedLanguageSchema,
  aspectRatio: SupportedAspectRatioSchema,
  dimensions: z.object({
    width: z.number().int().positive().max(3840),
    height: z.number().int().positive().max(3840)
  }).strict(),
  fps: z.number().int().min(12).max(60).default(24),
  totalFrames: z.number().int().positive().max(7200),
  timeline: z.array(TimelineSceneV2Schema).min(1).max(15),
  visualAssets: z.array(z.object({
    id: SafeIdString,
    publicPath: z.string().min(1).max(500),
    durationSeconds: z.number().positive(),
    frameCount: z.number().int().positive(),
    fps: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    codec: z.literal('h264'),
    pixelFormat: z.literal('yuv420p')
  }).strict()).default([]),
  audioAssets: z.array(z.object({
    id: SafeIdString,
    path: z.string().min(1).max(500),
    durationSeconds: z.number().positive(),
    codec: z.enum(['aac', 'wav', 'mp3']),
    startFrame: z.number().int().nonnegative().default(0)
  }).strict()).default([]),
  subtitleTrack: z.object({
    trackId: SafeIdString,
    cues: z.array(SubtitleCueV2Schema)
  }).strict().optional(),
  verifiedClaims: z.array(VerifiedClaimSchema).default([]),
  sourceReferences: z.array(SourceReferenceSchema).default([])
}).strict().superRefine((manifest, ctx) => {
  let currentFrame = 0;
  for (let i = 0; i < manifest.timeline.length; i++) {
    const scene = manifest.timeline[i];
    if (scene.startFrame !== currentFrame) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['timeline', i, 'startFrame'],
        message: `Timeline gap or overlap at scene ${scene.id}: expected startFrame ${currentFrame}, got ${scene.startFrame}`
      });
    }
    currentFrame += scene.durationFrames;
  }
  if (currentFrame !== manifest.totalFrames) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['totalFrames'],
      message: `Total frames (${manifest.totalFrames}) does not match sum of timeline scene frames (${currentFrame})`
    });
  }
});

export type RenderManifestV2 = z.infer<typeof RenderManifestV2Schema>;
