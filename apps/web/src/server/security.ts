import { createHash, timingSafeEqual } from 'node:crypto';

export const MAX_JSON_PAYLOAD_BYTES = 256 * 1024; // 256 KB
export const MAX_JOB_REQUEST_BYTES = 4 * 1024; // 4 KB
export const MAX_DOCUMENT_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export class SecurityError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'SecurityError';
  }
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function extractHostname(hostHeaderOrUrl: string): string {
  const trimmed = hostHeaderOrUrl.trim().toLowerCase();
  if (trimmed.startsWith('[')) {
    const endBracket = trimmed.indexOf(']');
    return endBracket >= 0 ? trimmed.slice(0, endBracket + 1) : trimmed;
  }
  return trimmed.split(':', 1)[0];
}

export function isLoopbackRequest(req: Request): boolean {
  try {
    const url = new URL(req.url);
    const urlHost = extractHostname(url.hostname);
    if (!LOOPBACK_HOSTS.has(urlHost)) {
      return false;
    }
  } catch {
    return false;
  }

  const hostHeader = req.headers.get('host');
  if (hostHeader && !LOOPBACK_HOSTS.has(extractHostname(hostHeader))) {
    return false;
  }

  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const hops = forwardedFor.split(',').map((ip) => ip.trim().toLowerCase());
    if (hops.some((ip) => ip && !LOOPBACK_HOSTS.has(ip) && ip !== '::ffff:127.0.0.1')) {
      return false;
    }
  }

  return true;
}

function safeTokenCompare(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function extractAuthToken(req: Request): string | undefined {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const customHeader = req.headers.get('x-lumina-auth-token');
  if (customHeader) {
    return customHeader.trim();
  }
  return undefined;
}

/**
 * Enforces local demo safety vs public deployment authentication.
 * - On localhost/loopback (when LUMINA_PUBLIC_DEPLOYMENT !== 'true'): allows local workflow without extra setup.
 * - On non-loopback or when LUMINA_PUBLIC_DEPLOYMENT === 'true': requires LUMINA_API_AUTH_TOKEN and a matching token.
 */
export function assertRequestAuthorized(req: Request): void {
  const publicDeployment = process.env.LUMINA_PUBLIC_DEPLOYMENT === 'true';
  const configuredToken = process.env.LUMINA_API_AUTH_TOKEN?.trim();
  const loopback = isLoopbackRequest(req);
  const providedToken = extractAuthToken(req);

  if (!loopback || publicDeployment) {
    if (!configuredToken) {
      throw new SecurityError(
        403,
        'public_deployment_disabled',
        'Unauthenticated non-loopback/public access is disabled to protect API quotas. Set LUMINA_API_AUTH_TOKEN or access via localhost.'
      );
    }
    if (!providedToken || !safeTokenCompare(providedToken, configuredToken)) {
      throw new SecurityError(
        401,
        'unauthorized',
        'Valid authentication token is required for non-loopback or public deployment requests.'
      );
    }
    return;
  }

  // Even on loopback, if a caller explicitly supplies an auth token when LUMINA_API_AUTH_TOKEN is configured, verify it
  if (configuredToken && providedToken && !safeTokenCompare(providedToken, configuredToken)) {
    throw new SecurityError(401, 'unauthorized', 'Invalid authentication token.');
  }
}

/**
 * Resolves the caller's session/owner identifier for document, draft, and job isolation.
 */
export function resolveOwnerId(req: Request): string {
  const headerOwner =
    req.headers.get('x-lumina-owner-id')?.trim() ||
    req.headers.get('x-lumina-client-id')?.trim();
  if (headerOwner) {
    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(headerOwner)) {
      throw new SecurityError(
        400,
        'invalid_owner_id',
        'x-lumina-owner-id must be 3-64 alphanumeric, dash, or underscore characters'
      );
    }
    return headerOwner;
  }

  const token = extractAuthToken(req);
  if (token) {
    return `tok_${createHash('sha256').update(token).digest('hex').slice(0, 16)}`;
  }

  return 'local-default';
}

export function assertOwnerMatch(
  resourceOwnerId: string | undefined,
  callerOwnerId: string,
  resourceLabel = 'resource'
): void {
  const effectiveResourceOwner = resourceOwnerId || 'local-default';
  if (effectiveResourceOwner !== callerOwnerId) {
    throw new SecurityError(
      403,
      'forbidden_owner_mismatch',
      `Caller '${callerOwnerId}' is not authorized to access ${resourceLabel} owned by another session`
    );
  }
}

export async function readBoundedJson<T = Record<string, unknown>>(
  req: Request,
  maxBytes = MAX_JSON_PAYLOAD_BYTES
): Promise<T> {
  const contentLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new SecurityError(
      413,
      'request_too_large',
      `Request payload exceeds maximum allowed size of ${maxBytes} bytes`
    );
  }
  const raw = await req.text();
  const byteLength = Buffer.byteLength(raw, 'utf8');
  if (byteLength > maxBytes) {
    throw new SecurityError(
      413,
      'request_too_large',
      `Request payload (${byteLength} bytes) exceeds maximum allowed size of ${maxBytes} bytes`
    );
  }
  if (!raw.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new SecurityError(400, 'invalid_json', 'Request body is not valid JSON');
  }
}

export function assertUploadSizeWithinLimit(
  sizeBytes: number,
  maxBytes = MAX_DOCUMENT_UPLOAD_BYTES
): void {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new SecurityError(400, 'empty_file', 'Uploaded file is empty');
  }
  if (sizeBytes > maxBytes) {
    throw new SecurityError(
      413,
      'file_too_large',
      `Uploaded file (${sizeBytes} bytes) exceeds maximum allowed size of ${maxBytes} bytes`
    );
  }
}

export function assertExternalApiConfirmed(options: {
  renderMode?: string;
  narrationMode?: string;
  confirmExternalApi?: boolean;
  headerConfirmed?: boolean;
}): void {
  const needsExternalApi =
    options.renderMode === 'live' ||
    options.narrationMode === 'gemini_tts' ||
    options.narrationMode === 'google_cloud_tts';
  if (!needsExternalApi) return;

  if (options.confirmExternalApi !== true && options.headerConfirmed !== true) {
    throw new SecurityError(
      400,
      'external_api_confirmation_required',
      'Explicit confirmation (confirmExternalApi: true) is required before making live Gemini or TTS API calls.'
    );
  }
}

export function getMaxPendingJobs(): number {
  const raw = process.env.LUMINA_MAX_PENDING_JOBS;
  if (!raw) return 3;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3;
}
