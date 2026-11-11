import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

test('V3 Teacher Studio carries explicit Gemini TTS selection and consent through generation and render actions', async () => {
  const source = await readFile(resolve(process.cwd(), 'src/components/V3TeacherStudio.tsx'), 'utf8');

  assert.match(source, /targetDurationSeconds:\s*targetSeconds, narrationMode, subtitlesEnabled/);
  assert.doesNotMatch(source, /targetDurationSeconds:\s*targetSeconds, narrationMode:\s*'none'/);
  assert.match(source, /Gemini TTS tiếng Việt — tạo audio thật/);
  assert.match(source, /confirmExternalApi:\s*narrationMode === 'gemini_tts' && confirmExternalApi/g);
  assert.match(source, /if \(nextMode === 'live'\)[\s\S]*setNarrationMode\('gemini_tts'\)/);
  assert.match(source, /option value="300s"/);
  assert.match(source, /generationMode:\s*requestedMode/);
  assert.match(source, /void generate\('mock'\)/);
});

test('TTS job resume reissues artifact-bound narration consent instead of retrying without authority', async () => {
  const route = await readFile(resolve(process.cwd(), 'src/app/api/jobs/[jobId]/resume/route.ts'), 'utf8');
  const store = await readFile(resolve(process.cwd(), 'src/server/job-store.ts'), 'utf8');

  assert.match(route, /issueExternalApiConsentV3/);
  assert.match(route, /expectedArtifactId|artifactId: artifactOverride\.artifactId/);
  assert.match(route, /operation:\s*'narration'/);
  assert.match(store, /authorizeV3Artifact: authorizeArtifact,\s*consentRecord/);
});
