import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LossLandscapeVisualPayloadSchema } from '@luminalearn/scene-schema';
import { deriveLossLandscapeFrameV3, evaluateQuadraticLossV3 } from '../src/educational/loss-landscape-motion-v3';

const example = LossLandscapeVisualPayloadSchema.parse({
  sceneType: 'loss_landscape',
  functionType: 'convex_quadratic',
  minimumPoint: { w: 0, loss: 0 },
  curvature: 1,
  currentParam: 2,
  learningRate: 0.3,
  showGradientTangent: true,
  steps: [
    { stepNumber: 1, w: 2, loss: 4, gradient: 4 },
    { stepNumber: 2, w: 0.8, loss: 0.64, gradient: 1.6 },
    { stepNumber: 3, w: 0.32, loss: 0.1024, gradient: 0.64 }
  ]
});

describe('Verified loss landscape frame motion', () => {
  it('starts at the known initial point and ends at the validated final step', () => {
    const start = deriveLossLandscapeFrameV3(example, 0, 240);
    const end = deriveLossLandscapeFrameV3(example, 239, 240);
    assert.equal(start.w, 2);
    assert.equal(start.loss, 4);
    assert.equal(start.gradient, 4);
    assert.ok(Math.abs(end.w - 0.32) < 1e-10);
    assert.ok(Math.abs(end.loss - 0.1024) < 1e-10);
    assert.ok(Math.abs(end.gradient - 0.64) < 1e-10);
  });

  it('keeps every animated frame mathematically on the same curve', () => {
    let lastW = Number.POSITIVE_INFINITY;
    for (let frame = 0; frame < 240; frame++) {
      const state = deriveLossLandscapeFrameV3(example, frame, 240);
      assert.ok(Number.isFinite(state.w) && Number.isFinite(state.gradient) && Number.isFinite(state.loss));
      assert.ok(state.w <= lastW + 1e-10);
      assert.ok(Math.abs(state.loss - state.w * state.w) < 1e-10);
      assert.ok(Math.abs(state.gradient - 2 * state.w) < 1e-10);
      lastW = state.w;
    }
  });

  it('supports shifted, non-unit quadratic examples without demo hardcoding', () => {
    const shifted = LossLandscapeVisualPayloadSchema.parse({
      ...example,
      minimumPoint: { w: 1, loss: 2 },
      curvature: 2,
      currentParam: 3,
      learningRate: 0.1,
      steps: [
        { stepNumber: 1, w: 3, loss: 10, gradient: 8 },
        { stepNumber: 2, w: 2.2, loss: 4.88, gradient: 4.8 }
      ]
    });
    for (let frame = 0; frame < 100; frame++) {
      const state = deriveLossLandscapeFrameV3(shifted, frame, 100);
      const expected = evaluateQuadraticLossV3(shifted, state.w);
      assert.ok(Math.abs(state.loss - expected.loss) < 1e-10);
      assert.ok(Math.abs(state.gradient - expected.gradient) < 1e-10);
    }
  });

  it('is deterministic and handles a single-step scene', () => {
    assert.deepEqual(deriveLossLandscapeFrameV3(example, 75, 180), deriveLossLandscapeFrameV3(example, 75, 180));
    const single = LossLandscapeVisualPayloadSchema.parse({ ...example, steps: [example.steps[0]] });
    assert.equal(deriveLossLandscapeFrameV3(single, 30, 80).w, 2);
    assert.throws(() => deriveLossLandscapeFrameV3(example, Number.NaN, 100), /invalid_frame/);
  });
});
