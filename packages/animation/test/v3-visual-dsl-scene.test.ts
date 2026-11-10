import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VisualDslSceneV3 } from '../src/educational/VisualDslSceneV3';
import type { VisualSceneDefinitionV3 } from '@luminalearn/scene-schema';

describe('VisualDslSceneV3 — Visual Fidelity & Mathematical Typesetting', () => {
  test('1. Typesets LaTeX formula using KaTeX with real mathematical symbols and classes', () => {
    const sceneDef: VisualSceneDefinitionV3 = {
      schemaVersion: 'visual-dsl-v3.1',
      sceneId: 'test_formula_katex',
      sceneType: 'concept_intro',
      layout: 'centered_focus',
      style: 'math_chalkboard',
      animation: 'fade_in',
      elements: [
        {
          elementType: 'text',
          elementId: 'title_1',
          content: 'Khai triển hằng đẳng thức',
          typography: 'heading_1',
          color: '#F8FAFC',
          animation: 'fade_in'
        },
        {
          elementType: 'formula',
          elementId: 'formula_identity',
          latex: '(a + b)^2 = a^2 + 2ab + b^2',
          claimId: 'claim_algebra_1',
          fontSize: 32,
          color: '#38BDF8',
          animation: 'step_reveal'
        }
      ],
      mathBindings: [
        {
          bindingId: 'bind_1',
          claimId: 'claim_algebra_1',
          elementId: 'formula_identity',
          formalExpression: '(a + b)^2 = a^2 + 2*a*b + b^2',
          mathSymbol: 'Identity 1',
          isVerified: true
        }
      ],
      dataBindings: []
    };

    const html = renderToStaticMarkup(React.createElement(VisualDslSceneV3, { definition: sceneDef }));

    // KaTeX classes must be present
    assert.ok(html.includes('class="katex"'), 'KaTeX class must be present');
    assert.ok(html.includes('class="katex-html"'), 'KaTeX HTML output must be present');
    assert.ok(html.includes('class="mord'), 'KaTeX math symbols must be present');
    // Math claim binding badge must be visible
    assert.ok(html.includes('✓ SymPy Bound: claim_algebra_1'));
  });

  test('2. Renders real sampled graph curve and tangent line from mathematical parameters', () => {
    const sceneDef: VisualSceneDefinitionV3 = {
      schemaVersion: 'visual-dsl-v3.1',
      sceneId: 'test_gradient_graph',
      sceneType: 'loss_landscape',
      layout: 'split_screen',
      style: 'clean_educational_infographic',
      animation: 'draw_line',
      elements: [
        {
          elementType: 'axes',
          elementId: 'axes_1',
          xLabel: 'w',
          yLabel: 'L(w)',
          showGrid: true,
          gridColor: '#334155'
        },
        {
          elementType: 'graph',
          elementId: 'graph_loss',
          functionType: 'convex_quadratic',
          expression: 'w^2',
          xRange: [-3, 3],
          yRange: [-1, 9],
          showTangentLine: true,
          tangentAtX: 2.0,
          animation: 'draw_line'
        },
        {
          elementType: 'point',
          elementId: 'point_current',
          coordinates: [2.0, 4.0],
          label: 'w_0 = 2.0',
          color: '#EF4444',
          pulse: true,
          animation: 'highlight_pulse'
        }
      ],
      mathBindings: [],
      dataBindings: []
    };

    const html = renderToStaticMarkup(React.createElement(VisualDslSceneV3, { definition: sceneDef }));

    // Check SVG structure
    assert.ok(html.includes('id="scientific-axes-layer"'));
    assert.ok(html.includes('clipPath id="graph-viewport-clip"'));
    // Graph path should contain sampled curve coordinates
    assert.ok(html.includes('<path d="M '));
    // Tangent line should be present
    assert.ok(html.includes('stroke="#F59E0B"'));
    // Point marker should have coordinates and label
    assert.ok(html.includes('w_0 = 2.0'));
  });

  test('3. Renders labeled step with KaTeX formula and step number', () => {
    const sceneDef: VisualSceneDefinitionV3 = {
      schemaVersion: 'visual-dsl-v3.1',
      sceneId: 'test_step',
      sceneType: 'step_explanation',
      layout: 'centered_focus',
      style: 'math_chalkboard',
      animation: 'step_reveal',
      elements: [
        {
          elementType: 'labeled_step',
          elementId: 'step_1',
          stepNumber: 1,
          title: 'Cập nhật trọng số Gradient Descent',
          formula: 'w_{t+1} = w_t - \\eta \\nabla L(w_t)',
          explanation: 'Bước nhảy tham số tỷ lệ thuận với đạo hàm tổn thất.',
          animation: 'step_reveal'
        }
      ],
      mathBindings: [],
      dataBindings: []
    };

    const html = renderToStaticMarkup(React.createElement(VisualDslSceneV3, { definition: sceneDef }));
    assert.ok(html.includes('Cập nhật trọng số Gradient Descent'));
    assert.ok(html.includes('class="katex"'));
    assert.ok(html.includes('Bước nhảy tham số tỷ lệ thuận với đạo hàm tổn thất.'));
  });

  test('4. Renders matrix with heatmap cell intensities', () => {
    const sceneDef: VisualSceneDefinitionV3 = {
      schemaVersion: 'visual-dsl-v3.1',
      sceneId: 'test_matrix',
      sceneType: 'attention_heatmap',
      layout: 'centered_focus',
      style: 'clean_educational_infographic',
      animation: 'fade_in',
      elements: [
        {
          elementType: 'matrix',
          elementId: 'matrix_att',
          rows: 2,
          cols: 2,
          values: [[0.85, 0.15], [0.10, 0.90]],
          showHeatmap: true,
          animation: 'fade_in'
        }
      ],
      mathBindings: [],
      dataBindings: []
    };

    const html = renderToStaticMarkup(React.createElement(VisualDslSceneV3, { definition: sceneDef }));
    assert.ok(html.includes('0.85'));
    assert.ok(html.includes('0.15'));
    assert.ok(html.includes('rgba(56, 189, 248'));
  });

  test('5. Rejects unsupported function types with descriptive error', () => {
    const invalidScene: VisualSceneDefinitionV3 = {
      schemaVersion: 'visual-dsl-v3.1',
      sceneId: 'invalid_graph',
      sceneType: 'concept_intro',
      layout: 'centered_focus',
      style: 'clean_educational_infographic',
      animation: 'fade_in',
      elements: [
        {
          elementType: 'graph',
          elementId: 'graph_bad',
          functionType: 'custom_curve',
          xRange: [-2, 2],
          yRange: [-1, 5],
          showTangentLine: false,
          animation: 'draw_line'
        }
      ],
      mathBindings: [],
      dataBindings: []
    };

    assert.throws(
      () => renderToStaticMarkup(React.createElement(VisualDslSceneV3, { definition: invalidScene })),
      /graph_render_failed|unsupported_function_type/
    );
  });
});

