import { z } from 'zod';
import { SafeIdString } from '../v2/document';

function generateConsentId(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(12);
    globalThis.crypto.getRandomValues(bytes);
    return `cst_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    return `cst_${nodeCrypto.randomBytes(12).toString('hex')}`;
  } catch {
    throw new Error('secure_random_unavailable: Cryptographically secure random number generator is required');
  }
}

export const DEV_TEST_CONSENT_SIGNING_SECRET = 'luminalearn_v3_consent_dev_test_only_secret';

export function resolveConsentSigningSecret(providedSecret?: string, isLiveOperation = false): string {
  if (providedSecret) return providedSecret;
  const envSecret =
    (typeof process !== 'undefined' && (process.env?.LUMINA_CONSENT_SIGNING_KEY || process.env?.CONSENT_SIGNING_SECRET)) ||
    undefined;
  if (envSecret) return envSecret;
  if (isLiveOperation) {
    throw new Error('consent_server_secret_missing: Live external operations require an explicitly configured LUMINA_CONSENT_SIGNING_KEY or CONSENT_SIGNING_SECRET server environment variable');
  }
  return DEV_TEST_CONSENT_SIGNING_SECRET;
}

export const DEFAULT_CONSENT_SIGNING_SECRET = resolveConsentSigningSecret();

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Pure JS SHA256 and HMAC implementation (zero dependencies, 100% portable)
function sha256Bytes(bytes: number[]): number[] {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;
  const words: number[] = [];
  const asciiBitLength = bytes.length * 8;
  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  hash = hash.slice(0, 8);
  const extended = Array.from(bytes);
  extended.push(0x80);
  while (extended.length % 64 !== 56) extended.push(0);
  for (i = 0; i < extended.length; i++) {
    words[i >> 2] |= extended[i] << ((3 - i) % 4) * 8;
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength | 0;
  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15],
        w2 = w[i - 2];
      const a = hash[0],
        e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0, a, hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  const out: number[] = [];
  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      out.push((hash[i] >> (j * 8)) & 255);
    }
  }
  return out;
}

export function hmacSha256Hex(keyStr: string, dataStr: string): string {
  const encoder = new TextEncoder();
  let key = Array.from(encoder.encode(keyStr));
  const data = Array.from(encoder.encode(dataStr));
  if (key.length > 64) key = sha256Bytes(key);
  while (key.length < 64) key.push(0);
  const oKeyPad = key.map((b) => b ^ 0x5c);
  const iKeyPad = key.map((b) => b ^ 0x36);
  const innerHash = sha256Bytes(iKeyPad.concat(data));
  const outerHash = sha256Bytes(oKeyPad.concat(innerHash));
  return outerHash.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const ExternalApiProviderSchema = z.enum(['gemini', 'gemini_tts', 'google_cloud_tts', 'dutai_tts']);
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
  expiresAt: z.string().datetime(),
  signature: z.string().regex(/^[0-9a-f]{64}$/)
}).strict();
export type ExternalApiConsentRecordV3 = z.infer<typeof ExternalApiConsentRecordV3Schema>;

export function computeConsentPayloadString(record: Omit<ExternalApiConsentRecordV3, 'signature'>): string {
  return [
    record.consentId,
    record.ownerId,
    record.provider,
    record.operation,
    record.requestId ?? '',
    record.draftId ?? '',
    record.artifactId ?? '',
    record.artifactVersion?.toString() ?? '',
    record.contentHash ?? '',
    record.authorizedAt,
    record.expiresAt
  ].join('|');
}

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
  signingSecret?: string;
  isLiveOperation?: boolean;
  now?: Date;
}

export function issueExternalApiConsentV3(options: IssueConsentV3Options): ExternalApiConsentRecordV3 {
  const now = options.now ?? new Date();
  const validitySeconds = options.validitySeconds ?? 900; // Exactly 15 minutes default
  const expiresAt = new Date(now.getTime() + validitySeconds * 1000);
  const secret = resolveConsentSigningSecret(options.signingSecret, options.isLiveOperation);

  const core = {
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
  };

  const payloadString = computeConsentPayloadString(core);
  const signature = hmacSha256Hex(secret, payloadString);

  return ExternalApiConsentRecordV3Schema.parse({
    ...core,
    signature
  });
}

export interface VerifyConsentV3Options {
  consent: ExternalApiConsentRecordV3 | undefined | null;
  ownerId: string;
  expectedProvider: ExternalApiProvider;
  expectedOperation: ExternalApiOperation;
  expectedArtifactId?: string;
  expectedContentHash?: string;
  expectedDraftId?: string;
  signingSecret?: string;
  isLiveOperation?: boolean;
  now?: Date;
}

export function verifyExternalApiConsentV3(options: VerifyConsentV3Options): {
  valid: boolean;
  code?: string;
  reason?: string;
} {
  const { consent, ownerId, expectedProvider, expectedOperation, expectedArtifactId, expectedContentHash, expectedDraftId } = options;

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
  let secret: string;
  try {
    secret = resolveConsentSigningSecret(options.signingSecret, options.isLiveOperation);
  } catch (err) {
    return {
      valid: false,
      code: 'consent_server_secret_missing',
      reason: err instanceof Error ? err.message : String(err)
    };
  }
  const payloadString = computeConsentPayloadString(record);
  const expectedSignature = hmacSha256Hex(secret, payloadString);

  if (!constantTimeEqual(record.signature, expectedSignature)) {
    return {
      valid: false,
      code: 'consent_signature_invalid',
      reason: 'Consent signature is invalid or token has been tampered with'
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

  if (expectedArtifactId) {
    if (!record.artifactId) {
      return {
        valid: false,
        code: 'consent_artifact_missing',
        reason: 'Consent record is missing mandatory artifactId binding'
      };
    }
    if (record.artifactId !== expectedArtifactId) {
      return {
        valid: false,
        code: 'consent_artifact_mismatch',
        reason: `Consent is bound to artifact '${record.artifactId}', not '${expectedArtifactId}'`
      };
    }
  }

  if (expectedContentHash) {
    if (!record.contentHash) {
      return {
        valid: false,
        code: 'consent_content_hash_missing',
        reason: 'Consent record is missing mandatory contentHash binding'
      };
    }
    if (record.contentHash !== expectedContentHash) {
      return {
        valid: false,
        code: 'consent_content_hash_mismatch',
        reason: 'Approved artifact content hash has changed since consent was authorized'
      };
    }
  }

  if (expectedDraftId && record.draftId && record.draftId !== expectedDraftId) {
    return {
      valid: false,
      code: 'consent_draft_mismatch',
      reason: `Consent is bound to draft '${record.draftId}', not '${expectedDraftId}'`
    };
  }

  return { valid: true };
}
