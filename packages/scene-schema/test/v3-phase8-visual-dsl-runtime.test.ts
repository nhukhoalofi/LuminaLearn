import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VISUAL_PRIMITIVE_READINESS_V3, VisualSceneDefinitionV3Schema } from '../src/v3';

const base = {
  sceneId: 'dsl-test',
  sceneType: 'gradient_descent_dsl',
  elements: [
    { elementType: 'formula' as const, elementId: 'formula', latex: 'L(w)=(w-2)^2', claimId: 'claim-loss' },
    { elementType: 'text' as const, elementId: 'label', content: 'Hàm mất mát', position: { x: 360, y: 100 } },
    { elementType: 'arrow' as const, elementId: 'arrow', fromElementId: 'label', toElementId: 'formula' }
  ],
  mathBindings: [{ bindingId: 'binding', claimId: 'claim-loss', elementId: 'formula', formalExpression: 'L(w)=(w-2)^2', mathSymbol: 'L' }]
};

test('Visual DSL accepts stable references and verified formula bindings', () => {
  assert.equal(VisualSceneDefinitionV3Schema.safeParse(base).success, true);
});

test('Visual DSL rejects duplicate IDs, dangling references, invalid bindings and unsafe positions', () => {
  assert.equal(VisualSceneDefinitionV3Schema.safeParse({ ...base, elements: [...base.elements, base.elements[0]] }).success, false);
  assert.equal(VisualSceneDefinitionV3Schema.safeParse({ ...base, elements: [{ ...base.elements[2], fromElementId: 'missing' }] }).success, false);
  assert.equal(VisualSceneDefinitionV3Schema.safeParse({ ...base, mathBindings: [{ ...base.mathBindings[0], elementId: 'label' }] }).success, false);
  assert.equal(VisualSceneDefinitionV3Schema.safeParse({ ...base, elements: [{ ...base.elements[1], position: { x: 721, y: 100 } }] }).success, false);
});

test('Component readiness distinguishes runtime primitives from schema-only primitives', () => {
  for (const primitive of ['formula', 'text', 'graph', 'axes', 'point', 'arrow', 'matrix', 'labeled_step', 'neural_node', 'neural_connection'] as const) {
    assert.equal(VISUAL_PRIMITIVE_READINESS_V3[primitive], 'render_ready');
  }
  assert.equal(VISUAL_PRIMITIVE_READINESS_V3.vector, 'schema_only');
  assert.equal(VISUAL_PRIMITIVE_READINESS_V3.callout, 'schema_only');
});
