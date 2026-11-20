import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OpenAICodexAIProvider,
  type OpenAICodexTransport
} from '../src/orchestration/openai-codex-provider';
import {
  issueExternalApiConsentV3,
  SupervisorRequestV3Schema,
  verifyExternalApiConsentV3
} from '@luminalearn/scene-schema';

test('Codex provider uses Responses structured output and validates the result without a live call', async () => {
  const payloads: unknown[] = [];
  const transport: OpenAICodexTransport = async (payload) => {
    payloads.push(payload);
    return {
      id: 'resp_fixture',
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{"title":"Cầu vồng","scenes":6}' }] }],
      usage: { input_tokens: 120, output_tokens: 40 }
    };
  };
  const provider = new OpenAICodexAIProvider({
    transport,
    model: 'codex-fixture-model',
    maxRetries: 0,
    maxRequests: 1
  });

  const result = await provider.generateStructured({
    purpose: 'curriculum_planning',
    systemPrompt: 'Create a safe lesson plan.',
    userPrompt: 'Registered topic: physics.optics.rainbow',
    jsonSchema: {
      type: 'object',
      properties: { title: { type: 'string' }, scenes: { type: 'number' } },
      required: ['title', 'scenes'],
      additionalProperties: false
    },
    validator(value) {
      const parsed = value as { title?: unknown; scenes?: unknown };
      assert.equal(typeof parsed.title, 'string');
      assert.equal(typeof parsed.scenes, 'number');
      return { title: parsed.title as string, scenes: parsed.scenes as number };
    }
  });

  assert.deepEqual(result.data, { title: 'Cầu vồng', scenes: 6 });
  assert.equal(result.model, 'codex-fixture-model');
  assert.deepEqual(result.usage, { promptTokens: 120, candidatesTokens: 40 });
  assert.equal(payloads.length, 1);
  assert.match(JSON.stringify(payloads[0]), /"type":"json_schema"/);
  assert.match(JSON.stringify(payloads[0]), /"store":false/);
  assert.doesNotMatch(JSON.stringify(payloads[0]), /OPENAI_API_KEY/);
});

test('Codex provider fails closed when the API key is absent', () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    assert.throws(() => new OpenAICodexAIProvider(), /openai_api_key_missing/);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test('Codex provider counts failed requests against its per-job budget', async () => {
  const transport: OpenAICodexTransport = async () => {
    throw Object.assign(new Error('temporary upstream failure'), { status: 503 });
  };
  const provider = new OpenAICodexAIProvider({
    transport,
    maxRetries: 1,
    maxRequests: 1,
    retryBaseDelayMs: 1
  });

  await assert.rejects(
    () => provider.generateStructured({
      purpose: 'quality_review',
      userPrompt: 'Review fixture',
      validator: (value) => value
    }),
    /openai_codex_budget_exceeded/
  );
});

test('Codex provider never leaks an API key through HTTP errors', async () => {
  const secret = 'sk-test-secret-value-123456789';
  const transport: OpenAICodexTransport = async () => {
    throw Object.assign(new Error(`upstream rejected ${secret}`), { status: 401 });
  };
  const provider = new OpenAICodexAIProvider({
    apiKey: secret,
    transport,
    maxRetries: 0
  });

  await assert.rejects(
    () => provider.generateStructured({
      purpose: 'quality_review',
      userPrompt: 'Review fixture',
      validator: (value) => value
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /sk-test-secret/);
      assert.match(error.message, /REDACTED_OPENAI_KEY/);
      return true;
    }
  );
});

test('Codex live planning uses provider-bound signed consent', () => {
  const signingSecret = 'codex-provider-consent-fixture-secret';
  const consent = issueExternalApiConsentV3({
    ownerId: 'teacher_fixture',
    provider: 'openai_codex',
    operation: 'planning',
    requestId: 'request_codex_fixture',
    signingSecret,
    isLiveOperation: true
  });

  assert.equal(verifyExternalApiConsentV3({
    consent,
    ownerId: 'teacher_fixture',
    expectedProvider: 'openai_codex',
    expectedOperation: 'planning',
    signingSecret,
    isLiveOperation: true
  }).valid, true);
  assert.equal(verifyExternalApiConsentV3({
    consent,
    ownerId: 'teacher_fixture',
    expectedProvider: 'gemini',
    expectedOperation: 'planning',
    signingSecret,
    isLiveOperation: true
  }).code, 'consent_provider_mismatch');
});

test('V3 supervisor request selects Codex independently from narration provider', () => {
  const request = SupervisorRequestV3Schema.parse({
    requestId: 'request_codex_mode',
    topic: 'Sự hình thành cầu vồng',
    domain: 'physics',
    generationMode: 'live',
    agentProvider: 'codex',
    narrationMode: 'gemini_tts'
  });

  assert.equal(request.agentProvider, 'codex');
  assert.equal(request.narrationMode, 'gemini_tts');
});
