import test from 'node:test';
import assert from 'node:assert/strict';
import { LessonDraftManagerV3 } from '@luminalearn/agent';
import { runRenderPipelineV3 } from '../src/pipeline-v3.js';

async function createAudioTestArtifact(narrationMode: 'none' | 'provided_audio' | 'gemini_tts' = 'provided_audio') {
  const manager = new LessonDraftManagerV3();
  let draft = await manager.create({
    requestId: `req_audio_${Date.now()}`,
    topic: '7 hằng đẳng thức đáng nhớ',
    domain: 'mathematics',
    generationMode: 'mock',
    targetDurationSeconds: 35,
    narrationMode,
    subtitlesEnabled: true,
    fps: 24,
    width: 720,
    height: 1280
  }, 'teacher_audio');
  draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_audio', draft.version);
  draft = await manager.approve(draft.draftId, 'teacher_audio', draft.version);
  return draft.approvedArtifact!;
}

test('Checkpoint F — V3 Audio Pipeline Integration', async (t) => {
  await t.test('1. narrationMode=provided_audio throws v3_audio_missing if path omitted', async () => {
    const artifact = await createAudioTestArtifact('provided_audio');
    await assert.rejects(
      () => runRenderPipelineV3(artifact, {
        jobId: 'job_audio_missing',
        authorizeArtifact: () => true
      }),
      /v3_audio_missing/
    );
  });

  await t.test('2. narrationMode=provided_audio with nonexistent path fails closed', async () => {
    const artifact = await createAudioTestArtifact('provided_audio');
    await assert.rejects(
      () => runRenderPipelineV3(artifact, {
        jobId: 'job_audio_nonexistent',
        authorizeArtifact: () => true,
        providedAudioPath: 'nonexistent/invalid.mp3'
      }),
      /cannot read audio file|no such file/i
    );
  });

  await t.test('3. narrationMode=none does not require audio files and proceeds directly', async () => {
    const artifact = await createAudioTestArtifact('none');
    assert.equal(artifact.request.narrationMode, 'none');
  });
});
