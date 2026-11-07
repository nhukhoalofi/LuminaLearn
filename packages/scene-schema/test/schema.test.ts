import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateStoryboard,
  parseStoryboard,
  getTotalFrames,
  simpsonFixture
} from '../src/index';

describe('LuminaLearn Scene Schema & Simpson Paradox Tests', () => {
  it('1. Fixture Simpson hợp lệ qua Zod validation', () => {
    const result = validateStoryboard(simpsonFixture);
    assert.strictEqual(result.success, true, `Validation failed: ${result.errors?.join(', ')}`);
    assert.ok(result.data);
    assert.strictEqual(result.data.title, simpsonFixture.title);
  });

  it('2. Tổng duration của video bằng đúng 960 frames', () => {
    const parsed = parseStoryboard(simpsonFixture);
    const totalFrames = getTotalFrames(parsed);
    assert.strictEqual(totalFrames, 960);
    assert.strictEqual(parsed.video.durationFrames, 960);
  });

  it('3. Tính toán đúng các tỷ lệ phần trăm từ facts gốc (90%, 80%, 20%, 10%)', () => {
    const facts = simpsonFixture.facts;
    const factEasyA = facts.find((f) => f.id === 'fact_easy_a')!;
    const factEasyB = facts.find((f) => f.id === 'fact_easy_b')!;
    const factHardA = facts.find((f) => f.id === 'fact_hard_a')!;
    const factHardB = facts.find((f) => f.id === 'fact_hard_b')!;

    assert.strictEqual((factEasyA.success / factEasyA.total) * 100, 90);
    assert.strictEqual((factEasyB.success / factEasyB.total) * 100, 80);
    assert.strictEqual((factHardA.success / factHardA.total) * 100, 20);
    assert.strictEqual((factHardB.success / factHardB.total) * 100, 10);
  });

  it('4. Kết quả gộp dữ liệu đúng 29/110 và 81/110, đảo chiều kết quả tỷ lệ', () => {
    const facts = simpsonFixture.facts;
    const factEasyA = facts.find((f) => f.id === 'fact_easy_a')!;
    const factEasyB = facts.find((f) => f.id === 'fact_easy_b')!;
    const factHardA = facts.find((f) => f.id === 'fact_hard_a')!;
    const factHardB = facts.find((f) => f.id === 'fact_hard_b')!;

    const mergeA = {
      success: factEasyA.success + factHardA.success,
      total: factEasyA.total + factHardA.total
    };
    const mergeB = {
      success: factEasyB.success + factHardB.success,
      total: factEasyB.total + factHardB.total
    };

    assert.strictEqual(mergeA.success, 29);
    assert.strictEqual(mergeA.total, 110);
    assert.strictEqual(mergeB.success, 81);
    assert.strictEqual(mergeB.total, 110);

    const percentA = (mergeA.success / mergeA.total) * 100;
    const percentB = (mergeB.success / mergeB.total) * 100;

    // A: 29/110 ≈ 26.36%, B: 81/110 ≈ 73.64%
    assert.ok(Math.abs(percentA - 26.3636) < 0.01);
    assert.ok(Math.abs(percentB - 73.6363) < 0.01);
    assert.ok(percentB > percentA, 'Tỷ lệ gộp của B phải lớn hơn A (Nghịch lý Simpson)');
  });

  it('5. Từ chối dữ liệu khi success > total', () => {
    const invalidData = JSON.parse(JSON.stringify(simpsonFixture));
    invalidData.facts[0].success = 15;
    invalidData.facts[0].total = 10;

    const result = validateStoryboard(invalidData);
    assert.strictEqual(result.success, false);
    assert.ok(result.errors?.some((err) => err.includes('không thể lớn hơn')));
  });

  it('6. Từ chối khi scene tham chiếu Fact ID không tồn tại', () => {
    const invalidData = JSON.parse(JSON.stringify(simpsonFixture));
    invalidData.scenes[1].content.factAId = 'non_existent_fact';

    const result = validateStoryboard(invalidData);
    assert.strictEqual(result.success, false);
    assert.ok(result.errors?.some((err) => err.includes('không tồn tại trong danh sách facts')));
  });

  it('7. Từ chối template không được hỗ trợ', () => {
    const invalidData = JSON.parse(JSON.stringify(simpsonFixture));
    invalidData.scenes[0].template = 'unsupported_3d_template';

    const result = validateStoryboard(invalidData);
    assert.strictEqual(result.success, false);
  });
});

