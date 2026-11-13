import React from 'react';
import { useCurrentFrame } from 'remotion';

export interface ForceVector {
  label: string; // e.g. "F_Lorentz", "P = mg", "F_đẩy"
  color: string;
  angleDeg: number; // 0 = right, 90 = down, 180 = left, 270 = up
  magnitude: number; // pixel length
}

export interface VectorFieldForceProps {
  objectType?: 'box' | 'sphere' | 'pendulum' | 'coil';
  forces?: ForceVector[];
  formula?: string;
  width?: number;
  height?: number;
}

/**
 * VectorFieldForceCanvas
 * Classical mechanics & electromagnetic force simulator.
 * Dynamically renders free-body force vectors with animated arrows, labels, and coordinate planes.
 */
export const VectorFieldForceCanvas: React.FC<VectorFieldForceProps> = ({
  objectType = 'box',
  forces = [
    { label: 'F_Lorentz', color: '#EF4444', angleDeg: 0, magnitude: 150 },
    { label: 'P = mg', color: '#38BDF8', angleDeg: 90, magnitude: 120 },
    { label: 'N', color: '#FBBF24', angleDeg: 270, magnitude: 120 },
    { label: 'F_ms', color: '#A855F7', angleDeg: 180, magnitude: 80 }
  ],
  formula = 'F = I(L × B)',
  width = 840,
  height = 460
}) => {
  const frame = useCurrentFrame();
  const centerX = width / 2;
  const centerY = height / 2;

  // Gentle floating oscillation
  const bobY = Math.sin(frame / 12) * 6;

  return (
    <div style={{ position: 'relative', width, height, margin: '0 auto' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <filter id="vectorGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Coordinate Reference Crosshair */}
        <line
          x1={centerX - 240}
          y1={centerY + bobY}
          x2={centerX + 240}
          y2={centerY + bobY}
          stroke="rgba(148, 163, 184, 0.2)"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />
        <line
          x1={centerX}
          y1={centerY - 160 + bobY}
          x2={centerX}
          y2={centerY + 160 + bobY}
          stroke="rgba(148, 163, 184, 0.2)"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />

        {/* Central Physical Object */}
        {objectType === 'sphere' && (
          <circle
            cx={centerX}
            cy={centerY + bobY}
            r="44"
            fill="#1E293B"
            stroke="#38BDF8"
            strokeWidth="5"
          />
        )}
        {objectType === 'box' && (
          <rect
            x={centerX - 45}
            y={centerY - 45 + bobY}
            width="90"
            height="90"
            rx="12"
            fill="#1E293B"
            stroke="#38BDF8"
            strokeWidth="5"
          />
        )}
        {objectType === 'coil' && (
          <g transform={`translate(${centerX - 40}, ${centerY - 40 + bobY})`}>
            <circle cx="40" cy="40" r="38" fill="#1E293B" stroke="#FBBF24" strokeWidth="6" />
            <circle cx="40" cy="40" r="22" fill="#0F172A" stroke="#EF4444" strokeWidth="3" />
          </g>
        )}

        {/* Center of Mass Dot */}
        <circle cx={centerX} cy={centerY + bobY} r="6" fill="#FFFFFF" />

        {/* Dynamic Force Vectors */}
        {forces.map((f, i) => {
          const rad = (f.angleDeg * Math.PI) / 180;
          const targetX = centerX + Math.cos(rad) * f.magnitude;
          const targetY = centerY + bobY + Math.sin(rad) * f.magnitude;

          // Arrowhead points
          const headLen = 14;
          const arrowAngle1 = rad + Math.PI * 0.85;
          const arrowAngle2 = rad - Math.PI * 0.85;
          const h1x = targetX + Math.cos(arrowAngle1) * headLen;
          const h1y = targetY + Math.sin(arrowAngle1) * headLen;
          const h2x = targetX + Math.cos(arrowAngle2) * headLen;
          const h2y = targetY + Math.sin(arrowAngle2) * headLen;

          // Label placement offset
          const labelDist = f.magnitude + 26;
          const lx = centerX + Math.cos(rad) * labelDist;
          const ly = centerY + bobY + Math.sin(rad) * labelDist;

          return (
            <g key={i}>
              {/* Vector Shaft */}
              <line
                x1={centerX}
                y1={centerY + bobY}
                x2={targetX}
                y2={targetY}
                stroke={f.color}
                strokeWidth="5"
                strokeLinecap="round"
                filter="url(#vectorGlow)"
              />
              {/* Arrowhead */}
              <polygon
                points={`${targetX},${targetY} ${h1x},${h1y} ${h2x},${h2y}`}
                fill={f.color}
              />
              {/* Vector Text Label */}
              <text
                x={lx}
                y={ly + 6}
                fill={f.color}
                fontSize="22"
                fontWeight="900"
                textAnchor="middle"
              >
                {f.label}
              </text>
            </g>
          );
        })}

        {/* Governing Formula in lower left */}
        {formula && (
          <text
            x={20}
            y={height - 20}
            fill="#FBBF24"
            fontSize="26"
            fontWeight="900"
            textAnchor="start"
          >
            {formula}
          </text>
        )}
      </svg>
    </div>
  );
};

