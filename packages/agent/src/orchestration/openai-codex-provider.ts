import type {
  AIProvider,
  AIProviderResult,
  AIStructuredRequest
} from './ai-provider';

export const DEFAULT_OPENAI_CODEX_MODEL = 'gpt-5.3-codex';

interface OpenAIResponsesPayload {
  model: string;
  input: Array<{ role: 'system' | 'user'; content: string }>;
  text?: {
    format: {
      type: 'json_schema';
      name: string;
      strict: false;
      schema: unknown;
    };
  };
  store: false;
  max_output_tokens: number;
}

export interface OpenAICodexRawResponse {
  id?: string;
  status?: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string; refusal?: string }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export type OpenAICodexTransport = (
  payload: OpenAIResponsesPayload,
  signal: AbortSignal
) => Promise<OpenAICodexRawResponse>;

export interface OpenAICodexAIProviderOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  maxRequests?: number;
  retryBaseDelayMs?: number;
  maxOutputTokens?: number;
  transport?: OpenAICodexTransport;
}

function extractOutputText(response: OpenAICodexRawResponse): string | undefined {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text;
  }
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'refusal' && content.refusal) {
        throw new Error('openai_codex_refused: Codex refused the structured planning request');
      }
      if (content.type === 'output_text' && content.text?.trim()) {
        return content.text;
      }
    }
  }
  return undefined;
}

function safeErrorMessage(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value);
  return message
    .replace(/sk-[a-zA-Z0-9_-]{8,}/g, '[REDACTED_OPENAI_KEY]')
    .slice(0, 800);
}

function statusFromError(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status;
  return typeof status === 'number' ? status : undefined;
}

export class OpenAICodexAIProvider implements AIProvider {
  public readonly isMock = false;
  public readonly providerId = 'openai_codex' as const;

  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly maxRequests: number;
  private readonly retryBaseDelayMs: number;
  private readonly maxOutputTokens: number;
  private readonly transport: OpenAICodexTransport;
  private requestCount = 0;

  constructor(options: OpenAICodexAIProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    if (!this.apiKey && !options.transport) {
      throw new Error('openai_api_key_missing: OPENAI_API_KEY is required for Codex live agents');
    }
    this.model = options.model ?? process.env.OPENAI_CODEX_MODEL ?? DEFAULT_OPENAI_CODEX_MODEL;
    this.timeoutMs = options.timeoutMs ?? Number(process.env.OPENAI_CODEX_TIMEOUT_MS || '60000');
    this.maxRetries = options.maxRetries ?? 1;
    this.maxRequests = options.maxRequests ?? Number(process.env.OPENAI_CODEX_MAX_REQUESTS_PER_JOB || '2');
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 750;
    this.maxOutputTokens = options.maxOutputTokens ?? Number(process.env.OPENAI_CODEX_MAX_OUTPUT_TOKENS || '12000');
    this.transport = options.transport ?? this.fetchResponses.bind(this);
  }

  public async generateStructured<T>(request: AIStructuredRequest<T>): Promise<AIProviderResult<T>> {
    const payload: OpenAIResponsesPayload = {
      model: this.model,
      input: [
        {
          role: 'system',
          content: `${request.systemPrompt ?? 'You are a bounded LuminaLearn educational planning agent.'}\nNever claim formal verification. Never request tools, shell access, secrets, or filesystem access.`
        },
        { role: 'user', content: request.userPrompt }
      ],
      ...(request.jsonSchema ? {
        text: {
          format: {
            type: 'json_schema' as const,
            name: `luminalearn_${request.purpose}`,
            strict: false as const,
            schema: request.jsonSchema
          }
        }
      } : {}),
      store: false,
      max_output_tokens: this.maxOutputTokens
    };

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      if (this.requestCount >= this.maxRequests) {
        throw new Error(`openai_codex_budget_exceeded: Maximum ${this.maxRequests} request(s) per job`);
      }
      this.requestCount += 1;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.transport(payload, controller.signal);
        if (response.status && response.status !== 'completed') {
          throw new Error(`openai_codex_incomplete: Responses API status was '${response.status}'`);
        }
        const text = extractOutputText(response);
        if (!text) {
          throw new Error('openai_codex_empty_response: Responses API returned no output text');
        }
        let raw: unknown;
        try {
          raw = JSON.parse(text);
        } catch (error) {
          throw new Error(`openai_codex_invalid_json: ${safeErrorMessage(error)}`);
        }
        let data: T;
        try {
          data = request.validator(raw);
        } catch (error) {
          throw new Error(`openai_codex_schema_invalid: ${safeErrorMessage(error)}`);
        }
        return {
          data,
          mode: 'ai_generated_live',
          model: this.model,
          attempts: attempt + 1,
          usage: {
            promptTokens: response.usage?.input_tokens,
            candidatesTokens: response.usage?.output_tokens
          }
        };
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        lastError = normalized.name === 'AbortError'
          ? new Error(`openai_codex_timeout: Request exceeded ${this.timeoutMs}ms`)
          : new Error(safeErrorMessage(normalized));
        const status = statusFromError(error);
        const retryable = normalized.name === 'AbortError' || status === 408 || status === 409 || status === 429 || (status !== undefined && status >= 500);
        const deterministicFailure = /openai_codex_(invalid_json|schema_invalid|refused|empty_response|incomplete)/.test(lastError.message);
        if (attempt >= this.maxRetries || deterministicFailure || !retryable) {
          throw lastError;
        }
        await new Promise((resolvePromise) => setTimeout(resolvePromise, this.retryBaseDelayMs * 2 ** attempt));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError ?? new Error('openai_codex_provider_failed');
  }

  private async fetchResponses(payload: OpenAIResponsesPayload, signal: AbortSignal): Promise<OpenAICodexRawResponse> {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload),
      signal
    });
    const raw = await response.json().catch(() => ({})) as OpenAICodexRawResponse & {
      error?: { message?: string; code?: string };
    };
    if (!response.ok) {
      const error = new Error(`openai_codex_http_${response.status}: ${safeErrorMessage(raw.error?.message ?? raw.error?.code ?? 'Request failed')}`) as Error & { status: number };
      error.status = response.status;
      throw error;
    }
    return raw;
  }
}
