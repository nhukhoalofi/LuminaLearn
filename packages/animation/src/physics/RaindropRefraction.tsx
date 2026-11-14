import React from 'react';
import type { Point2D } from './physics-types';
import { SPECTRUM_BANDS } from './physics-types';
import { LightRayAnimation } from './LightRayAnimation';

export interface RaindropRefractionProps {
  frame?: number;
  progress?: number; // 0 to 1
  width?: number;
  height?: number;
  showNormals?: boolean;
  showSnellFormula?: boolean;
}

export const RaindropRefraction: React.FC<RaindropRefractionProps> = ({
  frame = 0,
  progress = 1.0,
  width = 1080,
  height = 1920,
  showNormals = true,
  showSnellFormula = true
}) => {
  // Center of spherical raindrop
  const centerX = width / 2;
  const centerY = height * 0.44;
  const dropRadius = 260;

  // Impact parameter for Descartes rainbow caustic:
  // For n ≈ 1.33, sin(i0) ≈ 0.86, so entry point is near upper hemisphere
  // Angle phi from droplet center to entry point
  // Normal vector at surface points inward towards center or outward from center
  const entryAngleRad = (135 * Math.PI) / 180; // Entry at top-left
  const entryPoint: Point2D = {
    x: centerX + dropRadius * Math.cos(entryAngleRad),
    y: centerY - dropRadius * Math.sin(entryAngleRad)
  };

  // Incoming horizontal sunbeam from left
  const sunSource: Point2D = {
    x: entryPoint.x - 380,
    y: entryPoint.y
  };

  // Surface normal vector at entry (pointing radially outward)
  const normalOutward: Point2D = {
    x: Math.cos(entryAngleRad),
    y: -Math.sin(entryAngleRad)
  };

  // Ray progress phases:
  // Phase 1: Incoming sunlight reaches raindrop surface (progress 0..0.4)
  const sunbeamProgress = Math.min(1, progress / 0.4);

  // Phase 2: Refraction & dispersion inside droplet (progress 0.4..1.0)
  const refractionProgress = Math.min(1, Math.max(0, (progress - 0.4) / 0.6));

  // Compute refracted path for Red and Violet (and intermediate bands)
  // Inside the drop, the ray strikes the back boundary at angle = 2*r from entry
  const dispersedRays = SPECTRUM_BANDS.map((band, idx) => {
    const factor = idx / (SPECTRUM_BANDS.length - 1);
    // Red (n=1.331) bends less -> travels to back at higher position
    // Violet (n=1.344) bends more -> travels to back at lower position
    const backAngleRad = (-25 + factor * 16) * (Math.PI / 180);
    const backPoint: Point2D = {
      x: centerX + dropRadius * Math.cos(backAngleRad),
      y: centerY + dropRadius * Math.sin(backAngleRad)
    };

    return {
      band,
      backPoint
    };
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
      >
        <defs>
          {/* Water Droplet Radial Caustic Gradient */}
          <radialGradient id="raindropFluid" cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="rgba(224, 242, 254, 0.45)" />
            <stop offset="55%" stopColor="rgba(56, 189, 248, 0.18)" />
            <stop offset="85%" stopColor="rgba(14, 165, 233, 0.32)" />
            <stop offset="100%" stopColor="rgba(2, 132, 199, 0.55)" />
          </radialGradient>

          {/* Droplet Highlight Glow */}
          <filter id="dropGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="12" stdDeviation="24" floodColor="rgba(14, 165, 233, 0.35)" />
          </filter>
        </defs>

        {/* --- SPHERICAL RAINDROP BODY --- */}
        <circle
          cx={centerX}
          cy={centerY}
          r={dropRadius}
          fill="url(#raindropFluid)"
          stroke="rgba(186, 230, 253, 0.85)"
          strokeWidth="3.5"
          filter="url(#dropGlow)"
        />

        {/* Specular Highlight Arc on Droplet Top-Left */}
        <path
          d={`M ${centerX - dropRadius * 0.7} ${centerY - dropRadius * 0.65} 
             A ${dropRadius * 0.85} ${dropRadius * 0.85} 0 0 1 ${centerX + dropRadius * 0.2} ${centerY - dropRadius * 0.88}`}
          stroke="rgba(255, 255, 255, 0.65)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />

        {/* Refractive Index Label */}
        <text
          x={centerX}
          y={centerY - 20}
          fill="rgba(224, 242, 254, 0.5)"
          fontSize={22}
          fontWeight={700}
          textAnchor="middle"
        >
          Giọt nước (n ≈ 1.33)
        </text>

        {/* Normal Line at Entry Point */}
        {showNormals && sunbeamProgress > 0.6 && (
          <g opacity={0.75}>
            <line
              x1={entryPoint.x - normalOutward.x * 70}
              y1={entryPoint.y - normalOutward.y * 70}
              x2={entryPoint.x + normalOutward.x * 70}
              y2={entryPoint.y + normalOutward.y * 70}
              stroke="rgba(255, 255, 255, 0.55)"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
            <text
              x={entryPoint.x + normalOutward.x * 90}
              y={entryPoint.y + normalOutward.y * 90}
              fill="#E2E8F0"
              fontSize={16}
              fontWeight={600}
              textAnchor="middle"
            >
              Pháp tuyến N
            </text>
          </g>
        )}

        {/* --- 1. INCOMING WHITE SUNBEAM --- */}
        <LightRayAnimation
          from={sunSource}
          to={entryPoint}
          color="#FFFBEB"
          glowColor="rgba(255, 251, 235, 0.8)"
          width={7}
          progress={sunbeamProgress}
          frame={frame}
          showPhotons
          photonSpeed={8}
          label="Tia sáng Mặt Trời"
          labelPosition="mid"
        />

        {/* --- 2. REFRACTED RAYS INSIDE RAINDROP --- */}
        {refractionProgress > 0 &&
          dispersedRays.map(({ band, backPoint }) => (
            <LightRayAnimation
              key={`refracted-${band.name}`}
              from={entryPoint}
              to={backPoint}
              color={band.colorHex}
              glowColor={band.glowColor}
              width={3.5}
              progress={refractionProgress}
              frame={frame}
              showPhotons
              photonSpeed={6}
            />
          ))}

        {/* Refraction Point Sparkle */}
        {sunbeamProgress >= 0.95 && (
          <circle
            cx={entryPoint.x}
            cy={entryPoint.y}
            r={8}
            fill="#FFFFFF"
            style={{ filter: 'drop-shadow(0 0 10px #FFFFFF)' }}
          />
        )}

        {/* Color Dispersion Labels at Back Surface */}
        {refractionProgress > 0.7 && (
          <g opacity={Math.min(1, (refractionProgress - 0.7) * 3)}>
            {/* Red Ray Callout */}
            <text
              x={dispersedRays[0].backPoint.x + 25}
              y={dispersedRays[0].backPoint.y - 12}
              fill="#EF4444"
              fontSize={18}
              fontWeight={700}
            >
              Đỏ (lệch ít, n = 1.331)
            </text>

            {/* Violet Ray Callout */}
            <text
              x={dispersedRays[dispersedRays.length - 1].backPoint.x + 25}
              y={dispersedRays[dispersedRays.length - 1].backPoint.y + 18}
              fill="#A855F7"
              fontSize={18}
              fontWeight={700}
            >
              Tím (lệch nhiều, n = 1.344)
            </text>
          </g>
        )}
      </svg>

      {/* --- EDUCATIONAL SNELL'S LAW HUD --- */}
      {showSnellFormula && (
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
              Bước 1: Khúc xạ & Tán sắc khi vào giọt nước
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 19, color: '#CBD5E1', lineHeight: 1.5 }}>
            Theo <strong>Định luật Snell</strong> ($1 \cdot \sin i = n \cdot \sin r$), khi đi từ không khí vào nước,
            tia sáng bị bẻ cong. Vì mỗi màu sắc có chiết suất $n$ khác nhau nên chùm sáng bị tách thành các tia màu riêng biệt!
          </p>
        </div>
      )}
    </div>
  );
};

