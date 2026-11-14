import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';

export interface ParticleKineticProps {
  particleCount?: number;
  temperature?: 'low' | 'medium' | 'high';
  phase?: 'gas' | 'liquid' | 'condensing';
  containerWidth?: number;
  containerHeight?: number;
  color?: string;
  showVaporCollisions?: boolean;
}

/**
 * ParticleKineticCanvas
 * Thermodynamic particle kinetics: molecular Brownian motion, dew point condensation,
 * and kinetic temperature scaling.
 */
export const ParticleKineticCanvas: React.FC<ParticleKineticProps> = ({
  particleCount = 28,
  temperature = 'medium',
  phase = 'gas',
  containerWidth = 840,
  containerHeight = 460,
  color = '#38BDF8',
  showVaporCollisions = true
}) => {
  const frame = useCurrentFrame();

  const speedMultiplier = temperature === 'high' ? 2.5 : temperature === 'low' ? 0.6 : 1.2;

  // Generate deterministic pseudo-random seeds for each particle
  const initialParticles = useMemo(() => {
    return Array.from({ length: particleCount }).map((_, i) => {
      const seedX = (Math.sin(i * 997) * 0.5 + 0.5) * (containerWidth - 60) + 30;
      const seedY = (Math.cos(i * 733) * 0.5 + 0.5) * (containerHeight - 60) + 30;
      const vx = (Math.sin(i * 311) * 2 + 1) * (i % 2 === 0 ? 1 : -1);
      const vy = (Math.cos(i * 547) * 2 + 1) * (i % 3 === 0 ? -1 : 1);
      const radius = 8 + (i % 4) * 2;
      return { id: i, x: seedX, y: seedY, vx, vy, radius };
    });
  }, [particleCount, containerWidth, containerHeight]);

  // Compute animated positions with bouncy boundary reflection
  const particles = initialParticles.map((p) => {
    const totalDistX = p.vx * speedMultiplier * frame * 2;
    const totalDistY = p.vy * speedMultiplier * frame * 2;

    const spanX = containerWidth - 60;
    const spanY = containerHeight - 60;

    // Ping-pong bounce within bounds
    let currX = (p.x + totalDistX) % (spanX * 2);
    if (currX < 0) currX += spanX * 2;
    if (currX > spanX) currX = spanX * 2 - currX;
    currX += 30;

    let currY = (p.y + totalDistY) % (spanY * 2);
    if (currY < 0) currY += spanY * 2;
    if (currY > spanY) currY = spanY * 2 - currY;
    currY += 30;

    // Condensation mode: particles cluster toward cold surface at bottom/right
    if (phase === 'condensing') {
      const condenseProgress = Math.min(1, frame / 180);
      currY = currY * (1 - condenseProgress * 0.6) + (containerHeight - 50) * (condenseProgress * 0.6);
    }

    return { ...p, currX, currY };
  });

  return (
    <div style={{ position: 'relative', width: containerWidth, height: containerHeight, margin: '0 auto' }}>
      <svg
        width={containerWidth}
        height={containerHeight}
        viewBox={`0 0 ${containerWidth} ${containerHeight}`}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <filter id="particleGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="containerBorder" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#818CF8" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Insulated Chamber Enclosure */}
        <rect
          x="10"
          y="10"
          width={containerWidth - 20}
          height={containerHeight - 20}
          rx="18"
          fill="rgba(15, 23, 42, 0.65)"
          stroke="url(#containerBorder)"
          strokeWidth="3"
        />

        {/* Cold Boundary Rim (if condensing) */}
        {phase === 'condensing' && (
          <path
            d={`M 12 ${containerHeight - 12} L ${containerWidth - 12} ${containerHeight - 12}`}
            stroke="#38BDF8"
            strokeWidth="10"
            filter="url(#particleGlow)"
            strokeLinecap="round"
          />
        )}

        {/* Kinetic Particles */}
        {particles.map((p) => (
          <g key={p.id}>
            {/* Velocity Motion Trail */}
            {showVaporCollisions && (
              <line
                x1={p.currX}
                y1={p.currY}
                x2={p.currX - p.vx * speedMultiplier * 4}
                y2={p.currY - p.vy * speedMultiplier * 4}
                stroke={color}
                strokeWidth="2.5"
                opacity="0.4"
                strokeLinecap="round"
              />
            )}
            {/* Glowing Core */}
            <circle
              cx={p.currX}
              cy={p.currY}
              r={p.radius}
              fill={color}
              filter="url(#particleGlow)"
              opacity="0.85"
            />
            <circle
              cx={p.currX}
              cy={p.currY}
              r={p.radius * 0.5}
              fill="#FFFFFF"
            />
          </g>
        ))}

        {/* Thermodynamics State Badge */}
        <text
          x={containerWidth - 30}
          y={40}
          fill="#FBBF24"
          fontSize="22"
          fontWeight="800"
          textAnchor="end"
        >
          {temperature === 'high' ? '🔥 T cao (Động năng lớn)' : temperature === 'low' ? '❄️ T thấp (Điểm sương)' : '⚡ Trạng thái khí'}
        </text>
      </svg>
    </div>
  );
};

