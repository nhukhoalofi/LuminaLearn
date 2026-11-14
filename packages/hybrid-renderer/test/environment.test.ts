import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadRepositoryEnvironment } from '../src/environment';

test('loads repository-root .env without overriding process configuration', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lumina-env-'));
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_TTS_MODEL;
  try {
    delete process.env.GEMINI_API_KEY;
    process.env.GEMINI_TTS_MODEL = 'process-wins';
    await writeFile(join(root, '.env'), 'GEMINI_API_KEY=test-only-key\nGEMINI_TTS_MODEL=file-model\n', 'utf8');
    assert.equal(loadRepositoryEnvironment(root).loaded, true);
    assert.equal(process.env.GEMINI_API_KEY, 'test-only-key');
    assert.equal(process.env.GEMINI_TTS_MODEL, 'process-wins');
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_TTS_MODEL; else process.env.GEMINI_TTS_MODEL = previousModel;
    await rm(root, { recursive: true, force: true });
  }
});
