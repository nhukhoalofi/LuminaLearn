import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface CameraKeyframe {
  frame: number;
  scale?: number;
  panX?: number; // pixels
  panY?: number; // pixels
  rotationDeg?: number;
}

export interface PhysicsCameraTransitionsProps {
  children: React.ReactNode;
  keyframes?: CameraKeyframe[];
  currentScale?: number;
  currentPanX?: number;
  currentPanY?: number;
  currentRotationDeg?: number;
}

export const PhysicsCameraTransitions: React.FC<PhysicsCameraTransitionsProps> = ({
  children,
  keyframes,
  currentScale = 1.0,
  currentPanX = 0,
  currentPanY = 0,
  currentRotationDeg = 0
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let scale = currentScale;
  let panX = currentPanX;
  let panY = currentPanY;
  let rotationDeg = currentRotationDeg;

  if (keyframes && keyframes.length >= 2) {
    const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
    const framePoints = sorted.map((kf) => kf.frame);

    scale = interpolate(
      frame,
      framePoints,
      sorted.map((kf) => kf.scale ?? 1.0),
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    panX = interpolate(
      frame,
      framePoints,
      sorted.map((kf) => kf.panX ?? 0),
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    panY = interpolate(
      frame,
      framePoints,
      sorted.map((kf) => kf.panY ?? 0),
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    rotationDeg = interpolate(
      frame,
      framePoints,
      sorted.map((kf) => kf.rotationDeg ?? 0),
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        transform: `translate(${panX}px, ${panY}px) scale(${scale}) rotate(${rotationDeg}deg)`,
        transformOrigin: '50% 50%',
        transition: 'transform 0.05s linear'
      }}
    >
      {children}
    </div>
  );
};

