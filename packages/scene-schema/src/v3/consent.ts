import { z } from 'zod';
import { SafeIdString } from '../v2/document';

function generateConsentId(): string {
  const chars = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `cst_${id}`;
}

export const ExternalApiProviderSchema = z.enum(['gemini', 'gemini_tts', 'google_cloud_tts']);
export type ExternalApiProvider = z.infer<typeof ExternalApiProviderSchema>;

export const ExternalApiOperationSchema = z.enum(['planning', 'narration']);
export type ExternalApiOperation = z.infer<typeof ExternalApiOperationSchema>;

export const ExternalApiConsentRecordV3Schema = z.object({
  consentId: SafeIdString,
  ownerId: SafeIdString,
  provider: ExternalApiProviderSchema,
  operation: ExternalApiOperationSchema,
  requestId: SafeIdString.optional(),
  draftId: SafeIdString.optional(),
  artifactId: SafeIdString.optional(),
  artifactVersion: z.number().int().positive().optional(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  authorizedAt: z.string().datetime(),
  expiresAt: z.string().datetime()
}).strict();
export type ExternalApiConsentRecordV3 = z.infer<typeof ExternalApiConsentRecordV3Schema>;

export interface IssueConsentV3Options {
  ownerId: string;
  provider: ExternalApiProvider;
  operation: ExternalApiOperation;
  requestId?: string;
  draftId?: string;
  artifactId?: string;
  artifactVersion?: number;
  contentHash?: string;
  validitySeconds?: number;
  now?: Date;
}

export function issueExternalApiConsentV3(options: IssueConsentV3Options): ExternalApiConsentRecordV3 {
  const now = options.now ?? new Date();
  const validitySeconds = options.validitySeconds ?? 1800; // 30 minutes default
  const expiresAt = new Date(now.getTime() + validitySeconds * 1000);

  return ExternalApiConsentRecordV3Schema.parse({
    consentId: generateConsentId(),
    ownerId: options.ownerId,
    provider: options.provider,
    operation: options.operation,
    requestId: options.requestId,
    draftId: options.draftId,
    artifactId: options.artifactId,
    artifactVersion: options.artifactVersion,
    contentHash: options.contentHash,
    authorizedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  });
}

export interface VerifyConsentV3Options {
  consent: ExternalApiConsentRecordV3 | undefined | null;
  ownerId: string;
  expectedProvider: ExternalApiProvider;
  expectedOperation: ExternalApiOperation;
  expectedArtifactId?: string;
  expectedContentHash?: string;
  now?: Date;
}

export function verifyExternalApiConsentV3(options: VerifyConsentV3Options): {
  valid: boolean;
  code?: string;
  reason?: string;
} {
  const { consent, ownerId, expectedProvider, expectedOperation, expectedArtifactId, expectedContentHash } = options;

  if (!consent) {
    return {
      valid: false,
      code: 'consent_missing',
      reason: `Explicit external API consent is required for ${expectedProvider} (${expectedOperation})`
    };
  }

  const parsed = ExternalApiConsentRecordV3Schema.safeParse(consent);
  if (!parsed.success) {
    return {
      valid: false,
      code: 'consent_invalid_schema',
      reason: 'External API consent record has invalid schema'
    };
  }

  const record = parsed.data;

  if (record.ownerId !== ownerId) {
    return {
      valid: false,
      code: 'consent_owner_mismatch',
      reason: `Consent was authorized for owner '${record.ownerId}', not '${ownerId}'`
    };
  }

  if (record.provider !== expectedProvider) {
    return {
      valid: false,
      code: 'consent_provider_mismatch',
      reason: `Consent is for provider '${record.provider}', but '${expectedProvider}' was requested`
    };
  }

  if (record.operation !== expectedOperation) {
    return {
      valid: false,
      code: 'consent_operation_mismatch',
      reason: `Consent is for operation '${record.operation}', but '${expectedOperation}' was requested`
    };
  }

  if (expectedArtifactId && record.artifactId && record.artifactId !== expectedArtifactId) {
    return {
      valid: false,
      code: 'consent_artifact_mismatch',
      reason: `Consent is bound to artifact '${record.artifactId}', not '${expectedArtifactId}'`
    };
  }

  if (expectedContentHash && record.contentHash && record.contentHash !== expectedContentHash) {
    return {
      valid: false,
      code: 'consent_content_hash_mismatch',
      reason: 'Approved artifact content hash has changed since consent was authorized'
    };
  }

  const now = options.now ?? new Date();
  const expiresAt = new Date(record.expiresAt);
  if (now.getTime() > expiresAt.getTime()) {
    return {
      valid: false,
      code: 'consent_expired',
      reason: `Consent expired at ${record.expiresAt}`
    };
  }

  return { valid: true };
}
