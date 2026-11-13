import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { MascotRobot } from './MascotRobot';

export const ExactPhoneCallIdenticalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Top persistent header
  const renderHeader = () => (
    <div
      style={{
        position: 'absolute',
        top: 80,
        left: 60,
        right: 60,
        display: 'flex',
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
    </div>
  );

  // Persistent 5-stage transformation chain at the bottom of steps 1-6
  const renderBottomChain = (activeStage: 'amthanh_in' | 'dien_in' | 'song' | 'dien_out' | 'amthanh_out') => {
    const stages = [
      { id: 'amthanh_in', label: 'Âm thanh' },
      { id: 'dien_in', label: 'Điện' },
      { id: 'song', label: 'Sóng' },
      { id: 'dien_out', label: 'Điện' },
      { id: 'amthanh_out', label: 'Âm thanh' },
    ];

    return (
      <div
        style={{
          position: 'absolute',
          bottom: 460,
          left: 40,
          right: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          zIndex: 80,
        }}
      >
        {stages.map((st, idx) => {
          let bgColor = 'rgba(15, 23, 42, 0.7)';
          let textColor = '#E2E8F0';
          let borderColor = 'rgba(148, 163, 184, 0.4)';
          let boxShadow = 'none';

          if (activeStage === 'amthanh_in') {
            if (st.id === 'amthanh_in') {
              bgColor = '#FFFFFF';
              textColor = '#0F172A';
              borderColor = '#FFFFFF';
              boxShadow = '0 0 16px rgba(255, 255, 255, 0.6)';
            } else if (st.id === 'dien_in') {
              bgColor = '#38BDF8';
              textColor = '#0F172A';
              borderColor = '#38BDF8';
              boxShadow = '0 0 16px rgba(56, 189, 248, 0.5)';
            }
          } else if (activeStage === 'dien_in') {
            if (st.id === 'dien_in') {
              bgColor = '#38BDF8';
              textColor = '#0F172A';
              borderColor = '#38BDF8';
              boxShadow = '0 0 16px rgba(56, 189, 248, 0.5)';
            }
          } else if (activeStage === 'song') {
            if (st.id === 'song') {
              bgColor = '#2DD4BF';
              textColor = '#0F172A';
              borderColor = '#2DD4BF';
              boxShadow = '0 0 16px rgba(45, 212, 191, 0.5)';
            }
          } else if (activeStage === 'dien_out') {
            if (st.id === 'dien_out') {
              bgColor = '#38BDF8';
              textColor = '#0F172A';
              borderColor = '#38BDF8';
              boxShadow = '0 0 16px rgba(56, 189, 248, 0.5)';
            }
          } else if (activeStage === 'amthanh_out') {
            if (st.id === 'amthanh_out') {
              bgColor = '#FFFFFF';
              textColor = '#0F172A';
              borderColor = '#FFFFFF';
              boxShadow = '0 0 16px rgba(255, 255, 255, 0.6)';
            }
          }

          return (
            <React.Fragment key={st.id + idx}>
              <div
                style={{
                  padding: '12px 28px',
                  borderRadius: 9999,
                  fontSize: 28,
                  fontWeight: 700,
                  backgroundColor: bgColor,
                  color: textColor,
                  border: `2px solid ${borderColor}`,
                  boxShadow,
                  transition: 'all 0.2s ease',
                }}
              >
                {st.label}
              </div>
              {idx < stages.length - 1 && (
                <div style={{ color: '#64748B', fontSize: 24, fontWeight: 800 }}>→</div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // Step indicator: "BƯỚC X/6" with 6 indicator dots
  const renderStepHeader = (currentStep: number, title: string) => {
    return (
      <div style={{ position: 'absolute', top: 220, left: 70, right: 70, zIndex: 90 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14 }}>
          <span style={{ color: '#F59E0B', fontSize: 38, fontWeight: 800 }}>
            BƯỚC {currentStep}/6
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  backgroundColor: i <= currentStep ? '#F59E0B' : 'rgba(148, 163, 184, 0.25)',
                  boxShadow: i === currentStep ? '0 0 10px #F59E0B' : 'none',
                }}
              />
            ))}
          </div>
        </div>
        <div style={{ color: '#FFFFFF', fontSize: 72, fontWeight: 900, letterSpacing: '-0.02em' }}>
          {title}
        </div>
      </div>
    );
  };

  // Vector Smartphone
  const renderPhone = (options: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    label?: string;
    antennaActive?: boolean;
    antennaReceive?: boolean;
    antennaSide?: 'left' | 'right';
    micActive?: boolean;
  }) => {
    const w = options.width || 180;
    const h = options.height || 340;
    const x = options.x;
    const y = options.y;
    const side = options.antennaSide || (options.antennaReceive ? 'left' : 'right');

    return (
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: w,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 40,
        }}
      >
        {/* Antenna rod with electrons if antennaActive or antennaReceive */}
        {(options.antennaActive || options.antennaReceive) && (
          <div
            style={{
              position: 'absolute',
              top: -75,
              ...(side === 'left' ? { left: 24 } : { right: 24 }),
              width: 8,
              height: 80,
              backgroundColor: '#94A3B8',
              borderRadius: 4,
            }}
          >
            {[0, 1, 2].map((idx) => {
              const osc = Math.sin((frame * 0.45) + idx * 1.5) * 18;
              return (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    top: 18 + idx * 18 + osc,
                    ...(side === 'left' ? { left: 10 } : { left: -14 }),
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: '#F59E0B',
                    boxShadow: '0 0 10px #F59E0B',
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Phone Body */}
        <div
          style={{
            width: w,
            height: h,
            backgroundColor: '#1E293B',
            borderRadius: 36,
            border: '5px solid #64748B',
            boxShadow: '0 18px 40px rgba(0, 0, 0, 0.6)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '24px 14px',
            boxSizing: 'border-box',
          }}
        >
          {/* Top speaker notch */}
          <div
            style={{
              width: 48,
              height: 6,
              borderRadius: 4,
              backgroundColor: '#475569',
              marginBottom: 16,
            }}
          />

          {/* Screen */}
          <div
            style={{
              width: '100%',
              flex: 1,
              backgroundColor: '#0F2644',
              borderRadius: 22,
              border: '2px solid rgba(56, 189, 248, 0.3)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Screen shine */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 60%)',
              }}
            />
          </div>

          {/* Bottom home dot */}
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: '#475569',
              marginTop: 14,
            }}
          />
        </div>

        {/* Label below phone */}
        {options.label && (
          <div
            style={{
              marginTop: 18,
              fontSize: 34,
              fontWeight: 800,
              color: '#F8FAFC',
              letterSpacing: '0.02em',
              textAlign: 'center',
            }}
          >
            {options.label}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: '#0B1324',
        color: '#FFFFFF',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle background cosmic grid and glowing radial gradients */}
      <div
        style={{
          position: 'absolute',
          top: -200,
          left: -200,
          width: 900,
          height: 900,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -200,
          right: -200,
          width: 900,
          height: 900,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* ========================================================
          SCENE 1: HOOK - VÌ SAO ĐIỆN THOẠI NGHE GỌI ĐƯỢC (0 - 200)
          ======================================================== */}
      {frame >= 0 && frame < 200 && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {renderHeader()}

          <div style={{ position: 'absolute', top: 220, left: 70, width: 680, zIndex: 90 }}>
            <div style={{ color: '#38BDF8', fontSize: 44, fontWeight: 800, marginBottom: 12 }}>
              VÌ SAO...?
            </div>
            <div style={{ color: '#FFFFFF', fontSize: 64, fontWeight: 900, lineHeight: 1.25 }}>
              Vì sao điện thoại <span style={{ color: '#F59E0B' }}>nghe gọi</span> được với nhau?
            </div>
          </div>

          {/* Mascot Robot Icon in Hook Frame */}
          <div
            style={{
              position: 'absolute',
              top: 200,
              right: 70,
              transform: `translateY(${Math.sin(frame / 6) * 10}px)`,
              zIndex: 95,
            }}
          >
            <MascotRobot size={200} />
          </div>

          {/* Two Phones: Ha Noi (top-left) & TP. Ho Chi Minh (bottom-right) */}
          {renderPhone({
            x: 170,
            y: 580,
            width: 200,
            height: 380,
            label: 'Hà Nội',
          })}

          {renderPhone({
            x: 710,
            y: 880,
            width: 200,
            height: 380,
            label: 'TP. Hồ Chí Minh',
          })}

          {/* Dashed line and Question mark */}
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 35,
            }}
          >
            <line
              x1={370}
              y1={760}
              x2={710}
              y2={1020}
              stroke="#64748B"
              strokeWidth={5}
              strokeDasharray="16 14"
            />
          </svg>

          {/* Bouncing animated question mark */}
          <div
            style={{
              position: 'absolute',
              left: 510,
              top: 830,
              transform: `translate(-50%, -50%) scale(${1 + Math.sin(frame / 6) * 0.12})`,
              fontSize: 100,
              fontWeight: 900,
              color: '#F59E0B',
              textShadow: '0 0 25px rgba(245, 158, 11, 0.5)',
              zIndex: 45,
            }}
          >
            ?
          </div>

          {/* Subtitle */}
          <div
            style={{
              position: 'absolute',
              bottom: 460,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: 38,
              fontWeight: 800,
              color: '#CBD5E1',
            }}
          >
            cách nhau hơn 1 000 km
          </div>
        </div>
      )}

      {/* ========================================================
          SCENE 2: CHUỖI BIẾN ĐỔI (200 - 440)
          ======================================================== */}
      {frame >= 200 && frame < 440 && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {renderHeader()}

          <div style={{ position: 'absolute', top: 220, left: 70, right: 70, zIndex: 90 }}>
            <div style={{ color: '#94A3B8', fontSize: 48, fontWeight: 700, marginBottom: 12 }}>
              Bí mật là
            </div>
            <div style={{ color: '#F59E0B', fontSize: 68, fontWeight: 900, lineHeight: 1.2 }}>
              một chuỗi biến đổi
            </div>
          </div>

          {/* Vertical Stack of transformation pills */}
          <div
            style={{
              position: 'absolute',
              top: 480,
              left: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              zIndex: 80,
            }}
          >
            {[
              { label: 'Âm thanh', color: '#F8FAFC', border: 'rgba(255, 255, 255, 0.7)' },
              { label: 'Điện', color: '#38BDF8', border: '#38BDF8' },
              { label: 'Sóng điện từ', color: '#2DD4BF', border: '#2DD4BF' },
              { label: 'Điện', color: '#38BDF8', border: '#38BDF8' },
              { label: 'Âm thanh', color: '#F8FAFC', border: 'rgba(255, 255, 255, 0.7)' },
            ].map((item, idx) => {
              const itemSpring = spring({
                frame: frame - 200 - idx * 12,
                fps,
                config: { damping: 14, stiffness: 180 },
              });
              const opacity = Math.max(0, Math.min(1, itemSpring));
              const translateY = (1 - opacity) * 30;

              return (
                <React.Fragment key={idx}>
                  <div
                    style={{
                      width: 440,
                      height: 90,
                      borderRadius: 9999,
                      border: `3px solid ${item.border}`,
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: item.color,
                      fontSize: 42,
                      fontWeight: 800,
                      boxShadow: `0 0 24px ${item.border}44`,
                      opacity,
                      transform: `translateY(${translateY}px)`,
                    }}
                  >
                    {item.label}
                  </div>
                  {idx < 4 && (
                    <div
                      style={{
                        color: '#64748B',
                        fontSize: 34,
                        fontWeight: 900,
                        opacity,
                      }}
                    >
                      ↓
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          SCENE 3: BƯỚC 1/6 - MICRO (440 - 665)
          ======================================================== */}
      {frame >= 440 && frame < 665 && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {renderHeader()}
          {renderStepHeader(1, 'Micro')}

          {/* Sound waves entering mic */}
          <div
            style={{
              position: 'absolute',
              top: 540,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 50,
            }}
          >
            {/* Acoustic Waves Arcs */}
            <svg width={220} height={280} viewBox="0 0 220 280">
              {[0, 1, 2].map((arcIdx) => {
                const progress = ((frame * 2.5 + arcIdx * 35) % 105) / 105;
                const r = 50 + progress * 80;
                const opacity = Math.sin(progress * Math.PI);
                const startAngle = -50 * (Math.PI / 180);
                const endAngle = 50 * (Math.PI / 180);
                const cx = 30;
                const cy = 140;
                const x1 = cx + r * Math.cos(startAngle);
                const y1 = cy + r * Math.sin(startAngle);
                const x2 = cx + r * Math.cos(endAngle);
                const y2 = cy + r * Math.sin(endAngle);
                return (
                  <path
                    key={arcIdx}
                    d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={5}
                    strokeLinecap="round"
                    opacity={opacity}
                  />
                );
              })}
            </svg>

            {/* Mic Capsule with Vibrating Diaphragm */}
            <div
              style={{
                width: 140,
                height: 380,
                borderRadius: 70,
                border: '6px solid #64748B',
                backgroundColor: '#1E293B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                boxShadow: '0 20px 45px rgba(0, 0, 0, 0.6)',
              }}
            >
              {/* Vibrating membrane inside */}
              <div
                style={{
                  width: 10,
                  height: 280,
                  borderRadius: 5,
                  backgroundColor: '#F59E0B',
                  boxShadow: '0 0 18px #F59E0B',
                  transform: `translateX(${Math.sin(frame * 0.7) * 8}px)`,
                }}
              />
            </div>
          </div>

          {/* Labels */}
          <div
            style={{
              position: 'absolute',
              top: 980,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: 80,
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            <div style={{ color: '#E2E8F0' }}>sóng âm</div>
            <div style={{ color: '#F59E0B' }}>màng mỏng rung</div>
          </div>

          {renderBottomChain('dien_in')}
        </div>
      )}

      {/* ========================================================
          SCENE 4: BƯỚC 2/6 - BỘ XỬ LÍ (ADC) (665 - 896)
          ======================================================== */}
      {frame >= 665 && frame < 896 && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {renderHeader()}
          {renderStepHeader(2, 'Bộ xử lí')}

          {/* Continuous Sine Wave with sampling stems */}
          {(() => {
            const numSamples = 24;
            const startX = 85;
            const stepX = 33.5;
            const lambda = 8 * stepX; // 268 px period -> exactly 3 full cycles!
            const peak1X = startX + 2 * stepX; // 152 px
            const yMid = 145;
            const amp = 65;
            const yBase = 265;

            // Generate dense sine path
            const pathPoints: string[] = [];
            for (let px = 60; px <= 890; px += 2) {
              const py = yMid - amp * Math.cos((2 * Math.PI * (px - peak1X)) / lambda);
              pathPoints.push(`${px === 60 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`);
            }
            const sinePathD = pathPoints.join(' ');

            // Generate sample points
            const samplePoints = Array.from({ length: numSamples }).map((_, i) => {
              const sx = startX + i * stepX;
              const sy = yMid - amp * Math.cos((2 * Math.PI * (sx - peak1X)) / lambda);
              return { x: sx, y: sy, idx: i };
            });

            return (
              <div
                style={{
                  position: 'absolute',
                  top: 540,
                  left: 60,
                  right: 60,
                  height: 380,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <svg width={960} height={340} viewBox="0 0 960 340">
                  {/* Exact Sine wave curve */}
                  <path
                    d={sinePathD}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth={6}
                    strokeLinecap="round"
                  />

                  {/* Sampling Vertical Stems and Dots precisely on the curve */}
                  {samplePoints.map((pt) => {
                    const isVisible = (frame - 665) > pt.idx * 2.8;
                    if (!isVisible) return null;

                    return (
                      <g key={pt.idx}>
                        {/* Stem line down to baseline yBase */}
                        <line
                          x1={pt.x}
                          y1={pt.y}
                          x2={pt.x}
                          y2={yBase}
                          stroke="#F59E0B"
                          strokeWidth={3.5}
                        />
                        {/* Measurement Dot sitting precisely on the curve */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={7}
                          fill="#F59E0B"
                          stroke="#FFFFFF"
                          strokeWidth={2}
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>
            );
          })()}

          {/* Description */}
          <div
            style={{
              position: 'absolute',
              top: 980,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: 36,
              fontWeight: 800,
              color: '#F59E0B',
            }}
          >
            đo hàng nghìn lần mỗi giây
          </div>

          {/* Digital Binary Box */}
          <div
            style={{
              position: 'absolute',
              top: 1040,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                border: '2px solid rgba(56, 189, 248, 0.3)',
                borderRadius: 24,
                padding: '16px 44px',
                color: '#F59E0B',
                fontSize: 44,
                fontWeight: 900,
                letterSpacing: '0.06em',
                fontFamily: 'monospace',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
              }}
            >
              01101001110100101101001
            </div>
          </div>

          {renderBottomChain('dien_in')}

          {/* Bottom text */}
          <div
            style={{
              position: 'absolute',
              bottom: 380,
              left: 70,
              fontSize: 38,
              fontWeight: 800,
              color: '#FFFFFF',
            }}
          >
            Tín hiệu → dãy số <span style={{ color: '#F59E0B' }}>0 và 1</span>
          </div>
        </div>
      )}

      {/* ========================================================
          SCENE 5: BƯỚC 3/6 - ĂNG-TEN PHÁT (896 - 1190)
          ======================================================== */}
      {frame >= 896 && frame < 1190 && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {renderHeader()}
          {renderStepHeader(3, 'Ăng-ten phát')}

          {/* Transmitter Phone on Left */}
          {renderPhone({
            x: 160,
            y: 560,
            width: 220,
            height: 420,
            antennaActive: true,
          })}

          {/* Electron annotation */}
          <div
            style={{
              position: 'absolute',
              top: 510,
              left: 410,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ color: '#F59E0B', fontSize: 34, fontWeight: 800 }}>
              electron dao động
            </div>
            <div style={{ color: '#E2E8F0', fontSize: 28, fontWeight: 700 }}>
              hàng tỉ lần mỗi giây
            </div>
          </div>

          {/* Concentric Spherical Electromagnetic Waves radiating outward from antenna tip */}
          <svg
            width={1080}
            height={1920}
            viewBox="0 0 1080 1920"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 35,
            }}
          >
            {[0, 1, 2, 3].map((waveIdx) => {
              const progress = (((frame - 896) * 3 + waveIdx * 70) % 280) / 280;
              const r = 60 + progress * 420;
              const opacity = Math.sin(progress * Math.PI);
              const startAngle = -68 * (Math.PI / 180);
              const endAngle = 68 * (Math.PI / 180);
              const cx = 352;
              const cy = 485;
              const x1 = cx + r * Math.cos(startAngle);
              const y1 = cy + r * Math.sin(startAngle);
              const x2 = cx + r * Math.cos(endAngle);
              const y2 = cy + r * Math.sin(endAngle);

              return (
                <path
                  key={waveIdx}
                  d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`}
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth={5.5}
                  strokeLinecap="round"
                  opacity={opacity}
                />
              );
            })}
          </svg>

          {renderBottomChain('song')}

          {/* Bottom text */}
          <div
            style={{
              position: 'absolute',
              bottom: 380,
              left: 70,
              fontSize: 38,
              fontWeight: 800,
              color: '#FFFFFF',
            }}
          >
            Điện → <span style={{ color: '#2DD4BF' }}>sóng điện từ</span>
          </div>
        </div>
      )}

      {/* ========================================================
          SCENE 6: BƯỚC 4/6 - MẠNG DI ĐỘNG & CÁP QUANG (1190 - 1430)
          ======================================================== */}
      {frame >= 1190 && frame < 1430 && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {renderHeader()}
          {renderStepHeader(4, 'Mạng di động')}

          {/* Towers & Fiber Optic Cross-section Container */}
          <div style={{ position: 'absolute', top: 520, left: 0, right: 0, height: 600 }}>
            {/* Left Tower */}
            <div style={{ position: 'absolute', left: 160, top: 40, width: 140, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ color: '#F8FAFC', fontSize: 26, fontWeight: 700, marginBottom: 8, whiteSpace: 'nowrap' }}>
                trạm gần bạn
              </div>
              {/* Flashing Beacon */}
              <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: '#F97316', boxShadow: `0 0 ${12 + Math.sin(frame / 4) * 8}px #F97316`, marginBottom: 6 }} />
              {/* Lattice Tower Graphic */}
              <svg width={100} height={200} viewBox="0 0 100 200">
                <line x1={30} y1={20} x2={10} y2={200} stroke="#94A3B8" strokeWidth={5} />
                <line x1={70} y1={20} x2={90} y2={200} stroke="#94A3B8" strokeWidth={5} />
                <line x1={20} y1={80} x2={80} y2={80} stroke="#94A3B8" strokeWidth={4} />
                <line x1={15} y1={140} x2={85} y2={140} stroke="#94A3B8" strokeWidth={4} />
                <line x1={20} y1={80} x2={85} y2={140} stroke="#94A3B8" strokeWidth={3} />
                <line x1={80} y1={80} x2={15} y2={140} stroke="#94A3B8" strokeWidth={3} />
              </svg>
            </div>

            {/* Right Tower */}
            <div style={{ position: 'absolute', right: 160, top: 40, width: 140, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ color: '#F8FAFC', fontSize: 26, fontWeight: 700, marginBottom: 8, whiteSpace: 'nowrap' }}>
                trạm người nghe
              </div>
              <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: '#F97316', boxShadow: `0 0 ${12 + Math.sin(frame / 4) * 8}px #F97316`, marginBottom: 6 }} />
              <svg width={100} height={200} viewBox="0 0 100 200">
                <line x1={30} y1={20} x2={10} y2={200} stroke="#94A3B8" strokeWidth={5} />
                <line x1={70} y1={20} x2={90} y2={200} stroke="#94A3B8" strokeWidth={5} />
                <line x1={20} y1={80} x2={80} y2={80} stroke="#94A3B8" strokeWidth={4} />
                <line x1={15} y1={140} x2={85} y2={140} stroke="#94A3B8" strokeWidth={4} />
                <line x1={20} y1={80} x2={85} y2={140} stroke="#94A3B8" strokeWidth={3} />
                <line x1={80} y1={80} x2={15} y2={140} stroke="#94A3B8" strokeWidth={3} />
              </svg>
            </div>

            {/* Underground Soil Layer */}
            <div
              style={{
                position: 'absolute',
                bottom: 20,
                left: 80,
                right: 80,
                height: 160,
                backgroundColor: '#3E2723',
                borderRadius: 20,
                border: '4px solid #5D4037',
                overflow: 'hidden',
                boxShadow: 'inset 0 10px 25px rgba(0, 0, 0, 0.5)',
              }}
            >
              {/* Optical Fiber Cable Pipe */}
              <div
                style={{
                  position: 'absolute',
                  top: 70,
                  left: 60,
                  right: 60,
                  height: 24,
                  backgroundColor: '#1E293B',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  overflow: 'hidden',
                }}
              >
                {/* Traveling light pulses */}
                {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                  const x = ((frame * 6 + i * 120) % 800);
                  return (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: x,
                        width: 22,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: '#FDE047',
                        boxShadow: '0 0 14px #FDE047',
                      }}
                    />
                  );
                })}
              </div>

              {/* Cable Label */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 18,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  color: '#FDE047',
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                }}
              >
                cáp quang: chớp ánh sáng
              </div>
            </div>
          </div>

          {/* Subtitle bottom text */}
          <div
            style={{
              position: 'absolute',
              bottom: 580,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: 34,
              fontWeight: 800,
              color: '#F8FAFC',
            }}
          >
            Sóng → trạm → cáp quang → trạm → sóng
          </div>

          {renderBottomChain('song')}
        </div>
      )}

      {/* ========================================================
          SCENE 7: BƯỚC 5/6 - ĂNG-TEN NHẬN (1430 - 1730)
          ======================================================== */}
      {frame >= 1430 && frame < 1730 && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {renderHeader()}
          {renderStepHeader(5, 'Ăng-ten nhận')}

          {/* Concentric Spherical Electromagnetic Waves incoming to antenna tip */}
          <svg
            width={1080}
            height={1920}
            viewBox="0 0 1080 1920"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 35,
            }}
          >
            {[0, 1, 2, 3].map((waveIdx) => {
              const progress = (((frame - 1430) * 3 + waveIdx * 70) % 280) / 280;
              const r = 500 - progress * 420;
              const opacity = Math.sin((1 - progress) * Math.PI);
              const startAngle = 245 * (Math.PI / 180);
              const endAngle = 115 * (Math.PI / 180);
              const cx = 668;
              const cy = 485;
              const x1 = cx + r * Math.cos(startAngle);
              const y1 = cy + r * Math.sin(startAngle);
              const x2 = cx + r * Math.cos(endAngle);
              const y2 = cy + r * Math.sin(endAngle);

              return (
                <path
                  key={waveIdx}
                  d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 0 ${x2.toFixed(1)} ${y2.toFixed(1)}`}
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth={5.5}
                  strokeLinecap="round"
                  opacity={opacity}
                />
              );
            })}
          </svg>

          {/* Receiver Phone on Right */}
          {renderPhone({
            x: 640,
            y: 560,
            width: 220,
            height: 420,
            antennaReceive: true,
            antennaSide: 'left',
          })}

          {/* Electron annotation */}
          <div
            style={{
              position: 'absolute',
              top: 450,
              left: 320,
              color: '#F59E0B',
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            electron dao động theo
          </div>

          {/* Digital Decoded Box */}
          <div
            style={{
              position: 'absolute',
              top: 920,
              left: 80,
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                border: '2px solid rgba(56, 189, 248, 0.3)',
                borderRadius: 24,
                padding: '16px 44px',
                color: '#FFFFFF',
                fontSize: 42,
                fontWeight: 900,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
              }}
            >
              0110... → <span style={{ color: '#F59E0B' }}>giọng nói</span>
            </div>
          </div>

          {renderBottomChain('dien_out')}

          {/* Subtitle */}
          <div
            style={{
              position: 'absolute',
              bottom: 380,
              left: 70,
              fontSize: 38,
              fontWeight: 800,
              color: '#FFFFFF',
            }}
          >
            Sóng → tín hiệu <span style={{ color: '#38BDF8' }}>điện</span> → giải mã
          </div>
        </div>
      )}

      {/* ========================================================
          SCENE 8: BƯỚC 6/6 - LOA (1730 - 2015)
          ======================================================== */}
      {frame >= 1730 && frame < 2015 && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {renderHeader()}
          {renderStepHeader(6, 'Loa')}

          <div
            style={{
              position: 'absolute',
              top: 540,
              left: 100,
              right: 100,
              height: 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
            }}
          >
            {/* Permanent Magnet Block */}
            <div
              style={{
                width: 130,
                height: 240,
                borderRadius: 20,
                backgroundColor: '#334155',
                border: '4px solid #64748B',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 15px 35px rgba(0, 0, 0, 0.5)',
              }}
            >
              {/* North pole */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: '#EA580C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: 44,
                  fontWeight: 900,
                }}
              >
                N
              </div>
              {/* South pole */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: '#0284C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: 44,
                  fontWeight: 900,
                }}
              >
                S
              </div>
            </div>

            {/* Voice Coil Windings */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ color: '#FBBF24', fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
                cuộn dây
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  padding: '8px 12px',
                  backgroundColor: '#1E293B',
                  borderRadius: 12,
                  border: '2px solid #475569',
                }}
              >
                {[0, 1, 2, 3, 4, 5].map((wireIdx) => (
                  <div
                    key={wireIdx}
                    style={{
                      width: 8,
                      height: 180,
                      borderRadius: 4,
                      backgroundColor: '#F59E0B',
                      boxShadow: '0 0 8px #F59E0B',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Speaker Cone Diaphragm */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <svg width={200} height={260} viewBox="0 0 200 260">
                <polygon
                  points="20,70 180,20 180,240 20,190"
                  fill="#94A3B8"
                  stroke="#CBD5E1"
                  strokeWidth={4}
                  transform={`translate(${Math.sin(frame * 0.8) * 8}, 0)`}
                />
              </svg>
              <div style={{ color: '#E2E8F0', fontSize: 26, fontWeight: 800, marginTop: 8 }}>
                màng loa
              </div>
            </div>

            {/* Acoustic sound waves radiating out */}
            <svg width={180} height={260} viewBox="0 0 180 260">
              {[0, 1, 2].map((arcIdx) => {
                const progress = (((frame - 1730) * 2.8 + arcIdx * 45) % 135) / 135;
                const r = 35 + progress * 95;
                const opacity = Math.sin(progress * Math.PI);
                const startAngle = -52 * (Math.PI / 180);
                const endAngle = 52 * (Math.PI / 180);
                const cx = 10;
                const cy = 130;
                const x1 = cx + r * Math.cos(startAngle);
                const y1 = cy + r * Math.sin(startAngle);
                const x2 = cx + r * Math.cos(endAngle);
                const y2 = cy + r * Math.sin(endAngle);
                return (
                  <path
                    key={arcIdx}
                    d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`}
                    fill="none"
                    stroke="#CBD5E1"
                    strokeWidth={5}
                    strokeLinecap="round"
                    opacity={opacity}
                  />
                );
              })}
            </svg>
          </div>

          {/* Force and labels */}
          <div
            style={{
              position: 'absolute',
              top: 960,
              left: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ color: '#E2E8F0', fontSize: 32, fontWeight: 700 }}>
              nam châm
            </div>
            <div style={{ color: '#38BDF8', fontSize: 34, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>←</span> lực từ đẩy qua kéo lại <span>→</span>
            </div>
          </div>

          {renderBottomChain('amthanh_out')}

          {/* Subtitle */}
          <div
            style={{
              position: 'absolute',
              bottom: 380,
              left: 70,
              fontSize: 38,
              fontWeight: 800,
              color: '#FFFFFF',
            }}
          >
            Điện → màng loa rung → <span style={{ color: '#F59E0B' }}>giọng nói</span>
          </div>
        </div>
      )}

      {/* ========================================================
          SCENE 9: VỪA NÓI VỪA NGHE (2015 - 2255)
          ======================================================== */}
      {frame >= 2015 && frame < 2255 && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {renderHeader()}

          <div style={{ position: 'absolute', top: 220, left: 70, right: 70, zIndex: 90 }}>
            <div style={{ color: '#FFFFFF', fontSize: 68, fontWeight: 900, lineHeight: 1.25 }}>
              Vừa nói <span style={{ color: '#F59E0B' }}>vừa nghe</span>
            </div>
          </div>

          {/* Two Phones facing each other with bidirectional channels */}
          {renderPhone({
            x: 160,
            y: 560,
            width: 200,
            height: 380,
          })}

          {renderPhone({
            x: 720,
            y: 560,
            width: 200,
            height: 380,
          })}

          {/* Bidirectional Channels */}
          <div style={{ position: 'absolute', top: 620, left: 390, width: 300, display: 'flex', flexDirection: 'column', gap: 60 }}>
            {/* Channel 1: Left to Right (Cyan) */}
            <div>
              <div style={{ color: '#38BDF8', fontSize: 26, fontWeight: 800, textAlign: 'center', marginBottom: 6 }}>
                kênh 1
              </div>
              <div style={{ position: 'relative', height: 8, backgroundColor: '#38BDF8', borderRadius: 4 }}>
                <div
                  style={{
                    position: 'absolute',
                    right: -14,
                    top: -10,
                    width: 0,
                    height: 0,
                    borderTop: '14px solid transparent',
                    borderBottom: '14px solid transparent',
                    borderLeft: '22px solid #38BDF8',
                  }}
                />
                {/* Moving dot */}
                <div
                  style={{
                    position: 'absolute',
                    top: -5,
                    left: (frame * 6) % 280,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 10px #FFFFFF',
                  }}
                />
              </div>
            </div>

            {/* Channel 2: Right to Left (Orange) */}
            <div>
              <div style={{ color: '#F97316', fontSize: 26, fontWeight: 800, textAlign: 'center', marginBottom: 6 }}>
                kênh 2
              </div>
              <div style={{ position: 'relative', height: 8, backgroundColor: '#F97316', borderRadius: 4 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: -14,
                    top: -10,
                    width: 0,
                    height: 0,
                    borderTop: '14px solid transparent',
                    borderBottom: '14px solid transparent',
                    borderRight: '22px solid #F97316',
                  }}
                />
                {/* Moving dot */}
                <div
                  style={{
                    position: 'absolute',
                    top: -5,
                    right: (frame * 6) % 280,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 10px #FFFFFF',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Latency Callout Box */}
          <div
            style={{
              position: 'absolute',
              top: 1040,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                padding: '16px 44px',
                borderRadius: 24,
                border: '3px solid #F59E0B',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#FBBF24',
                fontSize: 42,
                fontWeight: 900,
                boxShadow: '0 0 25px rgba(245, 158, 11, 0.4)',
              }}
            >
              Cả hành trình &lt; 0,5 giây!
            </div>
          </div>

          {/* Subtitle */}
          <div
            style={{
              position: 'absolute',
              bottom: 460,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: 36,
              fontWeight: 800,
              color: '#CBD5E1',
            }}
          >
            Mỗi chiều truyền trên một kênh riêng
          </div>
        </div>
      )}

      {/* ========================================================
          SCENE 10: OUTRO / CÂU HỎI CHO BẠN (2255 - 2580)
          ======================================================== */}
      {frame >= 2255 && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {renderHeader()}

          <div style={{ position: 'absolute', top: 220, left: 70, right: 70, zIndex: 90 }}>
            <div style={{ color: '#94A3B8', fontSize: 38, fontWeight: 700, marginBottom: 14 }}>
              Câu hỏi cho bạn:
            </div>
            <div style={{ color: '#F59E0B', fontSize: 64, fontWeight: 900, lineHeight: 1.3 }}>
              Vì sao vào thang máy, điện thoại hay bị mất sóng?
            </div>
          </div>

          {/* Metal Elevator Enclosure (Faraday Cage) */}
          <div
            style={{
              position: 'absolute',
              top: 590,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 40,
            }}
          >
            <div
              style={{
                width: 380,
                height: 520,
                borderRadius: 24,
                backgroundColor: '#334155',
                border: '8px solid #94A3B8',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Elevator door seam line */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 3,
                  backgroundColor: '#64748B',
                }}
              />

              {/* Inside Phone */}
              {renderPhone({
                x: 105,
                y: 110,
                width: 170,
                height: 300,
              })}
            </div>

            {/* Blocked / Damped Waves outside */}
            <svg width={180} height={300} viewBox="0 0 180 300" style={{ marginLeft: 20 }}>
              {[0, 1, 2, 3].map((arcIdx) => {
                const r = 70 + arcIdx * 40;
                const startAngle = -55 * (Math.PI / 180);
                const endAngle = 55 * (Math.PI / 180);
                const cx = 10;
                const cy = 150;
                const x1 = cx + r * Math.cos(startAngle);
                const y1 = cy + r * Math.sin(startAngle);
                const x2 = cx + r * Math.cos(endAngle);
                const y2 = cy + r * Math.sin(endAngle);
                return (
                  <path
                    key={arcIdx}
                    d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`}
                    fill="none"
                    stroke="#64748B"
                    strokeWidth={5}
                    strokeLinecap="round"
                    opacity={0.45 - arcIdx * 0.08}
                  />
                );
              })}
            </svg>
          </div>

          {/* "???" Question mark below elevator */}
          <div
            style={{
              position: 'absolute',
              top: 1140,
              left: 560,
              fontSize: 68,
              fontWeight: 900,
              color: '#F97316',
              letterSpacing: '0.08em',
            }}
          >
            ???
          </div>

          {/* Mascot Robot sitting centered at bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: 340,
              left: '50%',
              transform: `translateX(-50%) translateY(${Math.sin(frame / 6) * 10}px)`,
              zIndex: 90,
            }}
          >
            <MascotRobot size={260} />
          </div>
        </div>
      )}
    </div>
  );
};

