import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { MascotRobot } from './MascotRobot';

export const ExactSmartCampusEnvironmentScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Top persistent LuminaLearn Smart Campus Header
  const renderHeader = (subtitle?: string) => (
    <div
      style={{
        position: 'absolute',
        top: 28,
        left: 40,
        right: 40,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 100,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          padding: '8px 20px',
          borderRadius: 9999,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: '#10B981',
            boxShadow: `0 0 ${10 + Math.sin(frame / 5) * 5}px #10B981`,
          }}
        />
        <span style={{ fontSize: 16, fontWeight: 800, color: '#F8FAFC', letterSpacing: '0.02em' }}>
          LuminaLearn
        </span>
        <span style={{ fontSize: 16, fontWeight: 500, color: '#64748B' }}>•</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#38BDF8', letterSpacing: '0.04em' }}>
          SMART CAMPUS 2026
        </span>
        {subtitle && (
          <>
            <span style={{ fontSize: 16, fontWeight: 500, color: '#64748B' }}>•</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#34D399' }}>{subtitle}</span>
          </>
        )}
      </div>

      <div
        style={{
          backgroundColor: 'rgba(16, 185, 129, 0.18)',
          backdropFilter: 'blur(12px)',
          border: '1.5px solid rgba(16, 185, 129, 0.5)',
          color: '#34D399',
          padding: '8px 20px',
          borderRadius: 9999,
          fontWeight: 800,
          fontSize: 14,
          letterSpacing: '0.05em',
          boxShadow: '0 4px 15px rgba(16, 185, 129, 0.15)',
        }}
      >
        MÔI TRƯỜNG & NĂNG LƯỢNG
      </div>
    </div>
  );

  // Subtitle Bar (Glassmorphic, crisp Vietnamese typography)
  const renderSubtitle = (text: string) => (
    <div
      style={{
        position: 'absolute',
        bottom: 26,
        left: 60,
        right: 60,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 90,
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.90)',
          backdropFilter: 'blur(14px)',
          border: '1.5px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '16px',
          padding: '12px 28px',
          color: '#FFFFFF',
          fontSize: 19,
          fontWeight: 600,
          textAlign: 'center',
          lineHeight: 1.45,
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          maxWidth: '92%',
        }}
      >
        {text}
      </div>
    </div>
  );

  // Floating clouds generator
  const renderClouds = () => (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: 65,
          left: `${((frame * 0.35) % 1500) - 180}px`,
          opacity: 0.7,
        }}
      >
        <svg width="150" height="60" viewBox="0 0 140 60" fill="#FFFFFF">
          <path d="M 20 50 A 20 20 0 0 1 50 30 A 25 25 0 0 1 95 30 A 20 20 0 0 1 125 50 Z" />
        </svg>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 120,
          left: `${(((frame * 0.22) + 700) % 1600) - 200}px`,
          opacity: 0.55,
        }}
      >
        <svg width="180" height="70" viewBox="0 0 180 70" fill="#FFFFFF">
          <path d="M 25 60 A 25 25 0 0 1 65 35 A 32 32 0 0 1 125 35 A 25 25 0 0 1 160 60 Z" />
        </svg>
      </div>
    </div>
  );

  // Background rolling green hills
  const renderRollingHills = () => (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 280, pointerEvents: 'none' }}>
      <svg width="1280" height="280" viewBox="0 0 1280 280" style={{ width: '100%', height: '100%' }}>
        <path d="M 0 180 Q 350 90 700 170 T 1280 140 L 1280 280 L 0 280 Z" fill="#6EE7B7" opacity="0.6" />
        <path d="M 0 210 Q 400 140 850 200 T 1280 180 L 1280 280 L 0 280 Z" fill="#34D399" />
        <circle cx="160" cy="180" r="28" fill="#059669" />
        <rect x="156" y="200" width="8" height="24" fill="#78350F" />
        <circle cx="1120" cy="170" r="32" fill="#047857" />
        <rect x="1116" y="195" width="8" height="28" fill="#78350F" />
      </svg>
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#E0F2FE',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Synchronized Master Vietnamese Voiceover (Bảo Trang DUTAI ZeroTTS + BGM) */}
      <Audio src={staticFile('audio/smart_campus_full_master_audio.wav')} volume={1.0} />

      {/* Persistent Animated Clouds & Rolling Green Hills */}
      {renderClouds()}
      {renderRollingHills()}

      {/* =========================================================================
          SCENE 1: Frame 0 -> 348 (0.0s -> 11.6s)
          Intro: Không gian sống thiết yếu & Thực trạng ô nhiễm nghiêm trọng
          ========================================================================= */}
      {frame >= 0 && frame < 348 && (() => {
        const titleScale = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
        const earthRotation = (frame * 0.6) % 360;
        const mascotFloatY = Math.sin(frame / 8) * 8;

        return (
          <AbsoluteFill>
            {renderHeader('GIỚI THIỆU TỔNG QUAN')}

            {/* Main Title Badge */}
            <div
              style={{
                position: 'absolute',
                top: 90,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                transform: `scale(${titleScale})`,
              }}
            >
              <div
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #0284C7 100%)',
                  padding: '12px 40px',
                  borderRadius: 24,
                  boxShadow: '0 8px 30px rgba(5, 150, 105, 0.3)',
                  border: '2px solid rgba(255, 255, 255, 0.4)',
                }}
              >
                <h1
                  style={{
                    margin: 0,
                    fontSize: 32,
                    fontWeight: 900,
                    color: '#FFFFFF',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                  }}
                >
                  CHUNG TAY BẢO VỆ MÔI TRƯỜNG
                </h1>
              </div>
            </div>

            {/* Mascot Robot (Left Side) */}
            <div
              style={{
                position: 'absolute',
                left: 100,
                bottom: 110,
                transform: `translateY(${mascotFloatY}px)`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <MascotRobot size={270} glow />
              <div
                style={{
                  marginTop: -10,
                  backgroundColor: '#0F172A',
                  color: '#38BDF8',
                  padding: '6px 18px',
                  borderRadius: 9999,
                  fontWeight: 800,
                  fontSize: 14,
                  border: '1.5px solid #38BDF8',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}
              >
                Lumina Bot
              </div>
            </div>

            {/* Animated 2D Earth Globe (Center - Right) */}
            <div
              style={{
                position: 'absolute',
                left: 540,
                top: 180,
                width: 380,
                height: 380,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #60A5FA 0%, #2563EB 60%, #1D4ED8 100%)',
                boxShadow: '0 20px 50px rgba(37, 99, 235, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                border: '4px solid rgba(255,255,255,0.7)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: 760,
                  height: 380,
                  left: `${-(earthRotation % 380)}px`,
                  display: 'flex',
                }}
              >
                <svg width="760" height="380" viewBox="0 0 760 380">
                  <path d="M 60 90 Q 120 40 180 80 Q 220 140 160 220 Q 90 260 50 180 Z" fill="#34D399" />
                  <path d="M 230 180 Q 300 120 340 190 Q 320 280 250 290 Q 200 240 230 180 Z" fill="#10B981" />
                  <path d="M 440 90 Q 500 40 560 80 Q 600 140 540 220 Q 470 260 430 180 Z" fill="#34D399" />
                  <path d="M 610 180 Q 680 120 720 190 Q 700 280 630 290 Q 580 240 610 180 Z" fill="#10B981" />
                </svg>
              </div>
            </div>

            {/* Side Highlights */}
            <div style={{ position: 'absolute', right: 80, top: 220, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '12px 20px', borderRadius: 16, boxShadow: '0 6px 18px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 26 }}>🌍</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Không Gian Sống Thiết Yếu</span>
              </div>
              <div style={{ backgroundColor: '#FEE2E2', border: '1.5px solid #FCA5A5', padding: '12px 20px', borderRadius: 16, boxShadow: '0 6px 18px rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 26 }}>⚠️</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#991B1B' }}>Ô Nhiễm Báo Động Đỏ</span>
              </div>
            </div>

            {renderSubtitle(
              'Các bạn thân mến, môi trường là không gian sống thiết yếu đối với con người và muôn loài. Tuy nhiên hiện nay, môi trường đang bị ô nhiễm nghiêm trọng, gây ảnh hưởng lớn đến sức khỏe, cuộc sống và sự phát triển bền vững.'
            )}
          </AbsoluteFill>
        );
      })()}

      {/* =========================================================================
          SCENE 2: Frame 348 -> 593 (11.6s -> 19.8s)
          Causes 1: Sản xuất công nghiệp, nông nghiệp, khai thác tài nguyên
          ========================================================================= */}
      {frame >= 348 && frame < 593 && (() => {
        const localFrame = frame - 348;
        const c1Spring = spring({ frame: localFrame, fps, config: { damping: 14 } });
        const c2Spring = spring({ frame: Math.max(0, localFrame - 15), fps, config: { damping: 14 } });
        const c3Spring = spring({ frame: Math.max(0, localFrame - 30), fps, config: { damping: 14 } });

        return (
          <AbsoluteFill>
            {renderHeader('NGUYÊN NHÂN TỪ SẢN XUẤT')}

            <div style={{ position: 'absolute', top: 90, left: 0, right: 0, textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  padding: '10px 32px',
                  borderRadius: 20,
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                }}
              >
                HOẠT ĐỘNG SẢN XUẤT & KHAI THÁC
              </div>
            </div>

            <div style={{ position: 'absolute', left: 70, bottom: 110, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <MascotRobot size={260} glow />
              <div style={{ marginTop: -8, backgroundColor: '#EF4444', color: '#FFFFFF', padding: '4px 16px', borderRadius: 9999, fontWeight: 800, fontSize: 13 }}>
                Áp Lực Sản Xuất
              </div>
            </div>

            {/* 3 Activity Cards */}
            <div style={{ position: 'absolute', left: 360, right: 60, top: 175, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: '24px 18px', border: '2px solid #FCA5A5', boxShadow: '0 8px 24px rgba(239,68,68,0.15)', transform: `scale(${c1Spring})`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🏭</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#991B1B', textAlign: 'center' }}>Sản Xuất Công Nghiệp</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#64748B', textAlign: 'center' }}>Khói bụi và khí thải xả trực tiếp vào bầu khí quyển</p>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: '24px 18px', border: '2px solid #FCD34D', boxShadow: '0 8px 24px rgba(245,158,11,0.15)', transform: `scale(${c2Spring})`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🌾</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#92400E', textAlign: 'center' }}>Nông Nghiệp Hóa Chất</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#64748B', textAlign: 'center' }}>Lạm dụng thuốc trừ sâu và phân bón hóa học làm chua đất</p>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: '24px 18px', border: '2px solid #CBD5E1', boxShadow: '0 8px 24px rgba(15,23,42,0.1)', transform: `scale(${c3Spring})`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>⛏️</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#1E293B', textAlign: 'center' }}>Khai Thác Quá Mức</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#64748B', textAlign: 'center' }}>Khai thác khoáng sản cạn kiệt, sạt lở và xói mòn đất</p>
              </div>
            </div>

            {renderSubtitle(
              'Hiện tượng ô nhiễm môi trường xuất phát từ nhiều nguyên nhân, chủ yếu do hoạt động sản xuất công nghiệp, nông nghiệp, và khai thác tài nguyên thiên nhiên quá mức.'
            )}
          </AbsoluteFill>
        );
      })()}

      {/* =========================================================================
          SCENE 3: Frame 593 -> 915 (19.8s -> 30.5s)
          Causes 2: Ý thức con người, rác thải nhựa, phá rừng, nhiên liệu hóa thạch
          ========================================================================= */}
      {frame >= 593 && frame < 915 && (() => {
        const localFrame = frame - 593;
        const panelSpring = spring({ frame: localFrame, fps, config: { damping: 14 } });

        return (
          <AbsoluteFill>
            {renderHeader('Ý THỨC & NHIÊN LIỆU HÓA THẠCH')}

            <div style={{ position: 'absolute', top: 90, left: 0, right: 0, textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  padding: '10px 32px',
                  borderRadius: 20,
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                }}
              >
                SUY THOÁI ĐẤT, NƯỚC & KHÔNG KHÍ
              </div>
            </div>

            <div style={{ position: 'absolute', left: 70, bottom: 110, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <MascotRobot size={260} glow />
              <div style={{ marginTop: -8, backgroundColor: '#DC2626', color: '#FFFFFF', padding: '4px 16px', borderRadius: 9999, fontWeight: 800, fontSize: 13 }}>
                Suy Thoái Môi Trường
              </div>
            </div>

            {/* Impact Grid Card */}
            <div
              style={{
                position: 'absolute',
                left: 360,
                right: 60,
                top: 175,
                bottom: 110,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: 24,
                border: '2px solid #F87171',
                padding: '24px 32px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 20,
                alignItems: 'center',
                transform: `scale(${panelSpring})`,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: 50, marginBottom: 8 }}>🚯</div>
                <h4 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#991B1B' }}>Xả Rác Bừa Bãi</h4>
                <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>Hàng triệu tấn rác thải nhựa tràn ra sông ngòi và đại dương.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: 50, marginBottom: 8 }}>🪓</div>
                <h4 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#9A3412' }}>Chặt Phá Rừng</h4>
                <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>Mất đi lá phổi xanh điều hòa khí hậu và giữ nguồn nước ngầm.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: 50, marginBottom: 8 }}>🛢️</div>
                <h4 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#1E293B' }}>Đốt Nhiên Liệu Hóa Thạch</h4>
                <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>Gia tăng hiệu ứng nhà kính và biến đổi khí hậu toàn cầu.</p>
              </div>
            </div>

            {renderSubtitle(
              'Cùng với đó là ý thức chưa tốt của con người: việc xả rác bừa bãi, chặt phá rừng, đốt nhiên liệu hóa thạch đã làm cho bầu không khí, nguồn nước và đất đai bị suy thoái nghiêm trọng.'
            )}
          </AbsoluteFill>
        );
      })()}

      {/* =========================================================================
          SCENE 4: Frame 915 -> 1253 (30.5s -> 41.8s)
          Solutions: Trồng cây, tiết kiệm điện, phân loại rác, bao bì thân thiện
          ========================================================================= */}
      {frame >= 915 && frame < 1253 && (() => {
        const localFrame = frame - 915;
        const panelSpring = spring({ frame: localFrame, fps, config: { damping: 14 } });
        const turbineRotation = (frame * 3.5) % 360;

        return (
          <AbsoluteFill>
            {renderHeader('GIẢI PHÁP NĂNG LƯỢNG & TÁI CHẾ')}

            <div style={{ position: 'absolute', top: 90, left: 0, right: 0, textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #10B981 0%, #0284C7 100%)',
                  color: '#FFFFFF',
                  padding: '10px 36px',
                  borderRadius: 20,
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                }}
              >
                BIỆN PHÁP KHẮC PHỤC THIẾT THỰC
              </div>
            </div>

            <div style={{ position: 'absolute', left: 70, bottom: 110, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <MascotRobot size={260} glow />
              <div style={{ marginTop: -8, backgroundColor: '#10B981', color: '#FFFFFF', padding: '4px 16px', borderRadius: 9999, fontWeight: 800, fontSize: 13 }}>
                Hành Động Xanh 🌱
              </div>
            </div>

            {/* Solutions Grid */}
            <div
              style={{
                position: 'absolute',
                left: 360,
                right: 60,
                top: 175,
                bottom: 110,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: 24,
                border: '2px solid #34D399',
                padding: '24px 32px',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 20,
                transform: `scale(${panelSpring})`,
              }}
            >
              <div style={{ backgroundColor: '#F0FDF4', borderRadius: 16, padding: '16px', border: '1.5px solid #86EFAC', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 40 }}>🌳</div>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#166534' }}>Trồng Nhiều Cây Xanh</h4>
                  <p style={{ margin: 0, fontSize: 12, color: '#4B5563' }}>Phủ xanh trường học, hấp thụ CO₂ và lọc bụi mịn</p>
                </div>
              </div>

              <div style={{ backgroundColor: '#EFF6FF', borderRadius: 16, padding: '16px', border: '1.5px solid #93C5FD', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 40 }}>⚡</div>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#1E40AF' }}>Tiết Kiệm Điện Năng</h4>
                  <p style={{ margin: 0, fontSize: 12, color: '#4B5563' }}>Tắt thiết bị khi không dùng, dùng điện mặt trời & gió</p>
                </div>
              </div>

              <div style={{ backgroundColor: '#FEF3C7', borderRadius: 16, padding: '16px', border: '1.5px solid #FCD34D', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 40 }}>♻️</div>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#92400E' }}>Phân Loại Rác Đúng</h4>
                  <p style={{ margin: 0, fontSize: 12, color: '#4B5563' }}>Tách riêng rác tái chế và rác hữu cơ tại nguồn</p>
                </div>
              </div>

              <div style={{ backgroundColor: '#FAF5FF', borderRadius: 16, padding: '16px', border: '1.5px solid #D8B4FE', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 40 }}>🛍️</div>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#6B21A8' }}>Sản Phẩm Thân Thiện</h4>
                  <p style={{ margin: 0, fontSize: 12, color: '#4B5563' }}>Ưu tiên túi vải, bao bì sinh học tự phân hủy</p>
                </div>
              </div>
            </div>

            {renderSubtitle(
              'Để khắc phục tình trạng này, chúng ta cần thực hiện nhiều biện pháp thiết thực như: trồng nhiều cây xanh, tiết kiệm năng lượng điện, phân loại rác thải đúng quy định, và ưu tiên sử dụng sản phẩm thân thiện với môi trường.'
            )}
          </AbsoluteFill>
        );
      })()}

      {/* =========================================================================
          SCENE 5: Frame 1253 -> 1560 (41.8s -> 52.0s)
          Campaigns: Tuyên truyền học đường, Giờ Trái Đất, Ngày Chủ nhật xanh
          ========================================================================= */}
      {frame >= 1253 && frame < 1560 && (() => {
        const localFrame = frame - 1253;
        const boardSpring = spring({ frame: localFrame, fps, config: { damping: 14 } });

        return (
          <AbsoluteFill>
            {renderHeader('TUYÊN TRUYỀN HỌC ĐƯỜNG')}

            <div style={{ position: 'absolute', left: 80, bottom: 110, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <MascotRobot size={260} glow />
              <div style={{ marginTop: -8, backgroundColor: '#0284C7', color: '#FFFFFF', padding: '4px 16px', borderRadius: 9999, fontWeight: 800, fontSize: 13 }}>
                Giảng Đường Xanh 🏫
              </div>
            </div>

            {/* Chalkboard Display */}
            <div
              style={{
                position: 'absolute',
                left: 370,
                right: 60,
                top: 95,
                bottom: 110,
                backgroundColor: '#1E3A2F',
                borderRadius: 24,
                border: '14px solid #78350F',
                boxShadow: '0 20px 45px rgba(0, 0, 0, 0.45)',
                padding: '24px 32px',
                display: 'flex',
                flexDirection: 'column',
                transform: `scale(${boardSpring})`,
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 20, borderBottom: '2px dashed rgba(255,255,255,0.25)', paddingBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#FCD34D' }}>
                  ĐẨY MẠNH CÔNG TÁC TUYÊN TRUYỀN HỌC ĐƯỜNG
                </h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, flex: 1 }}>
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 16, padding: '20px', border: '1px solid rgba(255, 255, 255, 0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 44, marginBottom: 10 }}>📱</div>
                  <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#38BDF8' }}>Truyền Thông Số</h3>
                  <p style={{ margin: 0, fontSize: 14, color: '#E2E8F0', textAlign: 'center', lineHeight: 1.4 }}>
                    Lan tỏa thông điệp trên app sinh viên, mạng xã hội & chiến dịch <b>Giờ Trái Đất 60+</b>
                  </p>
                </div>

                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 16, padding: '20px', border: '1px solid rgba(255, 255, 255, 0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 44, marginBottom: 10 }}>🏫</div>
                  <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#34D399' }}>Ngoại Khóa Sinh Viên</h3>
                  <p style={{ margin: 0, fontSize: 14, color: '#E2E8F0', textAlign: 'center', lineHeight: 1.4 }}>
                    Chiến dịch <b>Ngày Chủ nhật xanh</b>, dọn sạch khuôn viên và trồng cây quanh ký túc xá
                  </p>
                </div>
              </div>
            </div>

            {renderSubtitle(
              'Đặc biệt trong trường học, công tác tuyên truyền bảo vệ môi trường cần được đẩy mạnh thông qua các phương tiện truyền thông số, hoạt động ngoại khóa, cùng các chiến dịch như Giờ Trái Đất và Ngày Chủ nhật xanh.'
            )}
          </AbsoluteFill>
        );
      })()}

      {/* =========================================================================
          SCENE 6: Frame 1560 -> 1886 (52.0s -> 62.9s)
          Student Actions: Vứt rác đúng nơi, túi vải, đi bộ & đi xe đạp
          ========================================================================= */}
      {frame >= 1560 && frame < 1886 && (() => {
        const localFrame = frame - 1560;
        const actionSpring = spring({ frame: localFrame, fps, config: { damping: 14 } });

        return (
          <AbsoluteFill>
            {renderHeader('HÀNH ĐỘNG CỦA MỖI SINH VIÊN')}

            <div style={{ position: 'absolute', top: 90, left: 0, right: 0, textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  padding: '10px 36px',
                  borderRadius: 20,
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                }}
              >
                HÀNH ĐỘNG THỰC TẾ HÀNG NGÀY
              </div>
            </div>

            <div style={{ position: 'absolute', left: 70, bottom: 110, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <MascotRobot size={260} glow />
              <div style={{ marginTop: -8, backgroundColor: '#059669', color: '#FFFFFF', padding: '4px 16px', borderRadius: 9999, fontWeight: 800, fontSize: 13 }}>
                Hành Động Nhỏ 👍
              </div>
            </div>

            <div
              style={{
                position: 'absolute',
                left: 360,
                right: 60,
                top: 175,
                bottom: 110,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: 24,
                border: '2px solid #10B981',
                padding: '24px 32px',
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: 28,
                alignItems: 'center',
                transform: `scale(${actionSpring})`,
              }}
            >
              {/* Left Column: 2 Recycling Bins */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                  Phân Loại Rác Tại Giảng Đường:
                </h3>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1, backgroundColor: '#FEF3C7', border: '2px solid #F59E0B', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 6 }}>♻️</div>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#B45309' }}>Rác Tái Chế</span>
                    <span style={{ fontSize: 12, color: '#78350F', marginTop: 4 }}>Giấy, Chai Nhựa, Lon</span>
                  </div>
                  <div style={{ flex: 1, backgroundColor: '#D1FAE5', border: '2px solid #10B981', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 6 }}>🌱</div>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#047857' }}>Rác Hữu Cơ</span>
                    <span style={{ fontSize: 12, color: '#065F46', marginTop: 4 }}>Thức Ăn, Vỏ Hoa Quả</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Green Transport */}
              <div style={{ backgroundColor: '#F8FAFC', borderRadius: 20, border: '1.5px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 36 }}>🚴‍♂️</div>
                  <div>
                    <h4 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Đi Xe Đạp & Đi Bộ</h4>
                    <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>Không khói bụi, rèn luyện sức khỏe</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 36 }}>👜</div>
                  <div>
                    <h4 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Dùng Túi Vải Tiện Lợi</h4>
                    <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>Thay thế hoàn toàn túi nilon một lần</p>
                  </div>
                </div>
              </div>
            </div>

            {renderSubtitle(
              'Mỗi bạn sinh viên hãy thực hiện những việc làm thiết thực: vứt rác đúng nơi quy định, sử dụng túi vải thay cho túi nilon, đi bộ hoặc đi xe đạp thay vì sử dụng phương tiện gây khí thải độc hại.'
            )}
          </AbsoluteFill>
        );
      })()}

      {/* =========================================================================
          SCENE 7: Frame 1886 -> 2167 (62.9s -> 72.2s)
          Prevention: Tránh hành vi tiêu cực, phá rừng, săn bắt, xả thải
          ========================================================================= */}
      {frame >= 1886 && frame < 2167 && (() => {
        const localFrame = frame - 1886;
        const prevSpring = spring({ frame: localFrame, fps, config: { damping: 14 } });

        return (
          <AbsoluteFill>
            {renderHeader('HÀNH VI CẦN NGĂN CHẶN')}

            <div style={{ position: 'absolute', top: 90, left: 0, right: 0, textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: '#B91C1C',
                  color: '#FFFFFF',
                  padding: '10px 36px',
                  borderRadius: 20,
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                }}
              >
                KIÊN QUYẾT NÓI "KHÔNG" VỚI HÀNH VI TIÊU CỰC
              </div>
            </div>

            <div style={{ position: 'absolute', left: 70, bottom: 110, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <MascotRobot size={260} glow />
              <div style={{ marginTop: -8, backgroundColor: '#B91C1C', color: '#FFFFFF', padding: '4px 16px', borderRadius: 9999, fontWeight: 800, fontSize: 13 }}>
                Kiên Quyết Bài Trừ ❌
              </div>
            </div>

            {/* Prohibition Cards */}
            <div
              style={{
                position: 'absolute',
                left: 360,
                right: 60,
                top: 175,
                bottom: 110,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: 24,
                border: '2px solid #EF4444',
                padding: '24px 32px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 20,
                alignItems: 'center',
                transform: `scale(${prevSpring})`,
              }}
            >
              <div style={{ backgroundColor: '#FEF2F2', borderRadius: 16, padding: '20px', border: '1.5px solid #FCA5A5', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>🚫🌲</div>
                <h4 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#991B1B' }}>Không Phá Cây Xanh</h4>
                <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>Bảo vệ nghiêm ngặt thảm thực vật và cảnh quan học đường</p>
              </div>

              <div style={{ backgroundColor: '#FEF2F2', borderRadius: 16, padding: '20px', border: '1.5px solid #FCA5A5', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>🚫🦌</div>
                <h4 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#991B1B' }}>Không Săn Bắt Động Vật</h4>
                <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>Chấm dứt săn bắn và buôn bán động vật hoang dã trái phép</p>
              </div>

              <div style={{ backgroundColor: '#FEF2F2', borderRadius: 16, padding: '20px', border: '1.5px solid #FCA5A5', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>🚫🚰</div>
                <h4 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#991B1B' }}>Không Xả Thải Trái Phép</h4>
                <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>Tuyệt đối không xả nước thải và hóa chất chưa qua xử lý</p>
              </div>
            </div>

            {renderSubtitle(
              'Đồng thời, chúng ta cần kiên quyết tránh các hành động tiêu cực như phá hoại cây xanh, săn bắt động vật hoang dã, và xả nước thải chưa qua xử lý ra môi trường tự nhiên.'
            )}
          </AbsoluteFill>
        );
      })()}

      {/* =========================================================================
          SCENE 8: Frame 2167 -> 2515 (72.2s -> 83.8s)
          Grand Outro: Chung tay xây dựng Smart Campus xanh - sạch - đẹp
          ========================================================================= */}
      {frame >= 2167 && frame < 2515 && (() => {
        const localFrame = frame - 2167;
        const bannerScale = spring({ frame: localFrame, fps, config: { damping: 14 } });
        const mascotBounce = spring({ frame: localFrame + 5, fps, config: { damping: 12, stiffness: 140 } });

        return (
          <AbsoluteFill>
            {renderHeader('THÔNG ĐIỆP CHUNG')}

            <div
              style={{
                position: 'absolute',
                left: 100,
                right: 100,
                top: 95,
                bottom: 110,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(16px)',
                borderRadius: 32,
                border: '3px solid #10B981',
                boxShadow: '0 20px 50px rgba(16, 185, 129, 0.25)',
                padding: '30px 48px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${bannerScale})`,
              }}
            >
              <div
                style={{
                  backgroundColor: '#D1FAE5',
                  color: '#065F46',
                  padding: '6px 20px',
                  borderRadius: 9999,
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: '0.04em',
                  marginBottom: 12,
                }}
              >
                HÀNH ĐỘNG HÔM NAY - TƯƠNG LAI NGÀY MAI
              </div>

              <h1
                style={{
                  margin: '0 0 14px',
                  fontSize: 32,
                  fontWeight: 900,
                  color: '#0F172A',
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                CHUNG TAY XÂY DỰNG <br />
                <span
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #0284C7 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  SMART CAMPUS XANH - SẠCH - ĐẸP
                </span>
              </h1>

              <div style={{ transform: `scale(${mascotBounce})`, marginBottom: 12 }}>
                <MascotRobot size={200} glow />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', color: '#166534', padding: '8px 20px', borderRadius: 9999, fontWeight: 700, fontSize: 14 }}>
                  🌿 Giảm Rác Thải
                </div>
                <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #93C5FD', color: '#1E40AF', padding: '8px 20px', borderRadius: 9999, fontWeight: 700, fontSize: 14 }}>
                  ⚡ Tiết Kiệm Năng Lượng
                </div>
                <div style={{ backgroundColor: '#FAF5FF', border: '1px solid #D8B4FE', color: '#6B21A8', padding: '8px 20px', borderRadius: 9999, fontWeight: 700, fontSize: 14 }}>
                  🚲 Giao Thông Xanh
                </div>
              </div>
            </div>

            {renderSubtitle(
              'Bảo vệ môi trường chính là bảo vệ cuộc sống của chính chúng ta hôm nay và mai sau. Mỗi người hãy bắt đầu từ những hành động nhỏ nhất để chung tay xây dựng một Smart Campus xanh, sạch, đẹp nhé!'
            )}
          </AbsoluteFill>
        );
      })()}
    </AbsoluteFill>
  );
};
