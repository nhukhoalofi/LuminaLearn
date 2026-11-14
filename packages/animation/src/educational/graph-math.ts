/**
 * LuminaLearn V3.0 — Phase 9
 * Bounded Mathematical Graph Function Evaluation & SVG Coordinate Transformation
 *
 * Provides scientifically trustworthy sampling, bounds checking, numerical differentiation,
 * and SVG path generation for the bounded function catalog:
 * - convex_quadratic: y = a*(x - h)^2 + k  (default: y = x^2)
 * - linear:           y = m*x + b
 * - sine:             y = A*sin(w*x + phi) + C
 * - polynomial:       y = a_n*x^n + ... + a_0 (up to degree 4)
 * - exponential:      y = A*exp(k*x) + C
 *
 * Generic unvalidated custom curves are explicitly rejected to prevent fabricated mathematics.
 */

export type SupportedFunctionType = 'convex_quadratic' | 'linear' | 'sine' | 'polynomial' | 'exponential';

export interface EvaluatedFunction {
  type: SupportedFunctionType;
  evaluate: (x: number) => number;
  derivative: (x: number) => number;
  description: string;
}

export interface BoundedPolynomial {
  /** Coefficients in ascending power order: c[0] + c[1]x + ... */
  coefficients: readonly number[];
  degree: number;
}

const DECIMAL_PATTERN = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)';

export function parseBoundedPolynomial(expression: string): BoundedPolynomial {
  const cleaned = expression.replace(/\s+/g, '').replace(/w/g, 'x');
  if (!cleaned || cleaned.length > 100 || /[^0-9x+.*^\-]/.test(cleaned)) {
    throw new Error(`unsupported_polynomial_expression: '${expression}'`);
  }

  const normalized = cleaned.startsWith('-') ? cleaned : `+${cleaned}`;
  const terms = normalized.match(/[+-][^+-]+/g);
  if (!terms || terms.join('') !== normalized) {
    throw new Error(`unsupported_polynomial_expression: '${expression}'`);
  }

  const coefficients = [0, 0, 0, 0, 0];
  const variableTerm = new RegExp(`^([+-])(${DECIMAL_PATTERN})?\\*?x(?:\\^([0-9]+))?$`);
  const constantTerm = new RegExp(`^([+-])(${DECIMAL_PATTERN})$`);

  for (const term of terms) {
    const variable = variableTerm.exec(term);
    if (variable) {
      const power = variable[3] === undefined ? 1 : Number(variable[3]);
      if (!Number.isInteger(power) || power < 0 || power > 4) {
        throw new Error(`unsupported_polynomial_degree: Degree ${variable[3]} is outside 0..4`);
      }
      const magnitude = variable[2] === undefined ? 1 : Number(variable[2]);
      const coefficient = variable[1] === '-' ? -magnitude : magnitude;
      if (!Number.isFinite(coefficient)) throw new Error('invalid_polynomial_coefficient: Coefficients must be finite');
      coefficients[power] += coefficient;
      continue;
    }

    const constant = constantTerm.exec(term);
    if (constant) {
      const magnitude = Number(constant[2]);
      const coefficient = constant[1] === '-' ? -magnitude : magnitude;
      if (!Number.isFinite(coefficient)) throw new Error('invalid_polynomial_coefficient: Coefficients must be finite');
      coefficients[0] += coefficient;
      continue;
    }
    throw new Error(`unsupported_polynomial_term: '${term}'`);
  }

  const degree = coefficients.reduce((highest, coefficient, power) => coefficient !== 0 ? power : highest, 0);
  return { coefficients, degree };
}

function evaluatePolynomial(coefficients: readonly number[], x: number): number {
  if (!Number.isFinite(x)) throw new Error('invalid_polynomial_input: x must be finite');
  let result = 0;
  for (let power = coefficients.length - 1; power >= 0; power -= 1) result = result * x + coefficients[power];
  if (!Number.isFinite(result)) throw new Error('polynomial_evaluation_overflow');
  return result;
}

export interface ScreenBox {
  xMin: number;
  yMin: number;
  width: number;
  height: number;
}

export interface CoordinateTransform {
  toScreenX: (mathX: number) => number;
  toScreenY: (mathY: number) => number;
  toMathX: (screenX: number) => number;
  toMathY: (screenY: number) => number;
  screenBox: ScreenBox;
  xRange: [number, number];
  yRange: [number, number];
}

export interface GraphPoint {
  x: number;
  y: number;
  screenX: number;
  screenY: number;
  isDiscontinuous?: boolean;
}

export interface TangentLineResult {
  x0: number;
  y0: number;
  slope: number;
  screenX0: number;
  screenY0: number;
  screenX1: number;
  screenY1: number;
  screenX2: number;
  screenY2: number;
  label: string;
}

export interface AxisTick {
  value: number;
  screenCoord: number;
  label: string;
}

export interface AxesGridResult {
  xAxisScreenY: number | null;
  yAxisScreenX: number | null;
  xTicks: AxisTick[];
  yTicks: AxisTick[];
  xGridLines: { screenX: number }[];
  yGridLines: { screenY: number }[];
}

/**
 * Validates and sanitizes axis range.
 * Throws if range is reversed, zero-width, non-finite, or contains NaN/Infinity.
 */
export function validateAxisRange(range: [number, number], axisName = 'axis'): [number, number] {
  const [min, max] = range;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error(`invalid_${axisName}_range: Values must be finite numbers (got [${min}, ${max}])`);
  }
  if (min >= max) {
    throw new Error(`invalid_${axisName}_range: Minimum (${min}) must be strictly less than maximum (${max})`);
  }
  return [min, max];
}

/**
 * Parses supported mathematical expressions into deterministic executable functions.
 * Rejects arbitrary or unparsable expressions fail-closed.
 */
export function parseGraphFunction(
  functionType: string,
  expression?: string
): EvaluatedFunction {
  const normalizedType = functionType.trim().toLowerCase();

  switch (normalizedType) {
    case 'convex_quadratic': {
      // Default: y = x^2 (loss landscape canonical standard)
      let a = 1;
      let h = 0;
      let k = 0;

      if (expression) {
        const cleaned = expression.replace(/\s+/g, '').replace(/w/g, 'x');
        // Match a*(x - h)^2 + k or a*x^2 + k or x^2
        const shiftedMatch = /^(?:([+-]?\d*(?:\.\d+)?)\*?)?\(x([+-]\d*(?:\.\d+)?)\)\^2(?:([+-]\d*(?:\.\d+)?))?$/.exec(cleaned);
        const simpleMatch = /^(?:([+-]?\d*(?:\.\d+)?)\*?)?x\^2(?:([+-]\d*(?:\.\d+)?))?$/.exec(cleaned);

        if (shiftedMatch) {
          a = shiftedMatch[1] === '' || shiftedMatch[1] === undefined ? 1 : shiftedMatch[1] === '-' ? -1 : Number(shiftedMatch[1]);
          h = -Number(shiftedMatch[2]);
          k = shiftedMatch[3] ? Number(shiftedMatch[3]) : 0;
        } else if (simpleMatch) {
          a = simpleMatch[1] === '' || simpleMatch[1] === undefined ? 1 : simpleMatch[1] === '-' ? -1 : Number(simpleMatch[1]);
          h = 0;
          k = simpleMatch[2] ? Number(simpleMatch[2]) : 0;
        } else if (cleaned !== 'x^2' && cleaned !== 'w^2') {
          // If expression cannot be safely parsed, verify if it is a supported quadratic
          throw new Error(`unsupported_expression: Cannot safely parse convex quadratic expression '${expression}'`);
        }
      }

      // Convex quadratic must have a > 0 for convexity (standard loss bowl)
      if (a <= 0) {
        throw new Error(`invalid_convex_quadratic: Coefficient 'a' must be positive to be convex (got a=${a})`);
      }

      return {
        type: 'convex_quadratic',
        evaluate: (x: number) => a * Math.pow(x - h, 2) + k,
        derivative: (x: number) => 2 * a * (x - h),
        description: `y = ${a !== 1 ? `${a}*` : ''}(x - ${h})^2 + ${k}`
      };
    }

    case 'linear': {
      let m = 1;
      let b = 0;
      if (expression) {
        const cleaned = expression.replace(/\s+/g, '').replace(/w/g, 'x');
        const match = /^([+-]?\d*(?:\.\d+)?)\*?x(?:([+-]\d*(?:\.\d+)?))?$/.exec(cleaned);
        if (match) {
          m = match[1] === '' ? 1 : match[1] === '-' ? -1 : Number(match[1]);
          b = match[2] ? Number(match[2]) : 0;
        } else {
          throw new Error(`unsupported_expression: Cannot safely parse linear expression '${expression}'`);
        }
      }
      return {
        type: 'linear',
        evaluate: (x: number) => m * x + b,
        derivative: () => m,
        description: `y = ${m}*x + ${b}`
      };
    }

    case 'sine': {
      let A = 1;
      let w = 1;
      let phi = 0;
      let C = 0;
      if (expression) {
        const cleaned = expression.replace(/\s+/g, '');
        const match = /^(?:([+-]?\d*(?:\.\d+)?)\*?)?sin\((?:([+-]?\d*(?:\.\d+)?)\*?)?x(?:([+-]\d*(?:\.\d+)?))?\)(?:([+-]\d*(?:\.\d+)?))?$/.exec(cleaned);
        if (match) {
          A = match[1] === '' || match[1] === undefined ? 1 : match[1] === '-' ? -1 : Number(match[1]);
          w = match[2] === '' || match[2] === undefined ? 1 : match[2] === '-' ? -1 : Number(match[2]);
          phi = match[3] ? Number(match[3]) : 0;
          C = match[4] ? Number(match[4]) : 0;
        } else if (cleaned !== 'sin(x)') {
          throw new Error(`unsupported_expression: Cannot safely parse sine expression '${expression}'`);
        }
      }
      return {
        type: 'sine',
        evaluate: (x: number) => A * Math.sin(w * x + phi) + C,
        derivative: (x: number) => A * w * Math.cos(w * x + phi),
        description: `y = ${A}*sin(${w}*x + ${phi}) + ${C}`
      };
    }

    case 'polynomial': {
      const source = expression ?? 'x^3-3*x';
      const polynomial = parseBoundedPolynomial(source);
      const derivativeCoefficients = polynomial.coefficients.slice(1).map((coefficient, index) => coefficient * (index + 1));
      return {
        type: 'polynomial',
        evaluate: (x: number) => evaluatePolynomial(polynomial.coefficients, x),
        derivative: (x: number) => evaluatePolynomial(derivativeCoefficients, x),
        description: `y = ${source}`
      };
    }

    case 'exponential': {
      // y = A * exp(k * x) + C
      let A = 1;
      let k = 1;
      let C = 0;
      if (expression) {
        const cleaned = expression.replace(/\s+/g, '');
        const match = /^(?:([+-]?\d*(?:\.\d+)?)\*?)?exp\((?:([+-]?\d*(?:\.\d+)?)\*?)?x\)(?:([+-]\d*(?:\.\d+)?))?$/.exec(cleaned);
        if (match) {
          A = match[1] === '' || match[1] === undefined ? 1 : match[1] === '-' ? -1 : Number(match[1]);
          k = match[2] === '' || match[2] === undefined ? 1 : match[2] === '-' ? -1 : Number(match[2]);
          C = match[3] ? Number(match[3]) : 0;
        } else if (cleaned !== 'exp(x)') {
          throw new Error(`unsupported_expression: Cannot safely parse exponential expression '${expression}'`);
        }
      }
      return {
        type: 'exponential',
        evaluate: (x: number) => A * Math.exp(k * x) + C,
        derivative: (x: number) => A * k * Math.exp(k * x),
        description: `y = ${A}*exp(${k}*x) + ${C}`
      };
    }

    default:
      throw new Error(`unsupported_function_type: Function type '${functionType}' is not supported in the bounded scientific catalog`);
  }
}

/**
 * Creates a two-way coordinate transform between mathematical space and SVG screen pixels.
 */
export function createCoordinateTransform(
  xRange: [number, number],
  yRange: [number, number],
  screenBox: ScreenBox
): CoordinateTransform {
  const [xMin, xMax] = validateAxisRange(xRange, 'xRange');
  const [yMin, yMax] = validateAxisRange(yRange, 'yRange');

  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;

  const toScreenX = (mathX: number): number => {
    return screenBox.xMin + ((mathX - xMin) / xSpan) * screenBox.width;
  };

  const toScreenY = (mathY: number): number => {
    // Screen Y increases downwards; mathematical Y increases upwards
    return screenBox.yMin + screenBox.height - ((mathY - yMin) / ySpan) * screenBox.height;
  };

  const toMathX = (screenX: number): number => {
    return xMin + ((screenX - screenBox.xMin) / screenBox.width) * xSpan;
  };

  const toMathY = (screenY: number): number => {
    return yMin + ((screenBox.yMin + screenBox.height - screenY) / screenBox.height) * ySpan;
  };

  return {
    toScreenX,
    toScreenY,
    toMathX,
    toMathY,
    screenBox,
    xRange: [xMin, xMax],
    yRange: [yMin, yMax]
  };
}

/**
 * Deterministically samples points along a function across the specified xRange.
 * Handles bounds, numerical stability, and discontinuity detection.
 */
export function sampleGraphPoints(
  fn: EvaluatedFunction,
  transform: CoordinateTransform,
  numSamples = 120
): GraphPoint[] {
  const [xMin, xMax] = transform.xRange;
  const [yMin, yMax] = transform.yRange;
  const yMargin = (yMax - yMin) * 2; // Allow reasonable clipping margin before marking discontinuity

  const step = (xMax - xMin) / Math.max(10, numSamples - 1);
  const points: GraphPoint[] = [];

  for (let i = 0; i < numSamples; i++) {
    const x = xMin + i * step;
    let y: number;
    let isDiscontinuous = false;

    try {
      y = fn.evaluate(x);
      if (!Number.isFinite(y) || Number.isNaN(y)) {
        isDiscontinuous = true;
        y = 0;
      } else if (y < yMin - yMargin || y > yMax + yMargin) {
        // Out of visible bounds
        isDiscontinuous = true;
      }
    } catch {
      isDiscontinuous = true;
      y = 0;
    }

    points.push({
      x,
      y,
      screenX: Math.round(transform.toScreenX(x) * 100) / 100,
      screenY: Math.round(transform.toScreenY(y) * 100) / 100,
      isDiscontinuous
    });
  }

  return points;
}

/**
 * Generates an SVG path data string (`d="..."`) from sampled points,
 * handling discontinuities by starting new sub-paths with 'M'.
 */
export function generateGraphSvgPath(points: GraphPoint[]): string {
  if (points.length === 0) return '';

  const segments: string[] = [];
  let inSubpath = false;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.isDiscontinuous) {
      inSubpath = false;
      continue;
    }

    if (!inSubpath) {
      segments.push(`M ${pt.screenX} ${pt.screenY}`);
      inSubpath = true;
    } else {
      segments.push(`L ${pt.screenX} ${pt.screenY}`);
    }
  }

  return segments.join(' ');
}

/**
 * Computes tangent line at a specific x coordinate.
 */
export function computeTangentLine(
  fn: EvaluatedFunction,
  tangentX: number,
  transform: CoordinateTransform,
  tangentLengthMath = 2.0
): TangentLineResult {
  const y0 = fn.evaluate(tangentX);
  const slope = fn.derivative(tangentX);

  const x1Math = tangentX - tangentLengthMath;
  const y1Math = y0 - slope * tangentLengthMath;

  const x2Math = tangentX + tangentLengthMath;
  const y2Math = y0 + slope * tangentLengthMath;

  return {
    x0: tangentX,
    y0,
    slope: Math.round(slope * 1000) / 1000,
    screenX0: transform.toScreenX(tangentX),
    screenY0: transform.toScreenY(y0),
    screenX1: transform.toScreenX(x1Math),
    screenY1: transform.toScreenY(y1Math),
    screenX2: transform.toScreenX(x2Math),
    screenY2: transform.toScreenY(y2Math),
    label: `dL/dw = ${Math.round(slope * 100) / 100}`
  };
}

/** Computes the line through two actual points on the same function. */
export function computeSecantLine(
  fn: EvaluatedFunction,
  fromX: number,
  toX: number,
  transform: CoordinateTransform,
  lineLengthMath = 2.0
): TangentLineResult {
  if (!Number.isFinite(fromX) || !Number.isFinite(toX) || Math.abs(toX - fromX) < 1e-8) {
    throw new Error('invalid_secant_endpoints');
  }
  const y0 = fn.evaluate(fromX);
  const toY = fn.evaluate(toX);
  const slope = (toY - y0) / (toX - fromX);
  const x1Math = fromX - lineLengthMath;
  const x2Math = fromX + lineLengthMath;
  return {
    x0: fromX,
    y0,
    slope: Math.round(slope * 1000) / 1000,
    screenX0: transform.toScreenX(fromX),
    screenY0: transform.toScreenY(y0),
    screenX1: transform.toScreenX(x1Math),
    screenY1: transform.toScreenY(y0 + slope * (x1Math - fromX)),
    screenX2: transform.toScreenX(x2Math),
    screenY2: transform.toScreenY(y0 + slope * (x2Math - fromX)),
    label: `secant slope = ${Math.round(slope * 100) / 100}`
  };
}

/**
 * Generates coordinate axes, ticks, and grid lines for the coordinate box.
 */
export function generateAxesAndGrid(
  transform: CoordinateTransform,
  xTickStep?: number,
  yTickStep?: number
): AxesGridResult {
  const [xMin, xMax] = transform.xRange;
  const [yMin, yMax] = transform.yRange;

  // Determine tick steps if not provided
  const stepX = xTickStep ?? computeNiceTickStep(xMax - xMin);
  const stepY = yTickStep ?? computeNiceTickStep(yMax - yMin);

  // Position of X axis (y = 0)
  let xAxisScreenY: number | null = null;
  if (yMin <= 0 && 0 <= yMax) {
    xAxisScreenY = transform.toScreenY(0);
  } else {
    // If 0 not in range, place along bottom of screenBox
    xAxisScreenY = transform.screenBox.yMin + transform.screenBox.height;
  }

  // Position of Y axis (x = 0)
  let yAxisScreenX: number | null = null;
  if (xMin <= 0 && 0 <= xMax) {
    yAxisScreenX = transform.toScreenX(0);
  } else {
    // If 0 not in range, place along left of screenBox
    yAxisScreenX = transform.screenBox.xMin;
  }

  // Generate X ticks and grid lines
  const xTicks: AxisTick[] = [];
  const xGridLines: { screenX: number }[] = [];
  const startX = Math.ceil(xMin / stepX) * stepX;

  for (let val = startX; val <= xMax + 1e-9; val += stepX) {
    const screenX = transform.toScreenX(val);
    xGridLines.push({ screenX });
    xTicks.push({
      value: val,
      screenCoord: screenX,
      label: Number(val.toFixed(2)).toString()
    });
  }

  // Generate Y ticks and grid lines
  const yTicks: AxisTick[] = [];
  const yGridLines: { screenY: number }[] = [];
  const startY = Math.ceil(yMin / stepY) * stepY;

  for (let val = startY; val <= yMax + 1e-9; val += stepY) {
    const screenY = transform.toScreenY(val);
    yGridLines.push({ screenY });
    yTicks.push({
      value: val,
      screenCoord: screenY,
      label: Number(val.toFixed(2)).toString()
    });
  }

  return {
    xAxisScreenY,
    yAxisScreenX,
    xTicks,
    yTicks,
    xGridLines,
    yGridLines
  };
}

function computeNiceTickStep(range: number): number {
  if (range <= 0) return 1;
  const rawStep = range / 6;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;

  if (residual > 5) return 5 * magnitude;
  if (residual > 2) return 2 * magnitude;
  return magnitude;
}

