import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MathExpression, renderMathExpressionMarkup } from '../src/educational/MathExpression';

describe('MathExpression', () => {
  const representative = [
    String.raw`\frac{1}{3}`,
    String.raw`x^2 + x_1`,
    String.raw`\alpha + \Delta x`,
    String.raw`f'(x)=\lim_{h\to 0}\frac{f(x+h)-f(x)}{h}`,
    String.raw`\begin{bmatrix}1&2\\3&4\end{bmatrix}`,
    String.raw`\int_0^1 x^2\,dx=\frac{1}{3}`
  ];

  it('typesets fractions, powers, Greek letters, derivatives, matrices and equations deterministically', () => {
    for (const expression of representative) {
      const first = renderMathExpressionMarkup(expression);
      const second = renderMathExpressionMarkup(expression);
      assert.equal(first.status, 'rendered', expression);
      assert.equal(first.html, second.html);
      assert.match(first.html!, /katex/);
      assert.doesNotMatch(first.html!, /<script/i);
    }
  });

  it('renders accessible KaTeX markup instead of raw final text', () => {
    const markup = renderToStaticMarkup(React.createElement(MathExpression, { expression: String.raw`\frac{x^2}{2}` }));
    assert.match(markup, /data-math-status="rendered"/);
    assert.match(markup, /katex-mathml/);
    assert.match(markup, /aria-label/);
  });

  it('fails safely and marks malformed expressions for review', () => {
    const markup = renderToStaticMarkup(React.createElement(MathExpression, { expression: String.raw`\frac{1}{` }));
    assert.match(markup, /data-math-status="needs_review"/);
    assert.match(markup, /data-math-error="invalid_latex"/);
    assert.match(markup, /\\frac/);
  });

  it('flags likely 9:16 clipping before render QA', () => {
    const result = renderMathExpressionMarkup(String.raw`x_1+x_2+x_3+x_4+x_5+x_6+x_7+x_8+x_9+x_{10}`, { fontSize: 48, maxWidthPx: 180 });
    assert.equal(result.status, 'rendered');
    assert.equal(result.overflowRisk, true);
    assert.ok(result.fittedFontSize < 48);
  });
});
