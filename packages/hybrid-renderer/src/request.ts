import { z } from 'zod';

export const HybridRenderRequestSchema = z.object({
  topic: z.string().trim().min(3).max(300).refine(
    (value) => /đạo hàm|dao ham|derivative|cát tuyến.*tiếp tuyến|tích phân|tich phan|riemann|integral/i.test(value),
    'unsupported_topic: LuminaLearn supports calculus.derivative.intuition and calculus.integral.riemann_sum'
  ),
  language: z.literal('vi'),
  durationSeconds: z.literal(40),
  renderMode: z.enum(['mock', 'live']),
  voiceoverMode: z.enum(['none', 'provided_audio', 'google_cloud_tts', 'gemini_tts']).default('none'),
  subtitlesEnabled: z.boolean().default(true),
  providedAudioPath: z.string().trim().min(1).max(1024).optional()
}).strict().superRefine((request, ctx) => {
  if (request.voiceoverMode === 'provided_audio' && !request.providedAudioPath) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['providedAudioPath'], message: 'provided_audio requires a local audio path' });
  }
  if (request.voiceoverMode !== 'provided_audio' && request.providedAudioPath) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['providedAudioPath'], message: 'providedAudioPath is only allowed for provided_audio mode' });
  }
});

export type HybridRenderRequest = z.infer<typeof HybridRenderRequestSchema>;

