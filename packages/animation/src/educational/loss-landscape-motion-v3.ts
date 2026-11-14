import type { LossLandscapeVisualPayload } from '@luminalearn/scene-schema';

/**
 * Pure, deterministic frame-to-mathematics projection.
 * The moving marker always lies on the validated quadratic loss function;
 * never interpolate loss/gradient independently from the parameter value.
 */
export interface LossLandscapeFrameStateV3 {
  w: number;
  loss: number;
  gradient: number;
  segmentIndex: number;
  completedStepIndex: number;
  transitionProgress: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const smoothstep = (value: number): number => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export function evaluateQuadraticLossV3(
  payload: Pick<LossLandscapeVisualPayload, 'minimumPoint' | 'curvature'>,
  w: number
): { loss: number; gradient: number } {
  const displacement = w - payload.minimumPoint.w;
  return {
    loss: payload.curvature * displacement * displacement + payload.minimumPoint.loss,
    gradient: 2 * payload.curvature * displacement
  };
}

export function deriveLossLandscapeFrameV3(
  payload: LossLandscapeVisualPayload,
  frame: number,
  durationInFrames: number
): LossLandscapeFrameStateV3 {
  const steps = payload.steps;
  if (steps.length === 0) throw new Error('loss_landscape_steps_missing');
  if (!Number.isFinite(frame) || !Number.isFinite(durationInFrames) || durationInFrames <= 0) {
    throw new Error('loss_landscape_invalid_frame');
  }

  // Preserve an initial reading hold and a final hold, independently of FPS.
  const initialHold = Math.min(12, Math.floor(durationInFrames * 0.12));
  const finalHold = Math.min(18, Math.floor(durationInFrames * 0.12));
  const travelFrames = Math.max(1, durationInFrames - initialHold - finalHold);
  const elapsed = Math.min(travelFrames, Math.max(0, frame - initialHold));

  if (steps.length === 1) {
    const { loss, gradient } = evaluateQuadraticLossV3(payload, steps[0].w);
    return { w: steps[0].w, loss, gradient, segmentIndex: 0, completedStepIndex: 0, transitionProgress: 1 };
  }

  const segments = steps.length - 1;
  const segmentPosition = elapsed / travelFrames * segments;
  const segmentIndex = Math.min(segments - 1, Math.floor(segmentPosition));
  const localPosition = clamp01(segmentPosition - segmentIndex);
  // A short, intentional pause before a new update and a readable end state.
  const transitionProgress = smoothstep((localPosition - 0.12) / 0.78);
  const start = steps[segmentIndex].w;
  const end = steps[segmentIndex + 1].w;
  const w = start + (end - start) * transitionProgress;
  const { loss, gradient } = evaluateQuadraticLossV3(payload, w);

  return {
    w,
    loss,
    gradient,
    segmentIndex,
    completedStepIndex: transitionProgress >= 1 ? segmentIndex + 1 : segmentIndex,
    transitionProgress
  };
}
