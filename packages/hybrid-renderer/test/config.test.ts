import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvironmentConfig } from '../src/config';
import { LuminaError, toSafeUserFacingError } from '../src/error-taxonomy';

const repositoryRoot = resolve(fileURLToPath(import.meta.url), '../../../../');

describe('EnvironmentConfig & ErrorTaxonomy', () => {
  it('loads default environment configuration with valid paths', () => {
    const config = loadEnvironmentConfig(repositoryRoot);
    assert.ok(config.pythonExecutable.length > 0);
    assert.ok(config.remotionCliExecutable.length > 0);
    assert.ok(config.ffmpegExecutable.length > 0);
    assert.ok(config.ffprobeExecutable.length > 0);
    assert.equal(config.geminiModel, 'gemini-3.5-flash-lite');
    assert.equal(config.renderConcurrency, 1);
  });

  it('respects environment variable overrides', () => {
    const prevPython = process.env.PYTHON_EXECUTABLE;
    process.env.PYTHON_EXECUTABLE = '/custom/bin/python3';
    try {
      const config = loadEnvironmentConfig(repositoryRoot);
      assert.equal(config.pythonExecutable, '/custom/bin/python3');
    } finally {
      if (prevPython) process.env.PYTHON_EXECUTABLE = prevPython;
      else delete process.env.PYTHON_EXECUTABLE;
    }
  });

  it('converts LuminaError into safe user-facing response', () => {
    const error = new LuminaError('unsupported_topic', 'Chủ đề này chưa hỗ trợ', 400);
    const safe = toSafeUserFacingError(error);
    assert.equal(safe.code, 'unsupported_topic');
    assert.equal(safe.httpStatus, 400);
    assert.equal(safe.message, 'Chủ đề này chưa hỗ trợ');
  });

  it('maps known error strings to clean error codes without leaking internal stack traces', () => {
    const rawError = new Error('mathematical_verification_failed: SymPy derivative did not match');
    const safe = toSafeUserFacingError(rawError);
    assert.equal(safe.code, 'mathematical_verification_failed');
    assert.equal(safe.httpStatus, 422);
    assert.match(safe.message, /SymPy/);

    const unknownError = new Error('Unexpected crash at NullPointerException at internal/private/file.ts:99');
    const safeUnknown = toSafeUserFacingError(unknownError);
    assert.equal(safeUnknown.code, 'internal_error');
    assert.equal(safeUnknown.httpStatus, 500);
    assert.doesNotMatch(safeUnknown.message, /NullPointerException/);
  });
});

