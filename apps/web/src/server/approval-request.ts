import { z } from 'zod';
import { assertExternalApiConfirmed, readBoundedJson, SecurityError } from './security';

const ApprovalRequestSchema = z.object({
  note: z.string().trim().min(1).max(500).optional(),
  renderMode: z.enum(['mock', 'live']).optional(),
  narrationMode: z.enum(['none', 'provided_audio', 'google_cloud_tts', 'gemini_tts']).optional(),
  visualStyleId: z.enum(['math_chalkboard', 'clean_educational_infographic']).optional(),
  subtitlesEnabled: z.boolean().optional(),
  confirmExternalApi: z.boolean().optional(),
  confirmSemanticReview: z.boolean().optional(),
  expectedVersion: z.number().int().positive().optional()
}).strict();

export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export function assertApprovalExternalApiConsent(
  current: { renderMode: 'mock' | 'live'; narrationMode: 'none' | 'provided_audio' | 'google_cloud_tts' | 'gemini_tts' },
  proposed: ApprovalRequest,
  headerConfirmed: boolean
): { renderMode: 'mock' | 'live'; narrationMode: 'none' | 'provided_audio' | 'google_cloud_tts' | 'gemini_tts' } {
  const effective = {
    renderMode: proposed.renderMode ?? current.renderMode,
    narrationMode: proposed.narrationMode ?? current.narrationMode
  };
  assertExternalApiConfirmed({
    ...effective,
    confirmExternalApi: proposed.confirmExternalApi === true,
    headerConfirmed
  });
  return effective;
}

/** Empty bodies are explicitly supported and use server-side approval defaults. */
export async function readApprovalRequest(req: Request): Promise<ApprovalRequest> {
  const raw = await readBoundedJson<unknown>(req);
  const parsed = ApprovalRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SecurityError(400, 'invalid_approval_request', parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  return parsed.data;
}
