import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertApprovalExternalApiConsent, readApprovalRequest } from '../src/server/approval-request.ts';
import { SecurityError } from '../src/server/security.ts';

describe('Approval API request validation', () => {
  it('rejects malformed JSON before approval processing', async () => {
    const request = new Request('http://localhost/api/lessons/draft_1/approve', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"note":'
    });
    await assert.rejects(
      () => readApprovalRequest(request),
      (error: unknown) => error instanceof SecurityError && error.status === 400 && error.code === 'invalid_json'
    );
  });

  it('explicitly supports an empty body and rejects invalid or unknown fields', async () => {
    assert.deepEqual(await readApprovalRequest(new Request('http://localhost/api/lessons/draft_1/approve', { method: 'POST' })), {});
    const invalid = new Request('http://localhost/api/lessons/draft_1/approve', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ renderMode: 'unsafe', approveAnyway: true })
    });
    await assert.rejects(
      () => readApprovalRequest(invalid),
      (error: unknown) => error instanceof SecurityError && error.status === 400 && error.code === 'invalid_approval_request'
    );
  });

  it('rejects an unconfirmed Gemini TTS switch before mutating the current configuration', () => {
    const current = { renderMode: 'mock' as const, narrationMode: 'none' as const };
    const snapshot = structuredClone(current);
    assert.throws(
      () => assertApprovalExternalApiConsent(current, { narrationMode: 'gemini_tts', expectedVersion: 3 }, false),
      (error: unknown) => error instanceof SecurityError && error.status === 400 && error.code === 'external_api_confirmation_required'
    );
    assert.deepEqual(current, snapshot);
  });

  it('requires expectedVersion when configuration updates are present', async () => {
    // Missing expectedVersion when renderMode is specified
    const missing = new Request('http://localhost/api/lessons/draft_1/approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ renderMode: 'mock' })
    });
    await assert.rejects(
      () => readApprovalRequest(missing),
      (error: unknown) => error instanceof SecurityError && error.status === 400 && error.code === 'missing_expected_version'
    );

    // Invalid non-positive or non-integer expectedVersion
    const invalidVer = new Request('http://localhost/api/lessons/draft_1/approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ renderMode: 'mock', expectedVersion: 0 })
    });
    await assert.rejects(
      () => readApprovalRequest(invalidVer),
      (error: unknown) => error instanceof SecurityError && error.status === 400 && error.code === 'invalid_approval_request'
    );

    // Valid expectedVersion with config updates succeeds
    const valid = new Request('http://localhost/api/lessons/draft_1/approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ renderMode: 'mock', expectedVersion: 2 })
    });
    const parsed = await readApprovalRequest(valid);
    assert.equal(parsed.renderMode, 'mock');
    assert.equal(parsed.expectedVersion, 2);
  });

  it('enforces TOCTOU consent guard against pre-existing draft external API configurations', () => {
    // Current draft has gemini_tts: unconfirmed empty approval request must fail closed
    const currentGemini = { renderMode: 'mock' as const, narrationMode: 'gemini_tts' as const };
    assert.throws(
      () => assertApprovalExternalApiConsent(currentGemini, {}, false),
      (error: unknown) => error instanceof SecurityError && error.status === 400 && error.code === 'external_api_confirmation_required'
    );

    // Current draft has live render: unconfirmed empty approval request must fail closed
    const currentLive = { renderMode: 'live' as const, narrationMode: 'none' as const };
    assert.throws(
      () => assertApprovalExternalApiConsent(currentLive, {}, false),
      (error: unknown) => error instanceof SecurityError && error.status === 400 && error.code === 'external_api_confirmation_required'
    );

    // Confirmed via header succeeds
    const effectiveHeader = assertApprovalExternalApiConsent(currentGemini, {}, true);
    assert.equal(effectiveHeader.narrationMode, 'gemini_tts');

    // Confirmed via body succeeds
    const effectiveBody = assertApprovalExternalApiConsent(currentGemini, { confirmExternalApi: true }, false);
    assert.equal(effectiveBody.narrationMode, 'gemini_tts');
  });
});
