import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { MascotRobot } from './MascotRobot';

export const ExactProjectileIdenticalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Standard Header matching reference videos
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
        <span>ĐỘNG HỌC 2D</span>
      </div>
    </div>
  );

  // Subtitle Renderer matching exact clone glassmorphism card
  const renderSubtitle = (text: string) => (
    <div
      style={{
        position: 'absolute',
        bottom: 110,
        left: 60,
        right: 60,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(56, 189, 248, 0.35)',
        borderRadius: 24,
        padding: '24px 34px',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        zIndex: 90,
      }}
    >
      <p
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: '#FFFFFF',
          lineHeight: 1.45,
          margin: 0,
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          textShadow: '0 2px 8px rgba(0,0,0,0.7)',
        }}
      >
        {text}
      </p>
    </div>
  );

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: '#0A0F1D',
        color: '#FFFFFF',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Dynamic Background Glow */}
      <div
        style={{
          position: 'absolute',
          top: -200,
          left: '25%',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 200,
          right: -100,
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Grid Pattern */}
      <svg
        width="1080"
        height="1920"
        style={{ position: 'absolute', inset: 0, opacity: 0.12, pointerEvents: 'none' }}
      >
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#38BDF8" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="1080" height="1920" fill="url(#grid)" />
      </svg>

      {renderHeader()}

      {/* =========================================================================
          SCENE 1: Frame 0 -> 180 (0s -> 6.0s)
          Dynamic Hook: Airplane / Cliff Projectile + Mascot Curiosity
          ========================================================================= */}
      {frame >= 0 && frame < 180 && (() => {
        const mascotScale = spring({ frame, fps, config: { damping: 12, mass: 0.8, stiffness: 120 } });
        const mascotHover = Math.sin(frame / 7) * 14;
        const textY = interpolate(frame, [0, 25], [60, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const textOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const airplaneX = interpolate(frame, [0, 180], [100, 750]);
        const dropT = Math.max(0, (frame - 50) / 130);
        const cargoX = 400 + dropT * 350;
        const cargoY = 560 + dropT * dropT * 400;

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Title Section */}
            <div
              style={{
                position: 'absolute',
                top: 220,
                left: 60,
                right: 60,
                textAlign: 'center',
                transform: `translateY(${textY}px)`,
                opacity: textOpacity,
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  border: '1.5px solid rgba(56, 189, 248, 0.5)',
                  color: '#38BDF8',
                  padding: '8px 24px',
                  borderRadius: 9999,
                  fontSize: 22,
                  fontWeight: 800,
                  marginBottom: 16,
                  textTransform: 'uppercase',
                }}
              >
                CÂU HỎI VẬT LÝ HÔM NAY
              </div>
              <h1
                style={{
                  fontSize: 54,
                  fontWeight: 900,
                  lineHeight: 1.25,
                  margin: 0,
                  background: 'linear-gradient(135deg, #FFFFFF 0%, #38BDF8 60%, #F59E0B 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                CHUYỂN ĐỘNG NÉM NGANG
              </h1>
              <p style={{ color: '#94A3B8', fontSize: 26, marginTop: 12, fontWeight: 500 }}>
                Tại sao vật rơi theo đường cong Parabol chứ không bay thẳng?
              </p>
            </div>

            {/* Illustration Graphic */}
            <div
              style={{
                position: 'absolute',
                top: 480,
                left: 60,
                right: 60,
                height: 700,
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(12px)',
                borderRadius: 28,
                border: '1.5px solid rgba(56, 189, 248, 0.25)',
                overflow: 'hidden',
              }}
            >
              {/* Sky and Ground Level */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 60,
                  background: 'linear-gradient(to top, rgba(34, 197, 94, 0.3), transparent)',
                  borderTop: '2px dashed rgba(34, 197, 94, 0.6)',
                }}
              />
              <span style={{ position: 'absolute', bottom: 15, left: 30, color: '#4ADE80', fontSize: 20, fontWeight: 700 }}>
                MẶT ĐẤT (y = h)
              </span>

              {/* Parabolic Trajectory Trail */}
              <svg width="960" height="700" style={{ position: 'absolute', inset: 0 }}>
                {frame > 50 && (
                  <path
                    d={`M 400 180 Q ${400 + (dropT * 350) * 0.4} 180, ${cargoX - 60} ${cargoY - 380}`}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="4"
                    strokeDasharray="8 6"
                  />
                )}
              </svg>

              {/* Airplane */}
              <div
                style={{
                  position: 'absolute',
                  top: 150,
                  left: airplaneX,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    backgroundColor: '#1E293B',
                    border: '2px solid #38BDF8',
                    borderRadius: 16,
                    padding: '10px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)',
                  }}
                >
                  <span style={{ fontSize: 32 }}>✈️</span>
                  <div>
                    <div style={{ color: '#E2E8F0', fontSize: 18, fontWeight: 800 }}>MÁY BAY TIẾP TẾ</div>
                    <div style={{ color: '#38BDF8', fontSize: 16, fontWeight: 700 }}>v₀ = Hằng số (ngang)</div>
                  </div>
                </div>
                {/* Horizontal Velocity Arrow */}
                <div style={{ display: 'flex', alignItems: 'center', color: '#38BDF8' }}>
                  <div style={{ width: 60, height: 4, backgroundColor: '#38BDF8' }} />
                  <div style={{ width: 0, height: 0, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '12px solid #38BDF8' }} />
                  <span style={{ marginLeft: 6, fontWeight: 800, fontSize: 18 }}>v⃗₀</span>
                </div>
              </div>

              {/* Falling Cargo */}
              {frame > 50 && (
                <div
                  style={{
                    position: 'absolute',
                    top: cargoY - 380,
                    left: cargoX - 60,
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: '#F59E0B',
                    boxShadow: '0 0 25px #F59E0B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                  }}
                >
                  📦
                </div>
              )}
            </div>

            {/* Mascot in bottom corner */}
            <div
              style={{
                position: 'absolute',
                bottom: 270,
                right: 70,
                transform: `scale(${mascotScale}) translateY(${mascotHover}px)`,
                transformOrigin: 'bottom center',
              }}
            >
              <MascotRobot size={240} />
            </div>

            {renderSubtitle('Tại sao khi ném một vật theo phương ngang, vật lại rơi theo quỹ đạo cong parabol chứ không bay thẳng?')}
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 2: Frame 180 -> 480 (6.0s -> 16.0s)
          Galileo's Secret: Decomposition into Ox and Oy
          ========================================================================= */}
      {frame >= 180 && frame < 480 && (() => {
        const localFrame = frame - 180;
        const cardSlide = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 100 } });

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Header Title */}
            <div style={{ position: 'absolute', top: 200, left: 60, right: 60, textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  border: '1.5px solid rgba(245, 158, 11, 0.5)',
                  color: '#F59E0B',
                  padding: '6px 20px',
                  borderRadius: 9999,
                  fontSize: 20,
                  fontWeight: 800,
                  marginBottom: 12,
                }}
              >
                NGUYÊN LÝ ĐỘC LẬP GALILEO
              </div>
              <h2 style={{ fontSize: 44, fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                PHÂN TÍCH HAI CHUYỂN ĐỘNG THÀNH PHẦN
              </h2>
            </div>

            {/* Diagram Oxy Space */}
            <div
              style={{
                position: 'absolute',
                top: 360,
                left: 60,
                right: 60,
                height: 520,
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(16px)',
                borderRadius: 24,
                border: '1.5px solid rgba(56, 189, 248, 0.3)',
                padding: 30,
              }}
            >
              <svg width="900" height="460" style={{ position: 'absolute', inset: 0 }}>
                {/* Ox Axis */}
                <line x1="120" y1="80" x2="800" y2="80" stroke="#38BDF8" strokeWidth="4" markerEnd="url(#arrowCyan)" />
                <text x="820" y="88" fill="#38BDF8" fontSize="26" fontWeight="800">Ox (Ngang)</text>

                {/* Oy Axis */}
                <line x1="120" y1="80" x2="120" y2="400" stroke="#F59E0B" strokeWidth="4" markerEnd="url(#arrowAmber)" />
                <text x="100" y="440" fill="#F59E0B" fontSize="26" fontWeight="800">Oy (Dọc)</text>

                {/* Origin O */}
                <circle cx="120" cy="80" r="10" fill="#FFFFFF" />
                <text x="90" y="70" fill="#FFFFFF" fontSize="28" fontWeight="900">O</text>

                {/* Animated Vectors at point P */}
                {(() => {
                  const t = (localFrame % 150) / 150;
                  const px = 120 + t * 500;
                  const py = 80 + t * t * 260;
                  return (
                    <g>
                      {/* Trajectory dotted curve */}
                      <path d={`M 120 80 Q 370 80 620 340`} fill="none" stroke="#94A3B8" strokeWidth="3" strokeDasharray="6 6" />
                      
                      {/* Current Point */}
                      <circle cx={px} cy={py} r="12" fill="#E2E8F0" />

                      {/* vx arrow */}
                      <line x1={px} y1={py} x2={px + 120} y2={py} stroke="#38BDF8" strokeWidth="4" />
                      <polygon points={`${px + 130},${py} ${px + 120},${py - 6} ${px + 120},${py + 6}`} fill="#38BDF8" />
                      <text x={px + 135} y={py + 6} fill="#38BDF8" fontSize="20" fontWeight="800">v⃗ₓ = v⃗₀</text>

                      {/* vy arrow */}
                      <line x1={px} y1={py} x2={px} y2={py + 60 + t * 90} stroke="#F59E0B" strokeWidth="4" />
                      <polygon points={`${px},${py + 70 + t * 90} ${px - 6},${py + 60 + t * 90} ${px + 6},${py + 60 + t * 90}`} fill="#F59E0B" />
                      <text x={px + 12} y={py + 70 + t * 90} fill="#F59E0B" fontSize="20" fontWeight="800">v⃗ᵧ = g·t</text>
                    </g>
                  );
                })()}

                <defs>
                  <marker id="arrowCyan" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L9,3 z" fill="#38BDF8" />
                  </marker>
                  <marker id="arrowAmber" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L9,3 z" fill="#F59E0B" />
                  </marker>
                </defs>
              </svg>
            </div>

            {/* Split Cards: Ox vs Oy */}
            <div
              style={{
                position: 'absolute',
                top: 920,
                left: 60,
                right: 60,
                display: 'flex',
                gap: 24,
                transform: `scale(${cardSlide})`,
              }}
            >
              {/* Ox Card */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(56, 189, 248, 0.08)',
                  border: '2px solid rgba(56, 189, 248, 0.4)',
                  borderRadius: 24,
                  padding: 26,
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
                }}
              >
                <div style={{ color: '#38BDF8', fontSize: 24, fontWeight: 800, marginBottom: 10 }}>
                  TRỤC NGANG (Ox)
                </div>
                <div style={{ color: '#FFFFFF', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
                  Chuyển động thẳng đều
                </div>
                <div style={{ color: '#94A3B8', fontSize: 20, lineHeight: 1.5 }}>
                  • Không có lực cản tác dụng: <span style={{ color: '#38BDF8', fontWeight: 800 }}>aₓ = 0</span><br />
                  • Vận tốc ngang: <span style={{ color: '#38BDF8', fontWeight: 800 }}>vₓ = v₀</span> (không đổi)<br />
                  • Quãng đường: <span style={{ color: '#38BDF8', fontWeight: 800 }}>x = v₀ · t</span>
                </div>
              </div>

              {/* Oy Card */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '2px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: 24,
                  padding: 26,
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
                }}
              >
                <div style={{ color: '#F59E0B', fontSize: 24, fontWeight: 800, marginBottom: 10 }}>
                  TRỤC THẲNG ĐỨNG (Oy)
                </div>
                <div style={{ color: '#FFFFFF', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
                  Rơi tự do
                </div>
                <div style={{ color: '#94A3B8', fontSize: 20, lineHeight: 1.5 }}>
                  • Trọng lực kéo xuống: <span style={{ color: '#F59E0B', fontWeight: 800 }}>aᵧ = g</span><br />
                  • Vận tốc rơi: <span style={{ color: '#F59E0B', fontWeight: 800 }}>vᵧ = g · t</span><br />
                  • Tọa độ rơi: <span style={{ color: '#F59E0B', fontWeight: 800 }}>y = ½ · g · t²</span>
                </div>
              </div>
            </div>

            {renderSubtitle('Bí mật của Galileo: Chuyển động ném ngang được phân tích thành hai chuyển động hoàn toàn độc lập trên hai trục Ox và Oy.')}
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 3: Frame 480 -> 840 (16.0s -> 28.0s)
          Simultaneous Drop Experiment: Launch vs Freefall
          ========================================================================= */}
      {frame >= 480 && frame < 840 && (() => {
        const localFrame = frame - 480;
        // Cycle of drop: 300 frames per drop
        const dropCycle = (localFrame % 240) / 240;
        const ballAY = 350 + dropCycle * dropCycle * 650;
        const ballAX = 260 + dropCycle * 540;
        const ballBY = 350 + dropCycle * dropCycle * 650;
        const ballBX = 180;
        const timerSeconds = (dropCycle * 2.0).toFixed(2);

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Header Title */}
            <div style={{ position: 'absolute', top: 200, left: 60, right: 60, textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  border: '1.5px solid rgba(34, 197, 94, 0.5)',
                  color: '#4ADE80',
                  padding: '6px 20px',
                  borderRadius: 9999,
                  fontSize: 20,
                  fontWeight: 800,
                  marginBottom: 12,
                }}
              >
                THÍ NGHIỆM ĐỒNG THỜI KỲ DIỆU
              </div>
              <h2 style={{ fontSize: 44, fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                NÉM NGANG VÀ RƠI TỰ DO CHẠM ĐẤT CÙNG LÚC!
              </h2>
            </div>

            {/* Experiment Canvas */}
            <div
              style={{
                position: 'absolute',
                top: 360,
                left: 60,
                right: 60,
                height: 850,
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(16px)',
                borderRadius: 24,
                border: '1.5px solid rgba(34, 197, 94, 0.3)',
                overflow: 'hidden',
              }}
            >
              {/* Cliff Platform */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 220,
                  height: 350,
                  backgroundColor: '#1E293B',
                  borderRight: '3px solid #475569',
                  borderBottom: '3px solid #475569',
                }}
              >
                <div style={{ padding: 20, color: '#94A3B8', fontSize: 18, fontWeight: 700 }}>
                  ĐỘ CAO h
                </div>
              </div>

              {/* Ground level */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 80,
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  borderTop: '3px solid #22C55E',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 40px',
                }}
              >
                <span style={{ color: '#4ADE80', fontSize: 24, fontWeight: 800 }}>MẶT ĐẤT</span>
                {dropCycle > 0.95 && (
                  <span
                    style={{
                      color: '#FBBF24',
                      fontSize: 26,
                      fontWeight: 900,
                      backgroundColor: 'rgba(245, 158, 11, 0.25)',
                      padding: '6px 20px',
                      borderRadius: 9999,
                      border: '1.5px solid #F59E0B',
                    }}
                  >
                    ⚡ CHẠM ĐẤT CÙNG MỘT THỜI ĐIỂM!
                  </span>
                )}
              </div>

              {/* Horizontal Sync Lines */}
              <svg width="960" height="850" style={{ position: 'absolute', inset: 0 }}>
                {/* Horizontal connection line between the two balls */}
                <line
                  x1={ballBX}
                  y1={ballBY}
                  x2={ballAX}
                  y2={ballAY}
                  stroke="#38BDF8"
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                />
                {/* Trajectory of Ball A */}
                <path
                  d="M 220 350 Q 500 350 780 1000"
                  fill="none"
                  stroke="rgba(245, 158, 11, 0.35)"
                  strokeWidth="3"
                  strokeDasharray="6 6"
                />
              </svg>

              {/* Ball B (Free fall - Amber) */}
              <div
                style={{
                  position: 'absolute',
                  top: ballBY - 20,
                  left: ballBX - 20,
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: '#38BDF8',
                  boxShadow: '0 0 20px #38BDF8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 16,
                  color: '#000',
                }}
              >
                B
              </div>

              {/* Ball A (Horizontal throw - Orange) */}
              <div
                style={{
                  position: 'absolute',
                  top: ballAY - 20,
                  left: ballAX - 20,
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: '#F59E0B',
                  boxShadow: '0 0 25px #F59E0B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 16,
                  color: '#000',
                }}
              >
                A
              </div>

              {/* Timer HUD */}
              <div
                style={{
                  position: 'absolute',
                  top: 30,
                  right: 40,
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  border: '2px solid #38BDF8',
                  borderRadius: 16,
                  padding: '12px 24px',
                  textAlign: 'center',
                }}
              >
                <div style={{ color: '#94A3B8', fontSize: 16, fontWeight: 700 }}>ĐỒNG HỒ ĐO THỜI GIAN</div>
                <div style={{ color: '#38BDF8', fontSize: 36, fontWeight: 900, fontFamily: 'monospace' }}>
                  {timerSeconds} s
                </div>
              </div>

              {/* Legend */}
              <div
                style={{
                  position: 'absolute',
                  top: 150,
                  right: 40,
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 16,
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                  <span style={{ fontSize: 18, color: '#E2E8F0', fontWeight: 600 }}>Bi A: Ném ngang (v₀)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: '#38BDF8' }} />
                  <span style={{ fontSize: 18, color: '#E2E8F0', fontWeight: 600 }}>Bi B: Thả rơi tự do</span>
                </div>
              </div>
            </div>

            {renderSubtitle('Thí nghiệm đồng thời: Một vật ném ngang và một vật thả rơi tự do từ cùng độ cao sẽ chạm đất cùng một thời điểm.')}
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 4: Frame 840 -> 1260 (28.0s -> 42.0s)
          Mathematical Derivation: Parabolic Trajectory
          ========================================================================= */}
      {frame >= 840 && frame < 1260 && (() => {
        const localFrame = frame - 840;
        const cardScale = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 110 } });
        const drawProgress = Math.min(1, localFrame / 220);

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Header Title */}
            <div style={{ position: 'absolute', top: 200, left: 60, right: 60, textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: 'rgba(168, 85, 247, 0.15)',
                  border: '1.5px solid rgba(168, 85, 247, 0.5)',
                  color: '#C084FC',
                  padding: '6px 20px',
                  borderRadius: 9999,
                  fontSize: 20,
                  fontWeight: 800,
                  marginBottom: 12,
                }}
              >
                CHỨNG MINH TOÁN HỌC CHUẨN XÁC
              </div>
              <h2 style={{ fontSize: 44, fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                PHƯƠNG TRÌNH QUỸ ĐẠO PARABOL
              </h2>
            </div>

            {/* Formula Breakdown Cards */}
            <div
              style={{
                position: 'absolute',
                top: 350,
                left: 60,
                right: 60,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                transform: `scale(${cardScale})`,
              }}
            >
              {/* Step 1 & 2 */}
              <div style={{ display: 'flex', gap: 20 }}>
                <div
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(56, 189, 248, 0.08)',
                    border: '1.5px solid rgba(56, 189, 248, 0.4)',
                    borderRadius: 20,
                    padding: 22,
                  }}
                >
                  <div style={{ color: '#38BDF8', fontSize: 18, fontWeight: 800 }}>BƯỚC 1: TRỤC NGANG</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#FFFFFF', marginTop: 6 }}>
                    x = v₀ · t &nbsp;⟹&nbsp; <span style={{ color: '#38BDF8' }}>t = x / v₀</span>
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    border: '1.5px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: 20,
                    padding: 22,
                  }}
                >
                  <div style={{ color: '#F59E0B', fontSize: 18, fontWeight: 800 }}>BƯỚC 2: TRỤC DỌC</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#FFFFFF', marginTop: 6 }}>
                    y = ½ · g · t²
                  </div>
                </div>
              </div>

              {/* Master Formula Box */}
              <div
                style={{
                  backgroundColor: 'rgba(168, 85, 247, 0.12)',
                  border: '2.5px solid #A855F7',
                  borderRadius: 24,
                  padding: '24px 30px',
                  textAlign: 'center',
                  boxShadow: '0 0 35px rgba(168, 85, 247, 0.3)',
                }}
              >
                <div style={{ color: '#E9D5FF', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                  THAY t VÀO BIỂU THỨC y (PHƯƠNG TRÌNH QUỸ ĐẠO)
                </div>
                <div
                  style={{
                    fontSize: 48,
                    fontWeight: 900,
                    color: '#FBBF24',
                    letterSpacing: '0.04em',
                    textShadow: '0 0 20px rgba(251, 191, 36, 0.5)',
                  }}
                >
                  y = (g / 2v₀²) · x²
                </div>
                <div style={{ color: '#C084FC', fontSize: 22, fontWeight: 700, marginTop: 8 }}>
                  Dạng chuẩn Parabol chính tắc (y = a·x² với a &gt; 0)
                </div>
              </div>
            </div>

            {/* Parabola Graph Visual */}
            <div
              style={{
                position: 'absolute',
                top: 760,
                left: 60,
                right: 60,
                height: 460,
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(16px)',
                borderRadius: 24,
                border: '1.5px solid rgba(168, 85, 247, 0.3)',
              }}
            >
              <svg width="960" height="460" style={{ position: 'absolute', inset: 0 }}>
                {/* Axes */}
                <line x1="80" y1="60" x2="880" y2="60" stroke="#94A3B8" strokeWidth="3" markerEnd="url(#arrowCyan)" />
                <text x="900" y="68" fill="#38BDF8" fontSize="22" fontWeight="800">x</text>

                <line x1="80" y1="60" x2="80" y2="400" stroke="#94A3B8" strokeWidth="3" markerEnd="url(#arrowAmber)" />
                <text x="70" y="430" fill="#F59E0B" fontSize="22" fontWeight="800">y</text>

                {/* Parabola Curve Drawn Progressively */}
                {(() => {
                  const points: string[] = [];
                  const maxSteps = 100;
                  const currentSteps = Math.floor(drawProgress * maxSteps);
                  for (let i = 0; i <= currentSteps; i++) {
                    const progress = i / maxSteps;
                    const x = 80 + progress * 760;
                    const y = 60 + progress * progress * 320;
                    points.push(`${x},${y}`);
                  }
                  const pathStr = points.length > 1 ? `M ${points.join(' L ')}` : '';

                  const curX = 80 + drawProgress * 760;
                  const curY = 60 + drawProgress * drawProgress * 320;

                  return (
                    <g>
                      <path d={pathStr} fill="none" stroke="#F59E0B" strokeWidth="5" />
                      {/* Current Point and Velocity Tangent */}
                      <circle cx={curX} cy={curY} r="10" fill="#FFFFFF" />
                      <line x1={curX} y1={curY} x2={curX + 90} y2={curY + drawProgress * 140} stroke="#22C55E" strokeWidth="4" />
                      <polygon
                        points={`${curX + 100},${curY + drawProgress * 140} ${curX + 88},${curY + drawProgress * 140 - 6} ${curX + 88},${curY + drawProgress * 140 + 6}`}
                        fill="#22C55E"
                      />
                      <text x={curX + 105} y={curY + drawProgress * 140 + 6} fill="#22C55E" fontSize="20" fontWeight="800">
                        v⃗ (Tiếp tuyến)
                      </text>
                    </g>
                  );
                })()}
              </svg>
            </div>

            {renderSubtitle('Từ phương trình tọa độ, ta rút ra phương trình quỹ đạo: y bằng g chia hai v không bình phương nhân x bình phương, chính là đường cong parabol.')}
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 5: Frame 1260 -> 1560 (42.0s -> 52.0s)
          Range & Real-world Application
          ========================================================================= */}
      {frame >= 1260 && frame < 1560 && (() => {
        const localFrame = frame - 1260;
        const cardPop = spring({ frame: localFrame, fps, config: { damping: 13, stiffness: 110 } });

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Header Title */}
            <div style={{ position: 'absolute', top: 200, left: 60, right: 60, textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  border: '1.5px solid rgba(56, 189, 248, 0.5)',
                  color: '#38BDF8',
                  padding: '6px 20px',
                  borderRadius: 9999,
                  fontSize: 20,
                  fontWeight: 800,
                  marginBottom: 12,
                }}
              >
                CÔNG THỨC & ỨNG DỤNG THỰC TẾ
              </div>
              <h2 style={{ fontSize: 44, fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                TẦM NÉM XA (L) VÀ THỜI GIAN BAY (t)
              </h2>
            </div>

            {/* Range Formula Display */}
            <div
              style={{
                position: 'absolute',
                top: 350,
                left: 60,
                right: 60,
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                border: '2px solid rgba(56, 189, 248, 0.4)',
                borderRadius: 24,
                padding: '28px 36px',
                transform: `scale(${cardPop})`,
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 30 }}>
                {/* Time formula */}
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#94A3B8', fontSize: 20, fontWeight: 700 }}>THỜI GIAN BAY</div>
                  <div style={{ color: '#38BDF8', fontSize: 36, fontWeight: 900, marginTop: 8 }}>
                    t = √(2h / g)
                  </div>
                  <div style={{ color: '#E2E8F0', fontSize: 18, marginTop: 6 }}>
                    Chỉ phụ thuộc độ cao h, không phụ thuộc v₀!
                  </div>
                </div>

                <div style={{ width: 2, backgroundColor: 'rgba(255,255,255,0.1)' }} />

                {/* Range formula */}
                <div style={{ flex: 1.2 }}>
                  <div style={{ color: '#F59E0B', fontSize: 20, fontWeight: 700 }}>TẦM NÉM XA CỰC ĐẠI (L)</div>
                  <div style={{ color: '#FBBF24', fontSize: 36, fontWeight: 900, marginTop: 8 }}>
                    L = v₀ · √(2h / g)
                  </div>
                  <div style={{ color: '#E2E8F0', fontSize: 18, marginTop: 6 }}>
                    Tỉ lệ thuận với vận tốc ném ban đầu v₀!
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Real-world Map / Relief Plane Drop */}
            <div
              style={{
                position: 'absolute',
                top: 610,
                left: 60,
                right: 60,
                height: 600,
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(16px)',
                borderRadius: 24,
                border: '1.5px solid rgba(56, 189, 248, 0.25)',
                overflow: 'hidden',
                padding: 30,
              }}
            >
              <div style={{ color: '#38BDF8', fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
                ỨNG DỤNG: THẢ CỨU TRỢ CHÍNH XÁC VÀO ĐÍCH
              </div>
              <div style={{ color: '#94A3B8', fontSize: 20, lineHeight: 1.5 }}>
                Do kiện hàng mang quán tính vận tốc của máy bay, phi công phải thả hàng{' '}
                <span style={{ color: '#F59E0B', fontWeight: 800 }}>trước khi bay ngang qua đích</span> một khoảng đúng bằng tầm xa{' '}
                <span style={{ color: '#38BDF8', fontWeight: 800 }}>L</span>!
              </div>

              {/* Graphical radar target */}
              <div
                style={{
                  marginTop: 40,
                  height: 380,
                  position: 'relative',
                  border: '1.5px dashed rgba(56, 189, 248, 0.3)',
                  borderRadius: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {/* Target concentric circles */}
                <div
                  style={{
                    position: 'absolute',
                    right: 140,
                    bottom: 40,
                    width: 160,
                    height: 160,
                    borderRadius: '50%',
                    border: '3px solid #EF4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ width: 80, height: 80, borderRadius: '50%', border: '2px solid #EF4444' }} />
                  <span style={{ position: 'absolute', bottom: -35, color: '#EF4444', fontWeight: 800, fontSize: 18 }}>
                    🎯 MỤC TIÊU ĐÍCH
                  </span>
                </div>

                {/* Trajectory curve to target */}
                <svg width="840" height="340" style={{ position: 'absolute', inset: 0 }}>
                  <path d="M 120 60 Q 400 60 700 240" fill="none" stroke="#38BDF8" strokeWidth="4" strokeDasharray="8 6" />
                  <line x1="120" y1="280" x2="700" y2="280" stroke="#F59E0B" strokeWidth="3" markerEnd="url(#arrowAmber)" />
                  <text x="380" y="270" fill="#FBBF24" fontSize="24" fontWeight="800">Khoảng cách ném L</text>
                </svg>

                {/* Drop Point indicator */}
                <div style={{ position: 'absolute', top: 30, left: 90, textAlign: 'center' }}>
                  <span style={{ fontSize: 32 }}>📦</span>
                  <div style={{ color: '#38BDF8', fontSize: 16, fontWeight: 700 }}>Điểm cắt hàng</div>
                </div>
              </div>
            </div>

            {renderSubtitle('Tầm ném xa L bằng v không nhân căn bậc hai của hai h chia g. Muốn ném xa hơn, ta cần tăng tốc độ ban đầu hoặc nâng cao vị trí ném.')}
          </div>
        );
      })()}

      {/* =========================================================================
          SCENE 6: Frame 1560 -> 1800 (52.0s -> 60.0s)
          Summary & Brain Challenge + Mascot Goodbye
          ========================================================================= */}
      {frame >= 1560 && frame < 1800 && (() => {
        const localFrame = frame - 1560;
        const mascotScale = spring({ frame: localFrame, fps, config: { damping: 12, stiffness: 110 } });
        const mascotHover = Math.sin(localFrame / 6) * 12;

        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Header */}
            <div style={{ position: 'absolute', top: 200, left: 60, right: 60, textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  border: '1.5px solid rgba(34, 197, 94, 0.5)',
                  color: '#4ADE80',
                  padding: '6px 20px',
                  borderRadius: 9999,
                  fontSize: 20,
                  fontWeight: 800,
                  marginBottom: 12,
                }}
              >
                GHI NHỚ VÀ THỬ THÁCH
              </div>
              <h2 style={{ fontSize: 46, fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                3 NGUYÊN TẮC CỐT LÕI
              </h2>
            </div>

            {/* 3 Pillar Summary Cards */}
            <div
              style={{
                position: 'absolute',
                top: 340,
                left: 60,
                right: 60,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div
                style={{
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  border: '1.5px solid rgba(56, 189, 248, 0.4)',
                  borderRadius: 20,
                  padding: '18px 26px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#38BDF8', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 24 }}>1</div>
                <div>
                  <div style={{ color: '#38BDF8', fontSize: 22, fontWeight: 800 }}>Phương ngang (Ox)</div>
                  <div style={{ color: '#E2E8F0', fontSize: 18 }}>Chuyển động thẳng đều: vₓ = v₀ không đổi, x = v₀ · t</div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  border: '1.5px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: 20,
                  padding: '18px 26px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#F59E0B', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 24 }}>2</div>
                <div>
                  <div style={{ color: '#F59E0B', fontSize: 22, fontWeight: 800 }}>Phương thẳng đứng (Oy)</div>
                  <div style={{ color: '#E2E8F0', fontSize: 18 }}>Rơi tự do: aᵧ = g, vᵧ = gt, y = ½ · g · t²</div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(168, 85, 247, 0.1)',
                  border: '1.5px solid rgba(168, 85, 247, 0.4)',
                  borderRadius: 20,
                  padding: '18px 26px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#A855F7', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 24 }}>3</div>
                <div>
                  <div style={{ color: '#C084FC', fontSize: 22, fontWeight: 800 }}>Quỹ đạo chuyển động</div>
                  <div style={{ color: '#E2E8F0', fontSize: 18 }}>Là một nhánh Parabol cong úp: y = (g / 2v₀²) · x²</div>
                </div>
              </div>
            </div>

            {/* Interactive Question Card */}
            <div
              style={{
                position: 'absolute',
                top: 720,
                left: 60,
                right: 60,
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '2px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 24,
                padding: '24px 30px',
              }}
            >
              <div style={{ color: '#F87171', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
                ❓ THỬ THÁCH TRÍ TUỆ
              </div>
              <div style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 700, lineHeight: 1.4 }}>
                Nếu bắn một viên đạn theo phương nằm ngang và cùng lúc thả rơi một vỏ đạn từ cùng độ cao, cái nào sẽ chạm đất trước?
              </div>
              <div style={{ color: '#94A3B8', fontSize: 18, marginTop: 8 }}>
                👉 Hãy bình luận câu trả lời của bạn bên dưới nhé!
              </div>
            </div>

            {/* Mascot in bottom center */}
            <div
              style={{
                position: 'absolute',
                bottom: 270,
                left: '50%',
                transform: `translateX(-50%) scale(${mascotScale}) translateY(${mascotHover}px)`,
                transformOrigin: 'bottom center',
              }}
            >
              <MascotRobot size={240} />
            </div>

            {renderSubtitle('Tóm lại: ngang thẳng đều, dọc rơi tự do, quỹ đạo parabol! Bạn hãy thử giải: Bắn đạn và thả vỏ đạn cùng lúc, cái nào chạm đất trước?')}
          </div>
        );
      })()}
    </div>
  );
};

