# Codex runtime agent

LuminaLearn can use an OpenAI Codex model as the server-side curriculum-planning
provider. This mode is opt-in. Gemini remains the default content provider and
the configured TTS provider remains independent.

## Configuration

Set these values in the server environment only:

```dotenv
OPENAI_API_KEY=...
OPENAI_CODEX_MODEL=gpt-5.3-codex
OPENAI_CODEX_MAX_REQUESTS_PER_JOB=2
OPENAI_CODEX_TIMEOUT_MS=60000
OPENAI_CODEX_MAX_OUTPUT_TOKENS=12000
```

Do not prefix the key with `NEXT_PUBLIC_`. The browser sends only the selected
provider identifier; API credentials never leave the server.

In **Agent Studio**, choose **Codex Live Agent — dùng OpenAI API**. The request
creates a signed consent record bound to `openai_codex`, the owner and the
planning request. A Gemini consent record cannot authorize a Codex call.

## Trust boundary

The Codex runtime receives a bounded topic brief and a JSON schema. It has no
shell, filesystem, MCP write tool, render, publication or artifact-approval
capability. Its output is an untrusted candidate and must pass:

1. Zod structured-output validation.
2. Deterministic topic and capability checks.
3. SymPy/scientific verification where applicable.
4. Cross-agent consistency validation.
5. Teacher review and approval.
6. Artifact version and content-hash authorization before rendering.

The request uses the OpenAI Responses API with `store: false`, bounded timeout,
bounded retries and a per-job request budget. Failed requests consume budget.

## Offline verification

```powershell
pnpm --filter @luminalearn/agent exec node --test --import tsx test/openai-codex-provider.test.ts
pnpm --filter @luminalearn/agent typecheck
pnpm --filter @luminalearn/web typecheck
```

These commands use a fake transport and do not call OpenAI. There is no automatic
live smoke test; a real API request must be explicitly initiated from Agent
Studio after selecting Codex Live.
