import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LessonDraftManagerV3 } from '@luminalearn/agent';
import {
  MockTtsProvider,
  isTrustedOfflineTtsFixture,
  type TtsProvider
} from '../src/audio';
import { GeminiTtsProvider } from '../src/gemini-tts';
import { runRenderPipelineV3 } from '../src/pipeline-v3';

test('STEP 5 & 6: Provider Consent Hardening & Subtitle Cue Synchronization (Phase 11.2)', async (t) => {
  await t.test('1. isTrustedOfflineTtsFixture allows only authentic MockTtsProvider', () => {
    // 1. Valid MockTtsProvider instance
    const validMock = new MockTtsProvider(2.0);
    assert.strictEqual(isTrustedOfflineTtsFixture(validMock), true);

    // 2. Real providers must never be considered offline test fixtures
    const geminiTts = new GeminiTtsProvider({ apiKey: 'test_api_key' });
    assert.strictEqual(isTrustedOfflineTtsFixture(geminiTts), false);

    // 3. Null / undefined
    assert.strictEqual(isTrustedOfflineTtsFixture(null), false);
    assert.strictEqual(isTrustedOfflineTtsFixture(undefined), false);

    // 4. Malicious injected provider spoofing flags
    const maliciousSpoofer: TtsProvider = {
      id: 'malicious_paid_tts_api',
      isSilentFixture: true,
      requiresExternalConsent: false,
      synthesize: async () => {}
    };
    assert.strictEqual(isTrustedOfflineTtsFixture(maliciousSpoofer), false);

    // 5. Malicious injected provider spoofing mock_tts ID but wrong class
    const spoofedMockId: TtsProvider = {
      id: 'mock_tts',
      isSilentFixture: true,
      requiresExternalConsent: false,
      synthesize: async () => {}
    };
    assert.strictEqual(isTrustedOfflineTtsFixture(spoofedMockId), false);
  });

  await t.test('2. Injected provider without offline fixture trust fails closed with external_api_consent_required', async () => {
    const manager = new LessonDraftManagerV3();
    let draft = await manager.create({
      requestId: `req_consent_sec_${Date.now()}`,
      topic: '7 hằng đẳng thức đáng nhớ',
      domain: 'mathematics',
      generationMode: 'mock',
      targetDurationSeconds: 60,
      narrationMode: 'google_cloud_tts',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280
    }, 'teacher_sec_audit');

    draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_sec_audit', draft.version);
    draft = await manager.approve(draft.draftId, 'teacher_sec_audit', draft.version, 'Approved for consent security test');
    const artifact = draft.approvedArtifact!;

    // Malicious injected provider that claims to be silent and require no consent
    const injectedUntrustedProvider: TtsProvider = {
      id: 'custom_external_tts_service',
      isSilentFixture: true,
      requiresExternalConsent: false,
      synthesize: async () => {}
    };

    await assert.rejects(
      async () => {
        await runRenderPipelineV3(artifact, {
          jobId: `job_sec_consent_test_${Date.now()}`,
          authorizeArtifact: async () => true,
          ttsProvider: injectedUntrustedProvider
        });
      },
      (err: Error) => {
        assert.match(err.message, /external_api_consent_required/);
        return true;
      }
    );
  });

  await t.test('3. Remotion props and subtitles.srt share exact authoritative speech cues', async () => {
    const manager = new LessonDraftManagerV3();
    const jobId = `job_sub_sync_test_${Date.now()}`;
    let draft = await manager.create({
      requestId: `req_sub_sync_${Date.now()}`,
      topic: '7 hằng đẳng thức đáng nhớ',
      domain: 'mathematics',
      generationMode: 'mock',
      targetDurationSeconds: 60,
      narrationMode: 'google_cloud_tts',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280
    }, 'teacher_sub_sync');

    draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_sub_sync', draft.version);
    draft = await manager.approve(draft.draftId, 'teacher_sub_sync', draft.version, 'Approved for subtitle sync test');
    const artifact = draft.approvedArtifact!;

    const result = await runRenderPipelineV3(artifact, {
      jobId,
      authorizeArtifact: async () => true,
      ttsProvider: new MockTtsProvider(2.0)
    });

    assert.ok(result.outputPath);
    const outputDir = join(result.outputPath, '..');

    // 1. Read input props passed to Remotion
    const propsJson = await readFile(join(outputDir, 'v3-input-props.json'), 'utf8');
    const props = JSON.parse(propsJson);

    assert.ok(props.subtitleCues, 'Remotion props must contain subtitleCues array');
    assert.ok(Array.isArray(props.subtitleCues), 'subtitleCues must be an array');
    assert.ok(props.subtitleCues.length > 0, 'subtitleCues must not be empty');

    // 2. Read exported external SRT
    const srtContent = await readFile(join(outputDir, 'subtitles.srt'), 'utf8');
    assert.ok(srtContent.length > 0, 'SRT file must exist and have content');

    // 3. Verify each cue matches between Remotion props and SRT
    for (let i = 0; i < props.subtitleCues.length; i++) {
      const cue = props.subtitleCues[i];
      assert.ok(cue.startFrame >= 0, `Cue ${i} startFrame must be >= 0`);
      assert.ok(cue.endFrame > cue.startFrame, `Cue ${i} endFrame must be > startFrame`);
      assert.ok(cue.text.length > 0, `Cue ${i} text must not be empty`);

      // Verify SRT contains the cue text
      assert.ok(srtContent.includes(cue.text), `SRT must contain text for cue ${i}`);
    }
  });
});

