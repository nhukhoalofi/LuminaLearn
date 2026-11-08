/**
 * Safely parses an r_frame_rate rational string (e.g., '24/1', '30000/1001', '25')
 * without using eval() or Function().
 * Rejects non-rational expressions, division by zero, NaN, Infinity, negative values,
 * or arbitrary executable strings.
 */
export function parseRationalFps(raw: string | undefined | null, fallback = 24): number {
  if (raw === undefined || raw === null || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  // Pattern: strictly digits, optional slash followed by digits
  if (!/^\d+(?:\/\d+)?$/.test(trimmed)) {
    throw new Error(`invalid_fps_format: Malformed rational frame rate '${trimmed}'`);
  }

  if (trimmed.includes('/')) {
    const [numStr, denStr] = trimmed.split('/');
    const numerator = Number.parseInt(numStr, 10);
    const denominator = Number.parseInt(denStr, 10);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      throw new Error(`invalid_fps_division: Cannot divide by zero or non-finite value in '${trimmed}'`);
    }
    const val = numerator / denominator;
    if (!Number.isFinite(val) || val <= 0) {
      throw new Error(`invalid_fps_value: Frame rate must be a positive finite number, got '${val}'`);
    }
    return val;
  }

  const val = Number.parseFloat(trimmed);
  if (!Number.isFinite(val) || val <= 0) {
    throw new Error(`invalid_fps_value: Frame rate must be a positive finite number, got '${val}'`);
  }
  return val;
}

