import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeVietnameseNarration,
  integerToVietnamese,
  digitSequenceToVietnamese
} from '../src/vietnamese-narration-normalizer';

test('Vietnamese Narration Normalizer (Phase 11)', async (t) => {
  await t.test('1. Number and digit conversions into Vietnamese words', () => {
    assert.strictEqual(digitSequenceToVietnamese('01'), 'không một');
    assert.strictEqual(digitSequenceToVietnamese('2026'), 'hai không hai sáu');

    assert.strictEqual(integerToVietnamese(0), 'không');
    assert.strictEqual(integerToVietnamese(5), 'năm');
    assert.strictEqual(integerToVietnamese(10), 'mười');
    assert.strictEqual(integerToVietnamese(15), 'mười lăm');
    assert.strictEqual(integerToVietnamese(24), 'hai mươi tư');
    assert.strictEqual(integerToVietnamese(95), 'chín mươi lăm');
    assert.strictEqual(integerToVietnamese(100), 'một trăm');
    assert.strictEqual(integerToVietnamese(-5), 'âm năm');
  });

  await t.test('2. Seven algebraic identities formula normalization', () => {
    const input = 'Ta có công thức: (a + b)^2 = a^2 + 2ab + b^2 và (a - b)^2 = a^2 - 2ab + b^2.';
    const result = normalizeVietnameseNarration(input);
    assert.ok(result.normalizedText.includes('a cộng b tất cả bình phương'));
    assert.ok(result.normalizedText.includes('a bình phương cộng hai a b cộng b bình phương'));
    assert.ok(result.normalizedText.includes('a trừ b tất cả bình phương'));
    assert.ok(result.normalizedText.includes('a bình phương trừ hai a b cộng b bình phương'));

    const diffSquares = normalizeVietnameseNarration('Hiệu hai bình phương là a^2 - b^2.');
    assert.ok(diffSquares.normalizedText.includes('a bình phương trừ b bình phương'));

    const sumCubes = normalizeVietnameseNarration('Tổng hai lập phương là a^3 + b^3.');
    assert.ok(sumCubes.normalizedText.includes('a lập phương cộng b lập phương'));

    const cubeBinomial = normalizeVietnameseNarration('Lập phương một tổng là (a + b)^3.');
    assert.ok(cubeBinomial.normalizedText.includes('a cộng b tất cả lập phương'));
  });

  await t.test('3. Fractions, derivatives, and integrals normalization', () => {
    const fraction = normalizeVietnameseNarration('Hệ số là \\frac{1}{2}.');
    assert.ok(fraction.normalizedText.includes('1 phần 2'));

    const derivative = normalizeVietnameseNarration('Tính đạo hàm f\'(x) theo công thức \\frac{df}{dx}.');
    assert.ok(derivative.normalizedText.includes('f phẩy x'));
    assert.ok(derivative.normalizedText.includes('đạo hàm của f theo x'));

    const integral = normalizeVietnameseNarration('Xét tích phân \\int_0^1 x^2 dx.');
    assert.ok(integral.normalizedText.includes('tích phân từ không đến một của x bình phương theo x'));
  });

  await t.test('4. AI and Machine Learning terminology normalization', () => {
    const aiText = 'Mô hình Perceptron sử dụng Gradient Descent để tối ưu hóa Loss function với Learning rate nhỏ.';
    const result = normalizeVietnameseNarration(aiText);
    assert.ok(result.normalizedText.includes('mô hình pơ-sép-tròn'));
    assert.ok(result.normalizedText.includes('phương pháp hạ độ dốc'));
    assert.ok(result.normalizedText.includes('hàm mất mát'));
    assert.ok(result.normalizedText.includes('tốc độ học'));

    const attentionText = 'Self-Attention tính toán Query, Key, Value để tìm mối liên kết.';
    const attResult = normalizeVietnameseNarration(attentionText);
    assert.ok(attResult.normalizedText.includes('cơ chế tự chú ý'));
    assert.ok(attResult.normalizedText.includes('truy vấn, khóa và giá trị'));
  });

  await t.test('5. Decimals, percentages, and subscripts', () => {
    const text = 'Bước nhảy 0.01 với độ chính xác 95%, cập nhật trọng số w_{t+1} từ w_t.';
    const result = normalizeVietnameseNarration(text);
    assert.ok(result.normalizedText.includes('không phẩy không một'));
    assert.ok(result.normalizedText.includes('chín mươi lăm phần trăm'));
    assert.ok(result.normalizedText.includes('w tại bước t cộng một'));
    assert.ok(result.normalizedText.includes('w tại bước t'));
  });

  await t.test('6. Custom pronunciation hints precedence', () => {
    const customResult = normalizeVietnameseNarration('Học máy rất thú vị', {
      pronunciationHints: [{ written: 'Học máy', spoken: 'Machine learning' }]
    });
    assert.ok(customResult.normalizedText.includes('Machine learning rất thú vị'));
  });

  await t.test('7. Detection of unsupported LaTeX tokens and stripping', () => {
    const unsupported = normalizeVietnameseNarration('Ký hiệu \\fancyUnknownMacro trong bài giảng.');
    assert.ok(unsupported.unsupportedTokens.includes('\\fancyUnknownMacro'));
    // By default, unknown command backslash is stripped to prevent voice engine failure
    assert.ok(!unsupported.normalizedText.includes('\\fancyUnknownMacro'));
    assert.ok(unsupported.normalizedText.includes('fancyUnknownMacro'));
  });

  await t.test('8. Word count and estimated duration calculation', () => {
    const sample = normalizeVietnameseNarration('Đây là câu thuyết minh ngắn gồm mười từ mẫu.');
    assert.strictEqual(sample.wordCount, 10);
    assert.ok(sample.estimatedDurationSeconds >= 2.5 && sample.estimatedDurationSeconds <= 4.0);
  });
});

