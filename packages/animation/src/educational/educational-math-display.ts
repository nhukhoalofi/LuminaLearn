/**
 * Converts trusted mathematical content into student-facing plain display text.
 * This is presentation-only: it never mutates claims, proof records, or artifacts.
 */
export function formatEducationalMathDisplay(value: string): string {
  return value
    .replace(/diff\(\s*x\^2\s*,\s*x\s*\)\.subs\(\s*x\s*,\s*1\s*\)\s*=\s*2/gi, "f′(1) = 2")
    .replace(/diff\(\s*x\^2\s*,\s*x\s*\)\s*=\s*2\s*\*?\s*x/gi, "f'(x) = 2x")
    .replace(/dL\s*\/\s*dw/gi, "L′(w)")
    .replace(/\\eta\b/g, 'η')
    .replace(/\\nabla\b/g, '∇')
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\times\b/g, '×')
    .replace(/\\to\b/g, '→')
    .replace(/\\(?:left|right)\b/g, '')
    .replace(/\bw_mới\b/gi, 'w mới')
    .replace(/w_cũ/gi, 'w cũ')
    .replace(/\beta\s*\*?\s*nabla\b/gi, 'η∇')
    .replace(/\beta\b/gi, 'η')
    .replace(/\bnabla\b/gi, '∇')
    .replace(/\(x\^n\)'\s*=\s*n\s*\*\s*x\^\(n-1\)/gi, "(xⁿ)' = n·xⁿ⁻¹")
    .replace(/([0-9])\s*\*\s*([a-z])\s*\*\s*([a-z])/gi, '$1$2$3')
    .replace(/([a-z])\s*\*\s*([a-z])/gi, '$1$2')
    .replace(/\s*\*\s*/g, '·')
    .replace(/\s*->\s*/g, ' → ')
    .replace(/\^2\b/g, '²')
    .replace(/_\{t\+1\}/g, 'ₜ₊₁')
    .replace(/_t\b/g, 'ₜ')
    .replace(/_\{?0\}?/g, '₀')
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\\quad/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Presentation-only normalization for trusted algebra strings before KaTeX. */
export function normalizeEducationalMathLatex(value: string): string {
  return value
    .replace(/([0-9])\s*\*\s*([a-z])\s*\*\s*([a-z])/gi, '$1$2$3')
    .replace(/([a-z])\s*\*\s*([a-z])/gi, '$1$2')
    .replace(/\*/g, '\\cdot ')
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
