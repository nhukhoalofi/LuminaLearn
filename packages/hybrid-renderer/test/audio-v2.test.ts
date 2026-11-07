import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MockTtsProvider,
  synthesizeNarrationV2,
  type TtsProvider
} from '../src/audio';
import type { NarrationPlanV2, StoryboardV2 } from '@luminalearn/scene-schema';

test('Milestone 6: V2 Audio / TTS Pipeline', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lumina-v2-audio-'));
  const jobDirectory = join(root, 'job');
  const stagedDirectory = join(root, 'staged');
  mkdirSync(jobDirectory);
  mkdirSync(stagedDirectory);

  const storyboard: StoryboardV2 = {
    storyboardId: 'sb_test',
    lessonId: 'lesson_test',
    topicId: 'calculus.derivative.intuition',
    scenes: [
      {
        sceneId: 'sc_intro',
        templateId: 'hook',
        sceneType: 'intro',
        durationFrames: 192, // 8s @ 24fps
        parameters: {},
        layout: { aspectRatio: '9:16', safeAreaPadding: 32 },
        mathematicalBinding: { boundClaimIds: [], latexFormulas: [] },
        sourceReferenceIds: []
      },
      {
        sceneId: 'sc_secant',
        templateId: 'secant_to_tangent',
        sceneType: 'animation',
        durationFrames: 240, // 10s @ 24fps
        parameters: {},
        layout: { aspectRatio: '9:16', safeAreaPadding: 32 },
        mathematicalBinding: { boundClaimIds: [], latexFormulas: [] },
        sourceReferenceIds: []
      }
    ],
    visualTemplateIds: ['hook', 'secant_to_tangent'],
    mathematicalData: {},
    narrationObjectives: ['Mở đầu', 'Cát tuyến'],
    estimatedDurationFrames: 432,
    sourceReferences: []
  };

  const narrationPlan: NarrationPlanV2 = {
    planId: 'narr_plan_test',
    storyboardId: 'sb_test',
    language: 'vi',
    totalWords: 20,
    estimatedDurationSeconds: 18,
    mathematicalReview: {
      status: 'verified',
      verifiedClaimIds: []
    },
    segments: [
      {
        segmentId: 'seg_intro',
        sceneId: 'sc_intro',
        text: 'Chào các bạn, hôm nay chúng ta cùng khám phá trực quan đạo hàm.',
        subtitleText: 'Khám phá trực quan đạo hàm.',
        targetDurationSeconds: 6,
        pronunciationHints: []
      },
      {
        segmentId: 'seg_secant',
        sceneId: 'sc_secant',
        text: 'Quan sát điểm Q tiến lại gần điểm P trên đồ thị parabol.',
        subtitleText: 'Q tiến gần P trên đồ thị.',
        targetDurationSeconds: 7,
        pronunciationHints: []
      }
    ]
  };

  await t.test('synthesizes multi-scene narration assets with sequenced startFrame and valid mp3', async () => {
    const mockProvider = new MockTtsProvider(2); // 2 seconds per segment
    const assets = await synthesizeNarrationV2({
      provider: mockProvider,
      narrationPlan,
      storyboard,
      jobId: 'job_test_audio_v2',
      jobDirectory,
      stagedDirectory,
      fps: 24
    });

    assert.equal(assets.length, 2);
    assert.equal(assets[0].id, 'audio_seg_intro');
    assert.equal(assets[0].startFrame, 0);
    assert.equal(assets[0].codec, 'mp3');
    assert.ok(assets[0].durationSeconds > 1 && assets[0].durationSeconds < 5);

    assert.equal(assets[1].id, 'audio_seg_secant');
    assert.equal(assets[1].startFrame, 192); // scene 1 was 192 frames
    assert.equal(assets[1].codec, 'mp3');
  });

  await t.test('fails closed when audio segment duration exceeds scene duration', async () => {
    // Scene 1 duration is 192 frames (8 seconds)
    // Provider returning 12 seconds will exceed scene duration
    const longAudioProvider = new MockTtsProvider(12);
    await assert.rejects(
      async () => synthesizeNarrationV2({
        provider: longAudioProvider,
        narrationPlan,
        storyboard,
        jobId: 'job_test_overrun',
        jobDirectory: join(root, 'job_overrun'),
        stagedDirectory: join(root, 'staged_overrun'),
        fps: 24
      }),
      /audio_duration_exceeds_scene/
    );
  });

  // Cleanup
  rmSync(root, { recursive: true, force: true });
});

