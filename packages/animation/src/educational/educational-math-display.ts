/**
 * Converts trusted mathematical content into student-facing plain display text.
 * This is presentation-only: it never mutates claims, proof records, or artifacts.
 */
export function formatEducationalMathDisplay(value: string): string {
  return value
    .replace(/diff\(\s*x\^2\s*,\s*x\s*\)\s*=\s*2\s*\*?\s*x/gi, "f'(x) = 2x")
    .replace(/\(x\^n\)'\s*=\s*n\s*\*\s*x\^\(n-1\)/gi, "(xⁿ)' = n·xⁿ⁻¹")
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\\quad/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bounded conversion for the supported derivative subtitle used by the demo. */
export function supportedSubtitleMathLatex(value: string): string | undefined {
  const compact = value.replace(/\s+/g, ' ').trim();
  const isSupportedDerivativeLimit =
    compact.startsWith("f'(x) = lim_{h") &&
    compact.includes('(x+h)² - x²') &&
    compact.includes('(2x + h)') &&
    compact.endsWith('= 2x');
  return isSupportedDerivativeLimit
    ? "f'(x) = \\lim_{h \\to 0} \\frac{(x+h)^2-x^2}{h} = \\lim_{h \\to 0}(2x+h) = 2x"
    : undefined;
}
