import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GenericSceneVisualPayloadSchema, ScalarFunctionDataV1Schema } from '../src/index';

describe('typed mathematical presentation contract', () => {
  it('keeps display math, intent and numeric graph progression structured', () => {
    const scientificData = {
      kind: 'scalar_function_1d' as const, functionType: 'polynomial' as const,
      expression: 'x^3', xRange: [-2, 3] as [number, number], yRange: [-8, 27] as [number, number],
      pointX: 1, tangentAtX: 1, secantFromX: 1, secantToX: 2,
      secantProgression: [2, 1.5, 1.1], claimId: 'claim_cubic', validation: 'formally_verified' as const
    };
    assert.ok(ScalarFunctionDataV1Schema.safeParse(scientificData).success);
    assert.ok(GenericSceneVisualPayloadSchema.safeParse({
      sceneType: 'formula_derivation', headline: 'Giới hạn cát tuyến',
      displayMath: { latex: '\\lim_{q\\to p}m_{PQ}', accessibleText: 'Giới hạn hệ số góc cát tuyến', presentation: 'graph_overlay' },
      visualIntent: 'limit_transition', scientificData
    }).success);
  });

  it('rejects a progression outside the graph range or equal to the fixed point', () => {
    const base = {
      kind: 'scalar_function_1d' as const, functionType: 'polynomial' as const,
      expression: 'x^3', xRange: [-2, 3] as [number, number], yRange: [-8, 27] as [number, number],
      secantFromX: 1, secantToX: 2, claimId: 'claim_cubic', validation: 'formally_verified' as const
    };
    assert.equal(ScalarFunctionDataV1Schema.safeParse({ ...base, secantProgression: [2, 4] }).success, false);
    assert.equal(ScalarFunctionDataV1Schema.safeParse({ ...base, secantProgression: [2, 1] }).success, false);
  });
});
