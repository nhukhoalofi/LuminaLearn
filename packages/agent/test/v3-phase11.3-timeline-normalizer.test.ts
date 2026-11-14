import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EducationalSceneV3Schema, secondsToFrames } from '@luminalearn/scene-schema';
import {
  TimelineNormalizationError,
  normalizeStoryboardTimelineV3
} from '../src/orchestration/timeline-normalizer-v3';

function scene(sceneId: string, durationSeconds: number) {
  return {
    sceneId,
    sceneType: 'summary' as const,
    title: `Tổng kết ${sceneId}`,
    pedagogicalGoal: `Củng cố kiến thức ${sceneId}`,
    durationSeconds,
    boundClaimIds: [],
    rendererTarget: 'remotion_infographic' as const,
    narration: {
      vietnamese: `Nội dung được giáo viên duyệt cho ${sceneId}.`,
      subtitleVietnamese: `Nội dung được giáo viên duyệt cho ${sceneId}.`
    },
    visualPayload: {
      sceneType: 'summary' as const,
      title: `Tổng kết ${sceneId}`,
      takeaways: [`Điểm chính ${sceneId}`, `Ứng dụng ${sceneId}`],
      verifiedFacts: [],
      reviewNotes: [],
      finalCallout: `Ghi nhớ ${sceneId}`
    }
  };
}

function assertErrorCode(action: () => unknown, code: string, status: string) {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof TimelineNormalizationError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

describe('V3 authoritative timeline normalizer', () => {
  for (const [target, count] of [[60, 2], [180, 3], [300, 3], [600, 5]] as const) {
    it(`conserves exactly ${target}s at 24fps without changing scene identity or content`, () => {
      const input = Array.from({ length: count }, (_, index) => scene(`sc_${index + 1}`, 30 + index));
      const result = normalizeStoryboardTimelineV3({ rawScenes: input, targetDurationSeconds: target });
      assert.equal(result.totalFrames, target * 24);
      assert.equal(result.scenes.length, input.length);
      assert.deepEqual(result.scenes.map((item) => item.sceneId), input.map((item) => item.sceneId));
      assert.deepEqual(
        result.scenes.map((item) => item.narration),
        input.map((item) => item.narration)
      );
      assert.equal(
        result.scenes.reduce((sum, item) => sum + secondsToFrames(item.durationSeconds, 24), 0),
        target * 24
      );
      assert.equal(result.chapters.at(-1)?.endFrame, target * 24);
      assert.ok(result.chapters.every((chapter) => chapter.validationStatus === 'pending'));
      result.scenes.forEach((item) => assert.doesNotThrow(() => EducationalSceneV3Schema.parse(item)));
    });
  }

  it('rejects a long target when approved scenes cannot cover it', () => {
    assertErrorCode(
      () => normalizeStoryboardTimelineV3({ rawScenes: [scene('sc_1', 60)], targetDurationSeconds: 300 }),
      'timeline_insufficient_scene_capacity',
      'NEEDS_REVIEW'
    );
  });

  it('rejects invalid durations instead of silently defaulting them', () => {
    assertErrorCode(
      () => normalizeStoryboardTimelineV3({ rawScenes: [scene('sc_1', Number.NaN)], targetDurationSeconds: 60 }),
      'timeline_scene_duration_invalid',
      'BLOCKED'
    );
  });

  it('reallocates an oversized source duration without duplicating its content', () => {
    const input = [scene('sc_1', 160), scene('sc_2', 20)];
    const result = normalizeStoryboardTimelineV3({ rawScenes: input, targetDurationSeconds: 180 });
    assert.deepEqual(result.scenes.map((item) => item.sceneId), ['sc_1', 'sc_2']);
    assert.deepEqual(result.scenes.map((item) => item.narration), input.map((item) => item.narration));
    assert.ok(result.scenes.every((item) => item.durationSeconds <= 120));
  });

  it('rejects duplicate IDs instead of renaming approved scenes', () => {
    assertErrorCode(
      () => normalizeStoryboardTimelineV3({ rawScenes: [scene('sc_1', 30), scene('sc_1', 30)], targetDurationSeconds: 60 }),
      'timeline_duplicate_scene_id',
      'BLOCKED'
    );
  });

  it('rejects measured narration that exceeds the requested timeline', () => {
    assertErrorCode(
      () => normalizeStoryboardTimelineV3({
        rawScenes: [scene('sc_1', 30), scene('sc_2', 30)],
        targetDurationSeconds: 60,
        measuredNarrationDurationSeconds: 65
      }),
      'timeline_narration_exceeds_target',
      'NEEDS_REVIEW'
    );
  });

  it('rejects a missing visual payload and never invents a generic formula', () => {
    const invalid = { ...scene('sc_1', 30), visualPayload: undefined };
    assertErrorCode(
      () => normalizeStoryboardTimelineV3({ rawScenes: [invalid, scene('sc_2', 30)], targetDurationSeconds: 60 }),
      'timeline_scene_content_invalid',
      'BLOCKED'
    );
    assert.doesNotMatch(JSON.stringify(invalid), /f\(x\)\s*=\s*x/);
  });

  it('rejects scene/visual semantic mismatch', () => {
    const invalid = { ...scene('sc_1', 30), sceneType: 'concept_intro' };
    assertErrorCode(
      () => normalizeStoryboardTimelineV3({ rawScenes: [invalid, scene('sc_2', 30)], targetDurationSeconds: 60 }),
      'timeline_scene_content_invalid',
      'BLOCKED'
    );
  });

  it('blocks an empty storyboard', () => {
    assertErrorCode(
      () => normalizeStoryboardTimelineV3({ rawScenes: [], targetDurationSeconds: 60 }),
      'timeline_scenes_empty',
      'BLOCKED'
    );
  });
});
