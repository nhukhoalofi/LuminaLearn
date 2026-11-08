import { GoogleGenAI } from '@google/genai';
import {
  classifyGeminiError,
  computeBackoffWithJitterMs,
  GeminiRequestBudget,
  redactSecrets,
  type LessonPlanV2,
  type NarrationPlanV2
} from '@luminalearn/scene-schema';

export type AIProviderMode = 'ai_generated_live' | 'deterministic_mock';

export interface AIStructuredRequest<T> {
  purpose: 'curriculum_planning' | 'narration_planning' | 'document_analysis' | 'quality_review';
  systemPrompt?: string;
  userPrompt: string;
  jsonSchema?: unknown;
  validator: (data: unknown) => T;
  requestBudget?: GeminiRequestBudget;
}

export interface AIProviderResult<T> {
  data: T;
  mode: AIProviderMode;
  model: string;
  attempts?: number;
  usage?: {
    promptTokens?: number;
    candidatesTokens?: number;
  };
}

export interface AIProvider {
  readonly isMock: boolean;
  generateStructured<T>(request: AIStructuredRequest<T>): Promise<AIProviderResult<T>>;
}

export interface GeminiRawTransportResponse {
  text?: string;
  usage?: {
    promptTokens?: number;
    candidatesTokens?: number;
  };
}

export type GeminiRawTransport = (
  fullPrompt: string,
  request: AIStructuredRequest<unknown>,
  model: string
) => Promise<GeminiRawTransportResponse>;

export interface LiveGeminiAIProviderOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  requestBudget?: GeminiRequestBudget;
  transport?: GeminiRawTransport;
  randomFn?: () => number;
}

export class LiveGeminiAIProvider implements AIProvider {
  public readonly isMock = false;
  private readonly apiKey: string;
  private readonly client?: GoogleGenAI;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly defaultBudget?: GeminiRequestBudget;
  private readonly transport?: GeminiRawTransport;
  private readonly randomFn: () => number;

  constructor(options: LiveGeminiAIProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey && !options.transport) {
      throw new Error('gemini_api_key_missing: GEMINI_API_KEY is required for LiveGeminiAIProvider. Live paid calls cannot be performed without valid credentials.');
    }
    this.apiKey = apiKey ?? '';
    this.model = options.model ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    this.maxRetries = options.maxRetries ?? 1;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 250;
    this.defaultBudget = options.requestBudget;
    this.transport = options.transport;
    this.randomFn = options.randomFn ?? Math.random;
    if (!this.transport) {
      this.client = new GoogleGenAI({
        apiKey: this.apiKey,
        httpOptions: { timeout: options.timeoutMs ?? 30_000 }
      });
    }
  }

  public async generateStructured<T>(request: AIStructuredRequest<T>): Promise<AIProviderResult<T>> {
    const budget = request.requestBudget ?? this.defaultBudget ?? new GeminiRequestBudget();
    const category = request.purpose === 'narration_planning' ? 'narration_planning' : 'curriculum_planning';
    const fullPrompt = request.systemPrompt
      ? `${request.systemPrompt}\n\nUSER REQUEST:\n${request.userPrompt}`
      : request.userPrompt;

    let attempts = 0;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const attemptId = budget.consume(category, this.model);
      attempts += 1;

      try {
        let responseText: string | undefined;
        let promptTokens: number | undefined;
        let candidatesTokens: number | undefined;

        if (this.transport) {
          const customResponse = await this.transport(fullPrompt, request as AIStructuredRequest<unknown>, this.model);
          responseText = customResponse.text;
          promptTokens = customResponse.usage?.promptTokens;
          candidatesTokens = customResponse.usage?.candidatesTokens;
        } else {
          const response = await this.client!.models.generateContent({
            model: this.model,
            contents: fullPrompt,
            config: {
              temperature: 0.2,
              responseMimeType: 'application/json',
              ...(request.jsonSchema ? { responseJsonSchema: request.jsonSchema } : {})
            }
          });
          responseText = response.text;
          promptTokens = response.usageMetadata?.promptTokenCount;
          candidatesTokens = response.usageMetadata?.candidatesTokenCount;
        }

        if (!responseText) {
          const emptyErr = new Error('gemini_empty_response: Gemini API returned an empty text response for structured request');
          budget.completeAttempt(attemptId, 'failed', 'gemini_empty_response');
          throw emptyErr;
        }

        let rawJson: unknown;
        try {
          rawJson = JSON.parse(responseText);
        } catch (parseErr) {
          const syntaxErr = new Error(
            `gemini_invalid_json: ${redactSecrets(parseErr instanceof Error ? parseErr.message : String(parseErr), this.apiKey)}`
          );
          budget.completeAttempt(attemptId, 'failed', 'gemini_invalid_json');
          throw syntaxErr;
        }

        let validated: T;
        try {
          validated = request.validator(rawJson);
        } catch (valErr) {
          const schemaErr = new Error(
            `gemini_schema_invalid: ${redactSecrets(valErr instanceof Error ? valErr.message : String(valErr), this.apiKey)}`
          );
          budget.completeAttempt(attemptId, 'failed', 'gemini_schema_invalid');
          throw schemaErr;
        }

        budget.completeAttempt(attemptId, 'succeeded');
        return {
          data: validated,
          mode: 'ai_generated_live',
          model: this.model,
          attempts,
          usage: {
            promptTokens,
            candidatesTokens
          }
        };
      } catch (error) {
        if (
          error instanceof Error &&
          /^(gemini_empty_response|gemini_invalid_json|gemini_schema_invalid|gemini_budget_exceeded)/.test(error.message)
        ) {
          // Schema / JSON errors are NOT retried inside LiveGeminiAIProvider to prevent nested retry amplification.
          throw error;
        }

        const classified = classifyGeminiError(error, 'gemini', this.apiKey);
        budget.completeAttempt(attemptId, 'failed', classified.code);
        lastError = classified.error;

        // Fail immediately on non-retryable errors (401, 403, 404, 429, timeout, etc.)
        if (!classified.retryable || attempt >= this.maxRetries || !budget.canConsume(category)) {
          throw classified.error;
        }

        const delayMs = computeBackoffWithJitterMs(
          attempt + 1,
          this.retryBaseDelayMs,
          classified.retryAfterMs,
          this.randomFn
        );
        await new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));
      }
    }

    throw lastError ?? new Error(`gemini_provider_failed: LiveGeminiAIProvider failed after ${attempts} attempt(s)`);
  }
}

export class MockAIProvider implements AIProvider {
  public readonly isMock = true;
  private readonly overrides: Map<string, unknown> = new Map();

  constructor(overrides?: Record<string, unknown>) {
    if (overrides) {
      for (const [k, v] of Object.entries(overrides)) {
        this.overrides.set(k, v);
      }
    }
  }

  public setOverride(purpose: string, data: unknown): void {
    this.overrides.set(purpose, data);
  }

  public async generateStructured<T>(request: AIStructuredRequest<T>): Promise<AIProviderResult<T>> {
    if (this.overrides.has(request.purpose)) {
      const raw = this.overrides.get(request.purpose);
      const validated = request.validator(raw);
      return {
        data: validated,
        mode: 'deterministic_mock',
        model: 'lumina-mock-agent-v2',
        attempts: 1
      };
    }

    // Default mock responses based on purpose
    if (request.purpose === 'curriculum_planning') {
      const defaultPlan: Partial<LessonPlanV2> = {
        schemaVersion: 'lesson-v2',
        lessonId: 'lesson_mock_default',
        topicId: 'calculus.derivative.intuition',
        title: 'Bản chất hình học của đạo hàm (Deterministic Mock)',
        learningObjectives: [
          'Hiểu tiếp tuyến là vị trí giới hạn của cát tuyến khi hai điểm tiến lại gần nhau',
          'Nắm được mối quan hệ giữa hệ số góc tiếp tuyến và tốc độ biến thiên tức thời'
        ],
        prerequisites: ['Đại số cơ bản', 'Đồ thị hàm số'],
        keyConcepts: ['Đường cong', 'Cát tuyến', 'Tiếp tuyến', 'Hệ số góc'],
        mathematicalClaims: [
          {
            id: 'claim_polynomial_deriv',
            statement: 'Đạo hàm của hàm f(x) = x^2 là f\'(x) = 2x',
            validatorKey: 'polynomial_derivative',
            expectedExpression: '2*x',
            verificationStatus: 'unverified'
          },
          {
            id: 'claim_secant_slope',
            statement: 'Hệ số góc cát tuyến qua (1, 1) và (1+h, (1+h)^2) là 2 + h',
            validatorKey: 'secant_slope',
            expectedExpression: '2 + h',
            verificationStatus: 'unverified'
          },
          {
            id: 'claim_limit_zero',
            statement: 'Giới hạn của hệ số góc cát tuyến khi h tiến về 0 là 2',
            validatorKey: 'limit_at_zero',
            expectedExpression: '2',
            verificationStatus: 'unverified'
          },
          {
            id: 'claim_tangent_slope',
            statement: 'Hệ số góc của tiếp tuyến tại điểm x = 1 bằng 2',
            validatorKey: 'value_at_point',
            expectedExpression: '2',
            verificationStatus: 'unverified'
          }
        ],
        sourceEvidence: [],
        pedagogicalSequence: [
          {
            stepNumber: 1,
            pedagogicalGoal: 'Gợi mở trực quan',
            intuitiveConcept: 'Làm thế nào để xác định độ nghiêng tại một điểm duy nhất?',
            targetDurationSeconds: 8
          },
          {
            stepNumber: 2,
            pedagogicalGoal: 'Mô phỏng chuyển động cát tuyến',
            intuitiveConcept: 'Cho Q dần tiến lại gần P trên parabol y = x^2.',
            formalFormula: 'm(h) = (f(1+h) - f(1))/h = 2 + h',
            targetDurationSeconds: 16
          },
          {
            stepNumber: 3,
            pedagogicalGoal: 'Triệt tiêu khoảng cách',
            intuitiveConcept: 'Khi h tiến về 0, cát tuyến trùng với tiếp tuyến.',
            formalFormula: 'lim_{h->0} (2+h) = 2',
            targetDurationSeconds: 10
          },
          {
            stepNumber: 4,
            pedagogicalGoal: 'Khái quát đạo hàm',
            intuitiveConcept: 'Đạo hàm f\'(1) = 2 chính là hệ số góc tiếp tuyến.',
            formalFormula: "f'(1) = 2",
            targetDurationSeconds: 6
          }
        ],
        summary: 'Đạo hàm tại một điểm là hệ số góc tiếp tuyến khi cát tuyến co lại thành tiếp tuyến.'
      };

      const validated = request.validator(defaultPlan);
      return {
        data: validated,
        mode: 'deterministic_mock',
        model: 'lumina-mock-agent-v2',
        attempts: 1
      };
    }

    if (request.purpose === 'narration_planning') {
      const defaultNarr: Partial<NarrationPlanV2> = {
        planId: 'narr_mock_default',
        storyboardId: 'sb_mock_default',
        language: 'vi',
        segments: [
          {
            segmentId: 'seg_1',
            sceneId: 'sc_intro',
            text: 'Chào các bạn, hôm nay chúng ta sẽ tìm hiểu bản chất trực quan của đạo hàm.',
            subtitleText: 'Chào các bạn, hôm nay chúng ta tìm hiểu bản chất trực quan của đạo hàm.',
            targetDurationSeconds: 8,
            pronunciationHints: []
          },
          {
            segmentId: 'seg_2',
            sceneId: 'sc_secant',
            text: 'Quan sát điểm quy tiến dần về điểm pê trên đồ thị parabol.',
            subtitleText: 'Quan sát điểm Q tiến dần về điểm P trên đồ thị parabol.',
            targetDurationSeconds: 16,
            pronunciationHints: [{ written: 'Q, P', spoken: 'quy, pê' }]
          },
          {
            segmentId: 'seg_3',
            sceneId: 'sc_summary',
            text: 'Đạo hàm tại một điểm chính là hệ số góc của đường tiếp tuyến.',
            subtitleText: 'Đạo hàm tại một điểm chính là hệ số góc tiếp tuyến.',
            targetDurationSeconds: 6,
            pronunciationHints: []
          }
        ],
        totalWords: 35,
        estimatedDurationSeconds: 30,
        mathematicalReview: {
          status: 'verified',
          verifiedClaimIds: ['claim_polynomial_deriv', 'claim_secant_slope']
        }
      };

      const validated = request.validator(defaultNarr);
      return {
        data: validated,
        mode: 'deterministic_mock',
        model: 'lumina-mock-agent-v2',
        attempts: 1
      };
    }

    // Fallback: validate empty object or throw
    const validated = request.validator({});
    return {
      data: validated,
      mode: 'deterministic_mock',
      model: 'lumina-mock-agent-v2',
      attempts: 1
    };
  }
}
