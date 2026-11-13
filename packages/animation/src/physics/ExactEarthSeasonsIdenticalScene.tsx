import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { MascotRobot } from './MascotRobot';

export const ExactEarthSeasonsIdenticalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Consistent Top Header - Clean LuminaLearn branding (NO "NGÀY 15/100")
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
            boxShadow: `0 0 ${8 + Math.sin(frame / 6) * 5}px #38BDF8`,
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
        <span>THIÊN VĂN 23.5°</span>
      </div>
    </div>
  );

  // Subtitle Card with glassmorphism and gold highlights
  const renderSubtitle = (text: string, highlightWord?: string) => {
    let renderedText: React.ReactNode = text;
    if (highlightWord && text.includes(highlightWord)) {
      const parts = text.split(highlightWord);
      renderedText = (
        <>
          {parts[0]}
          <span style={{ color: '#FACC15', fontWeight: 800 }}>{highlightWord}</span>
          {parts[1]}
        </>
      );
    }

    return (
      <div
        style={{
          position: 'absolute',
          bottom: 100,
          left: 60,
          right: 60,
          background: 'rgba(15, 23, 42, 0.90)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(56, 189, 248, 0.35)',
          borderRadius: 24,
          padding: '24px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          zIndex: 100,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 25px rgba(56, 189, 248, 0.15)',
        }}
      >
        <div
          style={{
            width: 8,
            height: 48,
            borderRadius: 4,
            backgroundColor: '#38BDF8',
            boxShadow: '0 0 12px #38BDF8',
          }}
        />
        <div
          style={{
            color: '#F8FAFC',
            fontSize: 28,
            fontWeight: 600,
            lineHeight: 1.45,
            letterSpacing: '0.01em',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}
        >
          {renderedText}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: '#070D1E',
        color: '#FFFFFF',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Dynamic Background Stars */}
      <svg
        width="1080"
        height="1920"
        style={{ position: 'absolute', inset: 0, opacity: 0.6, pointerEvents: 'none' }}
      >
        <defs>
          <radialGradient id="nebulaGlow" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#1E3A8A" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#0B132B" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#070D1E" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1080" height="1920" fill="url(#nebulaGlow)" />
        {Array.from({ length: 65 }).map((_, i) => {
          const x = (i * 73 + 19) % 1080;
          const y = (i * 109 + 43) % 1920;
          const r = 1 + (i % 3) * 0.8;
          const pulse = Math.sin((frame + i * 20) / 12) * 0.4 + 0.6;
          return <circle key={i} cx={x} cy={y} r={r} fill="#BAE6FD" opacity={pulse * 0.75} />;
        })}
      </svg>

      {renderHeader()}

      {/* =========================================================================
          SCENE 1: Frame 0 -> 114 (0.0s -> 3.8s)
          Question Reveal: Vì sao mùa hè thì nóng, còn mùa đông lại lạnh?
          (Starts directly with the core educational problem hook)
          ========================================================================= */}
      {frame >= 0 && frame < 114 && (() => {
        const cardScale = spring({
          frame,
          fps,
          config: { damping: 12, stiffness: 110 },
        });

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Question Card Header */}
            <div
              style={{
                position: 'absolute',
                top: 240,
                left: 80,
                right: 80,
                textAlign: 'center',
                transform: `scale(${cardScale})`,
              }}
            >
              <div style={{ fontSize: 36, fontWeight: 700, color: '#38BDF8', letterSpacing: '0.08em', marginBottom: 12 }}>
                CÂU HỎI KHOA HỌC
              </div>
              <div style={{ fontSize: 58, fontWeight: 900, lineHeight: 1.3, color: '#FFFFFF' }}>
                VÌ SAO <span style={{ color: '#F97316' }}>MÙA HÈ NÓNG</span>,<br />
                CÒN <span style={{ color: '#38BDF8' }}>MÙA ĐÔNG LẠNH?</span>
              </div>
            </div>

            {/* Dual Comparison Cards */}
            <div
              style={{
                position: 'absolute',
                top: 540,
                left: 80,
                right: 80,
                display: 'flex',
                gap: 40,
                justifyContent: 'center',
              }}
            >
              {/* Summer Card */}
              <div
                style={{
                  flex: 1,
                  background: 'linear-gradient(180deg, rgba(249, 115, 22, 0.25) 0%, rgba(15, 23, 42, 0.8) 100%)',
                  border: '2px solid rgba(249, 115, 22, 0.6)',
                  borderRadius: 32,
                  padding: '40px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  boxShadow: '0 20px 40px rgba(249, 115, 22, 0.25)',
                }}
              >
                <div style={{ fontSize: 90, filter: 'drop-shadow(0 0 20px #F97316)' }}>☀️</div>
                <div style={{ fontSize: 44, fontWeight: 900, color: '#F97316', marginTop: 20 }}>MÙA HÈ</div>
                <div style={{ fontSize: 56, fontWeight: 900, color: '#EF4444', marginTop: 12 }}>~ 38°C</div>
                <div style={{ fontSize: 24, color: '#FED7AA', marginTop: 8, fontWeight: 600 }}>Nắng chói chang, oi bức</div>
              </div>

              {/* Winter Card */}
              <div
                style={{
                  flex: 1,
                  background: 'linear-gradient(180deg, rgba(56, 189, 248, 0.25) 0%, rgba(15, 23, 42, 0.8) 100%)',
                  border: '2px solid rgba(56, 189, 248, 0.6)',
                  borderRadius: 32,
                  padding: '40px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  boxShadow: '0 20px 40px rgba(56, 189, 248, 0.25)',
                }}
              >
                <div style={{ fontSize: 90, filter: 'drop-shadow(0 0 20px #38BDF8)' }}>❄️</div>
                <div style={{ fontSize: 44, fontWeight: 900, color: '#38BDF8', marginTop: 20 }}>MÙA ĐÔNG</div>
                <div style={{ fontSize: 56, fontWeight: 900, color: '#67E8F9', marginTop: 12 }}>~ 10°C</div>
                <div style={{ fontSize: 24, color: '#BAE6FD', marginTop: 8, fontWeight: 600 }}>Gió mùa buốt giá</div>
              </div>
            </div>

            {/* Mascot Robot */}
            <div
              style={{
                position: 'absolute',
                top: 1120 + Math.sin(frame / 7) * 10,
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              <MascotRobot size={320} />
            </div>

            {renderSubtitle('Vì sao mùa hè thì nóng, còn mùa đông lại lạnh?', 'mùa hè thì nóng')}
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 2: Frame 114 -> 384 (3.8s -> 12.8s)
          Misconception Debunk: Nghĩ mùa hè gần Mặt Trời hơn? SAI!
          Tháng 1 gần nhất (147 triệu km) lại là mùa đông miền Bắc!
          ========================================================================= */}
      {frame >= 114 && frame < 384 && (() => {
        const localFrame = frame - 114;
        const stampShow = localFrame > 40;
        const stampScale = stampShow
          ? spring({
              frame: localFrame - 40,
              fps,
              config: { damping: 10, stiffness: 180 },
            })
          : 0;

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Header Title */}
            <div
              style={{
                position: 'absolute',
                top: 220,
                left: 80,
                right: 80,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 700, color: '#FACC15', letterSpacing: '0.04em' }}>
                QUAN NIỆM PHỔ BIẾN
              </div>
              <div style={{ fontSize: 48, fontWeight: 800, color: '#F8FAFC', marginTop: 10 }}>
                &ldquo;Mùa hè nóng vì Trái Đất ở gần Mặt Trời hơn?&rdquo;
              </div>
            </div>

            {/* Orbit Illustration Box */}
            <div
              style={{
                position: 'absolute',
                top: 380,
                left: 70,
                right: 70,
                height: 700,
                background: 'rgba(15, 23, 42, 0.75)',
                borderRadius: 36,
                border: '1.5px solid rgba(56, 189, 248, 0.3)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
              }}
            >
              <svg width="940" height="700" style={{ position: 'absolute', inset: 0 }}>
                {/* Elliptical Orbit Dotted Path */}
                <ellipse
                  cx="470"
                  cy="350"
                  rx="390"
                  ry="210"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="3"
                  strokeDasharray="10 10"
                  opacity="0.45"
                />

                {/* Sun (Off-center slightly at focal point) */}
                <circle cx="430" cy="350" r="70" fill="url(#sunGlowClean)" />
                <circle
                  cx="430"
                  cy="350"
                  r={70 + Math.sin(frame / 5) * 6}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="4"
                  opacity="0.6"
                />
                <text x="430" y="358" textAnchor="middle" fill="#FFFFFF" fontSize="24" fontWeight="800">
                  MẶT TRỜI
                </text>

                {/* Left: Perihelion (Điểm cận nhật - Tháng 1) */}
                <g transform="translate(100, 350)">
                  <circle cx="0" cy="0" r="42" fill="#0284C7" stroke="#38BDF8" strokeWidth="3" />
                  <ellipse cx="0" cy="0" rx="36" ry="12" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.6" />
                  <line x1="-15" y1="-50" x2="15" y2="50" stroke="#FACC15" strokeWidth="3" />
                  <text x="0" y="-70" textAnchor="middle" fill="#EF4444" fontSize="26" fontWeight="900">
                    THÁNG 1
                  </text>
                  <text x="0" y="-95" textAnchor="middle" fill="#BAE6FD" fontSize="20" fontWeight="700">
                    GẦN NHẤT
                  </text>
                  <text x="0" y="80" textAnchor="middle" fill="#F8FAFC" fontSize="24" fontWeight="800">
                    147 triệu km
                  </text>
                  <text x="0" y="110" textAnchor="middle" fill="#38BDF8" fontSize="20" fontWeight="600">
                    (Mùa đông VN)
                  </text>
                </g>

                {/* Right: Aphelion (Điểm viễn nhật - Tháng 7) */}
                <g transform="translate(800, 350)">
                  <circle cx="0" cy="0" r="42" fill="#0284C7" stroke="#38BDF8" strokeWidth="3" />
                  <ellipse cx="0" cy="0" rx="36" ry="12" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.6" />
                  <line x1="-15" y1="-50" x2="15" y2="50" stroke="#FACC15" strokeWidth="3" />
                  <text x="0" y="-70" textAnchor="middle" fill="#F97316" fontSize="26" fontWeight="900">
                    THÁNG 7
                  </text>
                  <text x="0" y="-95" textAnchor="middle" fill="#BAE6FD" fontSize="20" fontWeight="700">
                    XA NHẤT
                  </text>
                  <text x="0" y="80" textAnchor="middle" fill="#F8FAFC" fontSize="24" fontWeight="800">
                    152 triệu km
                  </text>
                  <text x="0" y="110" textAnchor="middle" fill="#F97316" fontSize="20" fontWeight="600">
                    (Mùa hè VN)
                  </text>
                </g>

                <defs>
                  <radialGradient id="sunGlowClean" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FEF08A" />
                    <stop offset="70%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#D97706" />
                  </radialGradient>
                </defs>
              </svg>

              {/* Big "SAI!" Stamp Overlay */}
              {stampShow && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(-12deg) scale(${stampScale})`,
                    border: '8px solid #EF4444',
                    color: '#EF4444',
                    borderRadius: 24,
                    padding: '16px 56px',
                    fontSize: 84,
                    fontWeight: 900,
                    letterSpacing: '0.08em',
                    backgroundColor: 'rgba(239, 68, 68, 0.18)',
                    boxShadow: '0 0 60px rgba(239, 68, 68, 0.7)',
                    textShadow: '0 0 30px rgba(239, 68, 68, 0.8)',
                    zIndex: 50,
                  }}
                >
                  SAI!
                </div>
              )}
            </div>

            {/* Callout Summary */}
            <div
              style={{
                position: 'absolute',
                top: 1140,
                left: 80,
                right: 80,
                background: 'rgba(239, 68, 68, 0.12)',
                border: '2px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 24,
                padding: '24px 32px',
                textAlign: 'center',
              }}
            >
              <div style={{ color: '#FCA5A5', fontSize: 30, fontWeight: 700, lineHeight: 1.4 }}>
                💡 Trái Đất gần Mặt Trời nhất vào <span style={{ color: '#FACC15', fontWeight: 900 }}>tháng 1</span>, đúng giữa <span style={{ color: '#38BDF8', fontWeight: 900 }}>mùa đông</span> miền Bắc! Khoảng cách không quyết định mùa!
              </div>
            </div>

            {renderSubtitle(
              'Trái Đất gần Mặt Trời nhất vào khoảng tháng 1, đúng giữa mùa đông miền Bắc!',
              'tháng 1'
            )}
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 3: Frame 384 -> 750 (12.8s -> 25.0s)
          The Core Secret: Trục Trái Đất nghiêng 23,5°
          Tháng 6: Bắc bán cầu nghiêng VỀ Mặt Trời
          Tháng 12: Bắc bán cầu nghiêng RA XA Mặt Trời
          ========================================================================= */}
      {frame >= 384 && frame < 750 && (() => {
        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Header */}
            <div
              style={{
                position: 'absolute',
                top: 220,
                left: 80,
                right: 80,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 700, color: '#38BDF8', letterSpacing: '0.06em' }}>
                BÍ MẬT CỐT LÕI
              </div>
              <div style={{ fontSize: 52, fontWeight: 900, color: '#F8FAFC', marginTop: 10 }}>
                Trục Trái Đất nghiêng <span style={{ color: '#FACC15' }}>23,5°</span>
              </div>
              <div style={{ fontSize: 26, color: '#94A3B8', marginTop: 8 }}>
                Và luôn giữ nguyên hướng khi quay quanh Mặt Trời
              </div>
            </div>

            {/* Earth & Sun Seasonal Diagram */}
            <div
              style={{
                position: 'absolute',
                top: 400,
                left: 60,
                right: 60,
                height: 820,
                background: 'rgba(15, 23, 42, 0.8)',
                borderRadius: 36,
                border: '1.5px solid rgba(56, 189, 248, 0.35)',
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
              }}
            >
              <svg width="960" height="820" style={{ position: 'absolute', inset: 0 }}>
                {/* Central Radiating Sun */}
                <g transform="translate(480, 410)">
                  <circle cx="0" cy="0" r="85" fill="url(#sunGlowTilt)" />
                  {Array.from({ length: 16 }).map((_, i) => {
                    const ang = (i * Math.PI) / 8 + frame * 0.02;
                    const x1 = Math.cos(ang) * 95;
                    const y1 = Math.sin(ang) * 95;
                    const x2 = Math.cos(ang) * 125;
                    const y2 = Math.sin(ang) * 125;
                    return (
                      <line
                        key={i}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#F59E0B"
                        strokeWidth="4"
                        strokeLinecap="round"
                        opacity="0.75"
                      />
                    );
                  })}
                  <text x="0" y="8" textAnchor="middle" fill="#FFFFFF" fontSize="28" fontWeight="900">
                    MẶT TRỜI
                  </text>
                </g>

                {/* Left Earth: JUNE (Tháng 6 - Bắc Bán Cầu nghiêng VỀ Mặt Trời) */}
                <g transform="translate(180, 410)">
                  <line
                    x1="-48"
                    y1="110"
                    x2="48"
                    y2="-110"
                    stroke="#FACC15"
                    strokeWidth="4"
                    strokeDasharray="6 4"
                  />
                  <circle cx="0" cy="0" r="80" fill="#0369A1" stroke="#38BDF8" strokeWidth="4" />
                  <path
                    d="M -73 -32 A 80 80 0 0 1 73 -32 Z"
                    fill="rgba(249, 115, 22, 0.45)"
                  />
                  <ellipse
                    cx="0"
                    cy="0"
                    rx="80"
                    ry="24"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    transform="rotate(-23.5)"
                  />
                  <circle cx="48" cy="-110" r="7" fill="#FACC15" />
                  <text x="65" y="-115" fill="#FACC15" fontSize="22" fontWeight="800">
                    Bắc (N)
                  </text>

                  <rect x="-130" y="130" width="260" height="70" rx="16" fill="rgba(249, 115, 22, 0.2)" stroke="#F97316" strokeWidth="2" />
                  <text x="0" y="158" textAnchor="middle" fill="#F97316" fontSize="24" fontWeight="900">
                    THÁNG 6
                  </text>
                  <text x="0" y="185" textAnchor="middle" fill="#FED7AA" fontSize="18" fontWeight="700">
                    Bắc cầu nghiêng VỀ Mặt Trời
                  </text>
                </g>

                {/* Right Earth: DECEMBER (Tháng 12 - Bắc Bán Cầu nghiêng RA XA Mặt Trời) */}
                <g transform="translate(780, 410)">
                  <line
                    x1="-48"
                    y1="110"
                    x2="48"
                    y2="-110"
                    stroke="#FACC15"
                    strokeWidth="4"
                    strokeDasharray="6 4"
                  />
                  <circle cx="0" cy="0" r="80" fill="#0369A1" stroke="#38BDF8" strokeWidth="4" />
                  <path
                    d="M -73 -32 A 80 80 0 0 1 73 -32 Z"
                    fill="rgba(30, 58, 138, 0.6)"
                  />
                  <ellipse
                    cx="0"
                    cy="0"
                    rx="80"
                    ry="24"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    transform="rotate(-23.5)"
                  />
                  <circle cx="48" cy="-110" r="7" fill="#FACC15" />
                  <text x="65" y="-115" fill="#FACC15" fontSize="22" fontWeight="800">
                    Bắc (N)
                  </text>

                  <rect x="-130" y="130" width="260" height="70" rx="16" fill="rgba(56, 189, 248, 0.2)" stroke="#38BDF8" strokeWidth="2" />
                  <text x="0" y="158" textAnchor="middle" fill="#38BDF8" fontSize="24" fontWeight="900">
                    THÁNG 12
                  </text>
                  <text x="0" y="185" textAnchor="middle" fill="#BAE6FD" fontSize="18" fontWeight="700">
                    Bắc cầu nghiêng RA XA Mặt Trời
                  </text>
                </g>

                <defs>
                  <radialGradient id="sunGlowTilt" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FEF08A" />
                    <stop offset="60%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#B45309" />
                  </radialGradient>
                </defs>
              </svg>
            </div>

            {/* Bottom Insight Badge */}
            <div
              style={{
                position: 'absolute',
                top: 1260,
                left: 80,
                right: 80,
                background: 'rgba(56, 189, 248, 0.12)',
                border: '2px solid rgba(56, 189, 248, 0.4)',
                borderRadius: 24,
                padding: '24px 32px',
                textAlign: 'center',
              }}
            >
              <div style={{ color: '#F8FAFC', fontSize: 28, fontWeight: 700, lineHeight: 1.4 }}>
                🌍 Trục nghiêng <span style={{ color: '#FACC15', fontWeight: 900 }}>không đổi hướng</span> trong không gian khi Trái Đất quay quanh Mặt Trời → Tạo ra chu kỳ 4 mùa!
              </div>
            </div>

            {renderSubtitle(
              'Bí mật nằm ở trục Trái Đất nghiêng khoảng 23,5 độ và luôn giữ nguyên hướng nghiêng!',
              '23,5 độ'
            )}
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 4: Frame 750 -> 1110 (25.0s -> 37.0s)
          Angle of Incidence & Solar Flux:
          Chiếu thẳng góc (Hè) -> Tập trung hẹp -> Rất nóng
          Chiếu xiên (Đông) -> Trải rộng -> Nhận ít nhiệt
          ========================================================================= */}
      {frame >= 750 && frame < 1110 && (() => {
        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Header Title */}
            <div
              style={{
                position: 'absolute',
                top: 220,
                left: 80,
                right: 80,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 700, color: '#FACC15', letterSpacing: '0.04em' }}>
                CƠ CHẾ NHIỆT HỌC
              </div>
              <div style={{ fontSize: 52, fontWeight: 900, color: '#F8FAFC', marginTop: 10 }}>
                Góc Chiếu Ánh Sáng Mặt Trời
              </div>
            </div>

            {/* Side-by-Side Angle Comparison */}
            <div
              style={{
                position: 'absolute',
                top: 360,
                left: 60,
                right: 60,
                height: 860,
                display: 'flex',
                gap: 30,
              }}
            >
              {/* Box A: Chiếu thẳng góc (Mùa Hè) */}
              <div
                style={{
                  flex: 1,
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '2px solid rgba(249, 115, 22, 0.6)',
                  borderRadius: 32,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 25px 50px rgba(249, 115, 22, 0.2)',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#F97316' }}>MÙA HÈ</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#FED7AA', marginTop: 4 }}>
                    Chiếu gần thẳng góc (~90°)
                  </div>
                </div>

                <svg width="420" height="460" style={{ margin: '20px auto 0' }}>
                  <circle cx="210" cy="50" r="35" fill="#F59E0B" />
                  <polygon
                    points="175,90 245,90 255,340 165,340"
                    fill="url(#beamSummerClean)"
                    opacity="0.85"
                  />
                  <line x1="190" y1="95" x2="185" y2="335" stroke="#FACC15" strokeWidth="3" strokeDasharray="6 4" />
                  <line x1="210" y1="95" x2="210" y2="335" stroke="#FFFFFF" strokeWidth="4" />
                  <line x1="230" y1="95" x2="235" y2="335" stroke="#FACC15" strokeWidth="3" strokeDasharray="6 4" />

                  <line x1="40" y1="340" x2="380" y2="340" stroke="#94A3B8" strokeWidth="4" />
                  <rect x="165" y="334" width="90" height="12" rx="6" fill="#EF4444" style={{ filter: 'drop-shadow(0 0 10px #EF4444)' }} />
                  <ellipse cx="210" cy="340" rx="45" ry="10" fill="#EF4444" opacity="0.6" />

                  <line x1="165" y1="370" x2="255" y2="370" stroke="#F97316" strokeWidth="2" />
                  <text x="210" y="405" textAnchor="middle" fill="#F97316" fontSize="22" fontWeight="800">
                    Diện tích HẸP (A)
                  </text>
                  <text x="210" y="435" textAnchor="middle" fill="#EF4444" fontSize="24" fontWeight="900">
                    🔥 RẤT NÓNG!
                  </text>

                  <defs>
                    <linearGradient id="beamSummerClean" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#F97316" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>
                </svg>

                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    borderRadius: 16,
                    padding: '12px 16px',
                    textAlign: 'center',
                    marginTop: 'auto',
                  }}
                >
                  <div style={{ color: '#FCA5A5', fontSize: 20, fontWeight: 700 }}>
                    Năng lượng hội tụ dày đặc: <span style={{ color: '#EF4444', fontWeight: 900 }}>Mật độ nhiệt cao</span>
                  </div>
                </div>
              </div>

              {/* Box B: Chiếu xiên góc (Mùa Đông) */}
              <div
                style={{
                  flex: 1,
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '2px solid rgba(56, 189, 248, 0.6)',
                  borderRadius: 32,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 25px 50px rgba(56, 189, 248, 0.2)',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#38BDF8' }}>MÙA ĐÔNG</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#BAE6FD', marginTop: 4 }}>
                    Chiếu xiên góc (~35°)
                  </div>
                </div>

                <svg width="420" height="460" style={{ margin: '20px auto 0' }}>
                  <circle cx="340" cy="50" r="35" fill="#F59E0B" />
                  <polygon
                    points="300,75 360,65 290,340 110,340"
                    fill="url(#beamWinterClean)"
                    opacity="0.75"
                  />
                  <line x1="315" y1="75" x2="155" y2="335" stroke="#38BDF8" strokeWidth="3" strokeDasharray="6 4" />
                  <line x1="330" y1="75" x2="200" y2="335" stroke="#FFFFFF" strokeWidth="4" />
                  <line x1="345" y1="75" x2="245" y2="335" stroke="#38BDF8" strokeWidth="3" strokeDasharray="6 4" />

                  <line x1="40" y1="340" x2="380" y2="340" stroke="#94A3B8" strokeWidth="4" />
                  <rect x="110" y="334" width="180" height="12" rx="6" fill="#38BDF8" />
                  <ellipse cx="200" cy="340" rx="90" ry="10" fill="#38BDF8" opacity="0.4" />

                  <line x1="110" y1="370" x2="290" y2="370" stroke="#38BDF8" strokeWidth="2" />
                  <text x="200" y="405" textAnchor="middle" fill="#38BDF8" fontSize="22" fontWeight="800">
                    Diện tích RỘNG (2 × A)
                  </text>
                  <text x="200" y="435" textAnchor="middle" fill="#67E8F9" fontSize="24" fontWeight="900">
                    ❄️ BỊ LOÃNG & LẠNH!
                  </text>

                  <defs>
                    <linearGradient id="beamWinterClean" x1="100%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.7" />
                      <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.3" />
                    </linearGradient>
                  </defs>
                </svg>

                <div
                  style={{
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    borderRadius: 16,
                    padding: '12px 16px',
                    textAlign: 'center',
                    marginTop: 'auto',
                  }}
                >
                  <div style={{ color: '#BAE6FD', fontSize: 20, fontWeight: 700 }}>
                    Năng lượng bị trải rộng: <span style={{ color: '#38BDF8', fontWeight: 900 }}>Mật độ nhiệt thấp</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Formula / Physics Callout */}
            <div
              style={{
                position: 'absolute',
                top: 1250,
                left: 80,
                right: 80,
                background: 'rgba(250, 204, 21, 0.1)',
                border: '2px solid rgba(250, 204, 21, 0.4)',
                borderRadius: 24,
                padding: '20px 32px',
                textAlign: 'center',
              }}
            >
              <div style={{ color: '#FACC15', fontSize: 26, fontWeight: 800 }}>
                Định luật góc chiếu quang năng: I = I₀ · sin(θ)
              </div>
              <div style={{ color: '#E2E8F0', fontSize: 22, marginTop: 6, fontWeight: 600 }}>
                Góc chiếu θ càng gần 90° → Mặt đất hấp thụ năng lượng cực đại!
              </div>
            </div>

            {renderSubtitle(
              'Khi nghiêng về Mặt Trời, nắng chiếu gần thẳng góc, tập trung vùng hẹp nên rất nóng!',
              'thẳng góc'
            )}
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 5: Frame 1110 -> 1404 (37.0s -> 46.8s)
          Day Length in Hanoi:
          Hè: Ngày dài (13.5h), Đêm ngắn (10.5h) -> Sưởi nóng lâu
          Đông: Ngày ngắn (11h), Đêm dài (13h) -> Nhận ít nhiệt
          ========================================================================= */}
      {frame >= 1110 && frame < 1404 && (() => {
        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Header */}
            <div
              style={{
                position: 'absolute',
                top: 220,
                left: 80,
                right: 80,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 700, color: '#38BDF8', letterSpacing: '0.04em' }}>
                YẾU TỐ THỜI GIAN
              </div>
              <div style={{ fontSize: 52, fontWeight: 900, color: '#F8FAFC', marginTop: 10 }}>
                Ngày Dài, Đêm Ngắn
              </div>
              <div style={{ fontSize: 26, color: '#94A3B8', marginTop: 8 }}>
                Số liệu thực tế đo đạc tại Thủ đô Hà Nội
              </div>
            </div>

            {/* Infographic Container */}
            <div
              style={{
                position: 'absolute',
                top: 400,
                left: 70,
                right: 70,
                background: 'rgba(15, 23, 42, 0.85)',
                borderRadius: 36,
                border: '1.5px solid rgba(56, 189, 248, 0.35)',
                padding: '40px 36px',
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
              }}
            >
              {/* Summer Bar (Hà Nội Mùa Hè) */}
              <div style={{ marginBottom: 48 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 36 }}>☀️</span>
                    <span style={{ fontSize: 36, fontWeight: 900, color: '#F97316' }}>HÀ NỘI - MÙA HÈ</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#FED7AA' }}>
                    Tổng 24 giờ
                  </div>
                </div>

                <div
                  style={{
                    height: 64,
                    borderRadius: 32,
                    background: '#1E293B',
                    overflow: 'hidden',
                    display: 'flex',
                    border: '2px solid rgba(249, 115, 22, 0.5)',
                  }}
                >
                  <div
                    style={{
                      width: '56.25%',
                      background: 'linear-gradient(90deg, #F59E0B 0%, #F97316 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      fontWeight: 900,
                      fontSize: 26,
                      boxShadow: '0 0 20px rgba(249, 115, 22, 0.6)',
                    }}
                  >
                    Ngày: 13,5 tiếng
                  </div>
                  <div
                    style={{
                      width: '43.75%',
                      background: '#0F172A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94A3B8',
                      fontWeight: 700,
                      fontSize: 24,
                    }}
                  >
                    Đêm: 10,5 tiếng
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, color: '#FDE047', fontSize: 22, fontWeight: 600 }}>
                  <span>🔥</span>
                  <span>Mặt đất được sưởi nắng suốt 13,5 tiếng liên tục, tích lũy lượng nhiệt cực lớn!</span>
                </div>
              </div>

              {/* Winter Bar (Hà Nội Mùa Đông) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 36 }}>❄️</span>
                    <span style={{ fontSize: 36, fontWeight: 900, color: '#38BDF8' }}>HÀ NỘI - MÙA ĐÔNG</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#BAE6FD' }}>
                    Tổng 24 giờ
                  </div>
                </div>

                <div
                  style={{
                    height: 64,
                    borderRadius: 32,
                    background: '#1E293B',
                    overflow: 'hidden',
                    display: 'flex',
                    border: '2px solid rgba(56, 189, 248, 0.5)',
                  }}
                >
                  <div
                    style={{
                      width: '45.8%',
                      background: 'linear-gradient(90deg, #0284C7 0%, #38BDF8 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      fontWeight: 900,
                      fontSize: 26,
                      boxShadow: '0 0 20px rgba(56, 189, 248, 0.5)',
                    }}
                  >
                    Ngày: 11 tiếng
                  </div>
                  <div
                    style={{
                      width: '54.2%',
                      background: '#090E17',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94A3B8',
                      fontWeight: 700,
                      fontSize: 24,
                    }}
                  >
                    Đêm: 13 tiếng
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, color: '#BAE6FD', fontSize: 22, fontWeight: 600 }}>
                  <span>❄️</span>
                  <span>Đêm dài tới 13 tiếng khiến nhiệt lượng bức xạ thoát hết vào khí quyển!</span>
                </div>
              </div>
            </div>

            {/* Mascot Robot */}
            <div
              style={{
                position: 'absolute',
                top: 1120 + Math.sin(frame / 6) * 10,
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              <MascotRobot size={300} />
            </div>

            {renderSubtitle(
              'Ở Hà Nội, ngày hè dài 13 tiếng rưỡi, ngày đông chỉ 11 tiếng nên mùa hè được sưởi nóng lâu hơn!',
              '13 tiếng rưỡi'
            )}
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 6: Frame 1404 -> 1515 (46.8s -> 50.5s)
          Summary Conclusion:
          Nhớ nhé: Trục Trái Đất nghiêng tạo ra các mùa!
          ========================================================================= */}
      {frame >= 1404 && frame < 1515 && (() => {
        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Summary Badge Card */}
            <div
              style={{
                position: 'absolute',
                top: 300,
                left: 80,
                right: 80,
                background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
                border: '3px solid #FACC15',
                borderRadius: 36,
                padding: '48px 40px',
                textAlign: 'center',
                boxShadow: '0 30px 60px rgba(250, 204, 21, 0.25)',
              }}
            >
              <div style={{ fontSize: 36, fontWeight: 900, color: '#FACC15', letterSpacing: '0.08em' }}>
                ⭐ GHI NHỚ TRỌNG TÂM ⭐
              </div>
              <div style={{ fontSize: 52, fontWeight: 900, color: '#FFFFFF', marginTop: 24, lineHeight: 1.35 }}>
                TRỤC TRÁI ĐẤT NGHIÊNG <span style={{ color: '#FACC15' }}>23,5°</span><br />
                CHÍNH LÀ NGUYÊN NHÂN TẠO RA CÁC MÙA!
              </div>

              <div
                style={{
                  marginTop: 40,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20,
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.06)', padding: '16px 24px', borderRadius: 18 }}>
                  <span style={{ fontSize: 32 }}>1️⃣</span>
                  <span style={{ fontSize: 26, fontWeight: 700, color: '#F8FAFC' }}>
                    Không phải do khoảng cách gần/xa Mặt Trời.
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.06)', padding: '16px 24px', borderRadius: 18 }}>
                  <span style={{ fontSize: 32 }}>2️⃣</span>
                  <span style={{ fontSize: 26, fontWeight: 700, color: '#F8FAFC' }}>
                    Góc chiếu thẳng → Nhiệt tập trung → Mùa hè.
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.06)', padding: '16px 24px', borderRadius: 18 }}>
                  <span style={{ fontSize: 32 }}>3️⃣</span>
                  <span style={{ fontSize: 26, fontWeight: 700, color: '#F8FAFC' }}>
                    Góc chiếu xiên → Nhiệt phân tán → Mùa đông.
                  </span>
                </div>
              </div>
            </div>

            {/* Mascot Robot */}
            <div
              style={{
                position: 'absolute',
                top: 1080 + Math.sin(frame / 6) * 10,
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              <MascotRobot size={340} />
            </div>

            {renderSubtitle(
              'Nhớ nhé, trục Trái Đất nghiêng tạo ra các mùa!',
              'trục Trái Đất nghiêng'
            )}
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 7: Frame 1515 -> 1680 (50.5s -> 56.0s)
          Challenge Question (Clean educational quiz, NO "Comment đáp án nhé" prompt):
          Câu hỏi cho bạn: Khi miền Bắc nước ta đang là mùa đông, thì ở Úc là mùa gì?
          ========================================================================= */}
      {frame >= 1515 && frame < 1680 && (() => {
        const pulse = 1 + Math.sin(frame / 5) * 0.05;

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Quiz Banner */}
            <div
              style={{
                position: 'absolute',
                top: 240,
                left: 80,
                right: 80,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: '#0284C7',
                  color: '#FFFFFF',
                  padding: '10px 32px',
                  borderRadius: 9999,
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  boxShadow: '0 0 20px rgba(2, 132, 199, 0.5)',
                }}
              >
                CÂU HỎI SUY NGẪM
              </div>
              <div style={{ fontSize: 48, fontWeight: 900, color: '#FFFFFF', marginTop: 24, lineHeight: 1.35 }}>
                Khi miền Bắc nước ta là <span style={{ color: '#38BDF8' }}>MÙA ĐÔNG</span>,<br />
                thì ở nước <span style={{ color: '#FACC15' }}>ÚC</span> là mùa gì?
              </div>
            </div>

            {/* Multiple Choice Options */}
            <div
              style={{
                position: 'absolute',
                top: 540,
                left: 90,
                right: 90,
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
              }}
            >
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.85)',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 24,
                  padding: '24px 32px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                }}
              >
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#475569', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900 }}>
                  A
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#E2E8F0' }}>Mùa đông giống Việt Nam</div>
              </div>

              <div
                style={{
                  background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.2) 0%, rgba(30, 41, 59, 0.85) 100%)',
                  border: '2.5px solid #F59E0B',
                  borderRadius: 24,
                  padding: '24px 32px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                  transform: `scale(${pulse})`,
                  boxShadow: '0 0 25px rgba(245, 158, 11, 0.3)',
                }}
              >
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F59E0B', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900 }}>
                  B
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#FDE047' }}>Mùa hè ấm áp rực rỡ</div>
              </div>

              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.85)',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 24,
                  padding: '24px 32px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                }}
              >
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#475569', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900 }}>
                  C
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#E2E8F0' }}>Mùa thu mát mẻ</div>
              </div>
            </div>

            {/* Mascot Robot */}
            <div
              style={{
                position: 'absolute',
                top: 1080 + Math.sin(frame / 6) * 10,
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              <MascotRobot size={340} />
            </div>

            {renderSubtitle(
              'Khi miền Bắc nước ta là mùa đông, thì ở Úc là mùa gì?',
              'ở Úc là mùa gì?'
            )}
          </div>
        );
      })()}
    </div>
  );
};
