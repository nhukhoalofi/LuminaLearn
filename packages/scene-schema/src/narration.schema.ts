import { z } from 'zod';

const SafeNarrationTextSchema = z.string().trim().min(1).max(420).refine(
  (value) => !/```|\b(?:exec|eval|import)\b/i.test(value),
  'Narration must contain natural language only'
);

export const PronunciationHintSchema = z.object({
  written: z.string().trim().min(1).max(80),
  spoken: z.string().trim().min(1).max(120)
}).strict();

export const NarrationSegmentSchema = z.object({
  id: z.string().regex(/^narration_[a-z0-9_]+$/),
  sceneId: z.string().regex(/^scene_[a-z0-9_]+$/),
  text: SafeNarrationTextSchema,
  subtitleText: SafeNarrationTextSchema,
  targetDurationSeconds: z.number().positive().max(20),
  pronunciationHints: z.array(PronunciationHintSchema).max(8)
}).strict();

export const NarrationScriptSchema = z.object({
  schemaVersion: z.literal('narration-v1'),
  topicId: z.literal('calculus.derivative.intuition'),
  language: z.literal('vi'),
  audience: z.string().trim().min(2).max(120),
  timingLevel: z.literal('segment'),
  mathematicalReview: z.object({
    status: z.literal('verified'),
    verifiedClaimIds: z.array(z.string().regex(/^claim_[a-z0-9_]+$/)).min(4).max(8)
  }).strict(),
  segments: z.array(NarrationSegmentSchema).length(5)
}).strict().superRefine((script, ctx) => {
  const ids = new Set<string>();
  const scenes = new Set<string>();
  script.segments.forEach((segment, index) => {
    if (ids.has(segment.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['segments', index, 'id'], message: 'Duplicate narration segment ID' });
    if (scenes.has(segment.sceneId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['segments', index, 'sceneId'], message: 'Each scene must have one narration segment' });
    ids.add(segment.id);
    scenes.add(segment.sceneId);
  });
});

export const SubtitleCueSchema = z.object({
  id: z.string().regex(/^subtitle_[a-z0-9_]+$/),
  text: z.string().trim().min(1).max(180).refine((text) => text.split('\n').length <= 2, 'Subtitle supports at most two lines'),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive().max(960),
  sceneId: z.string().regex(/^scene_[a-z0-9_]+$/),
  narrationSegmentId: z.string().regex(/^narration_[a-z0-9_]+$/).optional()
}).strict().refine((cue) => cue.endFrame > cue.startFrame, { message: 'Subtitle endFrame must be after startFrame', path: ['endFrame'] });

export const SubtitleTrackSchema = z.object({
  schemaVersion: z.literal('subtitles-v1'),
  language: z.literal('vi'),
  timingLevel: z.literal('segment'),
  burnedIn: z.boolean(),
  cues: z.array(SubtitleCueSchema).max(40)
}).strict().superRefine((track, ctx) => {
  let previousEnd = 0;
  const ids = new Set<string>();
  track.cues.forEach((cue, index) => {
    if (ids.has(cue.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cues', index, 'id'], message: 'Duplicate subtitle cue ID' });
    if (cue.startFrame < previousEnd) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cues', index, 'startFrame'], message: 'Subtitle cues must not overlap' });
    ids.add(cue.id);
    previousEnd = cue.endFrame;
  });
});

export const NarrationAudioAssetSchema = z.object({
  id: z.string().regex(/^audio_[a-z0-9_]+$/),
  narrationSegmentId: z.string().regex(/^narration_[a-z0-9_]+$/).optional(),
  sceneId: z.string().regex(/^scene_[a-z0-9_]+$/).optional(),
  publicPath: z.string().regex(/^generated\/job-[a-z0-9-]{8,64}\/[a-z0-9][a-z0-9._-]*\.(?:mp3|wav|m4a)$/),
  startFrame: z.number().int().nonnegative().max(959),
  durationFrames: z.number().int().positive().max(960),
  durationSeconds: z.number().positive().max(40.1),
  codec: z.enum(['mp3', 'pcm_s16le', 'aac']),
  sampleRate: z.number().int().min(8_000).max(96_000),
  channels: z.number().int().min(1).max(2),
  verificationStatus: z.literal('verified')
}).strict().refine((asset) => asset.startFrame + asset.durationFrames <= 960, {
  message: 'Audio asset exceeds the video timeline', path: ['durationFrames']
});

export type NarrationScript = z.infer<typeof NarrationScriptSchema>;
export type NarrationSegment = z.infer<typeof NarrationSegmentSchema>;
export type SubtitleTrack = z.infer<typeof SubtitleTrackSchema>;
export type SubtitleCue = z.infer<typeof SubtitleCueSchema>;
export type NarrationAudioAsset = z.infer<typeof NarrationAudioAssetSchema>;
