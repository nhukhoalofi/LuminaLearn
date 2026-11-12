import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatEducationalMathDisplay, supportedSubtitleMathLatex } from '../src/educational/educational-math-display';

describe('student-facing mathematical display text', () => {
  it('does not expose SymPy or raw LaTeX commands in the derivative summary', () => {
    assert.equal(formatEducationalMathDisplay('diff(x^2, x) = 2x'), "f'(x) = 2x");
    assert.equal(
      formatEducationalMathDisplay("f'(x) = 2x \\quad \\text{và} \\quad m = 2 \\quad \\text{tại} \\quad x = 1"),
      "f'(x) = 2x và m = 2 tại x = 1"
    );
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
});
