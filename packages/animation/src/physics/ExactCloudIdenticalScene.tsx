import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { MascotRobot } from './MascotRobot';

interface DropletParticle {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
}

const DROPLET_GRID: DropletParticle[] = Array.from({ length: 48 }).map((_, i) => ({
  x: 200 + (i % 8) * 90 + ((Math.floor(i / 8) % 2) * 45),
  y: 600 + Math.floor(i / 8) * 110,
  r: 18 + ((i * 7) % 12),
  speed: 1.2 + ((i * 3) % 1.5),
  phase: i * 0.45,
}));

export const ExactCloudIdenticalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Top header - Clean LuminaLearn branding with topic badge (NO 14/100)
  const renderHeader = (subtitle?: string) => {
    return (
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 60,
          right: 60,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: '#94A3B8',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            VẬT LÝ VỚI LUMINALEARN
          </span>
          {subtitle && (
            <span style={{ fontSize: 22, fontWeight: 700, color: '#38BDF8' }}>
              {subtitle}
            </span>
          )}
        </div>

        <div
          style={{
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            color: '#38BDF8',
            border: '1.5px solid rgba(56, 189, 248, 0.4)',
            padding: '10px 24px',
            borderRadius: 9999,
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: '0.04em',
          }}
        >
          QUANG HỌC KHÍ QUYỂN
        </div>
      </div>
    );
  };

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
      {/* =========================================================================
          SCENE 1: Frame 0 -> 124 (0.0s -> 4.15s)
          Starts directly with the Hook Question:
          "Vì sao mây thường trắng, mây giông lại xám đen?"
          ========================================================================= */}
      {frame >= 0 && frame < 125 && (() => {
        const cloudScale = spring({
          frame,
          fps,
          config: { damping: 12, mass: 0.9, stiffness: 100 },
        });

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {renderHeader('QUANG HỌC KHÍ QUYỂN')}

            {/* Title question */}
            <div
              style={{
                position: 'absolute',
                top: 190,
                left: 60,
                right: 60,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 36, fontWeight: 800, color: '#38BDF8', letterSpacing: '0.04em' }}>
                VÌ SAO...?
              </span>
              <h1
                style={{
                  fontSize: 54,
                  fontWeight: 900,
                  lineHeight: 1.25,
                  margin: 0,
                  color: '#FFFFFF',
                }}
              >
                Mây thường màu <span style={{ color: '#F8FAFC', textShadow: '0 0 20px rgba(255,255,255,0.6)' }}>trắng</span>,<br />
                nhưng mây giông lại <span style={{ color: '#94A3B8' }}>xám đen?</span>
              </h1>
            </div>

            {/* Comparison Visual: White Cloud vs Storm Cloud */}
            <div
              style={{
                position: 'absolute',
                top: 560,
                left: 60,
                right: 60,
                height: 800,
                display: 'flex',
                gap: 30,
                transform: `scale(${cloudScale})`,
              }}
            >
              {/* Left Column: Mây Thường (Trắng) */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(30, 41, 59, 0.45)',
                  borderRadius: 28,
                  border: '2px solid rgba(56, 189, 248, 0.35)',
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#0284C7',
                    color: '#FFFFFF',
                    padding: '8px 20px',
                    borderRadius: 9999,
                    fontSize: 22,
                    fontWeight: 800,
                    marginBottom: 28,
                  }}
                >
                  MÂY THƯỜNG
                </div>

                <svg width="360" height="240" viewBox="0 0 360 240">
                  <defs>
                    <linearGradient id="whiteCloudGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="60%" stopColor="#F1F5F9" />
                      <stop offset="100%" stopColor="#CBD5E1" />
                    </linearGradient>
                    <filter id="cloudGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="rgba(255,255,255,0.3)" />
                    </filter>
                  </defs>
                  <path
                    d="M 90 180 A 60 60 0 0 1 120 80 A 75 75 0 0 1 240 70 A 65 65 0 0 1 300 130 A 55 55 0 0 1 270 190 Z"
                    fill="url(#whiteCloudGrad)"
                    filter="url(#cloudGlow)"
                  />
                  <ellipse cx="180" cy="160" rx="120" ry="45" fill="#E2E8F0" opacity="0.6" />
                </svg>

                <div
                  style={{
                    marginTop: 40,
                    textAlign: 'center',
                    fontSize: 26,
                    fontWeight: 700,
                    color: '#E2E8F0',
                    lineHeight: 1.4,
                  }}
                >
                  Bồng bềnh, mỏng<br />
                  <span style={{ color: '#38BDF8', fontWeight: 800 }}>MÀU TRẮNG SÁNG</span>
                </div>
              </div>

              {/* Right Column: Mây Giông (Xám Đen) */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  borderRadius: 28,
                  border: '2px solid rgba(148, 163, 184, 0.3)',
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#475569',
                    color: '#F8FAFC',
                    padding: '8px 20px',
                    borderRadius: 9999,
                    fontSize: 22,
                    fontWeight: 800,
                    marginBottom: 28,
                  }}
                >
                  MÂY GIÔNG
                </div>

                <svg width="360" height="280" viewBox="0 0 360 280">
                  <defs>
                    <linearGradient id="stormGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E2E8F0" />
                      <stop offset="35%" stopColor="#94A3B8" />
                      <stop offset="70%" stopColor="#475569" />
                      <stop offset="100%" stopColor="#1E293B" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 60 240 A 55 55 0 0 1 80 120 A 70 70 0 0 1 170 60 A 80 80 0 0 1 290 80 A 65 65 0 0 1 320 180 A 60 60 0 0 1 270 250 Z"
                    fill="url(#stormGrad)"
                  />
                  <ellipse cx="200" cy="75" rx="130" ry="32" fill="#CBD5E1" opacity="0.9" />
                  <rect x="50" y="210" width="260" height="50" rx="20" fill="#0F172A" opacity="0.95" />
                </svg>

                <div
                  style={{
                    marginTop: 30,
                    textAlign: 'center',
                    fontSize: 26,
                    fontWeight: 700,
                    color: '#94A3B8',
                    lineHeight: 1.4,
                  }}
                >
                  Khối lớn khổng lồ<br />
                  <span style={{ color: '#F59E0B', fontWeight: 800 }}>ĐÁY TỐI SẦM</span>
                </div>
              </div>
            </div>

            {/* Ground Horizon Line */}
            <div
              style={{
                position: 'absolute',
                bottom: 220,
                left: 60,
                right: 60,
                height: 2,
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
              }}
            />
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 2: Frame 125 -> 314 (4.15s -> 10.5s)
          Microscopic Water Droplets & Mie Scattering
          ========================================================================= */}
      {frame >= 125 && frame < 315 && (() => {
        const localFrame = frame - 125;
        const zoomProgress = interpolate(localFrame, [0, 40], [0.85, 1], {
          extrapolateRight: 'clamp',
        });

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {renderHeader('CƠ CHẾ VI MÔ')}

            {/* Section Title */}
            <div
              style={{
                position: 'absolute',
                top: 190,
                left: 60,
                right: 60,
                textAlign: 'center',
              }}
            >
              <h2
                style={{
                  fontSize: 46,
                  fontWeight: 900,
                  color: '#FFFFFF',
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                Mây là hàng tỷ <span style={{ color: '#38BDF8' }}>giọt nước li ti</span>
              </h2>
              <p
                style={{
                  fontSize: 26,
                  color: '#CBD5E1',
                  marginTop: 12,
                  fontWeight: 600,
                }}
              >
                Tán xạ ánh sáng (Mie Scattering): Các giọt nước tán xạ đều mọi bước sóng
              </p>
            </div>

            {/* Microscopic Droplet View SVG Canvas */}
            <svg
              width="1080"
              height="1000"
              style={{
                position: 'absolute',
                top: 360,
                left: 0,
                transform: `scale(${zoomProgress})`,
              }}
              viewBox="0 0 1080 1000"
            >
              <defs>
                <radialGradient id="dropletSpecular" cx="35%" cy="30%" r="65%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="40%" stopColor="#BAE6FD" />
                  <stop offset="75%" stopColor="#38BDF8" />
                  <stop offset="100%" stopColor="#0284C7" />
                </radialGradient>
                <filter id="lightGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Central Microscopic Cluster of Droplets */}
              {DROPLET_GRID.map((drop, i) => {
                const bob = Math.sin((localFrame + i * 15) * 0.08) * 6;
                const pulse = 1 + Math.sin(localFrame * 0.05 + drop.phase) * 0.06;

                return (
                  <g key={i} transform={`translate(${drop.x}, ${drop.y + bob}) scale(${pulse})`}>
                    <circle
                      cx="0"
                      cy="0"
                      r={drop.r}
                      fill="url(#dropletSpecular)"
                      filter="url(#lightGlow)"
                      opacity={0.88}
                    />
                    <circle cx={-drop.r * 0.3} cy={-drop.r * 0.3} r={drop.r * 0.25} fill="#FFFFFF" opacity={0.95} />
                  </g>
                );
              })}

              {/* Incoming Sunlight Rays from Top */}
              {[250, 400, 540, 680, 830].map((rayX, idx) => {
                const arrowOffset = (localFrame * 9 + idx * 40) % 180;
                return (
                  <g key={idx} filter="url(#lightGlow)">
                    <line
                      x1={rayX}
                      y1={40}
                      x2={rayX}
                      y2={440}
                      stroke="#FBBF24"
                      strokeWidth="6"
                      strokeDasharray="14 10"
                    />
                    <polygon
                      points={`${rayX - 10},${220 + arrowOffset} ${rayX + 10},${220 + arrowOffset} ${rayX},${245 + arrowOffset}`}
                      fill="#F59E0B"
                    />
                  </g>
                );
              })}

              {/* Multi-directional scattered rays radiating outwards in all directions */}
              {Array.from({ length: 16 }).map((_, idx) => {
                const angle = (idx * Math.PI * 2) / 16;
                const length = 120 + Math.sin(localFrame * 0.1 + idx) * 25;
                const centerX = 540;
                const centerY = 720;
                const x2 = centerX + Math.cos(angle) * (length + 180);
                const y2 = centerY + Math.sin(angle) * (length + 180);
                const colors = ['#EF4444', '#F97316', '#FBBF24', '#22C55E', '#06B6D4', '#3B82F6', '#A855F7'];
                const rayColor = colors[idx % colors.length];

                return (
                  <line
                    key={idx}
                    x1={centerX + Math.cos(angle) * 70}
                    y1={centerY + Math.sin(angle) * 70}
                    x2={x2}
                    y2={y2}
                    stroke={rayColor}
                    strokeWidth="4"
                    opacity={0.75}
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Central text badge */}
              <rect x="360" y="685" width="360" height="70" rx="35" fill="rgba(15, 23, 42, 0.9)" stroke="#38BDF8" strokeWidth="2" />
              <text x="540" y="730" textAnchor="middle" fill="#FFFFFF" fontSize="24" fontWeight="800">
                TÁN XẠ ĐỀU CÁC MÀU
              </text>
            </svg>

            {/* Bottom Insight Card */}
            <div
              style={{
                position: 'absolute',
                bottom: 160,
                left: 80,
                right: 80,
                backgroundColor: 'rgba(30, 41, 59, 0.75)',
                borderRadius: 24,
                padding: '24px 32px',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                textAlign: 'center',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 800, color: '#38BDF8' }}>
                Đỏ + Lục + Lam + Vàng... Gộp lại = ÁNH SÁNG TRẮNG
              </div>
              <div style={{ fontSize: 22, color: '#94A3B8', marginTop: 8 }}>
                Kích thước giọt nước lớn hơn bước sóng ánh sáng (d &gt;&gt; λ) nên mây có màu trắng
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 3: Frame 315 -> 539 (10.5s -> 18.0s)
          Thickness: Mây mỏng vs Mây giông dày hàng chục km
          ========================================================================= */}
      {frame >= 315 && frame < 540 && (() => {
        const localFrame = frame - 315;

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {renderHeader('ĐỘ DÀY QUANG HỌC')}

            <div style={{ position: 'absolute', top: 180, left: 60, right: 60 }}>
              <h2 style={{ fontSize: 44, fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                Mây mỏng ánh sáng dễ xuyên qua,<br />
                <span style={{ color: '#F59E0B' }}>Mây giông dày tới cả chục km!</span>
              </h2>
            </div>

            <div
              style={{
                position: 'absolute',
                top: 360,
                left: 60,
                right: 60,
                height: 1100,
                display: 'flex',
                gap: 40,
              }}
            >
              {/* Left Column: Mây Mỏng */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(30, 41, 59, 0.35)',
                  borderRadius: 28,
                  border: '2px solid rgba(56, 189, 248, 0.3)',
                  padding: 20,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#0284C7',
                    color: '#FFFFFF',
                    padding: '8px 24px',
                    borderRadius: 9999,
                    fontSize: 22,
                    fontWeight: 800,
                    marginBottom: 20,
                  }}
                >
                  MÂY MỎNG (~200m)
                </div>

                <svg width="340" height="160" viewBox="0 0 340 160">
                  <path
                    d="M 60 120 A 40 40 0 0 1 90 60 A 55 55 0 0 1 180 50 A 45 45 0 0 1 240 90 A 35 35 0 0 1 280 130 Z"
                    fill="#F1F5F9"
                    opacity={0.95}
                  />
                </svg>

                <svg width="340" height="500" viewBox="0 0 340 500" style={{ marginTop: 10 }}>
                  {[70, 140, 210, 280].map((x, i) => {
                    const arrowY = (localFrame * 12 + i * 60) % 400;
                    return (
                      <g key={i}>
                        <line x1={x} y1={0} x2={x} y2={450} stroke="#FBBF24" strokeWidth="5" strokeDasharray="12 8" />
                        <polygon
                          points={`${x - 8},${arrowY} ${x + 8},${arrowY} ${x},${arrowY + 22}`}
                          fill="#F59E0B"
                        />
                      </g>
                    );
                  })}
                  <circle cx="175" cy="420" r="16" fill="#F8FAFC" />
                  <line x1="175" y1="436" x2="175" y2="475" stroke="#F8FAFC" strokeWidth="4" />
                  <line x1="175" y1="450" x2="155" y2="465" stroke="#F8FAFC" strokeWidth="4" />
                  <line x1="175" y1="450" x2="195" y2="465" stroke="#F8FAFC" strokeWidth="4" />
                  <line x1="175" y1="475" x2="160" y2="495" stroke="#F8FAFC" strokeWidth="4" />
                  <line x1="175" y1="475" x2="190" y2="495" stroke="#F8FAFC" strokeWidth="4" />
                </svg>

                <div
                  style={{
                    backgroundColor: 'rgba(2, 132, 199, 0.25)',
                    padding: '10px 16px',
                    borderRadius: 16,
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#38BDF8',
                    textAlign: 'center',
                  }}
                >
                  Ánh sáng xuyên qua dễ dàng → Thấy trắng sáng
                </div>
              </div>

              {/* Right Column: Mây Giông Dày */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  borderRadius: 28,
                  border: '2px solid rgba(245, 158, 11, 0.4)',
                  padding: 20,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#D97706',
                    color: '#FFFFFF',
                    padding: '8px 24px',
                    borderRadius: 9999,
                    fontSize: 22,
                    fontWeight: 800,
                    marginBottom: 20,
                  }}
                >
                  MÂY GIÔNG (10 - 15 km)
                </div>

                <svg width="340" height="640" viewBox="0 0 340 640">
                  <defs>
                    <linearGradient id="towerGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="25%" stopColor="#CBD5E1" />
                      <stop offset="55%" stopColor="#64748B" />
                      <stop offset="85%" stopColor="#334155" />
                      <stop offset="100%" stopColor="#0F172A" />
                    </linearGradient>
                  </defs>

                  <line x1="35" y1="60" x2="35" y2="560" stroke="#94A3B8" strokeWidth="3" />
                  <text x="15" y="75" fill="#FBBF24" fontSize="18" fontWeight="800">15km</text>
                  <text x="15" y="240" fill="#94A3B8" fontSize="16" fontWeight="700">10km</text>
                  <text x="15" y="400" fill="#94A3B8" fontSize="16" fontWeight="700">5km</text>
                  <text x="20" y="565" fill="#94A3B8" fontSize="16" fontWeight="700">0km</text>

                  <path
                    d="M 60 520 L 70 200 A 70 70 0 0 1 200 80 A 85 85 0 0 1 310 110 A 65 65 0 0 1 300 240 L 310 520 Z"
                    fill="url(#towerGrad)"
                    stroke="#475569"
                    strokeWidth="2"
                  />

                  {[120, 190, 260].map((rx, idx) => (
                    <g key={idx}>
                      <line x1={rx} y1={10} x2={rx} y2={180} stroke="#FBBF24" strokeWidth="5" strokeDasharray="10 6" />
                      <polygon points={`${rx - 7},170 ${rx + 7},170 ${rx},185`} fill="#F59E0B" />
                    </g>
                  ))}

                  <rect x="60" y="500" width="250" height="50" rx="14" fill="#020617" />
                  <text x="185" y="532" textAnchor="middle" fill="#94A3B8" fontSize="18" fontWeight="800">
                    Ánh sáng bị chặn hoàn toàn
                  </text>
                </svg>

                <div
                  style={{
                    marginTop: 10,
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    padding: '10px 16px',
                    borderRadius: 16,
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#F87171',
                    textAlign: 'center',
                  }}
                >
                  Dày gấp 50 - 100 lần → Đáy tối sầm
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 4: Frame 540 -> 844 (18.0s -> 28.15s)
          Multiple Scattering: Ánh sáng bị hất đi hất lại và bật ngược lên trên
          ========================================================================= */}
      {frame >= 540 && frame < 845 && (() => {
        const localFrame = frame - 540;

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {renderHeader('CƠ CHẾ PHẢN XẠ NHIỀU LẦN')}

            <div style={{ position: 'absolute', top: 180, left: 60, right: 60, textAlign: 'center' }}>
              <h2 style={{ fontSize: 44, fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                Ánh sáng bị hất đi hất lại liên tục,<br />
                <span style={{ color: '#FBBF24' }}>Hơn 90% bị hất ngược lên trên!</span>
              </h2>
            </div>

            <svg
              width="960"
              height="960"
              viewBox="0 0 960 960"
              style={{
                position: 'absolute',
                top: 340,
                left: 60,
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                borderRadius: 32,
                border: '2px solid rgba(56, 189, 248, 0.35)',
              }}
            >
              <defs>
                <linearGradient id="cloudDepthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(241, 245, 249, 0.2)" />
                  <stop offset="40%" stopColor="rgba(148, 163, 184, 0.15)" />
                  <stop offset="75%" stopColor="rgba(51, 65, 85, 0.3)" />
                  <stop offset="100%" stopColor="rgba(15, 23, 42, 0.95)" />
                </linearGradient>
              </defs>

              <rect x="0" y="0" width="960" height="960" fill="url(#cloudDepthGrad)" />

              {Array.from({ length: 36 }).map((_, i) => {
                const col = i % 6;
                const row = Math.floor(i / 6);
                const cx = 130 + col * 140 + ((row % 2) * 50);
                const cy = 180 + row * 125;
                const r = 24 + ((i * 5) % 12);
                const pulse = 1 + Math.sin(localFrame * 0.08 + i) * 0.08;

                return (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={r * pulse}
                    fill="#38BDF8"
                    opacity={0.45 - row * 0.05}
                  />
                );
              })}

              {[180, 480, 750].map((startX, pathIdx) => {
                const pts = [
                  { x: startX, y: 40 },
                  { x: startX + 60, y: 190 },
                  { x: startX - 50, y: 290 },
                  { x: startX + 80, y: 380 },
                  { x: startX - 30, y: 260 },
                  { x: startX + 40, y: 120 },
                  { x: startX + 110, y: 30 },
                ];

                const animProgress = ((localFrame * 4 + pathIdx * 35) % 150) / 150;
                const currentIdx = Math.min(pts.length - 1, Math.floor(animProgress * pts.length));
                const currentPt = pts[currentIdx];

                return (
                  <g key={pathIdx}>
                    <polyline
                      points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke="#FBBF24"
                      strokeWidth="5"
                      strokeDasharray="10 8"
                      opacity={0.8}
                    />
                    <circle cx={currentPt.x} cy={currentPt.y} r="12" fill="#FFFFFF" filter="drop-shadow(0 0 10px #F59E0B)" />
                  </g>
                );
              })}

              <g opacity={0.9}>
                <path
                  d="M 280 450 Q 150 250 180 60"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <polygon points="180,50 165,75 195,75" fill="#38BDF8" />
                <text x="210" y="80" fill="#38BDF8" fontSize="26" fontWeight="900">
                  HẤT NGƯỢC LÊN TRỜI (&gt;90%)
                </text>

                <path
                  d="M 680 450 Q 820 250 780 60"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <polygon points="780,50 765,75 795,75" fill="#38BDF8" />
              </g>

              <rect x="0" y="800" width="960" height="160" fill="#0B1329" />
              <text x="480" y="860" textAnchor="middle" fill="#64748B" fontSize="28" fontWeight="800">
                Chỉ &lt;1% ánh sáng tới được đáy mây
              </text>
              <text x="480" y="905" textAnchor="middle" fill="#EF4444" fontSize="32" fontWeight="900">
                → ĐÁY MÂY XÁM ĐEN TỐI SẦM
              </text>
            </svg>

            <div
              style={{
                position: 'absolute',
                bottom: 150,
                left: 100,
                right: 100,
                textAlign: 'center',
                backgroundColor: 'rgba(30, 41, 59, 0.9)',
                borderRadius: 20,
                padding: '16px 24px',
                border: '1px solid rgba(245, 158, 11, 0.4)',
              }}
            >
              <span style={{ fontSize: 24, fontWeight: 700, color: '#F1F5F9' }}>
                Đứng dưới nhìn lên: Không nhận được ánh sáng nên thấy màu xám đen
              </span>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 5: Frame 845 -> 1079 (28.15s -> 36.0s)
          Airplane Perspective: Mây giông nhìn từ máy bay vẫn trắng sáng!
          ========================================================================= */}
      {frame >= 845 && frame < 1080 && (() => {
        const localFrame = frame - 845;
        const planeX = interpolate(localFrame, [0, 235], [120, 840]);
        const planeTilt = Math.sin(localFrame * 0.08) * 3;

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {renderHeader('GÓC NHÌN TỪ TRÊN CAO')}

            <div
              style={{
                position: 'absolute',
                top: 170,
                left: 60,
                right: 60,
                textAlign: 'center',
              }}
            >
              <h2 style={{ fontSize: 42, fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                Nhìn từ máy bay: Mây giông <span style={{ color: '#FBBF24' }}>vẫn trắng sáng!</span>
              </h2>
              <p style={{ fontSize: 24, color: '#94A3B8', marginTop: 10, fontWeight: 600 }}>
                Mây không hề đen — Ta chỉ đang đứng trong bóng râm của chính nó!
              </p>
            </div>

            <div
              style={{
                position: 'absolute',
                top: 320,
                left: 60,
                right: 60,
                height: 1160,
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              {/* TOP: Sky & Airplane */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: '#0369A1',
                  borderRadius: 28,
                  position: 'relative',
                  overflow: 'hidden',
                  border: '2px solid rgba(56, 189, 248, 0.5)',
                  boxShadow: '0 8px 30px rgba(3, 105, 161, 0.4)',
                }}
              >
                <circle cx="850" cy="90" r="50" fill="#FDE047" filter="drop-shadow(0 0 35px #FBBF24)" />

                <svg
                  width="180"
                  height="90"
                  viewBox="0 0 180 90"
                  style={{
                    position: 'absolute',
                    top: 80,
                    left: planeX,
                    transform: `rotate(${planeTilt}deg)`,
                  }}
                >
                  <path
                    d="M 20 45 Q 80 35 150 42 Q 170 45 150 48 Q 80 55 20 45 Z"
                    fill="#FFFFFF"
                    filter="drop-shadow(0 4px 10px rgba(0,0,0,0.3))"
                  />
                  <polygon points="75,45 105,10 120,10 95,45" fill="#E2E8F0" />
                  <polygon points="75,45 105,80 120,80 95,45" fill="#CBD5E1" />
                  <polygon points="25,45 10,25 20,25 35,45" fill="#38BDF8" />
                </svg>

                <svg
                  width="960"
                  height="260"
                  viewBox="0 0 960 260"
                  style={{ position: 'absolute', bottom: 0, left: 0 }}
                >
                  <path
                    d="M 0 260 L 0 140 A 100 100 0 0 1 200 80 A 120 120 0 0 1 450 60 A 140 140 0 0 1 720 70 A 110 110 0 0 1 960 120 L 960 260 Z"
                    fill="#FFFFFF"
                  />
                  <ellipse cx="480" cy="180" rx="420" ry="60" fill="#F1F5F9" opacity="0.8" />
                </svg>

                <div
                  style={{
                    position: 'absolute',
                    top: 20,
                    left: 24,
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    padding: '8px 20px',
                    borderRadius: 9999,
                    fontSize: 20,
                    fontWeight: 800,
                    color: '#FDE047',
                  }}
                >
                  ✈️ GÓC NHÌN TRÊN CAO: TRẮNG SÁNG RỰC RỠ
                </div>
              </div>

              {/* BOTTOM: Dark Ground Shadow */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: '#0B1329',
                  borderRadius: 28,
                  position: 'relative',
                  overflow: 'hidden',
                  border: '2px solid rgba(71, 85, 105, 0.5)',
                }}
              >
                <svg
                  width="960"
                  height="200"
                  viewBox="0 0 960 200"
                  style={{ position: 'absolute', top: 0, left: 0 }}
                >
                  <path
                    d="M 0 0 L 960 0 L 960 120 Q 720 160 480 140 Q 240 160 0 120 Z"
                    fill="#1E293B"
                  />
                  <rect x="0" y="0" width="960" height="90" fill="#0F172A" />
                </svg>

                <svg
                  width="960"
                  height="340"
                  viewBox="0 0 960 340"
                  style={{ position: 'absolute', bottom: 0, left: 0 }}
                >
                  <line x1="0" y1="280" x2="960" y2="280" stroke="#475569" strokeWidth="4" />
                  <circle cx="480" cy="170" r="24" fill="#F8FAFC" />
                  <line x1="480" y1="194" x2="480" y2="250" stroke="#F8FAFC" strokeWidth="6" />
                  <line x1="480" y1="210" x2="430" y2="190" stroke="#F8FAFC" strokeWidth="6" />
                  <line x1="480" y1="210" x2="530" y2="190" stroke="#F8FAFC" strokeWidth="6" />
                  <line x1="480" y1="250" x2="455" y2="280" stroke="#F8FAFC" strokeWidth="6" />
                  <line x1="480" y1="250" x2="505" y2="280" stroke="#F8FAFC" strokeWidth="6" />

                  <line x1="480" y1="160" x2="440" y2="70" stroke="#38BDF8" strokeWidth="3" strokeDasharray="8 6" />
                  <line x1="480" y1="160" x2="520" y2="70" stroke="#38BDF8" strokeWidth="3" strokeDasharray="8 6" />
                </svg>

                <div
                  style={{
                    position: 'absolute',
                    bottom: 24,
                    left: 24,
                    right: 24,
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    padding: '12px 24px',
                    borderRadius: 16,
                    fontSize: 22,
                    fontWeight: 800,
                    color: '#94A3B8',
                    textAlign: 'center',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                  }}
                >
                  👁️ GÓC NHÌN MẶT ĐẤT: Ta đứng trọn trong bóng tối của đám mây!
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 6: Frame 1080 -> 1194 (36.0s -> 39.8s)
          Summary Card: NHỚ NHÉ - Mây mỏng thì trắng, mây dày thì đáy xám đen
          ========================================================================= */}
      {frame >= 1080 && frame < 1195 && (() => {
        const localFrame = frame - 1080;
        const cardScale = spring({
          frame: localFrame,
          fps,
          config: { damping: 12, mass: 0.9, stiffness: 120 },
        });

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {renderHeader('TỔNG KẾT BÀI HỌC')}

            <div
              style={{
                position: 'absolute',
                top: 260,
                left: 60,
                right: 60,
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  fontSize: 56,
                  fontWeight: 950,
                  color: '#FFFFFF',
                  letterSpacing: '0.08em',
                  textShadow: '0 0 30px rgba(56, 189, 248, 0.6)',
                }}
              >
                NHỚ NHÉ!
              </span>
            </div>

            <div
              style={{
                position: 'absolute',
                top: 400,
                left: 80,
                right: 80,
                backgroundColor: 'rgba(30, 41, 59, 0.85)',
                borderRadius: 36,
                border: '3px solid #38BDF8',
                padding: '50px 40px',
                display: 'flex',
                flexDirection: 'column',
                gap: 40,
                boxShadow: '0 12px 50px rgba(56, 189, 248, 0.35)',
                transform: `scale(${cardScale})`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(15, 23, 42, 0.65)',
                  padding: '24px 32px',
                  borderRadius: 24,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <span style={{ fontSize: 44 }}>⛅</span>
                  <span style={{ fontSize: 36, fontWeight: 800, color: '#38BDF8' }}>
                    Mây mỏng
                  </span>
                </div>
                <span style={{ fontSize: 36, color: '#FFFFFF', fontWeight: 900 }}>→</span>
                <span
                  style={{
                    fontSize: 40,
                    fontWeight: 900,
                    color: '#FFFFFF',
                    textShadow: '0 0 20px rgba(255, 255, 255, 0.7)',
                  }}
                >
                  TRẮNG
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  padding: '24px 32px',
                  borderRadius: 24,
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <span style={{ fontSize: 44 }}>⛈️</span>
                  <span style={{ fontSize: 36, fontWeight: 800, color: '#38BDF8' }}>
                    Mây dày
                  </span>
                </div>
                <span style={{ fontSize: 36, color: '#FFFFFF', fontWeight: 900 }}>→</span>
                <span style={{ fontSize: 38, fontWeight: 900, color: '#CBD5E1' }}>
                  ĐÁY XÁM ĐEN
                </span>
              </div>
            </div>

            <div
              style={{
                position: 'absolute',
                top: 880,
                left: 100,
                right: 100,
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                borderRadius: 24,
                padding: '24px 32px',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 800, color: '#F59E0B' }}>
                Định luật Tán Xạ Mie &amp; Độ Dày Quang Học
              </div>
              <div style={{ fontSize: 22, color: '#CBD5E1', marginTop: 8 }}>
                Mây tán xạ ánh sáng trắng. Khi lớp mây quá dày, ánh sáng bị phản xạ ngược lên không gian trước khi chạm tới đáy!
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 7: Frame 1195 -> 1380 (39.8s -> 46.0s)
          Interactive Question & Mascot Robot
          (NO "Comment đáp án", pure educational engagement)
          ========================================================================= */}
      {frame >= 1195 && (() => {
        const localFrame = frame - 1195;
        const mascotScale = spring({
          frame: localFrame,
          fps,
          config: { damping: 10, mass: 0.8, stiffness: 130 },
        });
        const mascotBob = Math.sin(localFrame * 0.1) * 14;

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {renderHeader('CÂU HỎI THỬ THÁCH')}

            {/* Compact Mini Summary Box on Top */}
            <div
              style={{
                position: 'absolute',
                top: 170,
                left: 80,
                right: 80,
                backgroundColor: 'rgba(30, 41, 59, 0.65)',
                borderRadius: 20,
                border: '1.5px solid rgba(56, 189, 248, 0.35)',
                padding: '14px 28px',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 700, color: '#E2E8F0' }}>
                Mây mỏng → <strong style={{ color: '#FFFFFF' }}>Trắng</strong>
              </span>
              <span style={{ color: '#64748B' }}>|</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#E2E8F0' }}>
                Mây dày → <strong style={{ color: '#94A3B8' }}>Đáy xám đen</strong>
              </span>
            </div>

            {/* Big Question Section in Golden Amber */}
            <div
              style={{
                position: 'absolute',
                top: 310,
                left: 70,
                right: 70,
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                borderRadius: 36,
                border: '2px solid rgba(245, 158, 11, 0.5)',
                padding: '48px 40px',
                boxShadow: '0 16px 45px rgba(245, 158, 11, 0.25)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: '#F59E0B',
                  color: '#0F172A',
                  padding: '8px 24px',
                  borderRadius: 9999,
                  fontSize: 24,
                  fontWeight: 900,
                  marginBottom: 24,
                }}
              >
                CÂU HỎI CHO BẠN
              </div>

              <h2
                style={{
                  fontSize: 48,
                  fontWeight: 900,
                  color: '#FBBF24',
                  lineHeight: 1.35,
                  margin: 0,
                  textShadow: '0 0 25px rgba(251, 191, 36, 0.3)',
                }}
              >
                Vì sao thấy mây đen kéo đến<br />
                là biết trời sắp mưa?
              </h2>

              <p
                style={{
                  fontSize: 24,
                  color: '#94A3B8',
                  marginTop: 24,
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                Gợi ý: Liên quan tới kích thước hạt nước và mật độ hơi nước ngưng tụ trong đám mây!
              </p>
            </div>

            {/* Mascot Robot Hero in Center Bottom with thoughtful thinking pose */}
            <div
              style={{
                position: 'absolute',
                bottom: 240,
                left: 0,
                right: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transform: `scale(${mascotScale})`,
              }}
            >
              <div style={{ transform: `translateY(${mascotBob}px)` }}>
                <MascotRobot size={360} glow />
              </div>

              {/* Thought prompt pill */}
              <div
                style={{
                  marginTop: 24,
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  border: '2px solid rgba(56, 189, 248, 0.5)',
                  color: '#38BDF8',
                  padding: '14px 36px',
                  borderRadius: 9999,
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                }}
              >
                💡 Hãy thử suy luận dựa trên hiện tượng ngưng tụ!
              </div>
            </div>

            {/* Progress bar at the bottom */}
            <div
              style={{
                position: 'absolute',
                bottom: 50,
                left: 80,
                right: 80,
                height: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(frame / 1380) * 100}%`,
                  height: '100%',
                  backgroundColor: '#38BDF8',
                  borderRadius: 4,
                }}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
};
