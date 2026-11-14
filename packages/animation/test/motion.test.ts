import assert from 'node:assert/strict';
import { test } from 'node:test';
import { durationBoundedFrame, progressBetween } from '../src/motion';

test('motion helpers remain duration-bounded and deterministic', () => {
  assert.equal(durationBoundedFrame(-5, 24), 0);
  assert.equal(durationBoundedFrame(99, 24), 23);
  assert.equal(progressBetween(0, 4, 10), 0);
  assert.equal(progressBetween(14, 4, 10), 1);
  assert.equal(progressBetween(9, 4, 10), 0.5);
});
