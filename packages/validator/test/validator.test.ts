import { describe, it } from 'node:test';
import assert from 'node:assert';
import { simpsonFixture } from '@luminalearn/scene-schema';
import {
  validateFactArithmetic,
  compareFractions,
  validateSimpsonParadox,
  validateEducationalClaims,
  validateFactReferences,
  validateLessonStoryboard,
  FactRegistry,
  CANONICAL_SIMPSON_FACTS
} from '../src/index.ts';

describe('LuminaLearn Science Validator Tests', () => {
  it('1. So sánh phân số chính xác bằng cross-multiplication', () => {
    // 9/10 (0.9) > 80/100 (0.8)
    assert.strictEqual(compareFractions(9, 10, 80, 100), 1);
    // 20/100 (0.2) > 1/10 (0.1)
    assert.strictEqual(compareFractions(20, 100, 1, 10), 1);
    // 29/110 (~0.264) < 81/110 (~0.736)
    assert.strictEqual(compareFractions(29, 110, 81, 110), -1);
    // 1/2 == 5/10
    assert.strictEqual(compareFractions(1, 2, 5, 10), 0);
  });

  it('2. Thẩm định số học Fact arithmetic: hợp lệ và từ chối lỗi', () => {
    const valid = validateFactArithmetic(CANONICAL_SIMPSON_FACTS);
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.errors.length, 0);

    // Mẫu = 0
    const zeroTotal = validateFactArithmetic([{ id: 'bad', label: 'Bad', success: 0, total: 0 }]);
    assert.strictEqual(zeroTotal.valid, false);

    // success > total
    const overflow = validateFactArithmetic([{ id: 'bad', label: 'Bad', success: 12, total: 10 }]);
    assert.strictEqual(overflow.valid, false);
    assert.ok(overflow.errors[0].includes('lớn hơn tổng số'));
  });

  it('3. Thẩm định Nghịch lý Simpson: xác nhận 3 bất đẳng thức và phát hiện đảo chiều', () => {
    const result = validateSimpsonParadox(CANONICAL_SIMPSON_FACTS);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.reversalDetected, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('4. Thẩm định Nghịch lý Simpson: phát hiện dữ liệu làm mất tính đảo chiều', () => {
    // Sửa số liệu sao cho B không đảo chiều khi gộp
    const brokenFacts = JSON.parse(JSON.stringify(CANONICAL_SIMPSON_FACTS));
    // Cho A_easy = 99/100, A_hard = 99/100 => A luôn thắng B khi gộp
    brokenFacts[0].success = 99;
    brokenFacts[0].total = 100;
    brokenFacts[2].success = 99;
    brokenFacts[2].total = 100;

    const result = validateSimpsonParadox(brokenFacts);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.reversalDetected, false);
    assert.ok(result.errors.some((e) => e.includes('Không xuất hiện hiệu ứng đảo chiều')));
  });

  it('5. FactRegistry nhận biết chủ đề được hỗ trợ và từ chối chủ đề chưa hỗ trợ', () => {
    assert.strictEqual(FactRegistry.isTopicSupported('Giải thích nghịch lý Simpson'), true);
    assert.strictEqual(FactRegistry.isTopicSupported("Simpson's Paradox in STEM"), true);

    // Chủ đề chưa hỗ trợ ở Phase 3
    assert.strictEqual(FactRegistry.isTopicSupported('Định luật 3 Newton'), false);
    assert.strictEqual(FactRegistry.isTopicSupported('Phản ứng oxy hóa khử'), false);
  });

  it('6. validateEducationalClaims bắt buộc disclaimer khi dùng dữ liệu giả định', () => {
    const validClaims = validateEducationalClaims(simpsonFixture);
    assert.strictEqual(validClaims.valid, true);
    assert.strictEqual(validClaims.status, 'hypothetical_valid');

    // Xóa từ khóa giả định trong disclaimer
    const missingDisclaimerFixture = JSON.parse(JSON.stringify(simpsonFixture));
    missingDisclaimerFixture.scenes[4].content.disclaimer = 'Đây là bài học cơ bản.';

    const invalidClaims = validateEducationalClaims(missingDisclaimerFixture);
    assert.strictEqual(invalidClaims.valid, false);
    assert.ok(invalidClaims.errors[0].includes('chưa ghi rõ từ khóa "giả định"'));
  });

  it('7. validateLessonStoryboard: Thẩm định toàn diện storyboard chuẩn thành công', () => {
    const fullResult = validateLessonStoryboard(simpsonFixture, 'Nghịch lý Simpson');
    assert.strictEqual(fullResult.valid, true);
    assert.strictEqual(fullResult.status, 'hypothetical_valid');
    assert.strictEqual(fullResult.errors.length, 0);
  });

  it('8. validateLessonStoryboard: Từ chối chủ đề unsupported_topic', () => {
    const unsupportedResult = validateLessonStoryboard(simpsonFixture, 'Định luật vạn vật hấp dẫn');
    assert.strictEqual(unsupportedResult.valid, false);
    assert.strictEqual(unsupportedResult.status, 'unsupported_topic');
    assert.ok(unsupportedResult.errors[0].includes('chưa nằm trong danh mục hỗ trợ'));
  });
});
