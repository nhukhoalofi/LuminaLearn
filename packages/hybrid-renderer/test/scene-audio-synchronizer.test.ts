import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockTtsProvider, probeAudio } from '../src/audio';
import { AudioCacheManager } from '../src/audio-cache-manager';
import {
  SceneAudioSynchronizer,
  type SceneNarrationInput
} from '../src/scene-audio-synchronizer';
import { resolvePresentationStoryboardV3 } from '../src/pipeline-v3';

test('Scene-Level Narration & Audio Synchronizer (Phase 11)', async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), 'lumina-sync-test-'));
  const cacheDir = join(tempDir, 'cache');
  const cache = new AudioCacheManager({ cacheDir });
  const synchronizer = new SceneAudioSynchronizer(cache);

  const ttsProvider = new MockTtsProvider(2.0); // generates 2-second mock audio

  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  });

  const testScenes: SceneNarrationInput[] = [
    {
      id: 'scene_intro',
      durationSeconds: 4,
      narration: {
        vietnamese: 'Chào mừng các bạn đến với bảy hằng đẳng thức đáng nhớ.',
        subtitleVietnamese: 'Bảy hằng đẳng thức đáng nhớ'
      }
    },
    {
      id: 'scene_formula',
      durationSeconds: 3,
      narration: {
        vietnamese: 'Hằng đẳng thức thứ nhất: (a + b)^2 = a^2 + 2ab + b^2.',
        subtitleVietnamese: '(a + b)^2 = a^2 + 2ab + b^2'
      }
    },
    {
      id: 'scene_silent',
      durationSeconds: 2
      // No narration
    }
  ];

  await t.test('1. Synchronizes scenes, adjusts durations, and builds master audio', async () => {
    const outDir1 = join(tempDir, 'run1');
    const result1 = await synchronizer.synchronizeStoryboard(testScenes, {
      ttsProvider,
      audioCache: cache,
      voice: 'vi-VN-Neural2-A',
      outputDir: outDir1,
      ownerId: 'teacher_test',
      fps: 24,
      preRollSeconds: 0.5,
      postRollSeconds: 0.5
    });

    assert.ok(result1.masterAudioPath);
    assert.strictEqual(result1.sceneTimings.length, 3);

    // Verify first scene
    const s0 = result1.sceneTimings[0];
    assert.strictEqual(s0.sceneId, 'scene_intro');
    assert.strictEqual(s0.startFrame, 0);
    assert.strictEqual(s0.targetDurationSeconds, 4);
    assert.ok(s0.adjustedDurationSeconds >= 4);
    assert.strictEqual(s0.cacheHit, false); // First run: cache miss

    // Verify second scene timing continuity
    const s1 = result1.sceneTimings[1];
    assert.strictEqual(s1.sceneId, 'scene_formula');
    assert.strictEqual(s1.startFrame, s0.endFrame);
    assert.ok(s1.normalizedText.includes('a cộng b tất cả bình phương'));

    // Verify silent scene
    const s2 = result1.sceneTimings[2];
    assert.strictEqual(s2.sceneId, 'scene_silent');
    assert.strictEqual(s2.startFrame, s1.endFrame);
    assert.strictEqual(s2.audioDurationSeconds, 0);

    // Verify integer frame timeline: totalFrames equals last scene endFrame
    assert.strictEqual(result1.totalFrames, s2.endFrame);

    // Verify master audio probe
    const masterProbe = await probeAudio(result1.masterAudioPath, 1200);
    assert.strictEqual(masterProbe.codec, 'mp3');
    assert.ok(masterProbe.durationSeconds > 0);
    assert.ok(
      Math.abs(masterProbe.durationSeconds - result1.totalDurationSeconds) < 0.25,
      `Master audio duration (${masterProbe.durationSeconds}) should match totalDurationSeconds (${result1.totalDurationSeconds})`
    );

    // Verify SRT format
    assert.ok(result1.srtContent.includes('Bảy hằng đẳng thức đáng nhớ'));
    assert.ok(result1.srtContent.includes('-->'));
  });

  await t.test('2. Re-running with unchanged narration hits audio cache', async () => {
    const outDir2 = join(tempDir, 'run2');
    const result2 = await synchronizer.synchronizeStoryboard(testScenes, {
      ttsProvider,
      audioCache: cache,
      voice: 'vi-VN-Neural2-A',
      outputDir: outDir2,
      ownerId: 'teacher_test',
      fps: 24
    });

    const s0 = result2.sceneTimings[0];
    assert.strictEqual(s0.cacheHit, true, 'Second run must hit audio cache');
  });

  await t.test('3. Extends scene presentation duration when narration speech exceeds target', async () => {
    const longNarrationScene: SceneNarrationInput[] = [
      {
        id: 'scene_long_speech',
        durationSeconds: 1, // original target was 1 second
        narration: {
          vietnamese: 'Câu thuyết minh này rất dài và cần thời gian để phát âm đầy đủ.'
        }
      }
    ];

    // Mock provider with 4 seconds duration
    const slowTts = new MockTtsProvider(4.0);
    const outDir3 = join(tempDir, 'run3');
    const result3 = await synchronizer.synchronizeStoryboard(longNarrationScene, {
      ttsProvider: slowTts,
      audioCache: cache,
      voice: 'vi-VN-Neural2-B',
      outputDir: outDir3,
      preRollSeconds: 0.5,
      postRollSeconds: 0.5
    });

    const s = result3.sceneTimings[0];
    // Must be extended to at least 4.0 + 0.5 + 0.5 = 5.0 seconds
    assert.ok(
      s.adjustedDurationSeconds >= 5.0,
      `Scene duration should be extended to at least 5.0s, got ${s.adjustedDurationSeconds}`
    );
    assert.ok(s.durationFrames >= 120);
    const approvedSource = {
      storyboardId: 'storyboard_test', lessonId: 'lesson_test', totalDurationSeconds: 1,
      scenes: [{ sceneId: 'scene_long_speech', durationSeconds: 1 }]
    } as never;
    const resolved = resolvePresentationStoryboardV3(approvedSource, result3);
    assert.equal((approvedSource as { scenes: Array<{ durationSeconds: number }> }).scenes[0].durationSeconds, 1, 'approved source remains immutable');
    assert.equal(resolved.scenes[0].durationSeconds, s.durationFrames / 24);
    assert.equal(resolved.totalDurationSeconds, result3.totalFrames / 24);
  });

  await t.test('4. Caps post-speech silence for non-silent-fixture providers when target duration is over-inflated', async () => {
    const inflatedScene: SceneNarrationInput[] = [
      {
        id: 'scene_inflated_target',
        durationSeconds: 60, // inflated target duration (e.g. 300s / 5 scenes)
        narration: {
          vietnamese: 'Câu thuyết minh dài khoảng tám giây sẽ không bị chèn năm mươi giây im lặng.'
        }
      }
    ];

    const baseMock = new MockTtsProvider(8.0);
    const nonSilentFixtureProvider = {
      id: 'gemini_tts_test_fixture',
      voice: 'Kore',
      isSilentFixture: false,
      synthesize: (text: string, outputPath: string) =>
        baseMock.synthesize(text, outputPath)
    };

    const outDir4 = join(tempDir, 'run4');
    const result4 = await synchronizer.synchronizeStoryboard(inflatedScene, {
      ttsProvider: nonSilentFixtureProvider,
      audioCache: cache,
      outputDir: outDir4
    });

    const s = result4.sceneTimings[0];
    assert.ok(s.adjustedDurationSeconds >= 8.6, `Must include speech + bounded pre/post roll, got ${s.adjustedDurationSeconds}`);
    assert.ok(
      s.adjustedDurationSeconds <= 9.0,
      `Must NOT pad 50s of dead silence after 8s speech; got ${s.adjustedDurationSeconds}s`
    );
    const postSpeechGap = (s.endFrame - s.speechEndFrame) / result4.fps;
    assert.ok(postSpeechGap <= 0.65, `Post-speech gap must be <= 0.65s, got ${postSpeechGap}s`);
  });

  await t.test('5. Paces cache-miss provider requests without delaying cache hits', async () => {
    const starts: number[] = [];
    const baseMock = new MockTtsProvider(0.5);
    const pacedProvider = {
      id: 'gemini_tts_rate_limit_fixture',
      voice: 'Kore',
      isSilentFixture: false,
      async synthesize(text: string, outputPath: string) {
        starts.push(Date.now());
        await baseMock.synthesize(text, outputPath);
      }
    };
    const pacedScenes: SceneNarrationInput[] = [
      { id: 'paced_1', durationSeconds: 2, narration: { vietnamese: 'Nội dung nhịp một hoàn toàn riêng biệt.' } },
      { id: 'paced_2', durationSeconds: 2, narration: { vietnamese: 'Nội dung nhịp hai hoàn toàn riêng biệt.' } }
    ];
    const outDir5 = join(tempDir, 'run5');

    await synchronizer.synchronizeStoryboard(pacedScenes, {
      ttsProvider: pacedProvider,
      audioCache: cache,
      outputDir: outDir5,
      ownerId: 'teacher_rate_limit',
      minProviderRequestIntervalMs: 30
    });

    assert.equal(starts.length, 2);
    assert.ok(starts[1] - starts[0] >= 25, `Expected paced calls, got ${starts[1] - starts[0]}ms`);
  });
});

