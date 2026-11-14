import React from 'react';
import { useCurrentFrame } from 'remotion';

export interface WaveOscillationProps {
  amplitude?: number; // Wave peak in pixels
  frequency?: number; // Spatial frequency (cycles across width)
  speed?: number;     // Propagation speed
  color?: string;
  glow?: boolean;
  showPhotons?: boolean;
  phaseLabel?: string;
  wavelengthLabel?: string;
}

/**
 * WaveOscillationCanvas
 * Procedural harmonic sine/cosine wave renderer for electromagnetic, acoustic, and radio signals.
 * Features animated flowing wave crests, particle photons, and wavelength brackets.
 */
export const WaveOscillationCanvas: React.FC<WaveOscillationProps> = ({
  amplitude = 75,
  frequency = 3,
  speed = 4,
  color = '#38BDF8',
  glow = true,
  showPhotons = true,
  phaseLabel = 'λ = c / f',
  wavelengthLabel = 'Bước sóng λ'
}) => {
  const frame = useCurrentFrame();
  const width = 860;
  const height = 440;
  const centerY = height / 2;

  // Generate continuous SVG wave path
  const points: { x: number; y: number }[] = [];
  const sampleSteps = 120;
  for (let i = 0; i <= sampleSteps; i++) {
    const x = (i / sampleSteps) * width;
    const progress = i / sampleSteps;
    const phase = (frame * speed * 0.05) - (progress * frequency * Math.PI * 2);
    const y = centerY + Math.sin(phase) * amplitude;
    points.push({ x, y });
  }

  const pathD = points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), '');

  // Photons floating along the wave crests
  const photonCount = 7;
  const photons = Array.from({ length: photonCount }).map((_, idx) => {
    const progress = ((frame * 0.015 + idx / photonCount) % 1);
    const x = progress * width;
    const phase = (frame * speed * 0.05) - (progress * frequency * Math.PI * 2);
    const y = centerY + Math.sin(phase) * amplitude;
    return { x, y };
  });

  return (
    <div style={{ position: 'relative', width, height, margin: '0 auto' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <filter id="waveGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Center Equilibrium Baseline */}
        <line
          x1="0"
          y1={centerY}
          x2={width}
          y2={centerY}
          stroke="rgba(148, 163, 184, 0.3)"
          strokeWidth="2"
          strokeDasharray="8 8"
        />

        {/* Upper & Lower Envelope Boundaries */}
        <line
          x1="0"
          y1={centerY - amplitude}
          x2={width}
          y2={centerY - amplitude}
          stroke="rgba(56, 189, 248, 0.15)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <line
          x1="0"
          y1={centerY + amplitude}
          x2={width}
          y2={centerY + amplitude}
          stroke="rgba(56, 189, 248, 0.15)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* Ambient Halo behind Wave */}
        {glow && (
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="14"
            opacity="0.3"
            strokeLinecap="round"
            filter="url(#waveGlow)"
          />
        )}

        {/* Main Crisp Harmonic Wave Ray */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Energy Photons / Quanta */}
        {showPhotons &&
          photons.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="9" fill="#FFFFFF" opacity="0.9" filter="url(#waveGlow)" />
              <circle cx={p.x} cy={p.y} r="5" fill="#FBBF24" />
            </g>
          ))}

        {/* Wavelength Dimension Bracket */}
        <line x1={width * 0.3} y1={centerY - amplitude - 30} x2={width * 0.3 + (width / frequency)} y2={centerY - amplitude - 30} stroke="#FBBF24" strokeWidth="2" />
        <line x1={width * 0.3} y1={centerY - amplitude - 40} x2={width * 0.3} y2={centerY - amplitude - 20} stroke="#FBBF24" strokeWidth="2" />
        <line x1={width * 0.3 + (width / frequency)} y1={centerY - amplitude - 40} x2={width * 0.3 + (width / frequency)} y2={centerY - amplitude - 20} stroke="#FBBF24" strokeWidth="2" />
        <text
          x={width * 0.3 + (width / frequency) / 2}
          y={centerY - amplitude - 45}
          fill="#FBBF24"
          fontSize="22"
          fontWeight="800"
          textAnchor="middle"
        >
          {wavelengthLabel}
        </text>

        {/* Formula Badge in lower right */}
        {phaseLabel && (
          <text
            x={width - 20}
            y={height - 15}
            fill="#38BDF8"
            fontSize="24"
            fontWeight="800"
            textAnchor="end"
          >
            {phaseLabel}
          </text>
        )}
      </svg>
    </div>
  );
};

