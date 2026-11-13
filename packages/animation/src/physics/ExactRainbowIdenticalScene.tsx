import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { MascotRobot } from './MascotRobot';

const SPECTRUM_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#FBBF24', // Yellow
  '#22C55E', // Green
  '#06B6D4', // Cyan / Light Blue
  '#3B82F6', // Blue / Indigo
  '#A855F7', // Violet
];

export const ExactRainbowIdenticalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Persistent clean header (NO "NGÀY 10 / 100" as requested)
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
          padding: '8px 22px',
          borderRadius: 9999,
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: '0.04em',
        }}
      >
        <span>QUANG HỌC 2D</span>
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: '#0F172A',
        color: '#FFFFFF',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {renderHeader()}

      {/* =========================================================================
          SCENE 1: Frame 0 -> 110 (0s -> 3.7s)
          Dynamic Hook Intro:
          - NO "NGÀY 10 / 100" or 100-day matrix
          - 3D Mascot Robot pop-in with spring physics and gentle hover
          - Floating rain streaks in background
          - Kinetic title entrance
          ========================================================================= */}
      {frame >= 0 && frame < 110 && (() => {
        const mascotScale = spring({
          frame,
          fps,
          config: { damping: 11, mass: 0.8, stiffness: 120 },
        });
        const mascotHover = Math.sin(frame / 7) * 14;
        const textY = interpolate(frame, [0, 25], [60, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const textOpacity = interpolate(frame, [0, 20], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Background Animated Rain Particles */}
            <svg
              width="1080"
              height="1920"
              style={{ position: 'absolute', inset: 0, opacity: 0.35, pointerEvents: 'none' }}
            >
              {Array.from({ length: 30 }).map((_, i) => {
                const startX = (i * 37) % 1080;
                const speed = 18 + (i % 5) * 4;
                const yPos = (frame * speed + i * 85) % 2100 - 100;
                const len = 40 + (i % 4) * 15;
                return (
                  <line
                    key={i}
                    x1={startX}
                    y1={yPos}
                    x2={startX - 15}
                    y2={yPos + len}
                    stroke="#7DD3FC"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>

            {/* Glowing Aura Behind Mascot */}
            <div
              style={{
                position: 'absolute',
                top: 360,
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 440,
                height: 440,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(56, 189, 248, 0.28) 0%, rgba(15, 23, 42, 0) 70%)',
                filter: 'blur(20px)',
              }}
            />

            {/* 3D Mascot Robot */}
            <div
              style={{
                position: 'absolute',
                top: 250,
                left: '50%',
                transform: `translateX(-50%) translateY(${mascotHover}px) scale(${mascotScale})`,
              }}
            >
              <MascotRobot size={360} glow />
            </div>

            {/* Topic Hook Text */}
            <div
              style={{
                position: 'absolute',
                top: 760,
                left: 80,
                right: 80,
                textAlign: 'center',
                transform: `translateY(${textY}px)`,
                opacity: textOpacity,
              }}
            >
              <div
                style={{
                  color: '#38BDF8',
                  fontSize: 40,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  marginBottom: 20,
                  textTransform: 'uppercase',
                }}
              >
                ✦ HIỆN TƯỢNG VẬT LÝ ✦
              </div>

              <div
                style={{
                  color: '#FFFFFF',
                  fontSize: 66,
                  fontWeight: 900,
                  lineHeight: 1.25,
                  marginBottom: 30,
                  textShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}
              >
                Vì sao sau cơn mưa
                <br />
                lại có <span style={{ color: '#FBBF24' }}>cầu vồng?</span>
              </div>

              {/* Animated Progress Bar */}
              <div
                style={{
                  width: 320,
                  height: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: 9999,
                  margin: '0 auto',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${interpolate(frame, [0, 110], [0, 100], { extrapolateRight: 'clamp' })}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #38BDF8, #FBBF24)',
                    borderRadius: 9999,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 2: Frame 110 -> 240 (3.7s -> 8.0s)
          Question Scene:
          - Animated write-on rainbow arc
          - Shimmering photon sparkles along the rainbow
          - Mascot Robot hovering in upper corner
          ========================================================================= */}
      {frame >= 110 && frame < 240 && (() => {
        const localF = frame - 110;
        const arcProgress = interpolate(localF, [0, 45], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const titleSlide = spring({
          frame: localF,
          fps,
          config: { damping: 14, mass: 0.9 },
        });

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Title */}
            <div
              style={{
                position: 'absolute',
                top: 240,
                left: 90,
                right: 90,
                transform: `translateX(${(1 - titleSlide) * -50}px)`,
                opacity: titleSlide,
              }}
            >
              <div style={{ color: '#38BDF8', fontSize: 46, fontWeight: 800, marginBottom: 18 }}>
                VÌ SAO...?
              </div>
              <div style={{ color: '#FFFFFF', fontSize: 62, fontWeight: 900, lineHeight: 1.25 }}>
                Sau cơn mưa
                <br />
                lại có <span style={{ color: '#FBBF24' }}>cầu vồng?</span>
              </div>
            </div>

            {/* Mascot Robot Floating at Upper-Right */}
            <div
              style={{
                position: 'absolute',
                top: 220,
                right: 70,
                transform: `translateY(${Math.sin(frame / 8) * 10}px) rotate(${Math.sin(frame / 14) * 3}deg)`,
              }}
            >
              <MascotRobot size={200} glow />
            </div>

            {/* Animated Semicircular Rainbow Arch */}
            <svg
              width="1080"
              height="1920"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              {/* Ground Line */}
              <line
                x1="80"
                y1="1200"
                x2="1000"
                y2="1200"
                stroke="#FFFFFF"
                strokeWidth="4"
                strokeDasharray="920"
                strokeDashoffset={interpolate(localF, [0, 30], [920, 0], { extrapolateRight: 'clamp' })}
              />

              {/* 7 Concentric Rainbow Arcs with Progressive Draw-On */}
              {SPECTRUM_COLORS.map((col, idx) => {
                const r = 400 - idx * 20;
                const arcLength = Math.PI * r;
                const strokeOffset = arcLength * (1 - arcProgress);

                return (
                  <path
                    key={idx}
                    d={`M ${540 - r} 1200 A ${r} ${r} 0 0 1 ${540 + r} 1200`}
                    fill="none"
                    stroke={col}
                    strokeWidth="20"
                    strokeDasharray={arcLength}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="butt"
                  />
                );
              })}

              {/* Shimmering sparkles along rainbow if arc completed */}
              {arcProgress > 0.8 &&
                [0.2, 0.4, 0.6, 0.8].map((t, i) => {
                  const angle = Math.PI * (1 - t);
                  const radius = 340;
                  const sx = 540 + Math.cos(angle) * radius;
                  const sy = 1200 - Math.sin(angle) * radius;
                  const sparkleScale = Math.sin(frame / 4 + i * 2) * 4 + 6;

                  return (
                    <circle
                      key={i}
                      cx={sx}
                      cy={sy}
                      r={sparkleScale}
                      fill="#FFFFFF"
                      style={{ filter: 'drop-shadow(0 0 8px #FFFFFF)' }}
                    />
                  );
                })}
            </svg>
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 3: Frame 240 -> 450 (8.0s -> 15.0s)
          Prism Dispersion:
          - White ray shoots into left prism face with animated flowing pulses
          - Internal traversal beam
          - 7 distinct colored rays bursting from right face with flowing photons
          ========================================================================= */}
      {frame >= 240 && frame < 450 && (() => {
        const localF = frame - 240;
        const pulseOffset = -frame * 12;

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Title */}
            <div style={{ position: 'absolute', top: 240, left: 90, right: 90 }}>
              <div style={{ color: '#FFFFFF', fontSize: 58, fontWeight: 800, lineHeight: 1.28 }}>
                Ánh sáng trắng thật ra
                <br />
                gồm <span style={{ color: '#FBBF24' }}>nhiều màu</span>
              </div>
            </div>

            <svg
              width="1080"
              height="1920"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              {/* Triangular Prism */}
              <polygon
                points="500,560 320,880 680,880"
                fill="rgba(44, 62, 80, 0.45)"
                stroke="#FFFFFF"
                strokeWidth="5"
                style={{
                  filter: 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.2))',
                }}
              />

              {/* Incident White Ray with Animated Photon Dash Stream */}
              <line
                x1="80"
                y1="840"
                x2="390"
                y2="755"
                stroke="#FFFFFF"
                strokeWidth="14"
                strokeLinecap="round"
              />
              <line
                x1="80"
                y1="840"
                x2="390"
                y2="755"
                stroke="#38BDF8"
                strokeWidth="6"
                strokeDasharray="18 16"
                strokeDashoffset={pulseOffset}
              />

              {/* Entrance Sparkle Flare */}
              <circle
                cx="390"
                cy="755"
                r={12 + Math.sin(frame / 3) * 3}
                fill="#FFFFFF"
                style={{ filter: 'drop-shadow(0 0 10px #FFFFFF)' }}
              />

              {/* Internal Traversal Beam */}
              <line
                x1="390"
                y1="755"
                x2="607"
                y2="750"
                stroke="rgba(255, 255, 255, 0.9)"
                strokeWidth="10"
              />

              {/* Emergent 7 Colored Rays with Continuous Flowing Stream */}
              {SPECTRUM_COLORS.map((col, idx) => {
                const destY = 800 + idx * 36;
                const rayDelay = idx * 3;
                const rayProgress = interpolate(localF - rayDelay, [10, 35], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                const curEndX = 607 + (1020 - 607) * rayProgress;
                const curEndY = 750 + (destY - 750) * rayProgress;

                return (
                  <g key={idx}>
                    {/* Main Colored Ray */}
                    <line
                      x1="607"
                      y1="750"
                      x2={curEndX}
                      y2={curEndY}
                      stroke={col}
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                    {/* Flowing Light Photons */}
                    <line
                      x1="607"
                      y1="750"
                      x2={curEndX}
                      y2={curEndY}
                      stroke="#FFFFFF"
                      strokeWidth="4"
                      strokeDasharray="16 20"
                      strokeDashoffset={pulseOffset - idx * 5}
                    />
                    {/* Glowing Leading Head Particle */}
                    {rayProgress > 0.1 && (
                      <circle
                        cx={curEndX}
                        cy={curEndY}
                        r={7 + Math.sin(frame / 4 + idx) * 2}
                        fill={col}
                        style={{ filter: `drop-shadow(0 0 10px ${col})` }}
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Subtitle at Bottom */}
            <div
              style={{
                position: 'absolute',
                bottom: 340,
                left: 90,
                right: 90,
              }}
            >
              <div style={{ color: '#FFFFFF', fontSize: 40, fontWeight: 700, marginBottom: 12 }}>
                Qua lăng kính, ánh sáng trắng <span style={{ color: '#FBBF24' }}>tách</span> ra
              </div>
              <div style={{ color: '#94A3B8', fontSize: 32, fontWeight: 500 }}>
                thành dải màu: đỏ, cam, vàng, lục, lam, chàm, tím
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 4: Frame 450 -> 890 (15.0s -> 29.7s)
          Raindrop Refraction & Internal Reflection:
          - Liquid breathing droplet with pulsing rim
          - Concentric ripple shockwaves at refraction & reflection focal points
          - Flowing ray photons
          ========================================================================= */}
      {frame >= 450 && frame < 890 && (() => {
        const localF = frame - 450;
        const dropPulse = 1 + Math.sin(frame / 9) * 0.018;
        const ripple1 = (localF * 1.5) % 35;
        const ripple2 = ((localF + 15) * 1.5) % 35;

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Title */}
            <div style={{ position: 'absolute', top: 240, left: 90, right: 90 }}>
              <div style={{ color: '#FFFFFF', fontSize: 58, fontWeight: 800, lineHeight: 1.28 }}>
                Giọt mưa như một
                <br />
                <span style={{ color: '#38BDF8' }}>lăng kính</span> tí hon
              </div>
            </div>

            <svg
              width="1080"
              height="1920"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              {/* Raindrop Glowing Background Halo */}
              <circle
                cx="560"
                cy="680"
                r={245 * dropPulse}
                fill="none"
                stroke="rgba(56, 189, 248, 0.25)"
                strokeWidth="10"
                style={{ filter: 'blur(8px)' }}
              />

              {/* Raindrop Spherical Droplet */}
              <circle
                cx="560"
                cy="680"
                r={230 * dropPulse}
                fill="rgba(30, 41, 59, 0.45)"
                stroke="#7DD3FC"
                strokeWidth="6"
              />

              {/* Incident Pure Solid White Ray */}
              <line
                x1="80"
                y1="482"
                x2="443"
                y2="482"
                stroke="#FFFFFF"
                strokeWidth="11"
                strokeLinecap="round"
              />

              {/* Entry Point (Surface Refraction 1): Expanding Ripple Shockwaves */}
              <circle
                cx="443"
                cy="482"
                r={10 + ripple1}
                fill="none"
                stroke="#F97316"
                strokeWidth="2"
                opacity={1 - ripple1 / 35}
              />
              <circle cx="443" cy="482" r="10" fill="#F97316" />
              <text x="443" y="440" fill="#FBBF24" fontSize="28" fontWeight="800" textAnchor="middle">
                khúc xạ
              </text>

              {/* Physical Dispersion Coordinates: Entry -> Rear Reflection -> Exit -> Emerging Caustic */}
              {(() => {
                const REAR_POINTS = [
                  { x: 765, y: 575 }, // Red (refracts less, hits higher)
                  { x: 769, y: 583 }, // Orange
                  { x: 773, y: 592 }, // Yellow
                  { x: 777, y: 601 }, // Green
                  { x: 781, y: 610 }, // Cyan
                  { x: 784, y: 619 }, // Blue
                  { x: 786, y: 628 }, // Violet (refracts more, hits lower)
                ];
                const EXIT_POINTS = [
                  { x: 625, y: 898 }, // Red
                  { x: 619, y: 901 }, // Orange
                  { x: 613, y: 904 }, // Yellow
                  { x: 607, y: 906 }, // Green
                  { x: 600, y: 908 }, // Cyan
                  { x: 593, y: 910 }, // Blue
                  { x: 585, y: 912 }, // Violet
                ];
                const OUT_DEST = [
                  { x: 395, y: 1165 }, // Red
                  { x: 385, y: 1152 }, // Orange
                  { x: 375, y: 1140 }, // Yellow
                  { x: 365, y: 1128 }, // Green
                  { x: 355, y: 1116 }, // Cyan
                  { x: 345, y: 1104 }, // Blue
                  { x: 335, y: 1092 }, // Violet
                ];

                return (
                  <g>
                    {/* LEG 1: Immediate Dispersion Upon Entry (Entry -> Rear Wall) */}
                    {SPECTRUM_COLORS.map((col, idx) => (
                      <line
                        key={`leg1-${idx}`}
                        x1="443"
                        y1="482"
                        x2={REAR_POINTS[idx].x}
                        y2={REAR_POINTS[idx].y}
                        stroke={col}
                        strokeWidth="8"
                        strokeLinecap="round"
                      />
                    ))}

                    {/* Rear Surface Total Internal Reflection Point: Expanding Ripple */}
                    <circle
                      cx="777"
                      cy="601"
                      r={10 + ripple2}
                      fill="none"
                      stroke="#F97316"
                      strokeWidth="2"
                      opacity={1 - ripple2 / 35}
                    />
                    <circle cx="777" cy="601" r="10" fill="#F97316" />
                    <text x="815" y="608" fill="#FBBF24" fontSize="28" fontWeight="800" textAnchor="start">
                      phản xạ
                    </text>

                    {/* LEG 2: Total Internal Reflection (Rear Wall -> Exit Surface) */}
                    {SPECTRUM_COLORS.map((col, idx) => (
                      <line
                        key={`leg2-${idx}`}
                        x1={REAR_POINTS[idx].x}
                        y1={REAR_POINTS[idx].y}
                        x2={EXIT_POINTS[idx].x}
                        y2={EXIT_POINTS[idx].y}
                        stroke={col}
                        strokeWidth="8"
                        strokeLinecap="round"
                      />
                    ))}

                    {/* Exit Point Marker (Surface Refraction 2) */}
                    <circle cx="605" cy="905" r="10" fill="#F97316" />
                    <text x="500" y="915" fill="#FBBF24" fontSize="28" fontWeight="800" textAnchor="end">
                      khúc xạ
                    </text>

                    {/* LEG 3: Emergent Spectral Fan (Exit Surface -> Air ~40°-42°) */}
                    {SPECTRUM_COLORS.map((col, idx) => (
                      <line
                        key={`leg3-${idx}`}
                        x1={EXIT_POINTS[idx].x}
                        y1={EXIT_POINTS[idx].y}
                        x2={OUT_DEST[idx].x}
                        y2={OUT_DEST[idx].y}
                        stroke={col}
                        strokeWidth="9"
                        strokeLinecap="round"
                      />
                    ))}
                  </g>
                );
              })()}
            </svg>

            {/* Subtitle at Bottom */}
            <div
              style={{
                position: 'absolute',
                bottom: 300,
                left: 90,
                right: 90,
              }}
            >
              <div style={{ color: '#FFFFFF', fontSize: 38, fontWeight: 700, marginBottom: 14 }}>
                Mỗi màu bị lệch một góc <span style={{ color: '#FBBF24' }}>khác nhau</span>
              </div>
              <div style={{ color: '#FFFFFF', fontSize: 38, fontWeight: 700 }}>
                → tách thành dải màu (<span style={{ color: '#38BDF8' }}>tán sắc</span>)
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 5: Frame 890 -> 1165 (29.7s -> 38.8s)
          Observer, Sun, 7 Raindrops & Rainbow Rays:
          - Rotating sun ray spikes
          - Flowing sunlight streams to each droplet
          - Independent droplet bobbing
          - Flowing colored beams streaming directly into observer's eye
          ========================================================================= */}
      {frame >= 890 && frame < 1165 && (() => {
        const localF = frame - 890;
        const sunRotation = (frame * 0.4) % 360;

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Title */}
            <div style={{ position: 'absolute', top: 240, left: 90, right: 90 }}>
              <div style={{ color: '#FFFFFF', fontSize: 58, fontWeight: 800, lineHeight: 1.28 }}>
                Hàng triệu giọt mưa
                <br />
                cùng <span style={{ color: '#FBBF24' }}>“gửi màu”</span> tới mắt
              </div>
            </div>

            <svg
              width="1080"
              height="1920"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              {/* Ground Line */}
              <line x1="80" y1="1200" x2="1000" y2="1200" stroke="#FFFFFF" strokeWidth="4" />

              {/* Rotating Sun Spikes */}
              <g transform={`rotate(${sunRotation} 830 490)`}>
                {Array.from({ length: 12 }).map((_, i) => {
                  const a = (i * 30 * Math.PI) / 180;
                  const x1 = 830 + Math.cos(a) * 52;
                  const y1 = 490 + Math.sin(a) * 52;
                  const x2 = 830 + Math.cos(a) * 68;
                  const y2 = 490 + Math.sin(a) * 68;
                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#FBBF24"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>

              {/* Sun Core with Warm Pulse */}
              <circle
                cx="830"
                cy="490"
                r={44 + Math.sin(frame / 6) * 3}
                fill="#FBBF24"
                style={{ filter: 'drop-shadow(0 0 20px #FBBF24)' }}
              />

              {/* 7 Droplets & Beams to Eye */}
              {[500, 580, 660, 740, 820, 900, 980].map((baseY, idx) => {
                const dropBob = Math.sin(frame / 8 + idx * 1.2) * 5;
                const dropY = baseY + dropBob;
                const streamDelay = idx * 6;
                const streamProgress = interpolate(localF - streamDelay, [0, 30], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                const eyeX = 765;
                const eyeY = 1070;
                const rayEndX = 240 + (eyeX - 240) * streamProgress;
                const rayEndY = dropY + (eyeY - dropY) * streamProgress;

                return (
                  <g key={idx}>
                    {/* Flowing Sunlight Ray from Sun */}
                    <line
                      x1="830"
                      y1="490"
                      x2="240"
                      y2={dropY}
                      stroke="rgba(255, 255, 255, 0.4)"
                      strokeWidth="2.5"
                      strokeDasharray="10 14"
                      strokeDashoffset={-frame * 6}
                    />

                    {/* Droplet Circle with Glow */}
                    <circle
                      cx="240"
                      cy={dropY}
                      r="20"
                      fill="rgba(44, 62, 80, 0.65)"
                      stroke="#7DD3FC"
                      strokeWidth="4"
                      style={{ filter: 'drop-shadow(0 0 6px #7DD3FC)' }}
                    />

                    {/* Colored Ray Streaming to Eye */}
                    <line
                      x1="240"
                      y1={dropY}
                      x2={rayEndX}
                      y2={rayEndY}
                      stroke={SPECTRUM_COLORS[idx]}
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                    <line
                      x1="240"
                      y1={dropY}
                      x2={rayEndX}
                      y2={rayEndY}
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                      strokeDasharray="12 16"
                      strokeDashoffset={-frame * 9 - idx * 3}
                    />
                  </g>
                );
              })}

              {/* Observer Stick Figure */}
              <circle cx="780" cy="1070" r="24" fill="none" stroke="#FFFFFF" strokeWidth="4.5" />
              <line x1="780" y1="1094" x2="780" y2="1140" stroke="#FFFFFF" strokeWidth="4.5" />
              <line x1="780" y1="1108" x2="755" y2="1135" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />
              <line x1="780" y1="1108" x2="805" y2="1135" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />
              <line x1="780" y1="1140" x2="760" y2="1200" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />
              <line x1="780" y1="1140" x2="800" y2="1200" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />

              {/* Sparkle at Observer's Eye */}
              <circle
                cx="765"
                cy="1070"
                r={5 + Math.sin(frame / 3) * 2}
                fill="#FFFFFF"
                style={{ filter: 'drop-shadow(0 0 8px #FBBF24)' }}
              />
            </svg>

            {/* Subtitle (3 lines) */}
            <div
              style={{
                position: 'absolute',
                bottom: 250,
                left: 90,
                right: 90,
                fontSize: 38,
                fontWeight: 700,
                lineHeight: 1.5,
              }}
            >
              <div>
                Giọt ở cao gửi tới mắt màu <span style={{ color: '#EF4444' }}>đỏ</span>
              </div>
              <div>
                giọt thấp hơn gửi màu <span style={{ color: '#A855F7' }}>tím</span>
              </div>
              <div>
                → ghép lại thành <span style={{ color: '#FBBF24' }}>cầu vồng</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 6: Frame 1165 -> 1465 (38.8s -> 48.8s)
          Full 360° Circular Rainbow:
          - Gentle rotation of circular rainbow rings
          - Smooth ground mask sliding transition
          - Flying mini airplane in Phase 2
          ========================================================================= */}
      {frame >= 1165 && frame < 1465 && (() => {
        const ringRotation = (frame * 0.15) % 360;
        const groundSlide = interpolate(frame, [1370, 1400], [0, 360], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const groundOpacity = interpolate(frame, [1370, 1400], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Title */}
            <div style={{ position: 'absolute', top: 240, left: 90, right: 90 }}>
              <div style={{ color: '#FFFFFF', fontSize: 58, fontWeight: 800, lineHeight: 1.28 }}>
                Cầu vồng thật ra là
                <br />
                một <span style={{ color: '#FBBF24' }}>vòng tròn!</span>
              </div>
            </div>

            {/* Circular 360° Rainbow */}
            <svg
              width="1080"
              height="1920"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              <g transform={`rotate(${ringRotation} 540 850)`}>
                {SPECTRUM_COLORS.map((col, idx) => {
                  const r = 320 - idx * 16;
                  return (
                    <circle
                      key={idx}
                      cx="540"
                      cy="850"
                      r={r}
                      fill="none"
                      stroke={col}
                      strokeWidth="16"
                    />
                  );
                })}
              </g>

              {/* Phase 1: Ground Mask */}
              {groundOpacity > 0 && (
                <g opacity={groundOpacity} transform={`translate(0, ${groundSlide})`}>
                  <line x1="80" y1="850" x2="1000" y2="850" stroke="#34D399" strokeWidth="4" />
                  <rect
                    x="80"
                    y="850"
                    width="920"
                    height="340"
                    fill="rgba(15, 23, 42, 0.85)"
                  />
                  <text
                    x="540"
                    y="980"
                    fill="#FFFFFF"
                    fontSize="36"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    mặt đất che mất nửa dưới
                  </text>
                </g>
              )}
            </svg>

            {/* Phase 2: Center Airplane Badge & Mini Plane */}
            {frame >= 1380 && (
              <div
                style={{
                  position: 'absolute',
                  top: 790,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  textAlign: 'center',
                  color: '#38BDF8',
                  fontSize: 34,
                  fontWeight: 800,
                  lineHeight: 1.4,
                  width: 420,
                  animation: 'pulse 2s infinite',
                }}
              >
                <div style={{ fontSize: 44, marginBottom: 8 }}>✈</div>
                nhìn từ máy bay
                <br />
                có thể thấy cả vòng!
              </div>
            )}

            {/* Subtitle at Bottom */}
            <div
              style={{
                position: 'absolute',
                bottom: 300,
                left: 90,
                right: 90,
                fontSize: 36,
                fontWeight: 700,
                lineHeight: 1.5,
              }}
            >
              <div>
                Mắt ta nhìn thấy các giọt nằm trên vòng <span style={{ color: '#FBBF24' }}>≈ 42°</span>
              </div>
              <div>quanh bóng của chính mình</div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 7: Frame 1465 -> 1766 (48.8s -> 58.86s)
          Summary Card + Question + 3D Mascot Robot next to prompt
          ========================================================================= */}
      {frame >= 1465 && (() => {
        const arrowBob = Math.sin(frame / 5) * 12;
        const robotBob = Math.sin(frame / 7) * 10;
        const robotTilt = Math.sin(frame / 12) * 2.5;

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Header NHỚ NHÉ */}
            <div
              style={{
                position: 'absolute',
                top: 240,
                left: 90,
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
                left: 90,
                right: 90,
                border: '4px solid #38BDF8',
                borderRadius: 24,
                padding: '42px 36px',
                backgroundColor: 'rgba(56, 189, 248, 0.06)',
                boxShadow: '0 0 30px rgba(56, 189, 248, 0.15)',
              }}
            >
              <div style={{ color: '#38BDF8', fontSize: 44, fontWeight: 900, marginBottom: 16 }}>
                Ánh sáng trắng + giọt mưa
              </div>
              <div style={{ color: '#38BDF8', fontSize: 44, fontWeight: 900 }}>
                → tán sắc thành <span style={{ color: '#FBBF24' }}>cầu vồng</span>
              </div>
            </div>

            {/* Question Section */}
            <div style={{ position: 'absolute', top: 680, left: 90, right: 90 }}>
              <div style={{ color: '#94A3B8', fontSize: 36, fontWeight: 700, marginBottom: 20 }}>
                Câu hỏi cho bạn:
              </div>
              <div
                style={{
                  color: '#FBBF24',
                  fontSize: 54,
                  fontWeight: 900,
                  lineHeight: 1.35,
                  marginBottom: 60,
                }}
              >
                Vì sao giữa trưa gần như
                <br />
                không bao giờ thấy
                <br />
                cầu vồng?
              </div>
            </div>

            {/* 3D Mascot Robot Centered Below Question */}
            <div
              style={{
                position: 'absolute',
                top: 1040,
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
