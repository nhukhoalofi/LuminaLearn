import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyGeminiError } from '../src/v2/request-budget';

describe('Gemini request error classification', () => {
  it('treats an unusable HTTP client response as a retryable transient TTS failure', () => {
    const classified = classifyGeminiError(
      new TypeError('Unexpected HTTP client error: TypeError: unusable'),
      'tts'
    );

    assert.equal(classified.code, 'tts_transient_failed');
    assert.equal(classified.retryable, true);
  });
});
