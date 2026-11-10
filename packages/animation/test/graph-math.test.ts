import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGraphFunction,
  validateAxisRange,
  createCoordinateTransform,
  sampleGraphPoints,
  generateGraphSvgPath,
  computeTangentLine,
  generateAxesAndGrid
} from '../src/educational/graph-math';

describe('Graph Math Engine — Scientific Correctness & Coordinate Transforms', () => {
  test('1. Validates axis ranges strictly and rejects invalid or non-finite inputs', () => {
    assert.deepEqual(validateAxisRange([-3, 3]), [-3, 3]);
    assert.deepEqual(validateAxisRange([0, 10]), [0, 10]);

    // Min >= Max
    assert.throws(() => validateAxisRange([3, 3]), /invalid_axis_range/);
    assert.throws(() => validateAxisRange([5, 1]), /invalid_axis_range/);

    // Non-finite or NaN
    assert.throws(() => validateAxisRange([NaN, 1]), /invalid_axis_range/);
    assert.throws(() => validateAxisRange([0, Infinity]), /invalid_axis_range/);
    assert.throws(() => validateAxisRange([-Infinity, 5]), /invalid_axis_range/);
  });

  test('2. Parses convex quadratic and evaluates exact analytical points and derivatives', () => {
    // Default y = x^2
    const defaultQuad = parseGraphFunction('convex_quadratic');
    assert.equal(defaultQuad.type, 'convex_quadratic');
    assert.equal(defaultQuad.evaluate(0), 0);
    assert.equal(defaultQuad.evaluate(2), 4);
    assert.equal(defaultQuad.evaluate(-3), 9);
    assert.equal(defaultQuad.derivative(0), 0);
    assert.equal(defaultQuad.derivative(2), 4); // d/dx(x^2) = 2x => at x=2 is 4
    assert.equal(defaultQuad.derivative(-3), -6);

    // Expression w^2 (loss landscape)
    const lossFn = parseGraphFunction('convex_quadratic', 'w^2');
    assert.equal(lossFn.evaluate(1.5), 2.25);
    assert.equal(lossFn.derivative(1.5), 3.0);

    // Shifted quadratic: (x-1)^2 + 2 => minimum at (1, 2)
    const shifted = parseGraphFunction('convex_quadratic', '(x-1)^2+2');
    assert.equal(shifted.evaluate(1), 2);
    assert.equal(shifted.evaluate(0), 3);
    assert.equal(shifted.derivative(1), 0);
    assert.equal(shifted.derivative(3), 4); // 2*(3-1) = 4

    // Non-convex (a <= 0) must throw
    assert.throws(() => parseGraphFunction('convex_quadratic', '-x^2'), /invalid_convex_quadratic/);
  });

  test('3. Parses linear functions with exact slope and intercept', () => {
    const linear = parseGraphFunction('linear', '2*x+1');
    assert.equal(linear.type, 'linear');
    assert.equal(linear.evaluate(0), 1);
    assert.equal(linear.evaluate(5), 11);
    assert.equal(linear.evaluate(-2), -3);
    assert.equal(linear.derivative(10), 2);
  });

  test('4. Parses sine and exponential functions with exact values', () => {
    const sine = parseGraphFunction('sine', 'sin(x)');
    assert.equal(sine.type, 'sine');
    assert.equal(sine.evaluate(0), 0);
    assert.ok(Math.abs(sine.evaluate(Math.PI / 2) - 1.0) < 1e-9);
    assert.ok(Math.abs(sine.derivative(0) - 1.0) < 1e-9); // cos(0) = 1

    const exp = parseGraphFunction('exponential', 'exp(x)');
    assert.equal(exp.type, 'exponential');
    assert.equal(exp.evaluate(0), 1);
    assert.ok(Math.abs(exp.evaluate(1) - Math.E) < 1e-9);
    assert.ok(Math.abs(exp.derivative(0) - 1.0) < 1e-9);
  });

  test('5. Rejects unsupported function types fail-closed', () => {
    assert.throws(() => parseGraphFunction('custom_curve'), /unsupported_function_type/);
    assert.throws(() => parseGraphFunction('hyperbolic'), /unsupported_function_type/);
    assert.throws(() => parseGraphFunction('arbitrary_code'), /unsupported_function_type/);
  });

  test('6. Two-way coordinate transformation maintains mathematical-to-screen fidelity', () => {
    const screenBox = { xMin: 100, yMin: 200, width: 500, height: 400 };
    const transform = createCoordinateTransform([-2, 2], [0, 4], screenBox);

    // Center x = 0 should be at screenBox.xMin + width/2 = 100 + 250 = 350
    assert.equal(transform.toScreenX(0), 350);
    assert.equal(transform.toScreenX(-2), 100);
    assert.equal(transform.toScreenX(2), 600);

    // Mathematical y = 4 (top) should be at screenBox.yMin = 200
    assert.equal(transform.toScreenY(4), 200);
    // Mathematical y = 0 (bottom) should be at screenBox.yMin + height = 600
    assert.equal(transform.toScreenY(0), 600);
    // Center y = 2 should be at 400
    assert.equal(transform.toScreenY(2), 400);

    // Invertible: toMath(toScreen(x)) === x
    assert.ok(Math.abs(transform.toMathX(transform.toScreenX(1.23)) - 1.23) < 1e-9);
    assert.ok(Math.abs(transform.toMathY(transform.toScreenY(3.45)) - 3.45) < 1e-9);
  });

  test('7. Samples graph points and generates deterministic SVG path without fabricating data', () => {
    const screenBox = { xMin: 60, yMin: 200, width: 600, height: 500 };
    const transform = createCoordinateTransform([-3, 3], [0, 9], screenBox);
    const fn = parseGraphFunction('convex_quadratic', 'x^2');

    const points = sampleGraphPoints(fn, transform, 25);
    assert.equal(points.length, 25);

    // Verify first, center, last points
    assert.ok(Math.abs(points[0].x - (-3)) < 1e-9);
    assert.ok(Math.abs(points[0].y - 9) < 1e-9);

    const midIdx = Math.floor(points.length / 2);
    assert.ok(Math.abs(points[midIdx].x - 0) < 1e-9);
    assert.ok(Math.abs(points[midIdx].y - 0) < 1e-9);

    assert.ok(Math.abs(points[24].x - 3) < 1e-9);
    assert.ok(Math.abs(points[24].y - 9) < 1e-9);

    // SVG path starts with M and contains L segments
    const path = generateGraphSvgPath(points);
    assert.ok(path.startsWith('M '));
    assert.ok(path.includes(' L '));
  });

  test('8. Tangent line calculation produces accurate gradient and slope coordinates', () => {
    const screenBox = { xMin: 60, yMin: 200, width: 600, height: 500 };
    const transform = createCoordinateTransform([-3, 3], [-1, 9], screenBox);
    const fn = parseGraphFunction('convex_quadratic', 'x^2');

    // At x = 2, y = 4, dL/dw = 4
    const tangent = computeTangentLine(fn, 2, transform, 1.0);
    assert.equal(tangent.x0, 2);
    assert.equal(tangent.y0, 4);
    assert.equal(tangent.slope, 4);
    assert.equal(tangent.label, 'dL/dw = 4');

    // At minimum x = 0, slope should be 0 (horizontal tangent)
    const minTangent = computeTangentLine(fn, 0, transform, 1.0);
    assert.equal(minTangent.x0, 0);
    assert.equal(minTangent.y0, 0);
    assert.equal(minTangent.slope, 0);
  });

  test('9. Grid and axes generation correctly locates origin and ticks', () => {
    const screenBox = { xMin: 60, yMin: 200, width: 600, height: 500 };
    const transform = createCoordinateTransform([-2, 4], [-2, 8], screenBox);

    const grid = generateAxesAndGrid(transform);
    // Origin is inside range, so both axes must be present
    assert.ok(grid.xAxisScreenY !== null);
    assert.ok(grid.yAxisScreenX !== null);
    assert.ok(grid.xTicks.length > 2);
    assert.ok(grid.yTicks.length > 2);
    assert.ok(grid.xGridLines.length > 2);
    assert.ok(grid.yGridLines.length > 2);
  });

  test('10. Polynomial evaluator follows the requested bounded coefficients and derivative', () => {
    const fixtures = [
      { expression: 'x^3-3*x', x: 2, y: 2, dy: 9 },
      { expression: '2*x^2+1', x: 2, y: 9, dy: 8 },
      { expression: '-x^3+4*x', x: 2, y: 0, dy: -8 },
      { expression: '0.5*x^4-2*x^2+3', x: 2, y: 3, dy: 8 }
    ];
    for (const fixture of fixtures) {
      const polynomial = parseGraphFunction('polynomial', fixture.expression);
      assert.equal(polynomial.evaluate(fixture.x), fixture.y, fixture.expression);
      assert.equal(polynomial.derivative(fixture.x), fixture.dy, `${fixture.expression} derivative`);
    }

    const adversarial = parseGraphFunction('polynomial', '2*x^2+1');
    assert.notEqual(adversarial.evaluate(2), Math.pow(2, 3) - 3 * 2);
  });

  test('11. Polynomial parser rejects executable, non-finite and degree-overflow syntax', () => {
    assert.throws(() => parseGraphFunction('polynomial', 'x^5+1'), /unsupported_polynomial_degree/);
    assert.throws(() => parseGraphFunction('polynomial', 'Infinity*x'), /unsupported_polynomial_expression/);
    assert.throws(() => parseGraphFunction('polynomial', 'process.exit(1)'), /unsupported_polynomial_expression/);
    assert.throws(() => parseGraphFunction('polynomial', 'x**2'), /unsupported_polynomial_term/);
    const polynomial = parseGraphFunction('polynomial', 'x^4');
    assert.throws(() => polynomial.evaluate(Number.MAX_VALUE), /polynomial_evaluation_overflow/);
  });
});

