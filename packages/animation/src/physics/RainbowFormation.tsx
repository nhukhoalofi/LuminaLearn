import React from 'react';
import type { Point2D } from './physics-types';
import { SPECTRUM_BANDS } from './physics-types';
import { LightRayAnimation } from './LightRayAnimation';

export interface RainbowFormationProps {
  frame?: number;
  progress?: number; // 0 to 1
  width?: number;
  height?: number;
  viewMode?: 'exit_droplet' | 'atmospheric_arc' | 'combined';
  showAngleMarkers?: boolean;
}

export const RainbowFormation: React.FC<RainbowFormationProps> = ({
  frame = 0,
  progress = 1.0,
  width = 1080,
  height = 1920,
  viewMode = 'combined',
  showAngleMarkers = true
}) => {
  // If combined, split progress:
  // 0.0 .. 0.45: Microscopic exit from single droplet with 40°-42° angles
  // 0.45 .. 1.0: Transition to atmospheric landscape and circular rainbow arc
  const isAtmospheric = viewMode === 'atmospheric_arc' || (viewMode === 'combined' && progress > 0.42);
  const macroProgress = Math.min(1, Math.max(0, (progress - 0.4) / 0.6));
  const microProgress = Math.min(1, progress / 0.45);

  // Microscopic Droplet Exit Geometry
  const centerX = width / 2;
  const centerY = height * 0.42;
  const dropRadius = 240;

  // Single droplet exit rays calculation
  const exitRays = SPECTRUM_BANDS.map((band, idx) => {
    const factor = idx / (SPECTRUM_BANDS.length - 1);
    // Lower-front wall
    const exitAngleDeg = 212 + (1 - factor) * 12;
    const exitAngleRad = (exitAngleDeg * Math.PI) / 180;
    const exitPoint: Point2D = {
      x: centerX + dropRadius * Math.cos(exitAngleRad),
      y: centerY + dropRadius * Math.sin(exitAngleRad)
    };

    // Descartes exit angles (42.3° for Red, 40.3° for Violet relative to anti-solar horizontal)
    // Ray emerges pointing down-and-left towards observer
    const beamAngleRad = ((180 - band.rainbowExitAngleDeg) * Math.PI) / 180;
    const distance = 460;
    const observerTarget: Point2D = {
      x: exitPoint.x - distance * Math.cos(beamAngleRad - Math.PI / 2),
      y: exitPoint.y + distance * Math.sin(beamAngleRad - Math.PI / 2)
    };

    return {
      band,
      exitPoint,
      observerTarget
    };
  });

  // Atmospheric Scene Geometry (Landscape view)
  const groundY = height * 0.82;
  const observerPos: Point2D = { x: width * 0.22, y: groundY - 60 };
  const upperDrop: Point2D = { x: width * 0.72, y: height * 0.35 }; // sends Red to observer
  const lowerDrop: Point2D = { x: width * 0.72, y: height * 0.46 }; // sends Violet to observer

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
      >
        <defs>
          {/* Rainbow Spectral Gradient for the atmospheric arc */}
          <linearGradient id="rainbowBandGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.95" />
            <stop offset="16%" stopColor="#F97316" stopOpacity="0.95" />
            <stop offset="33%" stopColor="#FBBF24" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#10B981" stopOpacity="0.95" />
            <stop offset="66%" stopColor="#06B6D4" stopOpacity="0.95" />
            <stop offset="83%" stopColor="#3B82F6" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#A855F7" stopOpacity="0.95" />
          </linearGradient>

          {/* Rainbow Glow */}
          <filter id="arcGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="16" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ============================================================== */}
        {/* VIEW 1: MICROSCOPIC DROPLET EXIT (Progress 0 .. 0.45)           */}
        {/* ============================================================== */}
        {!isAtmospheric && (
          <g opacity={1 - microProgress * 0.1}>
            {/* Droplet Sphere */}
            <circle
              cx={centerX}
              cy={centerY}
              r={dropRadius}
              fill="rgba(56, 189, 248, 0.15)"
              stroke="rgba(186, 230, 253, 0.75)"
              strokeWidth="3"
            />

            {/* Emergent Refracted Rays exiting into air */}
            {exitRays.map(({ band, exitPoint, observerTarget }) => (
              <LightRayAnimation
                key={`exit-${band.name}`}
                from={exitPoint}
                to={observerTarget}
                color={band.colorHex}
                glowColor={band.glowColor}
                width={4}
                progress={microProgress}
                frame={frame}
                showPhotons
                photonSpeed={7}
                arrowHead
              />
            ))}

            {/* Angle Callout Indicators */}
            {showAngleMarkers && microProgress > 0.5 && (
              <g opacity={Math.min(1, (microProgress - 0.5) * 2)}>
                {/* Horizontal Anti-solar Reference Line */}
                <line
                  x1={exitRays[0].exitPoint.x - 360}
                  y1={exitRays[0].exitPoint.y}
                  x2={exitRays[0].exitPoint.x + 80}
                  y2={exitRays[0].exitPoint.y}
                  stroke="rgba(255, 255, 255, 0.4)"
                  strokeWidth={2}
                  strokeDasharray="6,6"
                />

                {/* 42° Red Ray Label */}
                <text
                  x={exitRays[0].observerTarget.x - 10}
                  y={exitRays[0].observerTarget.y - 12}
                  fill="#EF4444"
                  fontSize={22}
                  fontWeight={800}
                >
                  Tia Đỏ: ~42°
                </text>

                {/* 40° Violet Ray Label */}
                <text
                  x={exitRays[exitRays.length - 1].observerTarget.x - 10}
                  y={exitRays[exitRays.length - 1].observerTarget.y + 28}
                  fill="#A855F7"
                  fontSize={22}
                  fontWeight={800}
                >
                  Tia Tím: ~40°
                </text>
              </g>
            )}
          </g>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: ATMOSPHERIC MACRO VIEW (Progress 0.42 .. 1.0)           */}
        {/* ============================================================== */}
        {isAtmospheric && (
          <g opacity={Math.min(1, macroProgress * 1.5)}>
            {/* Ground Line & Silhouette */}
            <line
              x1={0}
              y1={groundY}
              x2={width}
              y2={groundY}
              stroke="rgba(100, 116, 139, 0.4)"
              strokeWidth={3}
            />

            {/* Sun in the Back-Left */}
            <g transform="translate(100, 360)">
              <circle cx={0} cy={0} r={48} fill="#FEF08A" opacity={0.9} />
              <circle
                cx={0}
                cy={0}
                r={72}
                fill="none"
                stroke="#FDE047"
                strokeWidth={2}
                opacity={0.5}
              />
              <text
                x={0}
                y={68}
                fill="#FEF08A"
                fontSize={16}
                fontWeight={700}
                textAnchor="middle"
              >
                Mặt Trời (Phía sau)
              </text>
            </g>

            {/* Observer Figure */}
            <g transform={`translate(${observerPos.x}, ${observerPos.y})`}>
              {/* Head */}
              <circle cx={0} cy={-48} r={14} fill="#F8FAFC" />
              {/* Body */}
              <line x1={0} y1={-34} x2={0} y2={6} stroke="#F8FAFC" strokeWidth={5} />
              {/* Legs */}
              <line x1={0} y1={6} x2={-14} y2={45} stroke="#F8FAFC" strokeWidth={4} />
              <line x1={0} y1={6} x2={14} y2={45} stroke="#F8FAFC" strokeWidth={4} />
              {/* Eye height reference */}
              <text
                x={0}
                y={70}
                fill="#F8FAFC"
                fontSize={17}
                fontWeight={700}
                textAnchor="middle"
              >
                Người quan sát
              </text>
            </g>

            {/* Raindrops in the Sky */}
            {/* Upper Raindrop (High) */}
            <circle
              cx={upperDrop.x}
              cy={upperDrop.y}
              r={18}
              fill="rgba(56, 189, 248, 0.8)"
              stroke="#E0F2FE"
              strokeWidth={2}
            />
            <text
              x={upperDrop.x + 30}
              y={upperDrop.y - 6}
              fill="#EF4444"
              fontSize={18}
              fontWeight={700}
            >
              Hạt mưa trên cao (Phát tia đỏ 42°)
            </text>

            {/* Lower Raindrop (Low) */}
            <circle
              cx={lowerDrop.x}
              cy={lowerDrop.y}
              r={18}
              fill="rgba(56, 189, 248, 0.8)"
              stroke="#E0F2FE"
              strokeWidth={2}
            />
            <text
              x={lowerDrop.x + 30}
              y={lowerDrop.y + 22}
              fill="#A855F7"
              fontSize={18}
              fontWeight={700}
            >
              Hạt mưa dưới thấp (Phát tia tím 40°)
            </text>

            {/* Rays entering the Observer's Eye */}
            {/* Red Ray from upper drop to eye */}
            <line
              x1={upperDrop.x}
              y1={upperDrop.y}
              x2={observerPos.x}
              y2={observerPos.y - 48}
              stroke="#EF4444"
              strokeWidth={3.5}
              strokeDasharray="4,4"
            />
            {/* Violet Ray from lower drop to eye */}
            <line
              x1={lowerDrop.x}
              y1={lowerDrop.y}
              x2={observerPos.x}
              y2={observerPos.y - 48}
              stroke="#A855F7"
              strokeWidth={3.5}
              strokeDasharray="4,4"
            />

            {/* ========================================================== */}
            {/* FULL GLOWING CIRCULAR RAINBOW ARC IN THE SKY               */}
            {/* ========================================================== */}
            {macroProgress > 0.3 && (
              <g
                opacity={Math.min(1, (macroProgress - 0.3) * 2)}
                filter="url(#arcGlow)"
              >
                {/* 7 Concentric Rainbow Arcs */}
                {SPECTRUM_BANDS.map((band, idx) => {
                  const factor = idx / (SPECTRUM_BANDS.length - 1);
                  // Outer arc is Red (r ≈ 760), Inner arc is Violet (r ≈ 715)
                  const arcRadius = 760 - factor * 45;
                  const arcCenter = { x: observerPos.x + 380, y: groundY + 120 };

                  return (
                    <path
                      key={`arc-${band.name}`}
                      d={`M ${arcCenter.x - arcRadius * 0.96} ${arcCenter.y - arcRadius * 0.3}
                          A ${arcRadius} ${arcRadius} 0 0 1 ${arcCenter.x + arcRadius * 0.96} ${arcCenter.y - arcRadius * 0.3}`}
                      stroke={band.colorHex}
                      strokeWidth={8}
                      fill="none"
                      strokeLinecap="round"
                      opacity={0.88}
                    />
                  );
                })}
              </g>
            )}

            {/* Rainbow Arc Explanation Overlay */}
            {macroProgress > 0.6 && (
              <g opacity={Math.min(1, (macroProgress - 0.6) * 2.5)}>
                <text
                  x={width / 2}
                  y={height * 0.22}
                  fill="#F8FAFC"
                  fontSize={28}
                  fontWeight={900}
                  textAnchor="middle"
                  style={{
                    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.9))',
                    letterSpacing: '1px'
                  }}
                >
                  🌈 CẦU VỒNG 7 SẮC HOÀN CHỈNH
                </text>
                <text
                  x={width / 2}
                  y={height * 0.25}
                  fill="#38BDF8"
                  fontSize={18}
                  fontWeight={700}
                  textAnchor="middle"
                >
                  Tia Đỏ ở ngoài cùng (42°) — Tia Tím ở trong cùng (40°)
                </text>
              </g>
            )}
          </g>
        )}
      </svg>

      {/* --- EDUCATIONAL STEP 3 HUD --- */}
      <div
        style={{
          position: 'absolute',
          bottom: height * 0.1,
          left: 50,
          right: 50,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
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
            {!isAtmospheric
              ? 'Bước 3: Khúc xạ thoát ra ở góc 40° — 42°'
              : 'Hình thành Vòng cung Cầu vồng'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 19, color: '#CBD5E1', lineHeight: 1.5 }}>
          {!isAtmospheric
            ? 'Khi tia sáng khúc xạ lần 2 ra ngoài không khí, góc lệch cực tiểu của tia đỏ là 42° và tia tím là 40°. Đây là chùm tia có mật độ tập trung quang học cao nhất (góc Descartes)!'
            : 'Hàng triệu giọt mưa trong bầu khí quyển cùng hướng các tia 40°-42° vào mắt bạn. Do tính đối xứng tròn quanh trục bóng người (điểm đối nhật), ta nhìn thấy một hình vòng cung rực rỡ!'}
        </p>
      </div>
    </div>
  );
};

