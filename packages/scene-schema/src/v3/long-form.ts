import { z } from 'zod';
import { SafeIdString, NoExecutableString } from '../v2/document';
import { EducationalDomainSchema } from './capability';
import { GenerationModeV3Schema } from './artifact';
import {
  EducationalSceneV3Schema,
  LESSON_SCHEMA_VERSION_V3,
  type EducationalSceneV3
} from './contracts';

// ============================================================================
// LUMINALEARN V3.0 — PHASE 6: LONG-FORM SEGMENTED VIDEO CONTRACTS
// ============================================================================

export const LONG_FORM_DURATION_PRESETS = [60, 180, 300, 600] as const;
export type LongFormDurationSeconds = typeof LONG_FORM_DURATION_PRESETS[number];

export const LONG_FORM_PRESET_NAMES = ['60s', '180s', '300s', '600s'] as const;
export type LongFormPresetName = typeof LONG_FORM_PRESET_NAMES[number];

export function secondsToFrames(seconds: number, fps: number = 24): number {
  return Math.round(seconds * fps);
}

export function framesToSeconds(frames: number, fps: number = 24): number {
  return Number((frames / fps).toFixed(3));
}

export function isLongFormDuration(seconds: number): boolean {
  return seconds >= 60;
}

// 1. Long-Form Lesson Request
export const LongFormLessonRequestV3Schema = z.object({
  requestId: SafeIdString,
  ownerId: SafeIdString,
  topic: z.string().min(3).max(200).pipe(NoExecutableString),
  domain: EducationalDomainSchema,
  generationMode: GenerationModeV3Schema,
  targetDurationPreset: z.enum(LONG_FORM_PRESET_NAMES),
  targetDurationSeconds: z.union([
    z.literal(60),
    z.literal(180),
    z.literal(300),
    z.literal(600)
  ]),
  targetDurationFrames: z.number().int().positive(),
  narrationMode: z.enum(['none', 'provided_audio', 'gemini_tts', 'google_cloud_tts']).default('none'),
  subtitlesEnabled: z.boolean().default(true),
  fps: z.literal(24).default(24),
  width: z.literal(720).default(720),
  height: z.literal(1280).default(1280),
  sourceDocumentText: z.string().max(60000).optional()
}).strict().superRefine((data: { targetDurationSeconds: number; targetDurationFrames: number; fps: number }, ctx) => {
  const expectedFrames = secondsToFrames(data.targetDurationSeconds, data.fps);
  if (data.targetDurationFrames !== expectedFrames) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetDurationFrames'],
      message: `targetDurationFrames (${data.targetDurationFrames}) must match seconds * fps (${expectedFrames})`
    });
  }
});
export type LongFormLessonRequestV3 = z.infer<typeof LongFormLessonRequestV3Schema>;

// 2. Educational Section (Unit within a Chapter)
export const EducationalSectionV3Schema = z.object({
  sectionId: SafeIdString,
  sectionTitle: z.string().trim().min(2).max(120),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
  durationFrames: z.number().int().min(1),
  pedagogicalIntent: z.string().trim().min(3).max(300),
  sceneIds: z.array(SafeIdString).min(1)
}).strict().superRefine((sec: { startFrame: number; endFrame: number; durationFrames: number }, ctx) => {
  if (sec.endFrame <= sec.startFrame) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endFrame'],
      message: 'endFrame must be strictly greater than startFrame'
    });
  }
  if (sec.durationFrames !== sec.endFrame - sec.startFrame) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['durationFrames'],
      message: 'durationFrames must equal endFrame - startFrame'
    });
  }
});
export type EducationalSectionV3 = z.infer<typeof EducationalSectionV3Schema>;

// 3. Educational Chapter (Pedagogical Unit)
export const EducationalChapterV3Schema = z.object({
  chapterId: SafeIdString,
  chapterIndex: z.number().int().min(0),
  chapterTitle: z.string().trim().min(2).max(120),
  learningObjectives: z.array(z.string().trim().min(3).max(200)).min(1),
  pedagogicalIntent: z.string().trim().min(3).max(300),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
  durationFrames: z.number().int().min(1),
  durationSeconds: z.number().positive(),
  sections: z.array(EducationalSectionV3Schema).default([]),
  sceneIds: z.array(SafeIdString).min(1),
  keyConcepts: z.array(z.string().trim()).min(1),
  formalClaimIds: z.array(SafeIdString).default([]),
  narrationPlan: z.object({
    overview: z.string().trim().min(1),
    speakingRateCharsPerSec: z.number().min(10).max(22).default(14)
  }).strict(),
  validationStatus: z.enum(['pending', 'verified', 'human_review_required', 'rejected']).default('pending')
}).strict().superRefine((chap: { startFrame: number; endFrame: number; durationFrames: number }, ctx) => {
  if (chap.endFrame <= chap.startFrame) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endFrame'],
      message: 'endFrame must be strictly greater than startFrame'
    });
  }
  if (chap.durationFrames !== chap.endFrame - chap.startFrame) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['durationFrames'],
      message: 'durationFrames must equal endFrame - startFrame'
    });
  }
});
export type EducationalChapterV3 = z.infer<typeof EducationalChapterV3Schema>;

// 4. Long-Form Storyboard
export const LongFormStoryboardV3Schema = z.object({
  schemaVersion: z.literal(LESSON_SCHEMA_VERSION_V3),
  totalDurationSeconds: z.union([
    z.literal(60),
    z.literal(180),
    z.literal(300),
    z.literal(600)
  ]),
  totalDurationFrames: z.number().int().positive(),
  fps: z.literal(24),
  chapters: z.array(EducationalChapterV3Schema).min(2).max(12),
  scenes: z.array(EducationalSceneV3Schema).min(3).max(60)
}).strict().superRefine((sb: { totalDurationSeconds: number; totalDurationFrames: number; fps: number; chapters: Array<{ chapterId: string; startFrame: number; endFrame: number }> }, ctx) => {
  const expectedFrames = secondsToFrames(sb.totalDurationSeconds, sb.fps);
  if (sb.totalDurationFrames !== expectedFrames) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['totalDurationFrames'],
      message: `totalDurationFrames (${sb.totalDurationFrames}) must match totalDurationSeconds * fps (${expectedFrames})`
    });
  }

  // Continuity check between chapters
  let currentFrame = 0;
  for (let i = 0; i < sb.chapters.length; i++) {
    const ch = sb.chapters[i];
    if (ch.startFrame !== currentFrame) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['chapters', i, 'startFrame'],
        message: `Chapter ${ch.chapterId} startFrame (${ch.startFrame}) does not match expected frame (${currentFrame})`
      });
    }
    currentFrame = ch.endFrame;
  }
  if (currentFrame !== sb.totalDurationFrames) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['chapters'],
      message: `Chapters total frames (${currentFrame}) does not equal totalDurationFrames (${sb.totalDurationFrames})`
    });
  }
});
export type LongFormStoryboardV3 = z.infer<typeof LongFormStoryboardV3Schema>;

// 5. Render Segment (15-45s atomic render chunk)
export const RenderSegmentV3Schema = z.object({
  segmentId: SafeIdString,
  segmentIndex: z.number().int().min(0),
  chapterId: SafeIdString,
  sceneIds: z.array(SafeIdString).min(1),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
  durationFrames: z.number().int().min(1),
  durationSeconds: z.number().positive(),
  inputContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(['pending', 'rendering', 'rendered', 'validated', 'failed', 'cached']).default('pending'),
  attemptCount: z.number().int().min(0).default(0),
  outputPath: z.string().optional(),
  cacheKey: z.string().regex(/^[a-f0-9]{64}$/).optional()
}).strict().superRefine((seg: { startFrame: number; endFrame: number; durationFrames: number }, ctx) => {
  if (seg.endFrame <= seg.startFrame) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endFrame'],
      message: 'endFrame must be strictly greater than startFrame'
    });
  }
  if (seg.durationFrames !== seg.endFrame - seg.startFrame) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['durationFrames'],
      message: 'durationFrames must equal endFrame - startFrame'
    });
  }
});
export type RenderSegmentV3 = z.infer<typeof RenderSegmentV3Schema>;

// 6. Segment Manifest (Full plan for segmented rendering)
export const SegmentManifestV3Schema = z.object({
  manifestId: SafeIdString,
  artifactId: SafeIdString,
  targetDurationSeconds: z.number().int().positive(),
  totalFrames: z.number().int().positive(),
  fps: z.literal(24),
  width: z.literal(720),
  height: z.literal(1280),
  segments: z.array(RenderSegmentV3Schema).min(2),
  contentFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime()
}).strict().superRefine((man: { totalFrames: number; segments: Array<{ segmentId: string; startFrame: number; endFrame: number }> }, ctx) => {
  // Validate complete frame continuity across all segments
  let currentFrame = 0;
  for (let i = 0; i < man.segments.length; i++) {
    const seg = man.segments[i];
    if (seg.startFrame !== currentFrame) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['segments', i, 'startFrame'],
        message: `Segment ${seg.segmentId} startFrame (${seg.startFrame}) does not match expected contiguous frame (${currentFrame})`
      });
    }
    currentFrame = seg.endFrame;
  }
  if (currentFrame !== man.totalFrames) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['segments'],
      message: `Total segments frame sum (${currentFrame}) does not match totalFrames (${man.totalFrames})`
    });
  }
});
export type SegmentManifestV3 = z.infer<typeof SegmentManifestV3Schema>;

// 7. Long-Form Render Job
export const LongFormRenderJobV3Schema = z.object({
  jobId: SafeIdString,
  artifactId: SafeIdString,
  manifestId: SafeIdString,
  status: z.enum([
    'planned',
    'validating',
    'rendering_segments',
    'validating_segments',
    'merging',
    'validating_output',
    'completed',
    'failed',
    'interrupted',
    'cancelled'
  ]),
  totalSegments: z.number().int().min(1),
  completedSegments: z.number().int().min(0),
  progress: z.number().min(0).max(100),
  outputPath: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();
export type LongFormRenderJobV3 = z.infer<typeof LongFormRenderJobV3Schema>;

// 8. Long-Form Media Report
export const LongFormMediaReportV3Schema = z.object({
  filePath: z.string(),
  fileSizeBytes: z.number().int().positive(),
  durationSeconds: z.number().positive(),
  totalFrames: z.number().int().positive(),
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  videoCodec: z.string(),
  audioCodec: z.string().optional(),
  hasAudio: z.boolean(),
  subtitlesEmbeddedOrSrt: z.boolean(),
  qaPassed: z.boolean(),
  inspectedAt: z.string().datetime()
}).strict();
export type LongFormMediaReportV3 = z.infer<typeof LongFormMediaReportV3Schema>;

