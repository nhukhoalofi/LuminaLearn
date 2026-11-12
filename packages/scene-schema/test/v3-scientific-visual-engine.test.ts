import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AttentionMatrixDataV1Schema,
  Geometry2dDataV1Schema,
  ProbabilityTreeDataV1Schema,
  MOTION_RECIPE_REGISTRY_V1,
  VISUAL_CAPABILITY_REGISTRY_V1,
  resolveVisualCapabilityV1
} from '../src/v3/index';

const graphData = {
  kind: 'scalar_function_1d' as const,
  functionType: 'polynomial' as const,
  expression: 'x^2', xRange: [-2, 2] as [number, number], yRange: [-1, 5] as [number, number],
  pointX: 1, tangentAtX: 1, claimId: 'claim_derivative', validation: 'formally_verified' as const
};

describe('Quality Sprint B scientific visual engine contracts', () => {
  it('selects graph adapter from typed scientific data without a topic name', () => {
    const result = resolveVisualCapabilityV1({ visualIntent: 'graph_and_tangent', scientificData: graphData, sceneType: 'formula_derivation', availableValidation: ['formal_math'], durationFrames: 240 });
    assert.equal(result.status, 'selected');
    if (result.status === 'selected') assert.equal(result.capability.rendererAdapterId, 'cartesian_graph_v3');
  });

  it('fails closed when validation required by a render-ready adapter is absent', () => {
    const result = resolveVisualCapabilityV1({ visualIntent: 'graph_and_tangent', scientificData: graphData, sceneType: 'formula_derivation', availableValidation: [], durationFrames: 240 });
    assert.equal(result.status, 'needs_review');
    if ('finding' in result) assert.equal(result.finding.code, 'visual_validation_missing');
  });

  it('keeps geometry and probability planning-only instead of fabricating evidence', () => {
    const geometry = Geometry2dDataV1Schema.parse({ kind: 'geometry_2d', points: [{ pointId: 'point_a', x: 0, y: 0 }, { pointId: 'point_b', x: 1, y: 0 }, { pointId: 'point_c', x: 0, y: 1 }], segments: [{ fromPointId: 'point_a', toPointId: 'point_b' }], polygons: [{ pointIds: ['point_a', 'point_b', 'point_c'], areaClaimId: 'claim_area' }], claimIds: ['claim_area'], validation: 'formally_verified' });
    const result = resolveVisualCapabilityV1({ visualIntent: 'geometric_proof', scientificData: geometry, sceneType: 'algebra_identity', availableValidation: ['formal_math', 'human_review'], durationFrames: 240 });
    assert.equal(result.status, 'needs_review');
    if ('finding' in result) assert.equal(result.finding.code, 'visual_adapter_not_ready');
    assert.equal(VISUAL_CAPABILITY_REGISTRY_V1.probability_tree.readinessStatus, 'planning_only');

    // Maturity precedence: planning_only is not masked even if availableValidation is empty
    const withoutValidation = resolveVisualCapabilityV1({ visualIntent: 'geometric_proof', scientificData: geometry, sceneType: 'algebra_identity', availableValidation: [], durationFrames: 240 });
    assert.equal(withoutValidation.status, 'needs_review');
    if ('finding' in withoutValidation) assert.equal(withoutValidation.finding.code, 'visual_adapter_not_ready');
  });

  it('validates attention probability rows and rejects inconsistent matrices', () => {
    assert.doesNotThrow(() => AttentionMatrixDataV1Schema.parse({ kind: 'attention_matrix', tokens: ['A', 'B'], weights: [[0.8, 0.2], [0.1, 0.9]], validation: 'deterministic_numeric' }));
    assert.throws(() => AttentionMatrixDataV1Schema.parse({ kind: 'attention_matrix', tokens: ['A', 'B'], weights: [[0.8, 0.4], [0.1, 0.9]], validation: 'deterministic_numeric' }), /sum to one/);
  });

  it('validates probability conservation even while the tree adapter remains planning-only', () => {
    assert.doesNotThrow(() => ProbabilityTreeDataV1Schema.parse({ kind: 'probability_tree', rootLabel: 'Root', validation: 'deterministic_numeric', branches: [
      { branchId: 'branch_yes', label: 'Có', probability: 0.4 },
      { branchId: 'branch_no', label: 'Không', probability: 0.6 }
    ] }));
    assert.throws(() => ProbabilityTreeDataV1Schema.parse({ kind: 'probability_tree', rootLabel: 'Root', validation: 'deterministic_numeric', branches: [
      { branchId: 'branch_yes', label: 'Có', probability: 0.7 },
      { branchId: 'branch_no', label: 'Không', probability: 0.6 }
    ] }), /sum to one/);
  });

  it('registers at least six implemented deterministic motion recipes', () => {
    const ready = Object.values(MOTION_RECIPE_REGISTRY_V1).filter((recipe) => recipe.readinessStatus === 'render_ready');
    assert.ok(ready.length >= 6);
    assert.deepEqual(ready.map((recipe) => recipe.recipeId).sort(), ['R01', 'R02', 'R03', 'R04', 'R05', 'R07', 'R08', 'R10']);
  });
});

