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

  await t.test('fails closed when narration exceeds a locked measured Manim clip', async () => {
    const lockedStoryboard = structuredClone(storyboard);
    const original = structuredClone(lockedStoryboard);
    await assert.rejects(
      synthesizeNarrationV2({
        provider: new MockTtsProvider(12), narrationPlan, storyboard: lockedStoryboard,
        jobId: 'job_test_locked', jobDirectory: join(root, 'job_locked'),
        stagedDirectory: join(root, 'staged_locked'), fps: 24,
        alignmentPolicy: 'adjust_timeline', lockedSceneIds: new Set(['sc_intro'])
      }),
      /audio_duration_exceeds_scene/
    );
    assert.deepEqual(lockedStoryboard, original, 'locked scene timing must not be stretched');
  });

  await t.test('aligns two narration segments around one measured Manim clip on one timeline', async () => {
    const measuredStoryboard = structuredClone(storyboard);
    measuredStoryboard.scenes = [
      { ...measuredStoryboard.scenes[0], sceneId: 'sc_before', durationFrames: 48 },
      { ...measuredStoryboard.scenes[1], sceneId: 'sc_manim', durationFrames: 72 },
      { ...measuredStoryboard.scenes[0], sceneId: 'sc_after', durationFrames: 48 }
    ];
    measuredStoryboard.estimatedDurationFrames = 168;
    const surroundingPlan = structuredClone(narrationPlan);
    surroundingPlan.segments = [
      { ...surroundingPlan.segments[0], segmentId: 'seg_before', sceneId: 'sc_before' },
      { ...surroundingPlan.segments[1], segmentId: 'seg_manim', sceneId: 'sc_manim' },
      { ...surroundingPlan.segments[0], segmentId: 'seg_after', sceneId: 'sc_after' }
    ];
    const assets = await synthesizeNarrationV2({
      provider: new MockTtsProvider(1), narrationPlan: surroundingPlan, storyboard: measuredStoryboard,
      jobId: 'job_test_surrounding', jobDirectory: join(root, 'job_surrounding'),
      stagedDirectory: join(root, 'staged_surrounding'), fps: 24,
      alignmentPolicy: 'adjust_timeline', lockedSceneIds: new Set(['sc_manim'])
    });
    assert.deepEqual(assets.map((asset) => asset.startFrame), [0, 48, 120]);
  });

  // Cleanup
  rmSync(root, { recursive: true, force: true });
});

