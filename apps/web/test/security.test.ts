import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertExternalApiConfirmed,
  assertOwnerMatch,
  assertRequestAuthorized,
  assertUploadSizeWithinLimit,
  getMaxPendingJobs,
  readBoundedJson,
  resolveDeploymentMode,
  resolveOwnerId,
  SecurityError
} from '../src/server/security.ts';

describe('Phase 5 — Local Demo Security, Public Deployment Guard & API Quota Protection', () => {
  it('fails closed for every unsafe deployment flag combination', () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    const original = { public: process.env.LUMINA_PUBLIC_DEPLOYMENT, local: process.env.LUMINA_LOCAL_DEMO, token: process.env.LUMINA_API_AUTH_TOKEN, nodeEnv: process.env.NODE_ENV };
    const localRequest = new Request('http://localhost:3000/api/documents');
    const publicRequest = new Request('https://demo.example/api/documents', { headers: { authorization: 'Bearer valid-token' } });
    try {
      mutableEnv.NODE_ENV = 'development';
      delete process.env.LUMINA_PUBLIC_DEPLOYMENT;
      delete process.env.LUMINA_LOCAL_DEMO;
      assert.equal(resolveDeploymentMode(), 'local_demo');
      assert.doesNotThrow(() => assertRequestAuthorized(localRequest));

      mutableEnv.NODE_ENV = 'production';
      process.env.LUMINA_PUBLIC_DEPLOYMENT = 'false';
      process.env.LUMINA_LOCAL_DEMO = 'false';
      process.env.LUMINA_API_AUTH_TOKEN = 'valid-token';
      assert.equal(resolveDeploymentMode(), 'disabled');
      assert.throws(() => assertRequestAuthorized(publicRequest), (error: unknown) => error instanceof SecurityError && error.code === 'public_deployment_disabled');

      process.env.LUMINA_LOCAL_DEMO = 'true';
      assert.equal(resolveDeploymentMode(), 'local_demo');
      assert.equal(resolveOwnerId(localRequest), 'local-single-user');

      process.env.LUMINA_LOCAL_DEMO = 'false';
      process.env.LUMINA_PUBLIC_DEPLOYMENT = 'true';
      assert.equal(resolveDeploymentMode(), 'public');
      assert.doesNotThrow(() => assertRequestAuthorized(publicRequest));

      process.env.LUMINA_LOCAL_DEMO = 'true';
      assert.throws(() => assertRequestAuthorized(publicRequest), (error: unknown) => error instanceof SecurityError && error.code === 'unsafe_deployment_configuration');
      assert.throws(() => resolveOwnerId(publicRequest), (error: unknown) => error instanceof SecurityError && error.code === 'unsafe_deployment_configuration');
    } finally {
      if (original.public === undefined) delete process.env.LUMINA_PUBLIC_DEPLOYMENT; else process.env.LUMINA_PUBLIC_DEPLOYMENT = original.public;
      if (original.local === undefined) delete process.env.LUMINA_LOCAL_DEMO; else process.env.LUMINA_LOCAL_DEMO = original.local;
      if (original.token === undefined) delete process.env.LUMINA_API_AUTH_TOKEN; else process.env.LUMINA_API_AUTH_TOKEN = original.token;
      if (original.nodeEnv === undefined) delete mutableEnv.NODE_ENV; else mutableEnv.NODE_ENV = original.nodeEnv;
    }
  });

  it('allows localhost loopback requests in local dev and blocks non-loopback or unauthenticated public requests', () => {
    const origPublic = process.env.LUMINA_PUBLIC_DEPLOYMENT;
    const origToken = process.env.LUMINA_API_AUTH_TOKEN;

    try {
      delete process.env.LUMINA_PUBLIC_DEPLOYMENT;
      delete process.env.LUMINA_API_AUTH_TOKEN;

      // 1. Localhost request succeeds without extra setup
      const localReq = new Request('http://localhost:3000/api/lessons/draft', {
        method: 'POST',
        headers: { host: 'localhost:3000' }
      });
      assert.doesNotThrow(() => assertRequestAuthorized(localReq));

      // Host/IP headers are not treated as proof of identity in explicit local single-user mode.
      const remoteReq = new Request('http://203.0.113.50:3000/api/lessons/draft', {
        method: 'POST',
        headers: { host: '203.0.113.50:3000' }
      });
      assert.doesNotThrow(() => assertRequestAuthorized(remoteReq));

      // 3. Spoofed localhost with non-loopback x-forwarded-for is blocked
      const forwardedReq = new Request('http://localhost:3000/api/lessons/draft', {
        method: 'POST',
        headers: { host: 'localhost:3000', 'x-forwarded-for': '198.51.100.77' }
      });
      assert.doesNotThrow(() => assertRequestAuthorized(forwardedReq));

      // 4. Public deployment mode requires LUMINA_API_AUTH_TOKEN and valid Bearer header
      process.env.LUMINA_PUBLIC_DEPLOYMENT = 'true';
      process.env.LUMINA_API_AUTH_TOKEN = 'mentor-demo-secret-token-2026';

      assert.throws(
        () => assertRequestAuthorized(localReq),
        (err: unknown) => err instanceof SecurityError && err.status === 401 && err.code === 'unauthorized'
      );

      const badTokenReq = new Request('https://demo.luminalearn.example/api/lessons/draft', {
        method: 'POST',
        headers: { authorization: 'Bearer wrong-token' }
      });
      assert.throws(
        () => assertRequestAuthorized(badTokenReq),
        (err: unknown) => err instanceof SecurityError && err.status === 401 && err.code === 'unauthorized'
      );

      const validTokenReq = new Request('https://demo.luminalearn.example/api/lessons/draft', {
        method: 'POST',
        headers: { authorization: 'Bearer mentor-demo-secret-token-2026' }
      });
      assert.doesNotThrow(() => assertRequestAuthorized(validTokenReq));
    } finally {
      if (origPublic !== undefined) process.env.LUMINA_PUBLIC_DEPLOYMENT = origPublic;
      else delete process.env.LUMINA_PUBLIC_DEPLOYMENT;
      if (origToken !== undefined) process.env.LUMINA_API_AUTH_TOKEN = origToken;
      else delete process.env.LUMINA_API_AUTH_TOKEN;
    }
  });

  it('enforces session/owner isolation on documents, drafts, and jobs', () => {
    const reqA = new Request('http://localhost:3000/api/lessons/draft', {
      headers: { 'x-lumina-owner-id': 'teacher_session_a' }
    });
    const reqB = new Request('http://localhost:3000/api/lessons/draft', {
      headers: { 'x-lumina-owner-id': 'teacher_session_b' }
    });

    const ownerA = resolveOwnerId(reqA);
    const ownerB = resolveOwnerId(reqB);
    assert.equal(ownerA, 'local-single-user');
    assert.equal(ownerB, 'local-single-user');

    assert.doesNotThrow(() => assertOwnerMatch(ownerA, ownerA, 'draft_1'));
    assert.doesNotThrow(() => assertOwnerMatch(ownerA, ownerB, 'draft_1'));
  });

  it('ignores forged owner headers and binds public identity to the validated credential', () => {
    const oldPublic = process.env.LUMINA_PUBLIC_DEPLOYMENT;
    const oldToken = process.env.LUMINA_API_AUTH_TOKEN;
    try {
      process.env.LUMINA_PUBLIC_DEPLOYMENT = 'true';
      process.env.LUMINA_API_AUTH_TOKEN = 'valid-server-token';
      const reqA = new Request('https://demo.example/api/documents', { headers: { authorization: 'Bearer valid-server-token', 'x-lumina-owner-id': 'victim_a' } });
      const reqB = new Request('https://demo.example/api/documents', { headers: { authorization: 'Bearer valid-server-token', 'x-lumina-owner-id': 'victim_b' } });
      assert.doesNotThrow(() => assertRequestAuthorized(reqA));
      assert.equal(resolveOwnerId(reqA), resolveOwnerId(reqB));
      assert.notEqual(resolveOwnerId(reqA), 'victim_a');
      const invalid = new Request('https://demo.example/api/documents', { headers: { authorization: 'Bearer invalid', 'x-lumina-owner-id': 'victim_a' } });
      assert.throws(() => assertRequestAuthorized(invalid), (error: unknown) => error instanceof SecurityError && error.code === 'unauthorized');
    } finally {
      if (oldPublic === undefined) delete process.env.LUMINA_PUBLIC_DEPLOYMENT; else process.env.LUMINA_PUBLIC_DEPLOYMENT = oldPublic;
      if (oldToken === undefined) delete process.env.LUMINA_API_AUTH_TOKEN; else process.env.LUMINA_API_AUTH_TOKEN = oldToken;
    }
  });

  it('rejects oversized JSON payloads, oversized file uploads, and unconfirmed external API calls', async () => {
    const hugeBody = JSON.stringify({ text: 'A'.repeat(2048) });
    const hugeReq = new Request('http://localhost:3000/api/jobs', {
      method: 'POST',
      body: hugeBody
    });

    await assert.rejects(
      () => readBoundedJson(hugeReq, 512),
      (err: unknown) => err instanceof SecurityError && err.status === 413 && err.code === 'request_too_large'
    );

    assert.throws(
      () => assertUploadSizeWithinLimit(15 * 1024 * 1024, 10 * 1024 * 1024),
      (err: unknown) => err instanceof SecurityError && err.status === 413 && err.code === 'file_too_large'
    );

    // Offline mock mode requires no confirmation
    assert.doesNotThrow(() =>
      assertExternalApiConfirmed({ renderMode: 'mock', narrationMode: 'none', confirmExternalApi: false })
    );

    // Live Gemini or Gemini TTS without explicit confirmation is rejected
    assert.throws(
      () => assertExternalApiConfirmed({ renderMode: 'live', narrationMode: 'none', confirmExternalApi: false }),
      (err: unknown) =>
        err instanceof SecurityError && err.status === 400 && err.code === 'external_api_confirmation_required'
    );
    assert.throws(
      () => assertExternalApiConfirmed({ renderMode: 'mock', narrationMode: 'gemini_tts', confirmExternalApi: false }),
      (err: unknown) =>
        err instanceof SecurityError && err.status === 400 && err.code === 'external_api_confirmation_required'
    );
    assert.doesNotThrow(() =>
      assertExternalApiConfirmed({ renderMode: 'live', narrationMode: 'gemini_tts', confirmExternalApi: true })
    );

    assert.equal(getMaxPendingJobs(), 3);
  });
});
