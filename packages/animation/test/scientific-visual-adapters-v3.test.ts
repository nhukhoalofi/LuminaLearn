import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptAttentionMatrixV3,
  adaptDirectedDiagramV3,
  adaptFormulaSequenceV3,
  adaptGeometry2dV3,
  adaptProbabilityTreeV3,
  adaptScalarFunctionGraphV3
} from '../src/educational/scientific-visual-adapters-v3';

describe('Quality Sprint B scientific visual adapters', () => {
  it('builds a reusable graph whose marker lies on the same source function', () => {
    const scene = adaptScalarFunctionGraphV3({ kind: 'scalar_function_1d', functionType: 'polynomial', expression: '2*x^2+1', xRange: [-2, 2], yRange: [0, 10], pointX: 2, tangentAtX: 2, secantFromX: 1, secantToX: 2, claimId: 'claim_parabola', validation: 'formally_verified' });
    const point = scene.elements.find((element) => element.elementType === 'point');
    const graph = scene.elements.find((element) => element.elementType === 'graph');
    assert.deepEqual(point && 'coordinates' in point ? point.coordinates : undefined, [2, 9]);
    assert.equal(graph && 'tangentAtX' in graph ? graph.tangentAtX : undefined, 2);
    assert.equal(graph && 'showSecantLine' in graph ? graph.showSecantLine : undefined, true);
    assert.equal(scene.style, 'ai_data_story');
  });

  it('builds directed diagrams from typed nodes and edges rather than a fixed network', () => {
    const scene = adaptDirectedDiagramV3({ kind: 'directed_diagram', nodes: [
      { nodeId: 'input_one', label: 'Input', layer: 0 }, { nodeId: 'hidden_one', label: 'Hidden', layer: 1 }, { nodeId: 'output_one', label: 'Output', layer: 2 }
    ], edges: [
      { edgeId: 'edge_input_hidden', fromNodeId: 'input_one', toNodeId: 'hidden_one', weight: 0.4 }, { edgeId: 'edge_hidden_output', fromNodeId: 'hidden_one', toNodeId: 'output_one', weight: 0.8 }
    ], validation: 'source_grounded' });
    assert.equal(scene.elements.filter((element) => element.elementType === 'neural_node').length, 3);
    assert.equal(scene.elements.filter((element) => element.elementType === 'neural_connection').length, 2);
    assert.equal(scene.style, 'systems_whiteboard');
  });

  it('preserves attention matrix values exactly and rejects non-normalized rows', () => {
    const scene = adaptAttentionMatrixV3({ kind: 'attention_matrix', tokens: ['A', 'B'], weights: [[0.7, 0.3], [0.25, 0.75]], validation: 'deterministic_numeric' });
    const matrix = scene.elements.find((element) => element.elementType === 'matrix');
    assert.deepEqual(matrix && 'values' in matrix ? matrix.values : undefined, [[0.7, 0.3], [0.25, 0.75]]);
    assert.throws(() => adaptAttentionMatrixV3({ kind: 'attention_matrix', tokens: ['A', 'B'], weights: [[0.7, 0.5], [0.25, 0.75]], validation: 'deterministic_numeric' }), /sum to one/);
  });

  it('requires proof references for every formally verified formula step', () => {
    assert.throws(() => adaptFormulaSequenceV3({ kind: 'verified_formula_steps', title: 'Identity', validation: 'formally_verified', steps: [
      { stepId: 'formula_step_1', latex: '(a+b)^2', explanation: 'Start', highlightTerms: [], claimIds: ['claim_identity'] },
      { stepId: 'formula_step_2', latex: 'a^2+2ab+b^2', explanation: 'Expand', highlightTerms: ['2ab'], claimIds: ['claim_identity'] }
    ] }), /proofReferenceId/);
  });

  it('builds 2D geometry primitives with points, segments, and polygons', () => {
    const scene = adaptGeometry2dV3({
      kind: 'geometry_2d',
      points: [
        { pointId: 'A', x: 0, y: 0 },
        { pointId: 'B', x: 4, y: 0 },
        { pointId: 'C', x: 0, y: 3 }
      ],
      segments: [
        { fromPointId: 'A', toPointId: 'B' },
        { fromPointId: 'B', toPointId: 'C' },
        { fromPointId: 'C', toPointId: 'A' }
      ],
      polygons: [
        { pointIds: ['A', 'B', 'C'], areaClaimId: 'claim_triangle_area' }
      ],
      claimIds: ['claim_triangle_area'],
      validation: 'formally_verified'
    });
    assert.equal(scene.elements.filter((el) => el.elementType === 'point').length, 3);
    assert.equal(scene.elements.filter((el) => el.elementType === 'segment').length, 3);
    assert.equal(scene.elements.filter((el) => el.elementType === 'polygon').length, 1);
  });

  it('builds probability tree hierarchical nodes and branch edges', () => {
    const scene = adaptProbabilityTreeV3({
      kind: 'probability_tree',
      rootLabel: 'Bệnh',
      branches: [
        { branchId: 'pos', label: 'Dương tính', probability: 0.99 },
        { branchId: 'neg', label: 'Âm tính', probability: 0.01 }
      ],
      validation: 'deterministic_numeric'
    });
    assert.ok(scene.elements.some((el) => el.elementType === 'neural_node' && el.elementId === 'probability_tree_scene_root'));
    assert.ok(scene.elements.some((el) => el.elementType === 'neural_node' && el.elementId === 'pos'));
    assert.ok(scene.elements.some((el) => el.elementType === 'neural_connection' && el.elementId === 'edge_pos'));
  });
});

