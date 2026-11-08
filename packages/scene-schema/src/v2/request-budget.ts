export type GeminiRequestCategory =
  | 'curriculum_planning'
  | 'narration_planning'
  | 'gemini_tts';

export interface GeminiBudgetAttemptRecord {
  attemptId: number;
  category: GeminiRequestCategory;
  categoryAttempt: number;
  timestamp: string;
  status: 'started' | 'succeeded' | 'failed';
  model?: string;
  errorCode?: string;
}

export interface GeminiRequestBudgetOptions {
  maxRequestsPerJob?: number;
  maxCurriculumRequests?: number;
  maxNarrationRequests?: number;
  maxTtsRequestsPerJob?: number;
  initialSummary?: GeminiRequestBudgetSummary;
  onChange?: (summary: GeminiRequestBudgetSummary) => void;
}

export interface GeminiRequestBudgetSummary {
  limits: {
    maxRequestsPerJob: number;
    maxCurriculumRequests: number;
    maxNarrationRequests: number;
    maxTtsRequestsPerJob: number;
  };
  counts: {
    curriculumPlanning: number;
    narrationPlanning: number;
    geminiTts: number;
    totalTextRequests: number;
    totalTtsRequests: number;
    totalAllRequests: number;
  };
  attempts: GeminiBudgetAttemptRecord[];
}

function parsePositiveIntEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export class GeminiRequestBudget {
  public readonly maxRequestsPerJob: number;
  public readonly maxCurriculumRequests: number;
  public readonly maxNarrationRequests: number;
  public readonly maxTtsRequestsPerJob: number;

  private curriculumCount = 0;
  private narrationCount = 0;
  private ttsCount = 0;
  private readonly attempts: GeminiBudgetAttemptRecord[] = [];
  private readonly onChange?: (summary: GeminiRequestBudgetSummary) => void;

  constructor(options: GeminiRequestBudgetOptions = {}) {
    const initial = options.initialSummary;
    this.maxRequestsPerJob =
      options.maxRequestsPerJob ??
      initial?.limits.maxRequestsPerJob ??
      parsePositiveIntEnv(process.env.GEMINI_MAX_REQUESTS_PER_JOB, 4);
    this.maxTtsRequestsPerJob =
      options.maxTtsRequestsPerJob ??
      initial?.limits.maxTtsRequestsPerJob ??
      parsePositiveIntEnv(process.env.GEMINI_TTS_MAX_REQUESTS_PER_JOB, 5);
    this.maxCurriculumRequests =
      options.maxCurriculumRequests ?? initial?.limits.maxCurriculumRequests ?? Math.min(2, this.maxRequestsPerJob);
    this.maxNarrationRequests =
      options.maxNarrationRequests ?? initial?.limits.maxNarrationRequests ?? Math.min(2, this.maxRequestsPerJob);
    this.onChange = options.onChange;
    if (initial) {
      this.curriculumCount = initial.counts.curriculumPlanning;
      this.narrationCount = initial.counts.narrationPlanning;
      this.ttsCount = initial.counts.geminiTts;
      this.attempts.push(...initial.attempts.map((attempt) => ({ ...attempt })));
    }
  }

  private notifyChange(): void {
    this.onChange?.(this.getSummary());
  }

  public canConsume(category: GeminiRequestCategory): boolean {
    if (category === 'gemini_tts') {
      return this.ttsCount < this.maxTtsRequestsPerJob;
    }
    const totalText = this.curriculumCount + this.narrationCount;
    if (totalText >= this.maxRequestsPerJob) {
      return false;
    }
    if (category === 'curriculum_planning') {
      return this.curriculumCount < this.maxCurriculumRequests;
    }
    return this.narrationCount < this.maxNarrationRequests;
  }

  public consume(category: GeminiRequestCategory, model?: string): number {
    if (category === 'gemini_tts') {
      if (this.ttsCount >= this.maxTtsRequestsPerJob) {
        throw new Error(
          `gemini_budget_exceeded: Gemini TTS request budget exhausted (${this.ttsCount}/${this.maxTtsRequestsPerJob} requests used in this job)`
        );
      }
      this.ttsCount += 1;
      const record: GeminiBudgetAttemptRecord = {
        attemptId: this.attempts.length + 1,
        category,
        categoryAttempt: this.ttsCount,
        timestamp: new Date().toISOString(),
        status: 'started',
        model
      };
      this.attempts.push(record);
      this.notifyChange();
      return record.attemptId;
    }

    const totalText = this.curriculumCount + this.narrationCount;
    if (totalText >= this.maxRequestsPerJob) {
      throw new Error(
        `gemini_budget_exceeded: Gemini request budget exhausted (${totalText}/${this.maxRequestsPerJob} requests used in this job)`
      );
    }

    if (category === 'curriculum_planning') {
      if (this.curriculumCount >= this.maxCurriculumRequests) {
        throw new Error(
          `gemini_budget_exceeded: Curriculum planning budget exhausted (${this.curriculumCount}/${this.maxCurriculumRequests} requests used; job total ${totalText}/${this.maxRequestsPerJob})`
        );
      }
      this.curriculumCount += 1;
      const record: GeminiBudgetAttemptRecord = {
        attemptId: this.attempts.length + 1,
        category,
        categoryAttempt: this.curriculumCount,
        timestamp: new Date().toISOString(),
        status: 'started',
        model
      };
      this.attempts.push(record);
      this.notifyChange();
      return record.attemptId;
    }

    if (this.narrationCount >= this.maxNarrationRequests) {
      throw new Error(
        `gemini_budget_exceeded: Narration planning budget exhausted (${this.narrationCount}/${this.maxNarrationRequests} requests used; job total ${totalText}/${this.maxRequestsPerJob})`
      );
    }
    this.narrationCount += 1;
    const record: GeminiBudgetAttemptRecord = {
      attemptId: this.attempts.length + 1,
      category,
      categoryAttempt: this.narrationCount,
      timestamp: new Date().toISOString(),
      status: 'started',
      model
    };
    this.attempts.push(record);
    this.notifyChange();
    return record.attemptId;
  }

  public completeAttempt(
    attemptId: number,
    status: 'succeeded' | 'failed',
    errorCode?: string
  ): void {
    const entry = this.attempts.find((item) => item.attemptId === attemptId);
    if (entry) {
      entry.status = status;
      if (errorCode) entry.errorCode = errorCode;
      this.notifyChange();
    }
  }

  public getSummary(): GeminiRequestBudgetSummary {
    return {
      limits: {
        maxRequestsPerJob: this.maxRequestsPerJob,
        maxCurriculumRequests: this.maxCurriculumRequests,
        maxNarrationRequests: this.maxNarrationRequests,
        maxTtsRequestsPerJob: this.maxTtsRequestsPerJob
      },
      counts: {
        curriculumPlanning: this.curriculumCount,
        narrationPlanning: this.narrationCount,
        geminiTts: this.ttsCount,
        totalTextRequests: this.curriculumCount + this.narrationCount,
        totalTtsRequests: this.ttsCount,
        totalAllRequests: this.curriculumCount + this.narrationCount + this.ttsCount
      },
      attempts: this.attempts.map((a) => ({ ...a }))
    };
  }
}

export interface ClassifiedGeminiError {
  code: string;
  message: string;
  status?: number;
  retryable: boolean;
  retryAfterMs?: number;
  error: Error;
}

export function redactSecrets(raw: string, apiKey?: string): string {
  let clean = raw;
  if (apiKey && apiKey.trim().length > 0) {
    clean = clean.replaceAll(apiKey, '[REDACTED]');
  }
  clean = clean.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_API_KEY]');
  return clean;
}

export function extractHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as {
    status?: unknown;
    code?: unknown;
    httpStatus?: unknown;
    cause?: unknown;
  };
  for (const val of [candidate.status, candidate.code, candidate.httpStatus]) {
    const num = Number(val);
    if (Number.isInteger(num) && num >= 100 && num <= 599) return num;
  }
  if (candidate.cause && candidate.cause !== error) {
    return extractHttpStatus(candidate.cause);
  }
  return undefined;
}

export function extractRetryAfterMs(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as {
    retryAfterMs?: unknown;
    retryAfter?: unknown;
    headers?: { get?: (name: string) => string | null } | Record<string, unknown>;
  };
  if (typeof candidate.retryAfterMs === 'number' && Number.isFinite(candidate.retryAfterMs) && candidate.retryAfterMs > 0) {
    return Math.min(60_000, Math.round(candidate.retryAfterMs));
  }
  if (typeof candidate.retryAfter === 'number' && Number.isFinite(candidate.retryAfter) && candidate.retryAfter > 0) {
    return Math.min(60_000, Math.round(candidate.retryAfter * 1000));
  }
  let headerVal: string | null | undefined;
  if (candidate.headers && typeof (candidate.headers as { get?: (name: string) => string | null }).get === 'function') {
    headerVal = (candidate.headers as { get: (name: string) => string | null }).get('retry-after');
  } else if (candidate.headers && typeof candidate.headers === 'object') {
    const record = candidate.headers as Record<string, unknown>;
    const raw = record['retry-after'] ?? record['Retry-After'];
    if (typeof raw === 'string' || typeof raw === 'number') headerVal = String(raw);
  }
  if (headerVal) {
    const seconds = Number(headerVal);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(60_000, Math.round(seconds * 1000));
    }
  }
  return undefined;
}

export function classifyGeminiError(
  error: unknown,
  scope: 'gemini' | 'tts',
  apiKey?: string
): ClassifiedGeminiError {
  const status = extractHttpStatus(error);
  const retryAfterMs = extractRetryAfterMs(error);
  const rawMessage = error instanceof Error ? error.message : String(error);
  const safeMessage = redactSecrets(rawMessage, apiKey);

  if (
    (error instanceof DOMException && error.name === 'AbortError') ||
    /abort|timed out|timeout/i.test(safeMessage) && status === undefined
  ) {
    const code = `${scope}_timeout`;
    const msg = `${code}: Request timed out (${safeMessage})`;
    return { code, message: msg, status: 408, retryable: false, retryAfterMs, error: new Error(msg) };
  }

  if (status === 401 || /api_key_invalid|invalid api key|unauthenticated/i.test(safeMessage)) {
    const code = `${scope}_authentication_failed`;
    const msg = `${code}: ${safeMessage}`;
    return { code, message: msg, status: 401, retryable: false, retryAfterMs, error: new Error(msg) };
  }

  if (status === 403 || /permission_denied|forbidden/i.test(safeMessage)) {
    const code = `${scope}_permission_denied`;
    const isAuth = scope === 'tts';
    const compatPrefix = isAuth ? 'tts_authentication_failed: ' : '';
    const msg = `${compatPrefix}${code}: ${safeMessage}`;
    return { code, message: msg, status: 403, retryable: false, retryAfterMs, error: new Error(msg) };
  }

  if (status === 404 || /not_found|model.*not.*found|tts_model_unavailable/i.test(safeMessage)) {
    const code = `${scope}_model_unavailable`;
    const msg = safeMessage.startsWith(code) ? safeMessage : `${code}: ${safeMessage}`;
    return { code, message: msg, status: 404, retryable: false, retryAfterMs, error: new Error(msg) };
  }

  if (status === 429 || /resource_exhausted|quota|rate limit/i.test(safeMessage)) {
    const code = `${scope}_quota_exceeded`;
    const retryNote = retryAfterMs ? ` (retry-after ${Math.ceil(retryAfterMs / 1000)}s)` : '';
    const msg = `${code}: Hết hạn mức Gemini API Free Tier${retryNote} — ${safeMessage}`;
    return { code, message: msg, status: 429, retryable: false, retryAfterMs, error: new Error(msg) };
  }

  const isTransientStatus = status !== undefined && (status === 408 || status >= 500);
  const isTransientNetwork =
    status === undefined &&
    /econnreset|econnrefused|socket|network|fetch failed|503|temporarily unavailable/i.test(safeMessage);

  if (isTransientStatus || isTransientNetwork) {
    const code = `${scope}_transient_failed`;
    const msg = `${code}: ${safeMessage}`;
    return { code, message: msg, status, retryable: true, retryAfterMs, error: new Error(msg) };
  }

  const code = `${scope}_provider_failed`;
  const msg = safeMessage.startsWith(code) ? safeMessage : `${code}: ${safeMessage}`;
  return { code, message: msg, status, retryable: false, retryAfterMs, error: new Error(msg) };
}

export function computeBackoffWithJitterMs(
  attempt: number,
  baseDelayMs: number,
  retryAfterMs?: number,
  randomFn: () => number = Math.random
): number {
  const exponential = baseDelayMs * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(randomFn() * Math.max(1, Math.round(baseDelayMs * 0.35)));
  const computed = exponential + jitter;
  return Math.min(30_000, Math.max(computed, retryAfterMs ?? 0));
}

