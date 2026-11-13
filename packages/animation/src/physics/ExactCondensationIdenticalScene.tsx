import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { MascotRobot } from './MascotRobot';

interface DropletData {
  x: number;
  y: number;
  r: number;
  speed?: number;
  delay?: number;
}

const STATIC_CAN_DROPS: DropletData[] = [
  // Upper zone (above label band, y: 65 .. 190) - safe from rim and label
  { x: 65, y: 75, r: 8 },
  { x: 125, y: 85, r: 11 },
  { x: 195, y: 70, r: 9 },
  { x: 255, y: 90, r: 7 },
  { x: 55, y: 135, r: 10 },
  { x: 110, y: 145, r: 13 },
  { x: 170, y: 125, r: 12 },
  { x: 235, y: 150, r: 9 },
  { x: 80, y: 185, r: 11 },
  { x: 145, y: 180, r: 8 },
  { x: 215, y: 185, r: 10 },

  // Lower zone (below label band, y: 325 .. 435) - safe from label and bottom chime
  { x: 60, y: 330, r: 9 },
  { x: 130, y: 345, r: 12 },
  { x: 190, y: 330, r: 10 },
  { x: 250, y: 340, r: 8 },
  { x: 85, y: 380, r: 12 },
  { x: 155, y: 375, r: 14 },
  { x: 220, y: 385, r: 11 },
  { x: 65, y: 425, r: 8 },
  { x: 125, y: 420, r: 10 },
  { x: 195, y: 430, r: 11 },
  { x: 255, y: 415, r: 9 },
];

// Helper component to render a realistic water droplet
const Droplet: React.FC<{ cx: number; cy: number; r: number; opacity?: number }> = ({ cx, cy, r, opacity = 1 }) => (
  <g opacity={opacity}>
    {/* Teardrop / rounded drop body */}
    <ellipse cx={cx} cy={cy + r * 0.2} rx={r} ry={r * 1.2} fill="#7DD3FC" opacity={0.9} />
    <path
      d={`M ${cx - r * 0.85} ${cy + r * 0.1} Q ${cx} ${cy - r * 1.5} ${cx + r * 0.85} ${cy + r * 0.1} Z`}
      fill="#7DD3FC"
      opacity={0.9}
    />
    {/* Specular highlight glint */}
    <circle cx={cx - r * 0.3} cy={cy - r * 0.3} r={r * 0.3} fill="#FFFFFF" opacity={0.95} />
    <ellipse cx={cx + r * 0.25} cy={cy + r * 0.4} rx={r * 0.2} ry={r * 0.25} fill="#BAE6FD" opacity={0.7} />
  </g>
);

// Helper component for the Cold Beverage Can
const ColdCan: React.FC<{
  x: number;
  y: number;
  width?: number;
  height?: number;
  dropProgress?: number;
  condensing?: boolean;
}> = ({ x, y, width = 320, height = 500, dropProgress = 1, condensing = false }) => {
  const frame = useCurrentFrame();

  return (
    <svg
      x={x - width / 2}
      y={y - height / 2}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="canBodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="15%" stopColor="#334155" />
          <stop offset="45%" stopColor="#475569" />
          <stop offset="70%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id="canRimGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#94A3B8" />
          <stop offset="50%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>
        <linearGradient id="bandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="50%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
        <clipPath id="canBodyClip">
          <rect x={16} y={35} width={width - 32} height={height - 68} rx={28} />
        </clipPath>
      </defs>

      {/* Top Rim & Pull Tab */}
      <ellipse cx={width / 2} cy={30} rx={width * 0.46} ry={16} fill="url(#canRimGrad)" stroke="#CBD5E1" strokeWidth={3} />
      <rect x={width / 2 - 28} y={12} width={56} height={16} rx={5} fill="#94A3B8" stroke="#475569" strokeWidth={2} />
      <circle cx={width / 2} cy={20} r={4} fill="#475569" />

      {/* Can Main Body */}
      <rect
        x={12}
        y={30}
        width={width - 24}
        height={height - 50}
        rx={34}
        fill="url(#canBodyGrad)"
        stroke="#475569"
        strokeWidth={3}
      />

      {/* Can Bottom Chime */}
      <ellipse cx={width / 2} cy={height - 24} rx={width * 0.44} ry={12} fill="#334155" />

      {/* Left Specular Glint Streaks */}
      <line x1={42} y1={50} x2={42} y2={height - 50} stroke="#FFFFFF" strokeWidth={5} strokeOpacity={0.25} strokeLinecap="round" />
      <line x1={54} y1={70} x2={54} y2={height - 70} stroke="#FFFFFF" strokeWidth={3} strokeOpacity={0.15} strokeLinecap="round" />

      {/* Middle Label Band: "NƯỚC LẠNH" (clean, zero droplets overlapping) */}
      <g>
        <rect
          x={12}
          y={height * 0.42}
          width={width - 24}
          height={95}
          fill="url(#bandGrad)"
        />
        <text
          x={width / 2}
          y={height * 0.42 + 60}
          fill="#0F172A"
          fontSize={32}
          fontWeight={900}
          letterSpacing="0.06em"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          NƯỚC LẠNH
        </text>
      </g>

      {/* Condensation Droplets strictly clipped inside can body */}
      <g clipPath="url(#canBodyClip)">
        {STATIC_CAN_DROPS.map((drop, idx) => {
          const dropOpacity = interpolate(
            dropProgress,
            [idx / STATIC_CAN_DROPS.length * 0.5, 0.5 + (idx / STATIC_CAN_DROPS.length) * 0.5],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          // Subtle sliding down for a few droplets
          const slideOffset = condensing ? Math.sin((frame + idx * 20) / 15) * 6 : 0;

          return (
            <Droplet
              key={idx}
              cx={drop.x}
              cy={drop.y + slideOffset}
              r={drop.r}
              opacity={dropOpacity}
            />
          );
        })}
      </g>
    </svg>
  );
};

export const ExactCondensationIdenticalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Clean persistent header (NO "NGÀY 2/100" as explicitly requested by user)
  const renderHeader = () => (
    <div
      style={{
        position: 'absolute',
        top: 80,
        left: 60,
        right: 60,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 100,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            backgroundColor: '#38BDF8',
            boxShadow: `0 0 ${8 + Math.sin(frame / 6) * 4}px #38BDF8`,
          }}
        />
        <div style={{ color: '#E2E8F0', fontSize: 32, fontWeight: 800, letterSpacing: '0.02em' }}>
          VẬT LÝ với LuminaLearn
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          backgroundColor: 'rgba(56, 189, 248, 0.12)',
          border: '2px solid rgba(56, 189, 248, 0.4)',
          color: '#38BDF8',
          padding: '8px 24px',
          borderRadius: 9999,
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: '0.04em',
        }}
      >
        <span>NGƯNG TỤ</span>
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: '#0B132B',
        color: '#FFFFFF',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {renderHeader()}

      {/* =========================================================================
          SCENE 1: Frame 0 -> 135 (0s -> 4.5s)
          Hook Intro:
          - Title: VÌ SAO...? / Lon nước lạnh “đổ mồ hôi”?
          - Cold can centered with condensation droplets
          ========================================================================= */}
      {frame >= 0 && frame < 135 && (() => {
        const titleY = interpolate(frame, [0, 25], [50, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const canScale = spring({
          frame,
          fps,
          config: { damping: 12, mass: 0.8, stiffness: 110 },
        });

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Title Section */}
            <div
              style={{
                position: 'absolute',
                top: 240,
                left: 80,
                right: 80,
                transform: `translateY(${titleY}px)`,
                opacity: titleOpacity,
              }}
            >
              <div style={{ color: '#38BDF8', fontSize: 44, fontWeight: 800, marginBottom: 12 }}>
                VÌ SAO...?
              </div>
              <div style={{ color: '#FFFFFF', fontSize: 62, fontWeight: 900, lineHeight: 1.25 }}>
                Lon nước lạnh
                <br />
                <span style={{ color: '#FBBF24' }}>“đổ mồ hôi”?</span>
              </div>
            </div>

            {/* Centered Cold Can */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 980,
                transform: `translate(-50%, -50%) scale(${canScale})`,
              }}
            >
              <ColdCan x={160} y={250} width={340} height={520} dropProgress={1} />
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 2: Frame 135 -> 390 (4.5s -> 13.0s)
          Misconception & Debunk:
          - Title: Nước thấm từ trong lon ra?
          - Can slides to left
          - Pop-in Orange 'X' + SAI!
          - Subtitle at bottom: Lon vẫn kín, nước trên thành lon cũng chẳng hề có vị ngọt.
          ========================================================================= */}
      {frame >= 135 && frame < 390 && (() => {
        const canX = interpolate(frame, [135, 175], [540, 320], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        // Frame 255 = ~8.5s when voice says "Sai!"
        const showCross = frame >= 250;
        const crossScale = showCross
          ? spring({
              frame: frame - 250,
              fps,
              config: { damping: 10, mass: 0.6, stiffness: 140 },
            })
          : 0;

        const subOpacity = interpolate(frame, [265, 285], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Title Section */}
            <div style={{ position: 'absolute', top: 240, left: 80, right: 80 }}>
              <div style={{ color: '#FFFFFF', fontSize: 58, fontWeight: 900, lineHeight: 1.3 }}>
                Nước thấm từ trong
                <br />
                lon ra?
              </div>
            </div>

            {/* Can shifted left */}
            <div
              style={{
                position: 'absolute',
                left: canX,
                top: 960,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <ColdCan x={160} y={250} width={320} height={500} dropProgress={1} />
            </div>

            {/* Red-Orange 'X' Cross and SAI! on the right */}
            {showCross && (
              <div
                style={{
                  position: 'absolute',
                  left: 770,
                  top: 960,
                  transform: `translate(-50%, -50%) scale(${crossScale})`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 24,
                }}
              >
                <svg width="240" height="240" viewBox="0 0 240 240">
                  <line
                    x1="30"
                    y1="30"
                    x2="210"
                    y2="210"
                    stroke="#F97316"
                    strokeWidth="28"
                    strokeLinecap="round"
                  />
                  <line
                    x1="210"
                    y1="30"
                    x2="30"
                    y2="210"
                    stroke="#F97316"
                    strokeWidth="28"
                    strokeLinecap="round"
                  />
                </svg>
                <div
                  style={{
                    color: '#F97316',
                    fontSize: 66,
                    fontWeight: 900,
                    letterSpacing: '0.04em',
                    textShadow: '0 0 24px rgba(249, 115, 22, 0.4)',
                  }}
                >
                  SAI!
                </div>
              </div>
            )}

            {/* Subtitle at bottom */}
            {frame >= 265 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 240,
                  left: 80,
                  right: 80,
                  fontSize: 38,
                  fontWeight: 700,
                  lineHeight: 1.5,
                  opacity: subOpacity,
                }}
              >
                <div>
                  Lon vẫn <span style={{ color: '#38BDF8' }}>kín</span>, nước trên thành lon
                </div>
                <div>cũng chẳng hề có vị ngọt.</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 3 & 4: Frame 390 -> 810 (13.0s -> 27.0s)
          Mechanism: Invisible vapor + Condensation on cold can surface
          - Cold contour wave rings around can + label "lạnh"
          - Ambient vapor particles floating
          - Particles drift inward and form droplets
          - Subtitle: Gặp thành lon lạnh → ngưng tụ thành giọt nước
          ========================================================================= */}
      {frame >= 390 && frame < 810 && (() => {
        // Cold pulsing contour waves
        const pulse = (frame * 0.08) % 1;
        const waveScale1 = 1 + pulse * 0.15;
        const waveScale2 = 1.08 + ((pulse + 0.5) % 1) * 0.15;

        // Condensation progress starts at ~frame 570 (19.0s)
        const isCondensing = frame >= 570;
        const condensationProgress = interpolate(frame, [570, 720], [0.3, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Title Section */}
            <div style={{ position: 'absolute', top: 240, left: 80, right: 80 }}>
              <div style={{ color: '#FFFFFF', fontSize: 58, fontWeight: 900, lineHeight: 1.3 }}>
                Không khí luôn có
                <br />
                hơi nước <span style={{ color: '#38BDF8' }}>vô hình</span>
              </div>
            </div>

            {/* Cold Contour Waves around Can */}
            <svg
              width="1080"
              height="1920"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              {/* Cold Radiating Rings */}
              <g transform="translate(540, 960)">
                <rect
                  x="-200"
                  y="-290"
                  width="400"
                  height="580"
                  rx="60"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="3"
                  strokeOpacity={0.45 * (1 - pulse)}
                  transform={`scale(${waveScale1})`}
                />
                <rect
                  x="-230"
                  y="-320"
                  width="460"
                  height="640"
                  rx="75"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="2"
                  strokeOpacity={0.3 * (1 - ((pulse + 0.5) % 1))}
                  transform={`scale(${waveScale2})`}
                />
                {/* Cold Layer Label */}
                <text
                  x="200"
                  y="-180"
                  fill="#38BDF8"
                  fontSize="34"
                  fontWeight="800"
                  fontFamily="system-ui"
                >
                  lạnh
                </text>
              </g>

              {/* Ambient Invisible Water Vapor Particles */}
              {Array.from({ length: 42 }).map((_, i) => {
                const angle = (i * 360) / 42;
                const baseDist = 260 + (i % 6) * 45;
                const drift = isCondensing
                  ? interpolate(frame, [570, 750], [0, baseDist - 150], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    })
                  : 0;
                const currentDist = Math.max(140, baseDist - drift);
                const rad = (angle * Math.PI) / 180;
                const px = 540 + Math.cos(rad) * currentDist + Math.sin((frame + i * 15) / 10) * 8;
                const py = 960 + Math.sin(rad) * (currentDist * 1.3) + Math.cos((frame + i * 12) / 10) * 8;
                const r = 5 + (i % 4) * 2.5;

                return (
                  <circle
                    key={i}
                    cx={px}
                    cy={py}
                    r={r}
                    fill="#38BDF8"
                    opacity={0.65 + Math.sin((frame + i * 10) / 8) * 0.3}
                    filter="drop-shadow(0 0 6px #38BDF8)"
                  />
                );
              })}
            </svg>

            {/* Can in Center */}
            <div
              style={{
                position: 'absolute',
                left: 540,
                top: 960,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <ColdCan
                x={160}
                y={250}
                width={320}
                height={500}
                dropProgress={condensationProgress}
                condensing={isCondensing}
              />
            </div>

            {/* Subtitle at bottom */}
            {isCondensing && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 240,
                  left: 80,
                  right: 80,
                  fontSize: 38,
                  fontWeight: 700,
                  lineHeight: 1.5,
                }}
              >
                <div>Gặp thành lon lạnh →</div>
                <div>
                  <span style={{ color: '#38BDF8' }}>ngưng tụ</span> thành giọt nước
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 5: Frame 810 -> 1230 (27.0s -> 41.0s)
          Temperature vs Saturated Vapor Capacity:
          - Top Card: Không khí càng lạnh càng chứa được ít hơi nước
          - 1 m³ chamber box
          - Phase A: 30°C (Orange), line at 30g
          - Phase B: Cools down to 5°C (Cyan), line drops to 7g, excess drips out
          - Subtitle: Hơi nước dư → ngưng tụ thành nước
          ========================================================================= */}
      {frame >= 810 && frame < 1230 && (() => {
        // Temperature drop starts at frame 1020 (~34s)
        const isCooling = frame >= 1020;
        const coolProgress = interpolate(frame, [1020, 1120], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        const tempVal = Math.round(interpolate(coolProgress, [0, 1], [30, 5]));
        const maxGrams = Math.round(interpolate(coolProgress, [0, 1], [30, 7]));
        const levelY = interpolate(coolProgress, [0, 1], [400, 150]);

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Top Cyan Bordered Card */}
            <div
              style={{
                position: 'absolute',
                top: 220,
                left: 80,
                right: 80,
                border: '4px solid #38BDF8',
                borderRadius: 24,
                padding: '36px 32px',
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                boxShadow: '0 0 24px rgba(56, 189, 248, 0.2)',
                textAlign: 'center',
              }}
            >
              <div style={{ color: '#38BDF8', fontSize: 44, fontWeight: 900, lineHeight: 1.35 }}>
                Không khí càng lạnh
                <br />
                càng chứa được ít hơi nước
              </div>
            </div>

            {/* 1 m³ Chamber Visualization */}
            <div
              style={{
                position: 'absolute',
                top: 520,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 860,
                height: 680,
              }}
            >
              <svg width="860" height="680" viewBox="0 0 860 680">
                <defs>
                  <clipPath id="chamberBoxClip">
                    <rect x="64" y="44" width="432" height="452" rx="16" />
                  </clipPath>
                  <clipPath id="dripClip">
                    <rect x="70" y="500" width="420" height="96" />
                  </clipPath>
                </defs>

                {/* Chamber Outline */}
                <rect
                  x="60"
                  y="40"
                  width="440"
                  height="460"
                  rx="20"
                  fill="rgba(30, 41, 59, 0.65)"
                  stroke="#475569"
                  strokeWidth="4"
                />

                {/* Chamber Label */}
                <text
                  x="280"
                  y="85"
                  fill="#E2E8F0"
                  fontSize="28"
                  fontWeight="700"
                  textAnchor="middle"
                  fontFamily="system-ui"
                >
                  1 m³ không khí ẩm
                </text>

                {/* Contents clipped strictly within chamber */}
                <g clipPath="url(#chamberBoxClip)">
                  {/* Saturated capacity blue fill area */}
                  <rect
                    x="64"
                    y={500 - levelY}
                    width="432"
                    height={levelY - 4}
                    rx="16"
                    fill="#0284C7"
                    opacity={0.35}
                  />

                  {/* Dynamic Vapor Particles bouncing with thermal motion */}
                  {Array.from({ length: isCooling ? 16 : 38 }).map((_, i) => {
                    const seedX = (i * 73) % 380;
                    const seedY = (i * 51) % Math.max(60, levelY - 40);
                    const motionX = Math.sin((frame * 1.5 + i * 23) / 10) * 16;
                    const motionY = Math.cos((frame * 1.5 + i * 17) / 10) * 12;
                    const px = Math.max(80, Math.min(480, 80 + seedX + motionX));
                    const py = Math.max(500 - levelY + 20, Math.min(485, 500 - seedY + motionY));

                    return (
                      <circle
                        key={i}
                        cx={px}
                        cy={py}
                        r={6}
                        fill="#38BDF8"
                        opacity={0.8}
                        filter="drop-shadow(0 0 5px #38BDF8)"
                      />
                    );
                  })}
                </g>

                {/* Dashed Capacity Boundary Line */}
                <line
                  x1="60"
                  y1={500 - levelY}
                  x2="500"
                  y2={500 - levelY}
                  stroke={isCooling ? '#38BDF8' : '#FB923C'}
                  strokeWidth="4"
                  strokeDasharray="12 10"
                />

                {/* Text along capacity line */}
                <text
                  x="280"
                  y={480 - levelY}
                  fill="#FFFFFF"
                  fontSize="26"
                  fontWeight="800"
                  textAnchor="middle"
                  fontFamily="system-ui"
                >
                  đang có {maxGrams} g
                </text>

                <text
                  x="530"
                  y={508 - levelY}
                  fill={isCooling ? '#38BDF8' : '#FB923C'}
                  fontSize="28"
                  fontWeight="800"
                  fontFamily="system-ui"
                >
                  tối đa ≈ {maxGrams} g
                </text>

                {/* Temperature Readout on Right */}
                <text
                  x="530"
                  y="460"
                  fill={isCooling ? '#38BDF8' : '#FB923C'}
                  fontSize="56"
                  fontWeight="900"
                  fontFamily="system-ui"
                >
                  {tempVal}°C
                </text>

                {/* Excess Water Dripping Out (Phase B) strictly clipped above tray */}
                {isCooling && (
                  <g clipPath="url(#dripClip)">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const dripX = 110 + i * 26; // inside tray horizontal span
                      const dripProgress = ((frame * 6 + i * 25) % 100) / 100;
                      const dripY = 502 + dripProgress * 88; // ends above tray y=595
                      return (
                        <circle
                          key={i}
                          cx={dripX}
                          cy={dripY}
                          r={4.5}
                          fill="#93C5FD"
                          opacity={1 - dripProgress * 0.35}
                        />
                      );
                    })}
                  </g>
                )}

                {/* Catch Tray / Surface */}
                {isCooling && (
                  <rect
                    x="70"
                    y="595"
                    width="420"
                    height="14"
                    rx="7"
                    fill="#64748B"
                    opacity={0.9}
                  />
                )}
              </svg>
            </div>

            {/* Subtitle at bottom */}
            {isCooling && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 240,
                  left: 80,
                  right: 80,
                  fontSize: 38,
                  fontWeight: 700,
                  lineHeight: 1.5,
                }}
              >
                <div>
                  <span style={{ color: '#38BDF8' }}>Hơi nước dư</span> → ngưng tụ thành nước
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 6: Frame 1230 -> 1560 (41.0s -> 52.0s)
          Real-World: Trời nồm ở miền Bắc
          - Left: Gió ẩm, ấm → + particle stream
          - Right: Tường, sàn còn lạnh + 4x5 wall tiles + perspective floor
          - Condensation droplets glistening on wall & floor
          - Subtitle: Tường lạnh + không khí ẩm → sàn nhà “đổ mồ hôi”
          ========================================================================= */}
      {frame >= 1230 && frame < 1560 && (() => {
        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Title Section */}
            <div style={{ position: 'absolute', top: 240, left: 80, right: 80 }}>
              <div style={{ color: '#FFFFFF', fontSize: 58, fontWeight: 900, lineHeight: 1.3 }}>
                Trời <span style={{ color: '#FBBF24' }}>nồm</span> ở miền Bắc
                <br />
                cũng là hiện tượng này!
              </div>
            </div>

            {/* Room Architecture Diagram */}
            <div
              style={{
                position: 'absolute',
                top: 500,
                left: 60,
                right: 60,
                height: 800,
              }}
            >
              <svg width="960" height="800" viewBox="0 0 960 800">
                {/* Left Label: gió ẩm, ấm → */}
                <text
                  x="80"
                  y="120"
                  fill="#FB923C"
                  fontSize="36"
                  fontWeight="800"
                  fontFamily="system-ui"
                >
                  gió ẩm, ấm →
                </text>

                {/* Flowing warm moisture vapor particles */}
                {Array.from({ length: 28 }).map((_, i) => {
                  const flowProgress = ((frame * 4 + i * 35) % 360) / 360;
                  const px = 60 + flowProgress * 320;
                  const py = 160 + (i % 7) * 55 + Math.sin((frame + i * 15) / 8) * 8;
                  return (
                    <circle
                      key={i}
                      cx={px}
                      cy={py}
                      r={7}
                      fill="#38BDF8"
                      opacity={0.8}
                      filter="drop-shadow(0 0 6px #38BDF8)"
                    />
                  );
                })}

                {/* Right Label: tường, sàn còn lạnh */}
                <text
                  x="620"
                  y="70"
                  fill="#38BDF8"
                  fontSize="32"
                  fontWeight="800"
                  textAnchor="middle"
                  fontFamily="system-ui"
                >
                  tường, sàn còn lạnh
                </text>

                <defs>
                  <clipPath id="floorDropletClip">
                    <polygon points="220,540 812,540 720,700 120,700" />
                  </clipPath>
                </defs>

                {/* 4x5 Wall Grid Tiles */}
                <g transform="translate(420, 100)">
                  {Array.from({ length: 5 }).map((_, row) =>
                    Array.from({ length: 4 }).map((_, col) => {
                      const tileX = col * 98;
                      const tileY = row * 88;
                      const hasDrop = (row * 4 + col) % 3 === 1;

                      return (
                        <g key={`${row}-${col}`}>
                          <rect
                            x={tileX}
                            y={tileY}
                            width="92"
                            height="82"
                            rx="8"
                            fill="#1E293B"
                            stroke="#334155"
                            strokeWidth="3"
                          />
                          {/* Condensed Water Drops safely centered in tile */}
                          {hasDrop && (
                            <Droplet cx={tileX + 46} cy={tileY + 41} r={7} opacity={0.9} />
                          )}
                        </g>
                      );
                    })
                  )}
                </g>

                {/* Perspective Floor (Trapezoid) */}
                <polygon
                  points="220,540 420,540 812,540 812,650 220,650"
                  fill="#1E293B"
                  stroke="#334155"
                  strokeWidth="3"
                />
                <polygon
                  points="220,650 812,650 720,700 120,700"
                  fill="#0F172A"
                  stroke="#334155"
                  strokeWidth="3"
                />

                {/* Floor wet puddles & droplets strictly clipped inside floor */}
                <g clipPath="url(#floorDropletClip)">
                  <Droplet cx={360} cy={580} r={9} />
                  <Droplet cx={520} cy={570} r={10} />
                  <Droplet cx={680} cy={585} r={8} />
                  <Droplet cx={280} cy={640} r={10} />
                  <Droplet cx={470} cy={645} r={11} />
                  <Droplet cx={640} cy={640} r={9} />
                </g>
              </svg>
            </div>

            {/* Subtitle at bottom */}
            <div
              style={{
                position: 'absolute',
                bottom: 240,
                left: 80,
                right: 80,
                fontSize: 38,
                fontWeight: 700,
                lineHeight: 1.5,
              }}
            >
              <div>Tường lạnh + không khí ẩm →</div>
              <div>
                sàn nhà <span style={{ color: '#FBBF24' }}>“đổ mồ hôi”</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 7: Frame 1560 -> 1920 (52.0s -> 64.0s)
          Outro: Takeaway Card & Challenge Question
          - Header: NHỚ NHÉ
          - Glowing Cyan Summary Card:
            Hơi nước gặp lạnh → ngưng tụ thành nước
          - Question:
            Câu hỏi cho bạn:
            Vì sao từ phòng điều hoà bước ra ngoài trời nóng, kính cận bị mờ?
          - 3D Mascot Robot centered below question
          - NO "Comment đáp án nhé"!
          - NO "NGÀY 2/100"!
          ========================================================================= */}
      {frame >= 1560 && (() => {
        const robotBob = Math.sin(frame / 7) * 12;
        const robotTilt = Math.sin(frame / 14) * 3;

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Header NHỚ NHÉ */}
            <div
              style={{
                position: 'absolute',
                top: 240,
                left: 80,
                color: '#94A3B8',
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: '0.05em',
              }}
            >
              NHỚ NHÉ
            </div>

            {/* Cyan Summary Card with Glowing Border */}
            <div
              style={{
                position: 'absolute',
                top: 310,
                left: 80,
                right: 80,
                border: '4px solid #38BDF8',
                borderRadius: 24,
                padding: '42px 36px',
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                boxShadow: '0 0 30px rgba(56, 189, 248, 0.2)',
              }}
            >
              <div style={{ color: '#38BDF8', fontSize: 46, fontWeight: 900, marginBottom: 14 }}>
                Hơi nước gặp lạnh
              </div>
              <div style={{ color: '#38BDF8', fontSize: 46, fontWeight: 900 }}>
                → ngưng tụ thành nước
              </div>
            </div>

            {/* Question Section */}
            <div style={{ position: 'absolute', top: 680, left: 80, right: 80 }}>
              <div style={{ color: '#94A3B8', fontSize: 36, fontWeight: 700, marginBottom: 20 }}>
                Câu hỏi cho bạn:
              </div>
              <div
                style={{
                  color: '#FBBF24',
                  fontSize: 52,
                  fontWeight: 900,
                  lineHeight: 1.35,
                }}
              >
                Vì sao từ phòng điều hoà
                <br />
                bước ra ngoài trời nóng,
                <br />
                kính cận bị mờ?
              </div>
            </div>

            {/* 3D Mascot Robot Centered Below Question */}
            <div
              style={{
                position: 'absolute',
                top: 1080,
                left: '50%',
                transform: `translateX(-50%) translateY(${robotBob}px) rotate(${robotTilt}deg)`,
              }}
            >
              <MascotRobot size={320} glow />
            </div>
          </div>
        );
      })()}
    </div>
  );
};
