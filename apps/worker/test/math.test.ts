import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computePercentage,
  formatPercentage,
  formatRatio,
  sumFacts
} from '../src/utils/math.ts';
import {
  devfestAlgebraLongformStoryboardV3,
  devfestDerivativeLongformStoryboardV3,
  devfestGradientLongformStoryboardV3
} from '../src/fixtures/v3/devfest-longform-v3.ts';

describe('Worker Math & Formatting Utilities', () => {
  it('Tính phần trăm chính xác', () => {
    assert.strictEqual(computePercentage(9, 10), 90);
    assert.strictEqual(computePercentage(80, 100), 80);
    assert.strictEqual(computePercentage(20, 100), 20);
    assert.strictEqual(computePercentage(1, 10), 10);
    assert.strictEqual(computePercentage(0, 10), 0);
  });

  it('Định dạng tỷ lệ và phần trăm chuẩn tiếng Việt', () => {
    assert.strictEqual(formatRatio(9, 10), '9/10');
    assert.strictEqual(formatPercentage(90), '90%');

    // 29 / 110 = 26.3636%
    const pA = computePercentage(29, 110);
    const formattedA = formatPercentage(pA, 1);
    assert.ok(formattedA === '26,4%' || formattedA === '26.4%');
  });

  it('Gộp facts cộng dồn chính xác cả success và total', () => {
    const easyA = { success: 9, total: 10 };
    const hardA = { success: 20, total: 100 };
    const mergedA = sumFacts(easyA, hardA);

    assert.strictEqual(mergedA.success, 29);
    assert.strictEqual(mergedA.total, 110);

    const easyB = { success: 80, total: 100 };
    const hardB = { success: 1, total: 10 };
    const mergedB = sumFacts(easyB, hardB);

    assert.strictEqual(mergedB.success, 81);
    assert.strictEqual(mergedB.total, 110);
  });
});

describe('DevFest long-form pedagogical storyboards', () => {
  const storyboards = [
    devfestAlgebraLongformStoryboardV3,
    devfestDerivativeLongformStoryboardV3,
    devfestGradientLongformStoryboardV3
  ];

  it('mỗi chủ đề có đúng 5 phút và đủ 8 nhịp dạy học có chủ đích', () => {
    for (const storyboard of storyboards) {
      assert.strictEqual(storyboard.totalDurationSeconds, 300);
      assert.strictEqual(storyboard.scenes.length, 8);
      assert.strictEqual(
        storyboard.scenes.reduce((total, scene) => total + scene.durationSeconds, 0),
        300
      );
      assert.ok(storyboard.scenes.every((scene) => scene.pedagogicalGoal.trim().length > 0));
      assert.ok(storyboard.scenes.every((scene) => scene.boundClaimIds.length > 0));
    }
  });

  it('giữ một claim đã xác minh xuyên suốt từng bài học', () => {
    const expectedClaims = [
      'claim_identity_square_sum',
      'claim_derivative_tangent',
      'claim_gd_update_rule'
    ];

    storyboards.forEach((storyboard, index) => {
      assert.ok(
        storyboard.scenes.every((scene) => scene.boundClaimIds.includes(expectedClaims[index]!))
      );
    });
  });

  it('không đưa cú pháp máy tính thô vào phụ đề học sinh', () => {
    const rawTokens = [/diff\s*\(/i, /\.subs\s*\(/i, /lim_\s*\{/i, /\\text\s*\{/i, /\\quad/i];
    for (const storyboard of storyboards) {
      for (const scene of storyboard.scenes) {
        for (const token of rawTokens) {
          assert.doesNotMatch(scene.narration.subtitleVietnamese, token);
        }
      }
    }
  });
});
