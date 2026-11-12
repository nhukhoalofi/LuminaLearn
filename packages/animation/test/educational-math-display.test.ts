import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatEducationalMathDisplay, normalizeEducationalMathLatex, supportedSubtitleMathLatex } from '../src/educational/educational-math-display';

describe('student-facing mathematical display text', () => {
  it('does not expose SymPy or raw LaTeX commands in the derivative summary', () => {
    assert.equal(formatEducationalMathDisplay('diff(x^2, x) = 2x'), "f'(x) = 2x");
    assert.equal(
      formatEducationalMathDisplay("f'(x) = 2x \\quad \\text{và} \\quad m = 2 \\quad \\text{tại} \\quad x = 1"),
      "f'(x) = 2x và m = 2 tại x = 1"
    );
    assert.equal(formatEducationalMathDisplay('diff(x^2, x).subs(x, 1) = 2'), 'f′(1) = 2');
  });

  it('converts only the supported derivative-limit subtitle into valid KaTeX input', () => {
    assert.equal(
      supportedSubtitleMathLatex("f'(x) = lim_{h⟶0} [(x+h)² - x²] / h = lim_{h⟶0} (2x + h) = 2x"),
      "f'(x) = \\lim_{h \\to 0} \\frac{(x+h)^2-x^2}{h} = \\lim_{h \\to 0}(2x+h) = 2x"
    );
    assert.equal(supportedSubtitleMathLatex('Một câu phụ đề thông thường.'), undefined);
    assert.equal(
      formatEducationalMathDisplay("Quy tắc lũy thừa: (x^n)' = n * x^(n-1)"),
      "Quy tắc lũy thừa: (xⁿ)' = n·xⁿ⁻¹"
    );
  });

  it('normalizes computer algebra notation for student-facing rendering only', () => {
    assert.equal(formatEducationalMathDisplay('L(w) = (w-2)^2 + 1 • dL/dw = 2*(w-2) • w=4 -> 2.4'), 'L(w) = (w-2)² + 1 • L′(w) = 2·(w-2) • w=4 → 2.4');
    assert.equal(
      formatEducationalMathDisplay('w = w_0 - \\eta \\cdot \\nabla L(w)'),
      'w = w₀ - η · ∇ L(w)'
    );
    assert.equal(
      formatEducationalMathDisplay('Quy tắc cập nhật: w_mới = w_cũ - eta * nabla L(w)'),
      'Quy tắc cập nhật: w mới = w cũ - η∇ L(w)'
    );
    assert.equal(normalizeEducationalMathLatex('a^2+2*a*b+b^2'), 'a^2+2ab+b^2');
  });
});
