import React from 'react';
import katex from 'katex';

export type MathExpressionStatus = 'rendered' | 'needs_review';

export interface MathExpressionRenderResult {
  status: MathExpressionStatus;
  html?: string;
  fallbackText: string;
  overflowRisk: boolean;
  fittedFontSize: number;
  errorCode?: 'empty_expression' | 'invalid_latex';
}

/** Pure deterministic rendering result used by Remotion and unit tests. */
export function renderMathExpressionMarkup(
  expression: string,
  options: { displayMode?: boolean; fontSize?: number; maxWidthPx?: number } = {}
): MathExpressionRenderResult {
  const source = expression.trim();
  const fontSize = options.fontSize ?? 36;
  const maxWidthPx = options.maxWidthPx ?? 560;
  const estimatedGlyphs = source
    .replace(/\\(?:frac|dfrac|tfrac|begin|end|left|right|operatorname)/g, 'WW')
    .replace(/\\[A-Za-z]+/g, 'W').length;
  const estimatedWidth = estimatedGlyphs * fontSize * 0.72;
  const overflowRisk = estimatedWidth > maxWidthPx;
  const fittedFontSize = overflowRisk ? Math.max(16, Math.floor(fontSize * maxWidthPx / estimatedWidth * 0.92)) : fontSize;
  if (!source) return { status: 'needs_review', fallbackText: 'Biểu thức trống', overflowRisk: false, fittedFontSize: fontSize, errorCode: 'empty_expression' };

  try {
    return {
      status: 'rendered',
      html: katex.renderToString(source, {
        displayMode: options.displayMode ?? true,
        throwOnError: true,
        strict: 'error',
        trust: false,
        output: 'htmlAndMathml'
      }),
      fallbackText: source,
      overflowRisk,
      fittedFontSize
    };
  } catch {
    return { status: 'needs_review', fallbackText: source, overflowRisk, fittedFontSize, errorCode: 'invalid_latex' };
  }
}

export interface MathExpressionProps {
  expression: string;
  displayMode?: boolean;
  fontSize?: number;
  maxWidthPx?: number;
  color?: string;
  className?: string;
}

/**
 * Safe mathematical typography. Malformed input is displayed verbatim and marked
 * needs_review; this component never repairs content or grants verification.
 */
export const MathExpression: React.FC<MathExpressionProps> = ({
  expression,
  displayMode = true,
  fontSize = 36,
  maxWidthPx = 560,
  color = '#F8FAFC',
  className
}) => {
  const result = renderMathExpressionMarkup(expression, { displayMode, fontSize, maxWidthPx });
  const style: React.CSSProperties = {
    color,
    fontSize: result.fittedFontSize,
    lineHeight: 1.35,
    maxWidth: maxWidthPx,
    width: '100%',
    overflow: 'hidden',
    overflowWrap: 'anywhere',
    textAlign: 'center'
  };

  if (result.status === 'rendered') {
    return (
      <div
        className={className}
        style={style}
        role="math"
        aria-label={expression}
        data-math-status="rendered"
        data-overflow-risk={String(result.overflowRisk)}
        data-fitted-font-size={result.fittedFontSize}
        dangerouslySetInnerHTML={{ __html: result.html! }}
      />
    );
  }
  return (
    <div
      className={className}
      style={{ ...style, fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', border: '1px solid #F59E0B', borderRadius: 8, padding: 12 }}
      role="math"
      aria-label={`Biểu thức cần kiểm tra: ${expression}`}
      data-math-status="needs_review"
      data-math-error={result.errorCode}
      data-overflow-risk={String(result.overflowRisk)}
      data-fitted-font-size={result.fittedFontSize}
    >
      {result.fallbackText}
    </div>
  );
};
