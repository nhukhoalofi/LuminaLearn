export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function smoothstep(value: number): number {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

export function progressBetween(frame: number, startFrame: number, durationFrames: number): number {
  return smoothstep((frame - startFrame) / Math.max(1, durationFrames));
}

export function durationBoundedFrame(frame: number, durationInFrames: number): number {
  return Math.min(Math.max(0, frame), Math.max(0, durationInFrames - 1));
}
