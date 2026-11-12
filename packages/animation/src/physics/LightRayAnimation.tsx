import React from 'react';
import type { Point2D } from './physics-types';

export interface LightRayAnimationProps {
  from: Point2D;
  to: Point2D;
  color?: string;
  glowColor?: string;
  width?: number;
  progress?: number; // 0 to 1
  frame?: number;
  showPhotons?: boolean;
  photonSpeed?: number;
  showWavefronts?: boolean;
  arrowHead?: boolean;
  label?: string;
  labelPosition?: 'start' | 'mid' | 'end';
  opacity?: number;
  dashed?: boolean;
}

export const LightRayAnimation: React.FC<LightRayAnimationProps> = ({
  from,
  to,
  color = '#FFFBEB',
  glowColor = 'rgba(255, 251, 235, 0.6)',
  width = 3,
  progress = 1.0,
  frame = 0,
  showPhotons = true,
  photonSpeed = 6,
  showWavefronts = false,
  arrowHead = false,
  label,
  labelPosition = 'mid',
  opacity = 1.0,
  dashed = false
}) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const totalLength = Math.sqrt(dx * dx + dy * dy);
  if (totalLength < 0.001) return null;

  const currentLength = totalLength * Math.max(0, Math.min(1, progress));
  const unitX = dx / totalLength;
  const unitY = dy / totalLength;
  const currentEnd = {
    x: from.x + unitX * currentLength,
    y: from.y + unitY * currentLength
  };

  // Normal vector for transverse wavefronts
  const normalX = -unitY;
  const normalY = unitX;

  // Photon animation along the ray
  const photonOffset = (frame * photonSpeed) % Math.max(1, totalLength);
  const photonCount = Math.max(1, Math.floor(currentLength / 45));

  // Label coordinates
  let labelCoord = currentEnd;
  if (labelPosition === 'start') {
    labelCoord = { x: from.x + normalX * 18, y: from.y + normalY * 18 };
  } else if (labelPosition === 'mid') {
    labelCoord = {
      x: from.x + unitX * (currentLength * 0.5) + normalX * 16,
      y: from.y + unitY * (currentLength * 0.5) + normalY * 16
    };
  } else {
    labelCoord = {
      x: currentEnd.x + normalX * 16,
      y: currentEnd.y + normalY * 16
    };
  }

  const filterId = `glow-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <g opacity={opacity}>
      <defs>
        <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={width * 1.5} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Glow Halo Layer */}
      <line
        x1={from.x}
        y1={from.y}
        x2={currentEnd.x}
        y2={currentEnd.y}
        stroke={glowColor}
        strokeWidth={width * 3}
        strokeLinecap="round"
        opacity={0.45}
      />

      {/* Main Core Beam */}
      <line
        x1={from.x}
        y1={from.y}
        x2={currentEnd.x}
        y2={currentEnd.y}
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dashed ? '6,6' : undefined}
        strokeLinecap="round"
        filter={`url(#${filterId})`}
      />

      {/* Wavefront Ripples (Transverse waves) */}
      {showWavefronts && currentLength > 20 && (
        <g opacity={0.65}>
          {Array.from({ length: Math.floor(currentLength / 28) }).map((_, idx) => {
            const waveDist = ((idx * 28 + (frame * 3) % 28)) % currentLength;
            const wx = from.x + unitX * waveDist;
            const wy = from.y + unitY * waveDist;
            const wLen = 10;
            return (
              <line
                key={`wave-${idx}`}
                x1={wx - normalX * wLen}
                y1={wy - normalY * wLen}
                x2={wx + normalX * wLen}
                y2={wy + normalY * wLen}
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={0.7}
              />
            );
          })}
        </g>
      )}

      {/* Animated Photon Stream Particles */}
      {showPhotons && currentLength > 10 && (
        <g>
          {Array.from({ length: photonCount }).map((_, idx) => {
            const dist = (photonOffset + idx * 45) % currentLength;
            const px = from.x + unitX * dist;
            const py = from.y + unitY * dist;
            return (
              <circle
                key={`photon-${idx}`}
                cx={px}
                cy={py}
                r={width * 0.9}
                fill="#FFFFFF"
                opacity={0.95}
                filter={`url(#${filterId})`}
              />
            );
          })}
        </g>
      )}

      {/* Leading Particle at Ray Head */}
      {progress < 1.0 && progress > 0.02 && (
        <circle
          cx={currentEnd.x}
          cy={currentEnd.y}
          r={width * 1.6}
          fill="#FFFFFF"
          filter={`url(#${filterId})`}
        />
      )}

      {/* Optional Direction Arrow Head */}
      {arrowHead && progress > 0.95 && (
        <polygon
          points={`
            ${currentEnd.x},${currentEnd.y}
            ${currentEnd.x - unitX * 12 + normalX * 6},${currentEnd.y - unitY * 12 + normalY * 6}
            ${currentEnd.x - unitX * 12 - normalX * 6},${currentEnd.y - unitY * 12 - normalY * 6}
          `}
          fill={color}
        />
      )}

      {/* Text Label Callout */}
      {label && progress > 0.3 && (
        <text
          x={labelCoord.x}
          y={labelCoord.y}
          fill="#F8FAFC"
          fontSize={15}
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
            letterSpacing: '0.4px'
          }}
        >
          {label}
        </text>
      )}
    </g>
  );
};

