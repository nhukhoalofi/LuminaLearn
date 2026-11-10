/**
 * LuminaLearn V3.0 — Phase 11.3
 * Test Suite: Storyboard Timeline Normalizer & Duration Reconciler
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EducationalSceneV3Schema,
  REGISTERED_TOPICS_V3
} from '@luminalearn/scene-schema';
import {
  normalizeStoryboardTimelineV3,
  TimelineNormalizationError
} from '../src/orchestration/timeline-normalizer-v3';

describe('Phase 11.3 — Timeline Normalizer V3 Test Suite', () => {
  const capability = REGISTERED_TOPICS_V3['ai.gradient_descent.optimization'];

  it('1. 60-second video: produces valid timeline where all scenes <= 120s', () => {
    const rawScenes = [
      { sceneId: 'sc_01', durationSeconds: 25, title: 'Scene 1', pedagogicalGoal: 'Goal 1' },
      { sceneId: 'sc_02', durationSeconds: 35, title: 'Scene 2', pedagogicalGoal: 'Goal 2' }
    ];

    const result = normalizeStoryboardTimelineV3({
      rawScenes,
      targetDurationSeconds: 60,
      capability
    });

    assert.equal(result.success, true);
    assert.equal(result.totalDurationSeconds, 60);
    assert.equal(result.scenes.length, 2);
    for (const sc of result.scenes) {
      assert.ok(sc.durationSeconds <= 120);
      assert.doesNotThrow(() => EducationalSceneV3Schema.parse(sc));
    }
    assert.equal(result.totalFrames, 60 * 24);
  });

  it('2. 180-second video: scales and reconciles integer frames accurately', () => {
    const rawScenes = [
      { sceneId: 'sc_01', durationSeconds: 20, title: 'Intro', pedagogicalGoal: 'Goal 1' },
      { sceneId: 'sc_02', durationSeconds: 30, title: 'Concept', pedagogicalGoal: 'Goal 2' },
      { sceneId: 'sc_03', durationSeconds: 30, title: 'Math', pedagogicalGoal: 'Goal 3' },
      { sceneId: 'sc_04', durationSeconds: 20, title: 'Summary', pedagogicalGoal: 'Goal 4' }
    ];

    const result = normalizeStoryboardTimelineV3({
      rawScenes,
      targetDurationSeconds: 180,
      capability
    });

    assert.equal(result.success, true);
    assert.equal(result.totalDurationSeconds, 180);
    let frameSum = 0;
    for (const sc of result.scenes) {
      assert.ok(sc.durationSeconds <= 120);
      assert.doesNotThrow(() => EducationalSceneV3Schema.parse(sc));
      frameSum += Math.round(sc.durationSeconds * 24);
    }
    assert.equal(frameSum, 180 * 24);
  });

  it('3. 300-second video: partitions into scenes with duration <= 120s', () => {
    const rawScenes = [
      { sceneId: 'sc_01', durationSeconds: 150, title: 'Long Part 1', pedagogicalGoal: 'Deep dive 1' },
      { sceneId: 'sc_02', durationSeconds: 150, title: 'Long Part 2', pedagogicalGoal: 'Deep dive 2' }
    ];

    const result = normalizeStoryboardTimelineV3({
      rawScenes,
      targetDurationSeconds: 300,
      capability
    });

    assert.equal(result.success, true);
    assert.equal(result.totalDurationSeconds, 300);
    assert.ok(result.scenes.length >= 4, `Expected >= 4 scenes after splitting, got ${result.scenes.length}`);
    for (const sc of result.scenes) {
      assert.ok(sc.durationSeconds <= 120, `Scene ${sc.sceneId} duration ${sc.durationSeconds}s exceeds 120s`);
      assert.doesNotThrow(() => EducationalSceneV3Schema.parse(sc));
    }
    assert.equal(result.totalFrames, 300 * 24);
  });

  it('4. 600-second video (10 min masterclass): partitions into scenes <= 120s', () => {
    const rawScenes = [
      { sceneId: 'sc_01', durationSeconds: 200, title: 'Lecture A', pedagogicalGoal: 'Goal A' },
      { sceneId: 'sc_02', durationSeconds: 200, title: 'Lecture B', pedagogicalGoal: 'Goal B' },
      { sceneId: 'sc_03', durationSeconds: 200, title: 'Lecture C', pedagogicalGoal: 'Goal C' }
    ];

    const result = normalizeStoryboardTimelineV3({
      rawScenes,
      targetDurationSeconds: 600,
      capability
    });

    assert.equal(result.success, true);
    assert.equal(result.totalDurationSeconds, 600);
    assert.ok(result.scenes.length >= 6);
    for (const sc of result.scenes) {
      assert.ok(sc.durationSeconds <= 120, `Scene ${sc.sceneId} duration ${sc.durationSeconds} exceeds 120s limit`);
      assert.doesNotThrow(() => EducationalSceneV3Schema.parse(sc));
    }
    assert.equal(result.totalFrames, 600 * 24);
  });

  it('5. Two oversized AI-generated scenes (150s + 150s): splits safely without exceeding 120s', () => {
    const rawScenes = [
      {
        sceneId: 'sc_ai_1',
        sceneType: 'concept_intro',
        durationSeconds: 150,
        title: 'Giới thiệu AI',
        pedagogicalGoal: 'Mở đầu bài học AI',
        boundClaimIds: ['claim_ai_1'],
        narration: { vietnamese: 'Chào mừng các bạn. Hôm nay chúng ta sẽ tìm hiểu về mạng nơ-ron.', subtitleVietnamese: 'Giới thiệu mạng nơ-ron.' }
      },
      {
        sceneId: 'sc_ai_2',
        sceneType: 'summary',
        durationSeconds: 150,
        title: 'Tổng kết AI',
        pedagogicalGoal: 'Củng cố kiến thức AI',
        boundClaimIds: ['claim_ai_1'],
        narration: { vietnamese: 'Tổng kết lại kiến thức đã học.', subtitleVietnamese: 'Tổng kết bài học.' }
      }
    ];

    const result = normalizeStoryboardTimelineV3({
      rawScenes,
      targetDurationSeconds: 300,
      capability
    });

    assert.equal(result.success, true);
    assert.ok(result.scenes.length >= 4);
    for (const sc of result.scenes) {
      assert.ok(sc.durationSeconds <= 120);
      assert.ok(sc.boundClaimIds.includes('claim_ai_1'), 'Claim bindings must be preserved');
      assert.doesNotThrow(() => EducationalSceneV3Schema.parse(sc));
    }
  });

  it('6. Invalid and missing duration values (NaN, negative, zero, string, null): repairs safely', () => {
    const rawScenes = [
      { sceneId: 'sc_valid', durationSeconds: 30, title: 'Valid Scene', pedagogicalGoal: 'Goal 1' },
      { sceneId: 'sc_nan', durationSeconds: NaN, title: 'NaN Scene', pedagogicalGoal: 'Goal 2' },
      { sceneId: 'sc_negative', durationSeconds: -15, title: 'Neg Scene', pedagogicalGoal: 'Goal 3' },
      { sceneId: 'sc_zero', durationSeconds: 0, title: 'Zero Scene', pedagogicalGoal: 'Goal 4' },
      { sceneId: 'sc_null', durationSeconds: null, title: 'Null Scene', pedagogicalGoal: 'Goal 5' }
    ];

    const result = normalizeStoryboardTimelineV3({
      rawScenes,
      targetDurationSeconds: 100,
      capability
    });

    assert.equal(result.success, true);
    assert.equal(result.scenes.length, 5);
    for (const sc of result.scenes) {
      assert.ok(Number.isFinite(sc.durationSeconds) && sc.durationSeconds > 0);
      assert.ok(sc.durationSeconds <= 120);
      assert.doesNotThrow(() => EducationalSceneV3Schema.parse(sc));
    }
    assert.equal(result.totalDurationSeconds, 100);
  });

  it('7. Duplicate scene IDs: deduplicates deterministically', () => {
    const rawScenes = [
      { sceneId: 'sc_dup', durationSeconds: 30, title: 'Scene 1', pedagogicalGoal: 'Goal 1' },
      { sceneId: 'sc_dup', durationSeconds: 30, title: 'Scene 2', pedagogicalGoal: 'Goal 2' },
      { sceneId: 'sc_dup', durationSeconds: 30, title: 'Scene 3', pedagogicalGoal: 'Goal 3' }
    ];

    const result = normalizeStoryboardTimelineV3({
      rawScenes,
      targetDurationSeconds: 90,
      capability
    });

    assert.equal(result.success, true);
    const ids = result.scenes.map((s) => s.sceneId);
    assert.equal(new Set(ids).size, 3, 'All scene IDs must be unique');
  });

  it('8. Incorrect total duration: scales proportionally to target without drift', () => {
    // 3 scenes of 10s = 30s, requested target is 180s
    const rawScenes = [
      { sceneId: 'sc_01', durationSeconds: 10, title: 'Scene 1', pedagogicalGoal: 'Goal 1' },
      { sceneId: 'sc_02', durationSeconds: 10, title: 'Scene 2', pedagogicalGoal: 'Goal 2' },
      { sceneId: 'sc_03', durationSeconds: 10, title: 'Scene 3', pedagogicalGoal: 'Goal 3' }
    ];

    const result = normalizeStoryboardTimelineV3({
      rawScenes,
      targetDurationSeconds: 180,
      capability
    });

    assert.equal(result.success, true);
    assert.equal(result.totalDurationSeconds, 180);
    assert.equal(result.totalFrames, 180 * 24);
  });

  it('9. Chapter boundaries after scene splitting: covers full timeline contiguously', () => {
    const rawScenes = [
      { sceneId: 'sc_01', durationSeconds: 180, title: 'Huge Scene', pedagogicalGoal: 'Goal 1' }
    ];

    const result = normalizeStoryboardTimelineV3({
      rawScenes,
      targetDurationSeconds: 180,
      capability
    });

    assert.equal(result.success, true);
    assert.ok(result.chapters.length >= 2, 'Chapters should be generated');

    let cursor = 0;
    for (const chap of result.chapters) {
      assert.equal(chap.startFrame, cursor, 'Chapters must be contiguous');
      cursor = chap.endFrame;
    }
    assert.equal(cursor, 180 * 24, 'Final chapter endFrame must match totalFrames');
  });

  it('10. Mathematical claim and approval integrity: boundClaimIds preserved across split scenes', () => {
    const rawScenes = [
      {
        sceneId: 'sc_identity_long',
        sceneType: 'algebra_identity',
        durationSeconds: 240,
        title: 'Hằng đẳng thức đáng nhớ',
        pedagogicalGoal: 'Chứng minh đại số',
        boundClaimIds: ['claim_identity_1', 'claim_identity_2'],
        visualPayload: {
          sceneType: 'algebra_identity',
          identityId: 'square_sum',
          leftExpression: '(a+b)^2',
          rightExpression: 'a^2+2*a*b+b^2',
          transformationSteps: [
            { expression: '(a+b)^2', explanationVietnamese: 'Biểu thức ban đầu' },
            { expression: 'a^2+2*a*b+b^2', explanationVietnamese: 'Biểu thức khai triển' }
          ],
          presentation: 'expansion'
        }
      }
    ];

    const result = normalizeStoryboardTimelineV3({
      rawScenes,
      targetDurationSeconds: 240,
      capability
    });

    assert.equal(result.success, true);
    assert.ok(result.scenes.length >= 2);
    for (const sc of result.scenes) {
      assert.ok(sc.boundClaimIds.includes('claim_identity_1'));
      assert.ok(sc.boundClaimIds.includes('claim_identity_2'));
      assert.ok(sc.durationSeconds <= 120);
      assert.doesNotThrow(() => EducationalSceneV3Schema.parse(sc));
    }
  });

  it('11. Empty or non-array scenes: fails closed with actionable finding', () => {
    assert.throws(
      () => normalizeStoryboardTimelineV3({ rawScenes: [], targetDurationSeconds: 60 }),
      (err: unknown) => err instanceof TimelineNormalizationError && err.code === 'empty_scenes_array'
    );
  });
});
