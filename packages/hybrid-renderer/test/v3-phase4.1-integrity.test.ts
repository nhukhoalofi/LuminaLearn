import test from 'node:test';
import assert from 'node:assert/strict';
import { TopicRouter } from '@luminalearn/agent';
import { runHybridPipelineV2 } from '../src/pipeline-v2.js';
import { runRenderPipelineV3 } from '../src/pipeline-v3.js';
import { parseRationalFps } from '../src/fps-parser.js';
import { LessonDraftManagerV3 } from '@luminalearn/agent';

test('Checkpoint G & Checkpoint D/E — V2 Dispatch & V3 Audio Security', async (t) => {
  await t.test('1. TopicRouter rejects algebra.identities.seven in V2 and directs users to V3 Studio', () => {
    const router = new TopicRouter();
    const result = router.route({
      requestId: 'req_algebra_v2',
      inputMode: 'topic_prompt',
      topic: '7 hằng đẳng thức đáng nhớ',
      audience: 'Học sinh lớp 8',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16',
      sourceDocumentIds: []
    });

    assert.equal(result.isSupported, false);
    assert.equal(result.v3Only, true);
    assert.match(result.unsupportedReason!, /v2_unsupported_algebra_topic/);
    assert.match(result.unsupportedReason!, /LuminaLearn V3 Multi-Topic Studio/);
  });

  await t.test('2. Pipeline V2 rejects algebra topic requests fail-closed', async () => {
    await assert.rejects(
      () => runHybridPipelineV2({
        requestId: 'req_v2_direct_algebra',
        inputMode: 'topic_prompt',
        topic: '7 hằng đẳng thức đáng nhớ',
        audience: 'Học sinh',
        language: 'vi',
        targetDurationSeconds: 40,
        renderMode: 'mock',
        narrationMode: 'none',
        aspectRatio: '9:16',
        sourceDocumentIds: []
      }, {
        jobId: `job-v2-algebra-rejected-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        onStage: () => undefined
      }),
      /v2_unsupported_algebra_topic/
    );
  });

  await t.test('3. Pipeline V3 rejects provided audio paths with directory traversal', async () => {
    const manager = new LessonDraftManagerV3();
    let draft = await manager.create({
      requestId: 'req_traversal_test',
      topic: 'Mạng Neural Perceptron',
      domain: 'artificial_intelligence',
      generationMode: 'mock',
      targetDurationSeconds: 30,
      narrationMode: 'provided_audio',
      subtitlesEnabled: true
    }, 'teacher_sec');
    draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_sec', draft.version);
    draft = await manager.approve(draft.draftId, 'teacher_sec', draft.version);
    const artifact = draft.approvedArtifact!;

    await assert.rejects(
      () => runRenderPipelineV3(artifact, {
        jobId: 'job_sec_traversal',
        authorizeArtifact: () => true,
        providedAudioPath: '../../../etc/passwd'
      }),
      /v3_audio_path_traversal/
    );
  });

  await t.test('4. Safe rational FPS parser handles various FPS formats without eval', () => {
    assert.equal(parseRationalFps('24/1'), 24);
    assert.equal(parseRationalFps('30/1'), 30);
    assert.equal(parseRationalFps('25'), 25);
    assert.ok(Math.abs(parseRationalFps('30000/1001') - 29.97) < 0.01);
    assert.throws(() => parseRationalFps('24/0'), /invalid_fps_division/);
    assert.throws(() => parseRationalFps('process.exit(1)'), /invalid_fps_format/);
  });
});
