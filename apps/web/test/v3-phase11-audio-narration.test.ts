import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { draftManagerV3 } from '../src/server/v3-services';
import { AuthStore } from '../src/server/auth-store';
import { POST as previewAudioHandler } from '../src/app/api/v3/lessons/[lessonId]/preview-audio/route';
import {
  runRenderPipelineV3,
  computeV3ContentHash,
  MockTtsProvider,
  probeAudio
} from '@luminalearn/hybrid-renderer';

const TEST_PASSWORD = 'CorrectHorseBatteryStaple123!';

test('Phase 11 — Vietnamese Narration, Audio Synchronization & Teacher Preview', async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), 'lumina-phase11-test-'));

  process.env.LUMINA_AUTH_TEST_MODE = 'true';
  process.env.LUMINA_AUTH_STORE_PATH = join(tempDir, 'auth-store.json');
  AuthStore.resetForTests();
  await AuthStore.configureUsersForTests([
    {
      ownerId: 'teacher_alpha',
      username: 'teacher_a',
      email: 'alpha@school.test',
      fullName: 'Teacher Alpha',
      subjectDomain: 'mathematics',
      password: TEST_PASSWORD
    },
    {
      ownerId: 'teacher_beta',
      username: 'teacher_b',
      email: 'beta@school.test',
      fullName: 'Teacher Beta',
      subjectDomain: 'artificial_intelligence',
      password: TEST_PASSWORD
    }
  ]);

  const sessionAlpha = await AuthStore.authenticate('teacher_a', TEST_PASSWORD);
  const sessionBeta = await AuthStore.authenticate('teacher_b', TEST_PASSWORD);
  assert.ok(sessionAlpha);
  assert.ok(sessionBeta);

  t.after(async () => {
    AuthStore.resetForTests();
    AuthStore.clearTestUsers();
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  });

  // Create a mathematics lesson draft for Teacher Alpha using v3 draftManager
  let alphaDraft = await draftManagerV3.create({
    requestId: `req_math_p11_${Date.now()}`,
    topic: '7 hằng đẳng thức đáng nhớ',
    domain: 'mathematics',
    generationMode: 'mock',
    targetDurationSeconds: 35,
    narrationMode: 'none',
    subtitlesEnabled: true,
    fps: 24,
    width: 720,
    height: 1280
  }, 'teacher_alpha');

  const sceneId = alphaDraft.lessonPlan.storyboard!.scenes[0].sceneId;

  await t.test('1. Preview Audio API requires valid loopback / authorization', async () => {
    const fakeReq = new Request(
      `http://evil.com/api/v3/lessons/${alphaDraft.draftId}/preview-audio`,
      {
        method: 'POST',
        headers: {
          host: 'evil.com'
          // No token on non-loopback host -> strictly rejected with local_demo_loopback_only
        },
        body: JSON.stringify({
          draftVersion: alphaDraft.version,
          sceneId
        })
      }
    );

    const res = await previewAudioHandler(fakeReq, {
      params: Promise.resolve({ lessonId: alphaDraft.draftId })
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error, 'local_demo_loopback_only');
  });

  await t.test('2. Enforces teacher owner isolation on audio preview', async () => {
    // Teacher Beta attempts to preview Teacher Alpha's draft
    const betaReq = new Request(
      `http://127.0.0.1:3000/api/v3/lessons/${alphaDraft.draftId}/preview-audio`,
      {
        method: 'POST',
        headers: {
          host: '127.0.0.1:3000',
          authorization: `Bearer ${sessionBeta!.token}`
        },
        body: JSON.stringify({
          draftVersion: alphaDraft.version,
          sceneId
        })
      }
    );

    const res = await previewAudioHandler(betaReq, {
      params: Promise.resolve({ lessonId: alphaDraft.draftId })
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error, 'forbidden_owner_mismatch');
  });

  await t.test('3. Rejects stale draft version with 409 Conflict', async () => {
    const staleReq = new Request(
      `http://127.0.0.1:3000/api/v3/lessons/${alphaDraft.draftId}/preview-audio`,
      {
        method: 'POST',
        headers: {
          host: '127.0.0.1:3000',
          authorization: `Bearer ${sessionAlpha!.token}`
        },
        body: JSON.stringify({
          draftVersion: 999, // stale version
          sceneId
        })
      }
    );

    const res = await previewAudioHandler(staleReq, {
      params: Promise.resolve({ lessonId: alphaDraft.draftId })
    });
    assert.strictEqual(res.status, 409);
    const data = await res.json();
    assert.strictEqual(data.error, 'stale_draft_version');
  });

  await t.test('4. Generates audio preview with Vietnamese formula normalization', async () => {
    const mathFormulaText = `Xét công thức (a + b)^2 = a^2 + 2ab + b^2 với bước nhảy 0.01 tại ${Date.now()}.`;
    const validReq = new Request(
      `http://127.0.0.1:3000/api/v3/lessons/${alphaDraft.draftId}/preview-audio`,
      {
        method: 'POST',
        headers: {
          host: '127.0.0.1:3000',
          authorization: `Bearer ${sessionAlpha!.token}`
        },
        body: JSON.stringify({
          draftVersion: alphaDraft.version,
          sceneId,
          customNarrationText: mathFormulaText
        })
      }
    );

    const res = await previewAudioHandler(validReq, {
      params: Promise.resolve({ lessonId: alphaDraft.draftId })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.normalizedText.includes('a cộng b tất cả bình phương'));
    assert.ok(data.normalizedText.includes('không phẩy không một'));
    assert.ok(data.audioDataUrl.startsWith('data:audio/mp3;base64,'));
    assert.ok(data.durationSeconds > 0);
    assert.strictEqual(data.cacheHit, false);

    // Second request with same text hits audio cache
    const cachedReq = new Request(
      `http://127.0.0.1:3000/api/v3/lessons/${alphaDraft.draftId}/preview-audio`,
      {
        method: 'POST',
        headers: {
          host: '127.0.0.1:3000',
          authorization: `Bearer ${sessionAlpha!.token}`
        },
        body: JSON.stringify({
          draftVersion: alphaDraft.version,
          sceneId,
          customNarrationText: mathFormulaText
        })
      }
    );
    const cachedRes = await previewAudioHandler(cachedReq, {
      params: Promise.resolve({ lessonId: alphaDraft.draftId })
    });
    assert.strictEqual(cachedRes.status, 200);
    const cachedData = await cachedRes.json();
    assert.strictEqual(cachedData.cacheHit, true);
  });

  await t.test('5. End-to-end V3 rendering with SceneAudioSynchronizer produces valid MP4 and SRT', async () => {
    // Approve draft for rendering
    alphaDraft = await draftManagerV3.confirmSemanticReview(alphaDraft.draftId, 'teacher_alpha', alphaDraft.version);
    alphaDraft = await draftManagerV3.approve(alphaDraft.draftId, 'teacher_alpha', alphaDraft.version, 'Approved Phase 11 render');

    const artifact = alphaDraft.approvedArtifact!;
    assert.ok(artifact);

    // Modify artifact to enable google_cloud_tts mode with MockTtsProvider and recompute valid content hash
    const { contentHash: _ignored, ...core } = {
      ...artifact,
      request: {
        ...artifact.request,
        narrationMode: 'google_cloud_tts' as const,
        subtitlesEnabled: true
      }
    };
    const validTestArtifact = {
      ...core,
      contentHash: computeV3ContentHash(core)
    };

    const jobId = `job_p11_render_${Date.now()}`;
    const result = await runRenderPipelineV3(validTestArtifact, {
      jobId,
      authorizeArtifact: async () => true,
      ttsProvider: new MockTtsProvider(2.0)
    });

    assert.ok(result.outputPath);

    // Verify audio stream in final MP4
    const audioProbe = await probeAudio(result.outputPath, 600);
    assert.ok(audioProbe.durationSeconds > 0);

    // Verify subtitles.srt generated alongside final.mp4
    const srtPath = join(process.cwd(), '../../outputs', jobId, 'subtitles.srt');
    const srtContent = await readFile(srtPath, 'utf8');
    assert.ok(srtContent.includes('-->'));
    assert.ok(srtContent.includes('1\n'));
  });
});
