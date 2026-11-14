import React from 'react';
import type { Point2D } from './physics-types';
import { SPECTRUM_BANDS } from './physics-types';
import { LightRayAnimation } from './LightRayAnimation';

export interface InternalReflectionProps {
  frame?: number;
  progress?: number; // 0 to 1
  width?: number;
  height?: number;
  showNormals?: boolean;
  showExplanation?: boolean;
}

export const InternalReflection: React.FC<InternalReflectionProps> = ({
  frame = 0,
  progress = 1.0,
  width = 1080,
  height = 1920,
  showNormals = true,
  showExplanation = true
}) => {
  const centerX = width / 2;
  const centerY = height * 0.44;
  const dropRadius = 260;

  // Entry point (from Phase 1)
  const entryAngleRad = (135 * Math.PI) / 180;
  const entryPoint: Point2D = {
    x: centerX + dropRadius * Math.cos(entryAngleRad),
    y: centerY - dropRadius * Math.sin(entryAngleRad)
  };

  // Phase split:
  // Phase 1: Incoming from entry to back surface (already arrived or arriving, progress 0..0.4)
  // Phase 2: Internal reflection bouncing to lower-front surface (progress 0.4..1.0)
  const bounceProgress = Math.min(1, Math.max(0, (progress - 0.3) / 0.7));

  // Compute ray trajectory for all spectral bands
  const rayPaths = SPECTRUM_BANDS.map((band, idx) => {
    const factor = idx / (SPECTRUM_BANDS.length - 1);

    // Back reflection point on right-rear wall
    const backAngleRad = (-25 + factor * 16) * (Math.PI / 180);
    const backPoint: Point2D = {
      x: centerX + dropRadius * Math.cos(backAngleRad),
      y: centerY + dropRadius * Math.sin(backAngleRad)
    };

    // Exit point on lower-front wall (bottom-left)
    // Red reflects higher inside and hits lower-front wall at approx 220°..225°
    // Violet reflects lower inside and hits lower-front wall at approx 210°..215°
    const exitAngleDeg = 212 + (1 - factor) * 12; // Inverted order after internal reflection!
    const exitAngleRad = (exitAngleDeg * Math.PI) / 180;
    const exitPoint: Point2D = {
      x: centerX + dropRadius * Math.cos(exitAngleRad),
      y: centerY + dropRadius * Math.sin(exitAngleRad)
    };

    // Normal at back surface pointing towards droplet center
    const backNormal: Point2D = {
      x: -Math.cos(backAngleRad),
      y: -Math.sin(backAngleRad)
    };

    return {
      band,
      backPoint,
      exitPoint,
      backNormal
    };
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="reflectionFluid" cx="42%" cy="36%" r="65%">
            <stop offset="0%" stopColor="rgba(224, 242, 254, 0.4)" />
            <stop offset="60%" stopColor="rgba(56, 189, 248, 0.16)" />
            <stop offset="100%" stopColor="rgba(2, 132, 199, 0.52)" />
          </radialGradient>
        </defs>

        {/* Droplet Sphere */}
        <circle
          cx={centerX}
          cy={centerY}
          r={dropRadius}
          fill="url(#reflectionFluid)"
          stroke="rgba(186, 230, 253, 0.85)"
          strokeWidth="3.5"
          style={{ filter: 'drop-shadow(0 16px 36px rgba(14, 165, 233, 0.3))' }}
        />

        {/* 1. Incident path from entry to back wall (dimmed background reference) */}
        {rayPaths.map(({ band, backPoint }) => (
          <line
            key={`prior-${band.name}`}
            x1={entryPoint.x}
            y1={entryPoint.y}
            x2={backPoint.x}
            y2={backPoint.y}
            stroke={band.colorHex}
            strokeWidth={2}
            opacity={0.4}
          />
        ))}

        {/* 2. Normals at back reflection points */}
        {showNormals && bounceProgress > 0.1 && (
          <g opacity={0.65}>
            {/* Draw normal for central green ray */}
            <line
              x1={rayPaths[3].backPoint.x - rayPaths[3].backNormal.x * 55}
              y1={rayPaths[3].backPoint.y - rayPaths[3].backNormal.y * 55}
              x2={rayPaths[3].backPoint.x + rayPaths[3].backNormal.x * 55}
              y2={rayPaths[3].backPoint.y + rayPaths[3].backNormal.y * 55}
              stroke="rgba(255, 255, 255, 0.55)"
              strokeWidth="2"
              strokeDasharray="4,4"
            />
            <text
              x={rayPaths[3].backPoint.x + 35}
              y={rayPaths[3].backPoint.y}
              fill="#E2E8F0"
              fontSize={16}
              fontWeight={600}
            >
              Mặt phản xạ trong
            </text>
          </g>
        )}

        {/* 3. Reflection Sparkles at back wall */}
        {bounceProgress > 0.05 &&
          rayPaths.map(({ band, backPoint }) => (
            <circle
              key={`sparkle-${band.name}`}
              cx={backPoint.x}
              cy={backPoint.y}
              r={5}
              fill="#FFFFFF"
              style={{ filter: `drop-shadow(0 0 6px ${band.colorHex})` }}
            />
          ))}

        {/* 4. Internally Reflected Rays traveling from back wall to lower-front wall */}
        {rayPaths.map(({ band, backPoint, exitPoint }) => (
          <LightRayAnimation
            key={`reflected-${band.name}`}
            from={backPoint}
            to={exitPoint}
            color={band.colorHex}
            glowColor={band.glowColor}
            width={3.5}
            progress={bounceProgress}
            frame={frame}
            showPhotons
            photonSpeed={7}
          />
        ))}

        {/* Reflection Angle equality annotation */}
        {bounceProgress > 0.4 && (
          <g opacity={Math.min(1, (bounceProgress - 0.4) * 2.5)}>
            <text
              x={centerX + 60}
              y={centerY + 60}
              fill="#FBBF24"
              fontSize={20}
              fontWeight={700}
              textAnchor="middle"
            >
              Góc tới = Góc phản xạ (i&apos; = r)
            </text>
          </g>
        )}
      </svg>

      {/* --- EDUCATIONAL EXPLANATION HUD --- */}
      {showExplanation && (
        <div
          style={{
            position: 'absolute',
            bottom: height * 0.12,
            left: 50,
            right: 50,
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: 20,
            padding: '20px 28px',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 22, color: '#38BDF8' }}>✦</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#F8FAFC' }}>
              Bước 2: Phản xạ một phần tại mặt trong
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 19, color: '#CBD5E1', lineHeight: 1.5 }}>
            Khi chạm vào thành sau của giọt nước, một phần ánh sáng thoát ra ngoài, nhưng phần quan trọng được{' '}
            <strong>phản xạ lại vào bên trong</strong>. Tia sáng đổi hướng, dội ngược về phía mặt trước phía dưới!
          </p>
        </div>
      )}
    </div>
  );
};

