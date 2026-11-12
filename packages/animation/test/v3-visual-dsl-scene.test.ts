import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VisualDslSceneV3 } from '../src/educational/VisualDslSceneV3';
import { FormulaStepCard } from '../src/educational/FormulaSequenceSceneV3';
import { adaptScalarFunctionGraphV3 } from '../src/educational/scientific-visual-adapters-v3';
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
      trustedMathBindings: [],
      dataBindings: []
    };

    const html = renderToStaticMarkup(React.createElement(VisualDslSceneV3, { definition: sceneDef }));

    // KaTeX classes must be present
    assert.ok(html.includes('class="katex"'), 'KaTeX class must be present');
    assert.ok(html.includes('class="katex-html"'), 'KaTeX HTML output must be present');
    assert.ok(html.includes('class="mord'), 'KaTeX math symbols must be present');
    assert.equal(html.includes('✓ SymPy Verified'), false);
    assert.ok(html.includes('Chưa có proof binding hợp lệ'));
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
      trustedMathBindings: [],
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

  test('2b. Shows verified badge only with a server binding for the approved artifact version', () => {
    const sceneDef: VisualSceneDefinitionV3 = {
      schemaVersion: 'visual-dsl-v3.1', sceneId: 'trusted_scene', sceneType: 'formula_derivation',
      layout: 'centered_focus', style: 'math_chalkboard', animation: 'fade_in',
      elements: [{ elementType: 'formula', elementId: 'formula_trusted', latex: 'x^2', claimId: 'claim_x2', fontSize: 36, color: '#38BDF8', animation: 'step_reveal' }],
      mathBindings: [{ bindingId: 'binding_trusted', claimId: 'claim_x2', elementId: 'formula_trusted', formalExpression: 'x^2', mathSymbol: 'x^2', isVerified: true }],
      trustedMathBindings: [{ authority: 'server_sympy_v3', claimId: 'claim_x2', elementId: 'formula_trusted', verifiedExpression: 'x^2', normalizedExpressionFingerprint: 'a'.repeat(64), verificationResult: 'formally_verified', verificationTimestamp: '2026-11-10T00:00:00.000Z', approvedDraftVersion: 7, sourceSceneId: 'trusted_scene' }],
      dataBindings: []
    };
    const approved = renderToStaticMarkup(React.createElement(VisualDslSceneV3, { definition: sceneDef, trustedProofContext: { artifactIntegrityVerified: true, approvedDraftVersion: 7, verifiedBindingFingerprints: ['a'.repeat(64)] } }));
    const forgedProofId = renderToStaticMarkup(React.createElement(VisualDslSceneV3, { definition: sceneDef, trustedProofContext: { artifactIntegrityVerified: true, approvedDraftVersion: 7, verifiedBindingFingerprints: ['b'.repeat(64)] } }));
    const stale = renderToStaticMarkup(React.createElement(VisualDslSceneV3, { definition: sceneDef, trustedProofContext: { artifactIntegrityVerified: true, approvedDraftVersion: 8, verifiedBindingFingerprints: ['a'.repeat(64)] } }));
    const mismatchedExpression = structuredClone(sceneDef);
    const formula = mismatchedExpression.elements[0];
    if (formula?.elementType === 'formula') formula.latex = 'x^3';
    const mismatch = renderToStaticMarkup(React.createElement(VisualDslSceneV3, { definition: mismatchedExpression, trustedProofContext: { artifactIntegrityVerified: true, approvedDraftVersion: 7, verifiedBindingFingerprints: ['a'.repeat(64)] } }));
    const missingContext = renderToStaticMarkup(React.createElement(VisualDslSceneV3, { definition: sceneDef }));
    const numericOnly = structuredClone(sceneDef);
    numericOnly.trustedMathBindings = [];
    const numericOnlyHtml = renderToStaticMarkup(React.createElement(VisualDslSceneV3, { definition: numericOnly, trustedProofContext: { artifactIntegrityVerified: true, approvedDraftVersion: 7, verifiedBindingFingerprints: ['a'.repeat(64)] } }));
    assert.ok(approved.includes('SymPy Verified: claim_x2'));
    assert.equal(forgedProofId.includes('SymPy Verified: claim_x2'), false);
    assert.equal(stale.includes('SymPy Verified: claim_x2'), false);
    assert.equal(mismatch.includes('SymPy Verified: claim_x2'), false);
    assert.equal(missingContext.includes('SymPy Verified: claim_x2'), false);
    assert.equal(numericOnlyHtml.includes('SymPy Verified: claim_x2'), false);
  });

  test('2d. Holds completed curve and separates point and tangent labels in continuation scenes', () => {
    const definition = adaptScalarFunctionGraphV3({
      kind: 'scalar_function_1d', functionType: 'polynomial', expression: 'x^2',
      xRange: [-1, 3], yRange: [-1, 9], pointX: 1, tangentAtX: 1,
      secantFromX: 1, secantToX: 1.3, claimId: 'claim_derivative', validation: 'formally_verified'
    }, 'continuation', { phase: 'secant_step' });
    const html = renderToStaticMarkup(React.createElement(VisualDslSceneV3, { definition, frame: 0, durationInFrames: 720 }));
    assert.ok(html.includes('data-progress="1.0000"'));
    assert.ok(html.includes('Q(1.30, 1.69)'));
    assert.ok(html.includes('f&#x27;(1) = 2.00'));
    assert.ok(html.includes('text-anchor="end"'));
  });

  test('2e. Animates a typed secant progression without knowing the lesson topic', () => {
    const definition = adaptScalarFunctionGraphV3({
      kind: 'scalar_function_1d', functionType: 'polynomial', expression: 'x^3',
      xRange: [-1, 3], yRange: [-2, 27], pointX: 1, tangentAtX: 1,
      secantFromX: 1, secantToX: 2, secantProgression: [2, 1.5, 1.1],
      claimId: 'claim_cubic', validation: 'formally_verified'
    }, 'generic_motion', { phase: 'secant_motion' });
    const start = renderToStaticMarkup(React.createElement(VisualDslSceneV3, { definition, frame: 0, durationInFrames: 240 }));
    const end = renderToStaticMarkup(React.createElement(VisualDslSceneV3, { definition, frame: 220, durationInFrames: 240 }));
    assert.ok(start.includes('Q(2.00, 8.00)'));
    assert.ok(end.includes('Q(1.10, 1.33)'));
  });

  test('2c. Formula step reference alone remains neutral even with artifact integrity', () => {
    const html = renderToStaticMarkup(React.createElement(FormulaStepCard, {
      step: {
        stepId: 'step_neutral',
        latex: 'a^2+2ab+b^2',
        explanation: 'Khai triển đại số',
        highlightTerms: ['2ab'],
        claimIds: ['claim_square_sum'],
        proofReferenceId: 'forged_proof_reference'
      },
      stepNumber: 1,
      totalSteps: 1,
      isActive: true,
      isVisible: true,
      revealOpacity: 1,
      revealTranslateY: 0,
      highlightPulseProgress: 0,
      trustedProofContext: {
        artifactIntegrityVerified: true,
        approvedDraftVersion: 7,
        verifiedBindingFingerprints: ['a'.repeat(64)]
      }
    }));
    assert.ok(html.includes('Biến đổi đại số từng bước'));
    assert.equal(html.includes('SymPy'), false);
    assert.equal(html.includes('forged_proof_reference'), false);
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
      trustedMathBindings: [],
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
      trustedMathBindings: [],
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
      trustedMathBindings: [],
      dataBindings: []
    };

    assert.throws(
      () => renderToStaticMarkup(React.createElement(VisualDslSceneV3, { definition: invalidScene })),
      /graph_render_failed|unsupported_function_type/
    );
  });
});

