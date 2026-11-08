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
});
