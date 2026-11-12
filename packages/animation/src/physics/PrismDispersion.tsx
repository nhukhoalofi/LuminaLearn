import React from 'react';
import { SPECTRUM_BANDS, type Point2D } from './physics-types';
import { LightRayAnimation } from './LightRayAnimation';

export interface PrismDispersionProps {
  frame?: number;
  progress?: number; // 0 to 1
  width?: number;
  height?: number;
  showLabels?: boolean;
  showCauchyFormula?: boolean;
}

export const PrismDispersion: React.FC<PrismDispersionProps> = ({
  frame = 0,
  progress = 1.0,
  width = 1080,
  height = 1920,
  showLabels = true,
  showCauchyFormula = true
}) => {
  // Center coordinates for 9:16 canvas (focused in upper-middle area)
  const centerX = width / 2;
  const centerY = height * 0.44;

  // Triangular prism geometry
  const prismApex: Point2D = { x: centerX, y: centerY - 220 };
  const prismLeft: Point2D = { x: centerX - 260, y: centerY + 200 };
  const prismRight: Point2D = { x: centerX + 260, y: centerY + 200 };

  // Incoming white beam entry point on left prism face
  const entryT = 0.52; // parameter along left face
  const entryPoint: Point2D = {
    x: prismApex.x + (prismLeft.x - prismApex.x) * entryT,
    y: prismApex.y + (prismLeft.y - prismApex.y) * entryT
  };
  const sourcePoint: Point2D = { x: entryPoint.x - 300, y: entryPoint.y - 80 };

  // Normal at left face
  const leftEdgeDx = prismLeft.x - prismApex.x;
  const leftEdgeDy = prismLeft.y - prismApex.y;
  const leftEdgeLen = Math.sqrt(leftEdgeDx * leftEdgeDx + leftEdgeDy * leftEdgeDy);
  const leftNormal: Point2D = {
    x: -leftEdgeDy / leftEdgeLen,
    y: leftEdgeDx / leftEdgeLen
  };

  // Phase-based progression
  // Phase 1: White ray approaches prism (progress 0..0.3)
  const whiteRayProgress = Math.min(1, progress / 0.3);

  // Phase 2: Internal dispersion (progress 0.3..0.6)
  const internalProgress = Math.min(1, Math.max(0, (progress - 0.3) / 0.3));

  // Phase 3: External fan out onto spectral screen (progress 0.6..1.0)
  const externalProgress = Math.min(1, Math.max(0, (progress - 0.6) / 0.4));

  // Calculate exit points and external endpoints for each spectral band
  const bandRays = SPECTRUM_BANDS.map((band, idx) => {
    // Relative dispersion spread index from red (0) to violet (6)
    const factor = idx / (SPECTRUM_BANDS.length - 1);

    // Inside prism: Red deviates less (higher exit point on right face), Violet deviates more (lower exit)
    const rightFaceExitT = 0.42 + factor * 0.22;
    const exitPoint: Point2D = {
      x: prismApex.x + (prismRight.x - prismApex.x) * rightFaceExitT,
      y: prismApex.y + (prismRight.y - prismApex.y) * rightFaceExitT
    };

    // Outside prism: Fan out onto target screen on the right
    const screenDistance = 320;
    const screenYOffset = 40 + factor * 260; // Fanned out vertical spread
    const screenPoint: Point2D = {
      x: exitPoint.x + screenDistance,
      y: exitPoint.y + screenYOffset
    };

    return {
      band,
      exitPoint,
      screenPoint
    };
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
      >
        <defs>
          {/* Glass prism gradient */}
          <linearGradient id="prismGlass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.22)" />
            <stop offset="45%" stopColor="rgba(56, 189, 248, 0.12)" />
            <stop offset="100%" stopColor="rgba(14, 165, 233, 0.28)" />
          </linearGradient>

          {/* Glow filter for spectral screen */}
          <filter id="spectrumGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* --- PRISM BASE SHADOW & BODY --- */}
        <polygon
          points={`${prismApex.x},${prismApex.y} ${prismLeft.x},${prismLeft.y} ${prismRight.x},${prismRight.y}`}
          fill="url(#prismGlass)"
          stroke="rgba(186, 230, 253, 0.85)"
          strokeWidth="3.5"
          style={{
            filter: 'drop-shadow(0 20px 40px rgba(14, 165, 233, 0.25))'
          }}
        />

        {/* Glass edge reflections */}
        <line
          x1={prismApex.x}
          y1={prismApex.y}
          x2={prismLeft.x}
          y2={prismLeft.y}
          stroke="rgba(255, 255, 255, 0.7)"
          strokeWidth="2"
        />

        {/* Normal line at entrance interface */}
        {whiteRayProgress > 0.4 && (
          <line
            x1={entryPoint.x - leftNormal.x * 60}
            y1={entryPoint.y - leftNormal.y * 60}
            x2={entryPoint.x + leftNormal.x * 60}
            y2={entryPoint.y + leftNormal.y * 60}
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="1.5"
            strokeDasharray="4,4"
          />
        )}

        {/* --- 1. INCIDENT WHITE SUNLIGHT RAY --- */}
        <LightRayAnimation
          from={sourcePoint}
          to={entryPoint}
          color="#FFFBEB"
          glowColor="rgba(255, 251, 235, 0.8)"
          width={6}
          progress={whiteRayProgress}
          frame={frame}
          showPhotons
          photonSpeed={8}
          label="Ánh sáng trắng (Mặt trời)"
          labelPosition="mid"
        />

        {/* --- 2. INTERNAL DISPERSED RAYS INSIDE PRISM --- */}
        {internalProgress > 0 &&
          bandRays.map(({ band, exitPoint }) => (
            <LightRayAnimation
              key={`internal-${band.name}`}
              from={entryPoint}
              to={exitPoint}
              color={band.colorHex}
              glowColor={band.glowColor}
              width={2.5}
              progress={internalProgress}
              frame={frame}
              showPhotons={false}
              opacity={0.85}
            />
          ))}

        {/* --- 3. REFRACTED RAYS FANNING OUTSIDE PRISM --- */}
        {externalProgress > 0 &&
          bandRays.map(({ band, exitPoint, screenPoint }) => (
            <LightRayAnimation
              key={`external-${band.name}`}
              from={exitPoint}
              to={screenPoint}
              color={band.colorHex}
              glowColor={band.glowColor}
              width={3.5}
              progress={externalProgress}
              frame={frame}
              showPhotons
              photonSpeed={6}
              arrowHead
            />
          ))}

        {/* --- 4. SPECTRAL PROJECTION SCREEN --- */}
        {externalProgress > 0.5 && (
          <g opacity={Math.min(1, (externalProgress - 0.5) * 2)}>
            {/* Projection screen bar */}
            <rect
              x={centerX + 310}
              y={centerY - 10}
              width={16}
              height={360}
              rx={8}
              fill="rgba(30, 41, 59, 0.9)"
              stroke="rgba(148, 163, 184, 0.5)"
              strokeWidth={2}
            />

            {/* Continuous Rainbow Spectrum Band */}
            <defs>
              <linearGradient id="screenRainbow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#EF4444" />
                <stop offset="16%" stopColor="#F97316" />
                <stop offset="33%" stopColor="#FBBF24" />
                <stop offset="50%" stopColor="#10B981" />
                <stop offset="66%" stopColor="#06B6D4" />
                <stop offset="83%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#A855F7" />
              </linearGradient>
            </defs>
            <rect
              x={centerX + 313}
              y={centerY + 5}
              width={10}
              height={330}
              rx={5}
              fill="url(#screenRainbow)"
              filter="url(#spectrumGlow)"
            />

            {/* Spectral Wavelength Markers */}
            {bandRays.map(({ band, screenPoint }) => (
              <g key={`marker-${band.name}`}>
                <circle cx={screenPoint.x} cy={screenPoint.y} r={4} fill={band.colorHex} />
                {showLabels && (
                  <text
                    x={screenPoint.x + 36}
                    y={screenPoint.y + 4}
                    fill={band.colorHex}
                    fontSize={18}
                    fontWeight={700}
                    dominantBaseline="middle"
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.9))' }}
                  >
                    {band.vietnameseName} ({band.wavelengthNm} nm)
                  </text>
                )}
              </g>
            ))}
          </g>
        )}
      </svg>

      {/* --- EDUCATIONAL OVERLAY HUD CARDS --- */}
      {showCauchyFormula && (
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
              Hiện tượng Tán sắc ánh sáng (Dispersion)
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 19, color: '#CBD5E1', lineHeight: 1.5 }}>
            Ánh sáng trắng gồm 7 màu cơ bản. Trong môi trường trong suốt,{' '}
            <strong style={{ color: '#A855F7' }}>ánh sáng tím</strong> có chiết suất lớn nhất nên bị lệch nhiều nhất,{' '}
            <strong style={{ color: '#EF4444' }}>ánh sáng đỏ</strong> có chiết suất nhỏ nhất nên bị lệch ít nhất!
          </p>
        </div>
      )}
    </div>
  );
};

