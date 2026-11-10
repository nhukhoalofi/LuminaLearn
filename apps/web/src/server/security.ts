import { createHash, timingSafeEqual } from 'node:crypto';
import { AuthStore, SESSION_COOKIE_NAME } from './auth-store';

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
    if (process.env.LUMINA_TRUST_PROXY !== 'true') {
      // Proxy headers are untrusted unless explicitly enabled via LUMINA_TRUST_PROXY
      return false;
    }
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

export function extractCookieValue(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

function extractAuthToken(req: Request): string | undefined {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const customHeader = req.headers.get('x-lumina-auth-token') ?? req.headers.get('x-lumina-session-token');
  if (customHeader) {
    return customHeader.trim();
  }
  const cookieToken = extractCookieValue(req.headers.get('cookie'), SESSION_COOKIE_NAME);
  if (cookieToken) {
    return cookieToken.trim();
  }
  return undefined;
}

type DeploymentMode = 'local_demo' | 'public' | 'disabled';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function assertSameOriginRequest(req: Request): void {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return;
  const origin = req.headers.get('origin');
  const expected = process.env.LUMINA_PUBLIC_ORIGIN?.trim() || new URL(req.url).origin;
  if (!origin || origin !== expected) {
    throw new SecurityError(403, 'csrf_origin_mismatch', 'State-changing cookie request must originate from the configured application origin.');
  }
}

export function resolveDeploymentMode(): DeploymentMode {
  const publicDeployment = process.env.LUMINA_PUBLIC_DEPLOYMENT === 'true';
  const explicitLocalDemo = process.env.LUMINA_LOCAL_DEMO === 'true';
  if (publicDeployment && explicitLocalDemo) {
    throw new SecurityError(
      500,
      'unsafe_deployment_configuration',
      'LUMINA_PUBLIC_DEPLOYMENT=true and LUMINA_LOCAL_DEMO=true are mutually exclusive'
    );
  }
  if (publicDeployment) return 'public';
  if (explicitLocalDemo || process.env.NODE_ENV !== 'production') return 'local_demo';
  return 'disabled';
}

/**
 * Enforces local demo safety vs private/public deployment authentication.
 * - On localhost/loopback (when LUMINA_PUBLIC_DEPLOYMENT !== 'true'): allows local workflow without extra setup.
 * - With active teacher session: authorizes per-teacher request.
 * - With LUMINA_API_AUTH_TOKEN: authorizes API client.
 */
export function assertRequestAuthorized(req: Request): void {
  const mode = resolveDeploymentMode();
  const providedToken = extractAuthToken(req);

  if (mode === 'disabled') {
    throw new SecurityError(
      403,
      'public_deployment_disabled',
      'Production access is disabled until LUMINA_PUBLIC_DEPLOYMENT=true and authentication are configured.'
    );
  }

  // Check if caller holds a valid active teacher pilot session
  if (providedToken) {
    const session = AuthStore.getSession(providedToken);
    if (session) {
      const cookieToken = extractCookieValue(req.headers.get('cookie'), SESSION_COOKIE_NAME);
      if (cookieToken && !req.headers.has('authorization') && !req.headers.has('x-lumina-session-token')) assertSameOriginRequest(req);
      return;
    }
  }

  // Check if caller holds the configured API auth token
  const configuredToken = process.env.LUMINA_API_AUTH_TOKEN?.trim();
  if (configuredToken && providedToken && safeTokenCompare(providedToken, configuredToken)) {
    return;
  }

  if (mode === 'public') {
    throw new SecurityError(
      401,
      'unauthorized',
      'Valid authentication token or active teacher session is required for public or non-loopback requests.'
    );
  }

  if (!isLoopbackRequest(req)) {
    throw new SecurityError(403, 'local_demo_loopback_only', 'Local demo requests must originate from loopback.');
  }
}

/**
 * Resolves the caller's session/owner identifier for document, draft, and job isolation.
 */
export function resolveOwnerId(req: Request): string {
  const mode = resolveDeploymentMode();
  const providedToken = extractAuthToken(req);

  // 1. Authenticated teacher session
  if (providedToken) {
    const session = AuthStore.getSession(providedToken);
    if (session) {
      return session.ownerId;
    }
  }

  // 2. Configured API token
  const configuredToken = process.env.LUMINA_API_AUTH_TOKEN?.trim();
  if (configuredToken && providedToken && safeTokenCompare(providedToken, configuredToken)) {
    return `tok_${createHash('sha256').update(providedToken).digest('hex').slice(0, 16)}`;
  }

  // 3. Local single-user demo fallback
  if (mode === 'local_demo') {
    if (!isLoopbackRequest(req)) throw new SecurityError(403, 'local_demo_loopback_only', 'Local demo requests must originate from loopback.');
    return 'local-single-user';
  }

  if (mode === 'disabled') {
    throw new SecurityError(403, 'public_deployment_disabled', 'Production access is disabled.');
  }

  throw new SecurityError(401, 'unauthorized', 'Authenticated identity is required.');
}

export function assertOwnerMatch(
  resourceOwnerId: string | undefined,
  callerOwnerId: string,
  resourceLabel = 'resource'
): void {
  if (!resourceOwnerId) {
    throw new SecurityError(403, 'missing_resource_owner', `${resourceLabel} has no valid ownership metadata`);
  }
  const effectiveResourceOwner = resourceOwnerId;
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
