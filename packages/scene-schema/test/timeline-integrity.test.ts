import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compileStoryboardV2,
  RenderManifestV2Schema,
  StoryboardV2Schema,
  type StoryboardV2,
  type NarrationPlanV2
} from '../src/index';

function createMockStoryboard(sceneCount: 3 | 5): StoryboardV2 {
  const scenes = sceneCount === 3
    ? [
        {
          sceneId: 'scene_1_intro',
          templateId: 'function_graph',
          sceneType: 'intro' as const,
          durationFrames: 120,
          parameters: { title: 'Intro' },
          layout: { aspectRatio: '9:16' as const, safeAreaPadding: 32 },
          mathematicalBinding: { boundClaimIds: [], latexFormulas: [] },
          sourceReferenceIds: []
        },
        {
          sceneId: 'scene_2_anim',
          templateId: 'riemann_sum',
          sceneType: 'animation' as const,
          durationFrames: 240,
          parameters: { title: 'Animation' },
          layout: { aspectRatio: '9:16' as const, safeAreaPadding: 32 },
          mathematicalBinding: { boundClaimIds: [], latexFormulas: [] },
          sourceReferenceIds: []
        },
        {
          sceneId: 'scene_3_summary',
          templateId: 'function_graph',
          sceneType: 'summary' as const,
          durationFrames: 120,
          parameters: { title: 'Summary' },
          layout: { aspectRatio: '9:16' as const, safeAreaPadding: 32 },
          mathematicalBinding: { boundClaimIds: [], latexFormulas: [] },
          sourceReferenceIds: []
        }
      ]
    : [
        {
          sceneId: 'scene_1_intro',
          templateId: 'function_graph',
          sceneType: 'intro' as const,
          durationFrames: 120,
          parameters: { title: 'Intro' },
          layout: { aspectRatio: '9:16' as const, safeAreaPadding: 32 },
          mathematicalBinding: { boundClaimIds: [], latexFormulas: [] },
          sourceReferenceIds: []
        },
        {
          sceneId: 'scene_2_concept',
          templateId: 'function_graph',
          sceneType: 'concept' as const,
          durationFrames: 180,
          parameters: { title: 'Concept' },
          layout: { aspectRatio: '9:16' as const, safeAreaPadding: 32 },
          mathematicalBinding: { boundClaimIds: [], latexFormulas: [] },
          sourceReferenceIds: []
        },
        {
          sceneId: 'scene_3_anim',
          templateId: 'secant_to_tangent',
          sceneType: 'animation' as const,
          durationFrames: 260,
          parameters: { title: 'Animation' },
          layout: { aspectRatio: '9:16' as const, safeAreaPadding: 32 },
          mathematicalBinding: { boundClaimIds: [], latexFormulas: [] },
          sourceReferenceIds: []
        },
        {
          sceneId: 'scene_4_formula',
          templateId: 'function_graph',
          sceneType: 'formula' as const,
          durationFrames: 220,
          parameters: { title: 'Formula' },
          layout: { aspectRatio: '9:16' as const, safeAreaPadding: 32 },
          mathematicalBinding: { boundClaimIds: [], latexFormulas: [] },
          sourceReferenceIds: []
        },
        {
          sceneId: 'scene_5_summary',
          templateId: 'function_graph',
          sceneType: 'summary' as const,
          durationFrames: 180,
          parameters: { title: 'Summary' },
          layout: { aspectRatio: '9:16' as const, safeAreaPadding: 32 },
          mathematicalBinding: { boundClaimIds: [], latexFormulas: [] },
          sourceReferenceIds: []
        }
      ];

  const visualTemplateIds = Array.from(new Set(scenes.map((s) => s.templateId)));
  const estimatedDurationFrames = scenes.reduce((sum, s) => sum + s.durationFrames, 0);

  return StoryboardV2Schema.parse({
    storyboardId: `sb_test_${sceneCount}`,
    lessonId: `lesson_test_${sceneCount}`,
    topicId: 'calculus.integral.riemann_sum',
    scenes,
    visualTemplateIds,
    mathematicalData: {},
    narrationObjectives: ['Objective 1'],
    estimatedDurationFrames
  });
}

function createMockNarration(storyboard: StoryboardV2): NarrationPlanV2 {
  return {
    planId: 'narr_test_001',
    storyboardId: storyboard.storyboardId,
    language: 'vi',
    totalWords: 50,
    estimatedDurationSeconds: storyboard.estimatedDurationFrames / 24,
    mathematicalReview: { status: 'verified', verifiedClaimIds: [] },
    segments: storyboard.scenes.map((s, idx) => ({
      segmentId: `seg_${s.sceneId}`,
      sceneId: s.sceneId,
      text: `Lời dẫn phân đoạn ${idx + 1}`,
      subtitleText: `Phụ đề phân đoạn ${idx + 1}`,
      targetDurationSeconds: s.durationFrames / 24,
      pronunciationHints: []
    }))
  };
}

describe('Milestone 2 — Media & Timeline Integrity', () => {
  it('compiles a 3-scene storyboard into a contiguous manifest with accurate totalFrames', () => {
    const sb3 = createMockStoryboard(3);
    const narr3 = createMockNarration(sb3);

    const manifest = compileStoryboardV2(sb3, narr3, {
      jobId: 'job_test_3scene',
      lessonTitle: 'Bài giảng 3 cảnh',
      topicId: 'calculus.integral.riemann_sum'
    });

    assert.equal(manifest.timeline.length, 3);
    assert.equal(manifest.totalFrames, 480); // 120 + 240 + 120 = 480
    assert.equal(manifest.timeline[0].startFrame, 0);
    assert.equal(manifest.timeline[0].durationFrames, 120);
    assert.equal(manifest.timeline[1].startFrame, 120);
    assert.equal(manifest.timeline[1].durationFrames, 240);
    assert.equal(manifest.timeline[2].startFrame, 360);
    assert.equal(manifest.timeline[2].durationFrames, 120);
  });

  it('compiles a 5-scene storyboard into a contiguous manifest with accurate totalFrames', () => {
    const sb5 = createMockStoryboard(5);
    const narr5 = createMockNarration(sb5);

    const manifest = compileStoryboardV2(sb5, narr5, {
      jobId: 'job_test_5scene',
      lessonTitle: 'Bài giảng 5 cảnh',
      topicId: 'calculus.derivative.intuition'
    });

    assert.equal(manifest.timeline.length, 5);
    assert.equal(manifest.totalFrames, 960); // 120 + 180 + 260 + 220 + 180 = 960
  });

  it('adjusts scene duration to match asset frameCount under adjust_timeline policy when clip is shorter', () => {
    const sb3 = createMockStoryboard(3); // scene 2 anim is 240 frames
    const narr3 = createMockNarration(sb3);

    // Verified asset is 200 frames (shorter by 40 frames)
    const asset = {
      id: 'asset_manim',
      publicPath: 'generated/job1/clip.mp4',
      durationSeconds: 8.333,
      frameCount: 200,
      fps: 24,
      width: 720,
      height: 1280,
      codec: 'h264' as const,
      pixelFormat: 'yuv420p' as const
    };

    const manifest = compileStoryboardV2(sb3, narr3, {
      jobId: 'job_test_adjust_short',
      lessonTitle: 'Test Adjust Short',
      topicId: 'calculus.integral.riemann_sum',
      assetAlignmentPolicy: 'adjust_timeline',
      assets: [asset]
    });

    // Scene 2 duration must be adjusted to exactly 200 frames
    assert.equal(manifest.timeline[1].durationFrames, 200);
    assert.equal(manifest.timeline[2].startFrame, 320); // 120 + 200
    assert.equal(manifest.totalFrames, 440); // 120 + 200 + 120 = 440
  });

  it('expands scene duration to fit asset frameCount when clip is longer under adjust_timeline policy', () => {
    const sb3 = createMockStoryboard(3); // scene 2 anim is 240 frames
    const narr3 = createMockNarration(sb3);

    // Verified asset is 300 frames (longer by 60 frames)
    const asset = {
      id: 'asset_manim',
      publicPath: 'generated/job1/clip.mp4',
      durationSeconds: 12.5,
      frameCount: 300,
      fps: 24,
      width: 720,
      height: 1280,
      codec: 'h264' as const,
      pixelFormat: 'yuv420p' as const
    };

    const manifest = compileStoryboardV2(sb3, narr3, {
      jobId: 'job_test_adjust_long',
      lessonTitle: 'Test Adjust Long',
      topicId: 'calculus.integral.riemann_sum',
      assetAlignmentPolicy: 'adjust_timeline',
      assets: [asset]
    });

    assert.equal(manifest.timeline[1].durationFrames, 300);
    assert.equal(manifest.timeline[2].startFrame, 420); // 120 + 300
    assert.equal(manifest.totalFrames, 540); // 120 + 300 + 120 = 540
  });

  it('throws media_timeline_mismatch under strict policy when asset frameCount differs', () => {
    const sb3 = createMockStoryboard(3);
    const narr3 = createMockNarration(sb3);

    const asset = {
      id: 'asset_manim',
      publicPath: 'generated/job1/clip.mp4',
      durationSeconds: 8.333,
      frameCount: 200, // differs from 240
      fps: 24,
      width: 720,
      height: 1280,
      codec: 'h264' as const,
      pixelFormat: 'yuv420p' as const
    };

    assert.throws(
      () =>
        compileStoryboardV2(sb3, narr3, {
          jobId: 'job_test_strict',
          lessonTitle: 'Test Strict',
          topicId: 'calculus.integral.riemann_sum',
          assetAlignmentPolicy: 'strict',
          assets: [asset]
        }),
      /media_timeline_mismatch/i
    );
  });

  it('allows hold_last_frame policy when difference is within maxHoldFrames limit', () => {
    const sb3 = createMockStoryboard(3); // scene 2 is 240 frames
    const narr3 = createMockNarration(sb3);

    const asset = {
      id: 'asset_manim',
      publicPath: 'generated/job1/clip.mp4',
      durationSeconds: 9.166,
      frameCount: 220, // 20 frames shorter <= 48
      fps: 24,
      width: 720,
      height: 1280,
      codec: 'h264' as const,
      pixelFormat: 'yuv420p' as const
    };

    const manifest = compileStoryboardV2(sb3, narr3, {
      jobId: 'job_test_hold',
      lessonTitle: 'Test Hold',
      topicId: 'calculus.integral.riemann_sum',
      assetAlignmentPolicy: 'hold_last_frame',
      maxHoldFrames: 48,
      assets: [asset]
    });

    assert.equal(manifest.timeline[1].durationFrames, 240); // Preserved
    assert.equal(manifest.totalFrames, 480);
  });

  it('validates subtitle cue boundaries lie strictly within corresponding scenes', () => {
    const sb3 = createMockStoryboard(3);
    const narr3 = createMockNarration(sb3);

    const manifest = compileStoryboardV2(sb3, narr3, {
      jobId: 'job_test_subtitles',
      lessonTitle: 'Test Subtitles',
      topicId: 'calculus.integral.riemann_sum'
    });

    assert.ok(manifest.subtitleTrack);
    const cues = manifest.subtitleTrack.cues;
    assert.equal(cues.length, 3);
    for (let i = 0; i < manifest.timeline.length; i++) {
      const scene = manifest.timeline[i];
      const cue = cues[i];
      assert.equal(cue.startFrame, scene.startFrame);
      assert.equal(cue.endFrame, scene.startFrame + scene.durationFrames);
    }
  });

  it('rejects timeline gaps or overlaps via RenderManifestV2Schema', () => {
    const invalidTimelineManifest = {
      schemaVersion: 'manifest-v2',
      manifestId: 'manifest_gap_test',
      jobId: 'job_gap_01',
      topicId: 'calculus.integral.riemann_sum',
      lessonTitle: 'Gap Test',
      language: 'vi',
      aspectRatio: '9:16',
      dimensions: { width: 720, height: 1280 },
      fps: 24,
      totalFrames: 400,
      timeline: [
        {
          id: 'scene_1',
          sceneType: 'intro',
          templateId: 'function_graph',
          startFrame: 0,
          durationFrames: 100,
          content: { title: 'S1', formulas: [] },
          parameters: {}
        },
        {
          id: 'scene_2',
          sceneType: 'concept',
          templateId: 'function_graph',
          startFrame: 150, // GAP! Expected 100, got 150
          durationFrames: 100,
          content: { title: 'S2', formulas: [] },
          parameters: {}
        }
      ],
      visualAssets: [],
      audioAssets: []
    };

    assert.throws(
      () => RenderManifestV2Schema.parse(invalidTimelineManifest),
      /Timeline gap or overlap/i
    );
  });
});
