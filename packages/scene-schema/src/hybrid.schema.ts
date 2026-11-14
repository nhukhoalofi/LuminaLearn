import { z } from 'zod';
import { DERIVATIVE_INTUITION_TOPIC } from './math.schema';
import { NarrationAudioAssetSchema, NarrationScriptSchema, SubtitleTrackSchema } from './narration.schema';

export const HYBRID_SCHEMA_VERSION = 'hybrid-v1' as const;
export const HYBRID_TOTAL_FRAMES = 960 as const;

export const HybridVideoSettingsSchema = z.object({
  width: z.literal(720),
  height: z.literal(1280),
  fps: z.literal(24),
  durationFrames: z.literal(HYBRID_TOTAL_FRAMES)
}).strict();

export const VerifiedMathClaimSchema = z.object({
  id: z.string().regex(/^claim_[a-z0-9_]+$/),
  statement: z.string().min(1).max(500),
  expectedExpression: z.string().min(1).max(120),
  verificationStatus: z.literal('verified')
}).strict();

export const MathClipAssetSchema = z.object({
  id: z.string().regex(/^asset_[a-z0-9_]+$/),
  publicPath: z.string().regex(/^generated\/job-[a-z0-9-]{8,64}\/[a-z0-9][a-z0-9._-]*\.mp4$/),
  durationSeconds: z.number().positive().max(15),
  frameCount: z.number().int().positive().max(360),
  fps: z.literal(24),
  width: z.literal(720),
  height: z.literal(1280),
  codec: z.literal('h264'),
  pixelFormat: z.literal('yuv420p'),
  verificationStatus: z.literal('verified'),
  verificationReportFile: z.string().regex(/^[a-z0-9][a-z0-9._-]*\.json$/)
}).strict();

const TimelineContentSchema = z.object({
  eyebrow: z.string().max(100).optional(),
  title: z.string().min(1).max(300),
  body: z.string().max(1000).optional(),
  formulas: z.array(z.string().min(1).max(200)).max(5).optional()
}).strict();

const TimelineBaseSchema = z.object({
  id: z.string().regex(/^scene_[a-z0-9_]+$/),
  startFrame: z.number().int().nonnegative(),
  durationFrames: z.number().int().positive(),
  content: TimelineContentSchema
});

export const HybridTimelineSceneSchema = z.discriminatedUnion('template', [
  TimelineBaseSchema.extend({ template: z.literal('hook') }).strict(),
  TimelineBaseSchema.extend({
    template: z.literal('math_clip'),
    assetId: z.string().regex(/^asset_[a-z0-9_]+$/),
    sourceStartFrame: z.number().int().nonnegative(),
    sourceDurationFrames: z.number().int().positive()
  }).strict(),
  TimelineBaseSchema.extend({ template: z.literal('equation_explanation') }).strict(),
  TimelineBaseSchema.extend({ template: z.literal('intuition_formula') }).strict(),
  TimelineBaseSchema.extend({ template: z.literal('summary') }).strict()
]);

export const HybridOutputSettingsSchema = z.object({
  codec: z.literal('h264'),
  pixelFormat: z.literal('yuv420p'),
  fileName: z.literal('final.mp4')
}).strict();

export const HybridVideoManifestSchema = z.object({
  schemaVersion: z.literal(HYBRID_SCHEMA_VERSION),
  jobId: z.string().regex(/^job-[a-z0-9-]{8,64}$/),
  topicId: z.literal(DERIVATIVE_INTUITION_TOPIC),
  lessonTitle: z.string().min(1).max(300),
  language: z.literal('vi'),
  renderMode: z.enum(['mock', 'live']),
  videoSettings: HybridVideoSettingsSchema,
  verifiedMathClaims: z.array(VerifiedMathClaimSchema).min(4).max(8),
  mathClipAssets: z.array(MathClipAssetSchema).min(1).max(4),
  timelineScenes: z.array(HybridTimelineSceneSchema).length(5),
  voiceoverMode: z.enum(['none', 'provided_audio', 'google_cloud_tts', 'gemini_tts']).default('none'),
  narrationScript: NarrationScriptSchema.optional(),
  narrationAudioAssets: z.array(NarrationAudioAssetSchema).max(8).default([]),
  subtitles: SubtitleTrackSchema.optional(),
  outputSettings: HybridOutputSettingsSchema
}).strict().superRefine((manifest, ctx) => {
  const assetIds = new Set<string>();
  for (let index = 0; index < manifest.mathClipAssets.length; index += 1) {
    const asset = manifest.mathClipAssets[index];
    if (assetIds.has(asset.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mathClipAssets', index, 'id'], message: `Duplicate asset ID: ${asset.id}` });
    }
    assetIds.add(asset.id);
    if (!asset.publicPath.startsWith(`generated/${manifest.jobId}/`)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mathClipAssets', index, 'publicPath'], message: 'Asset must belong to the current job' });
    }
  }

  let expectedStart = 0;
  const sceneIds = new Set<string>();
  for (let index = 0; index < manifest.timelineScenes.length; index += 1) {
    const scene = manifest.timelineScenes[index];
    if (sceneIds.has(scene.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['timelineScenes', index, 'id'], message: `Duplicate scene ID: ${scene.id}` });
    }
    sceneIds.add(scene.id);
    if (scene.startFrame !== expectedStart) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['timelineScenes', index, 'startFrame'], message: `Timeline must be contiguous; expected frame ${expectedStart}` });
    }
    expectedStart += scene.durationFrames;
    if (scene.template === 'math_clip') {
      const asset = manifest.mathClipAssets.find((candidate) => candidate.id === scene.assetId);
      if (!asset) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['timelineScenes', index, 'assetId'], message: `Missing asset reference: ${scene.assetId}` });
      } else if (scene.sourceStartFrame + scene.sourceDurationFrames > asset.frameCount) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['timelineScenes', index, 'sourceDurationFrames'], message: 'Math clip source range exceeds verified asset frames' });
      }
      if (scene.durationFrames !== scene.sourceDurationFrames) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['timelineScenes', index, 'durationFrames'], message: 'Math clip cannot be stretched' });
      }
    }
  }
  if (expectedStart !== manifest.videoSettings.durationFrames) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['timelineScenes'], message: `Timeline must total exactly ${manifest.videoSettings.durationFrames} frames; received ${expectedStart}` });
  }
  if (manifest.voiceoverMode === 'none' && manifest.narrationAudioAssets.length > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['narrationAudioAssets'], message: 'Voiceover mode none cannot contain audio assets' });
  }
  if (manifest.voiceoverMode !== 'none' && manifest.narrationAudioAssets.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['narrationAudioAssets'], message: 'Voiceover mode requires at least one verified audio asset' });
  }
  for (let index = 0; index < manifest.narrationAudioAssets.length; index += 1) {
    if (!manifest.narrationAudioAssets[index].publicPath.startsWith(`generated/${manifest.jobId}/`)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['narrationAudioAssets', index, 'publicPath'], message: 'Audio asset must belong to the current job' });
    }
  }
});

