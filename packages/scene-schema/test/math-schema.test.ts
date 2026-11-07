import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateMathScene } from '../src/index';

const validScene = {
  schemaVersion: 'math-v1',
  topicId: 'calculus.derivative.intuition',
  visualization: 'secant_to_tangent',
  function: { type: 'polynomial', coefficients: [0, 0, 1] },
  pointX: 1,
  hStart: 2,
  hEnd: 0.05,
  durationSeconds: 8,
  fps: 24,
  width: 720,
  height: 1280
};

describe('Math visualization schema', () => {
  it('accepts the derivative secant-to-tangent scene', () => {
    assert.equal(validateMathScene(validScene).success, true);
  });

  it('rejects a template outside the approved allowlist', () => {
    assert.equal(validateMathScene({ ...validScene, visualization: 'python_module' }).success, false);
  });

  it('rejects h = 0 and an h interval moving away from zero', () => {
    assert.equal(validateMathScene({ ...validScene, hEnd: 0 }).success, false);
    assert.equal(validateMathScene({ ...validScene, hEnd: 3 }).success, false);
  });

  it('enforces render resource limits', () => {
    assert.equal(validateMathScene({ ...validScene, fps: 120 }).success, false);
    assert.equal(validateMathScene({ ...validScene, width: 4000 }).success, false);
    assert.equal(validateMathScene({ ...validScene, durationSeconds: 60 }).success, false);
  });

  it('rejects executable routing fields', () => {
    assert.equal(validateMathScene({ ...validScene, scriptPath: 'unsafe.py' }).success, false);
  });
});
