import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { PhysicsExplainerVisualPayload } from '@luminalearn/scene-schema';
import { MascotRobot } from './MascotRobot';
import { ParticleKineticCanvas } from './ParticleKineticCanvas';
import { VectorFieldForceCanvas } from './VectorFieldForceCanvas';
import { WaveOscillationCanvas } from './WaveOscillationCanvas';

export interface CinematicPhysicsExplainerSceneProps {
  title: string;
  payload: PhysicsExplainerVisualPayload;
  subtitleText?: string;
  durationInFrames?: number;
}

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

const formatLabels: Record<PhysicsExplainerVisualPayload['family'], string> = {
  process_chain: 'CHUỖI TÍN HIỆU',
  particle_state: 'NHIỆT HỌC HẠT',
  wave_propagation: 'SÓNG & TRƯỜNG',
  force_motion: 'LỰC & CHUYỂN ĐỘNG',
  energy_transfer: 'BẢO TOÀN NĂNG LƯỢNG'
};

const beatLabels: Record<string, string> = {
  hook: 'CÂU HỎI VẬT LÝ HÔM NAY',
  system_model: 'MÔ HÌNH HỆ VẬT LÝ',
  mechanism_a: 'CƠ CHẾ HOẠT ĐỘNG',
  mechanism_b: 'PHÂN TÍCH ĐỐI CHỨNG',
  evidence: 'CHỨNG MINH TOÁN HỌC & ĐO LƯỜNG',
  takeaway: 'TỔNG KẾT & THỬ THÁCH TRÍ TUỆ'
};

const contextLabels: Record<PhysicsExplainerVisualPayload['family'], [string, string, string]> = {
  process_chain: ['NGUỒN', 'BIẾN ĐỔI', 'ĐÍCH'],
  particle_state: ['HƠI NƯỚC', 'LÀM LẠNH', 'NGƯNG TỤ'],
  wave_propagation: ['NGUỒN PHÁT', 'LAN TRUYỀN', 'BỘ THU'],
  force_motion: ['VẬT THỂ', 'VECTOR LỰC', 'QUỸ ĐẠO'],
  energy_transfer: ['ĐỘNG NĂNG', 'THẾ NĂNG', 'CƠ NĂNG']
};

const ContextPictogram: React.FC<{ family: PhysicsExplainerVisualPayload['family']; index: number; accent: string }> = ({ family, index, accent }) => {
  if (family === 'wave_propagation') {
    return (
      <svg width="78" height="46" viewBox="0 0 78 46">
        <path d="M3 24 C12 4 21 44 30 24 S48 4 57 24 S69 44 75 24" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
        <circle cx={index === 0 ? 7 : index === 1 ? 39 : 71} cy="24" r="6" fill="#FBBF24" />
      </svg>
    );
  }
  if (family === 'particle_state') {
    return (
      <svg width="78" height="46" viewBox="0 0 78 46">
        {Array.from({ length: index === 2 ? 6 : 10 }, (_, particle) => (
          <circle
            key={particle}
            cx={10 + (particle * 17) % 62}
            cy={10 + (particle * 13) % 30}
            r={index === 2 ? 5 : 3.5}
            fill={index === 1 ? '#7DD3FC' : accent}
            opacity={0.75 + (particle % 2) * 0.2}
          />
        ))}
      </svg>
    );
  }
  if (family === 'force_motion') {
    return (
      <svg width="78" height="46" viewBox="0 0 78 46">
        <rect x="28" y="14" width="22" height="22" rx="5" fill="#1E293B" stroke={accent} strokeWidth="3" />
        <line x1="39" y1="25" x2={index === 1 ? 69 : 58} y2={index === 2 ? 8 : 25} stroke="#FBBF24" strokeWidth="4" />
        <polygon points={index === 2 ? '58,8 52,13 61,15' : '69,25 61,20 61,30'} fill="#FBBF24" />
      </svg>
    );
  }
  if (family === 'energy_transfer') {
    return (
      <svg width="78" height="46" viewBox="0 0 78 46">
        <rect x="5" y="13" width="68" height="22" rx="10" fill="#0F172A" stroke="#475569" strokeWidth="2" />
        <rect x="8" y="16" width={index === 0 ? 45 : index === 1 ? 20 : 31} height="16" rx="7" fill={accent} />
        <rect x={index === 0 ? 53 : index === 1 ? 28 : 39} y="16" width={index === 0 ? 17 : index === 1 ? 42 : 31} height="16" rx="7" fill="#FBBF24" />
      </svg>
    );
  }
  return (
    <svg width="78" height="46" viewBox="0 0 78 46">
      <line x1="10" y1="23" x2="68" y2="23" stroke="#475569" strokeWidth="5" />
      {[10, 39, 68].map((x, node) => (
        <circle key={x} cx={x} cy="23" r={node === index ? 9 : 6} fill={node === index ? '#FBBF24' : accent} />
      ))}
    </svg>
  );
};

const VisualContextStrip: React.FC<{ payload: PhysicsExplainerVisualPayload }> = ({ payload }) => (
  <div style={{ position: 'absolute', top: 430, left: 60, right: 60, height: 84, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, zIndex: 10 }}>
    {contextLabels[payload.family].map((label, index) => (
      <div
        key={label}
        style={{
          borderRadius: 20,
          border: `1.5px solid ${payload.accentColor}44`,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.35)',
        }}
      >
        <ContextPictogram family={payload.family} index={index} accent={payload.accentColor} />
        <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: 1.1, color: index === 1 ? '#FBBF24' : '#CBD5E1' }}>{label}</span>
      </div>
    ))}
  </div>
);

const ProcessChainVisual: React.FC<{
  simulation: Extract<PhysicsExplainerVisualPayload['simulation'], { kind: 'process_chain' }>;
  accentColor: string;
}> = ({ simulation, accentColor }) => {
  const frame = useCurrentFrame();
  const active = simulation.activeNodeIndex;
  const nodeWidth = 116;
  const gap = 22;
  const totalWidth = simulation.nodes.length * nodeWidth + (simulation.nodes.length - 1) * gap;
  const startX = (860 - totalWidth) / 2;
  const pulse = 1 + Math.sin(frame / 8) * 0.04;

  return (
    <svg width="860" height="560" viewBox="0 0 860 560">
      <defs>
        <filter id="chainGlow"><feGaussianBlur stdDeviation="8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {simulation.nodes.slice(0, -1).map((_, index) => {
        const x1 = startX + index * (nodeWidth + gap) + nodeWidth;
        const x2 = x1 + gap;
        const reached = index < active;
        return (
          <g key={`connector-${index}`}>
            <line x1={x1} y1={280} x2={x2} y2={280} stroke={reached ? accentColor : '#334155'} strokeWidth="5" strokeDasharray={reached ? 'none' : '4 4'} filter={reached ? 'url(#chainGlow)' : undefined} />
            {reached && <circle cx={x1 + ((frame * 3 + index * 10) % gap)} cy={280} r="4" fill="#FBBF24" />}
          </g>
        );
      })}
      {simulation.nodes.map((nodeName, index) => {
        const x = startX + index * (nodeWidth + gap);
        const y = 220;
        const isCurrent = index === active;
        const reached = index <= active;
        return (
          <g key={`${nodeName}-${index}`} transform={`translate(${x}, ${y}) scale(${isCurrent ? pulse : 1})`} transform-origin={`${nodeWidth / 2} 60`}>
            <rect width={nodeWidth} height="120" rx="20" fill={isCurrent ? '#1E293B' : '#0F172A'} stroke={isCurrent ? '#FBBF24' : reached ? accentColor : '#334155'} strokeWidth={isCurrent ? 3.5 : 2} filter={isCurrent ? 'url(#chainGlow)' : undefined} />
            <text x={nodeWidth / 2} y="68" fill={isCurrent ? '#FBBF24' : reached ? '#F8FAFC' : '#94A3B8'} fontSize="18" fontWeight="900" textAnchor="middle">{nodeName}</text>
          </g>
        );
      })}
    </svg>
  );
};

const EnergyVisual: React.FC<{
  simulation: Extract<PhysicsExplainerVisualPayload['simulation'], { kind: 'energy_transfer' }>;
}> = ({ simulation }) => {
  const kRatio = simulation.kineticFraction;
  const pRatio = simulation.potentialFraction;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', padding: '0 40px' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38BDF8', fontSize: 22, fontWeight: 900, marginBottom: 8 }}>
          <span>ĐỘNG NĂNG (Wđ)</span>
          <span>{Math.round(kRatio * 100)}%</span>
        </div>
        <div style={{ height: 32, borderRadius: 16, background: '#1E293B', overflow: 'hidden', border: '2px solid rgba(56, 189, 248, 0.4)' }}>
          <div style={{ width: `${Math.round(kRatio * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #0284C7, #38BDF8)', boxShadow: '0 0 15px rgba(56,189,248,0.5)', transition: 'width 0.2s' }} />
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#F59E0B', fontSize: 22, fontWeight: 900, marginBottom: 8 }}>
          <span>THẾ NĂNG (Wt)</span>
          <span>{Math.round(pRatio * 100)}%</span>
        </div>
        <div style={{ height: 32, borderRadius: 16, background: '#1E293B', overflow: 'hidden', border: '2px solid rgba(245, 158, 11, 0.4)' }}>
          <div style={{ width: `${Math.round(pRatio * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #D97706, #FBBF24)', boxShadow: '0 0 15px rgba(245,158,11,0.5)', transition: 'width 0.2s' }} />
        </div>
      </div>

      <div style={{ background: 'rgba(34, 197, 94, 0.12)', border: '2px solid rgba(34, 197, 94, 0.5)', borderRadius: 20, padding: '16px 24px', textAlign: 'center', marginTop: 10 }}>
        <div style={{ color: '#4ADE80', fontSize: 18, fontWeight: 800 }}>TỔNG CƠ NĂNG BẢO TOÀN</div>
        <div style={{ color: '#FFFFFF', fontSize: 28, fontWeight: 900, marginTop: 4 }}>
          {simulation.totalEnergyLabel || 'W = Wđ + Wt = HẰNG SỐ'}
        </div>
      </div>
    </div>
  );
};

const PhysicsSimulation: React.FC<{ payload: PhysicsExplainerVisualPayload }> = ({ payload }) => {
  const simulation = payload.simulation;
  if (simulation.kind === 'process_chain') {
    return <ProcessChainVisual simulation={simulation} accentColor={payload.accentColor} />;
  }
  if (simulation.kind === 'particle_state') {
    return (
      <ParticleKineticCanvas
        particleCount={simulation.particleCount}
        temperature={simulation.temperature}
        phase={simulation.phase}
        color={payload.accentColor}
      />
    );
  }
  if (simulation.kind === 'wave') {
    return (
      <WaveOscillationCanvas
        amplitude={simulation.amplitude}
        frequency={simulation.spatialFrequency}
        speed={simulation.propagationSpeed}
        color={payload.accentColor}
        phaseLabel={simulation.relationLabel}
        wavelengthLabel={simulation.wavelengthLabel}
      />
    );
  }
  if (simulation.kind === 'force_motion') {
    return (
      <VectorFieldForceCanvas
        objectType={simulation.objectType}
        motionModel={simulation.motionModel}
        formula={simulation.formula}
        forces={simulation.forces}
        gravityMps2={simulation.gravityMps2}
        initialSpeedMps={simulation.initialSpeedMps}
        launchAngleDeg={simulation.launchAngleDeg}
        pendulumLengthM={simulation.pendulumLengthM}
        periodSeconds={simulation.periodSeconds}
      />
    );
  }
  if (simulation.kind === 'energy_transfer') {
    return <EnergyVisual simulation={simulation} />;
  }
  return null;
};

export const CinematicPhysicsExplainerScene: React.FC<CinematicPhysicsExplainerSceneProps> = ({
  title,
  payload,
  subtitleText,
  durationInFrames
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: compositionDuration } = useVideoConfig();
  const duration = durationInFrames ?? compositionDuration;
  const entrance = spring({ frame, fps, config: { damping: 14, stiffness: 110, mass: 0.85 } });
  const mascotSpring = spring({ frame, fps, config: { damping: 12, stiffness: 120, mass: 0.8 } });
  const mascotHover = Math.sin(frame / 7) * 12;

  const sceneProgress = Math.min(1, frame / Math.max(1, duration - 1));
  const outroOpacity = interpolate(frame, [Math.max(0, duration - 10), duration], [1, 0], clamp);

  const scale = payload.cameraMove === 'push_in'
    ? interpolate(sceneProgress, [0, 1], [0.95, 1.05])
    : payload.cameraMove === 'pull_out'
      ? interpolate(sceneProgress, [0, 1], [1.05, 0.96])
      : payload.cameraMove === 'macro'
        ? 1.1
        : 1;

  const translateX = payload.cameraMove === 'track' ? interpolate(sceneProgress, [0, 1], [24, -24]) : 0;
  const isHook = payload.beat === 'hook';
  const isTakeaway = payload.beat === 'takeaway';
  const hasFormula = payload.simulation && 'formula' in payload.simulation && Boolean(payload.simulation.formula);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0A0F1D',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
        opacity: outroOpacity,
      }}
    >
      {/* Background Radial Glows matching Demo Form */}
      <div
        style={{
          position: 'absolute',
          top: -150,
          left: '20%',
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${payload.accentColor}22 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 150,
          right: -100,
          width: 750,
          height: 750,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Dynamic Animated Ambient Light Beam matching Demo Videos to prevent static freeze */}
      <div
        style={{
          position: 'absolute',
          top: -300,
          left: '10%',
          width: 800,
          height: 1200,
          background: `radial-gradient(ellipse at 50% 20%, ${payload.accentColor}18 0%, transparent 65%)`,
          transform: `rotate(${Math.sin(frame / 20) * 8}deg) scale(${1 + Math.sin(frame / 12) * 0.04})`,
          transformOrigin: 'top center',
          pointerEvents: 'none',
        }}
      />

      {/* Floating Sparkle Particles throughout the whole scene */}
      <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
        {Array.from({ length: 12 }).map((_, i) => {
          const px = ((i * 197 + frame * (0.8 + (i % 3) * 0.4)) % 1080);
          const py = ((i * 311 + Math.sin(frame / 15 + i) * 60 + frame * 0.5) % 1920);
          const r = 2.5 + (i % 3);
          const op = 0.25 + Math.sin(frame / 8 + i) * 0.2;
          return <circle key={i} cx={px} cy={py} r={r} fill={i % 2 === 0 ? '#38BDF8' : '#FBBF24'} opacity={op} />;
        })}
      </svg>

      {/* Grid Pattern */}
      <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0, opacity: 0.12, pointerEvents: 'none' }}>
        <defs>
          <pattern id="universalGrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#38BDF8" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="1080" height="1920" fill="url(#universalGrid)" />
      </svg>

      {/* Persistent Standard Header matching Demo Videos */}
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: payload.accentColor,
              boxShadow: `0 0 ${8 + Math.sin(frame / 6) * 5}px ${payload.accentColor}`,
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
            backgroundColor: `${payload.accentColor}18`,
            border: `2px solid ${payload.accentColor}66`,
            color: payload.accentColor,
            padding: '8px 22px',
            borderRadius: 9999,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '0.04em',
          }}
        >
          <span>{formatLabels[payload.family]}</span>
        </div>
      </div>

      {/* Title Section */}
      <div
        style={{
          position: 'absolute',
          top: 195,
          left: 60,
          right: 60,
          textAlign: 'center',
          opacity: entrance,
          transform: `translateY(${(1 - entrance) * 30}px)`,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            border: '1.5px solid rgba(56, 189, 248, 0.4)',
            color: '#38BDF8',
            padding: '6px 22px',
            borderRadius: 9999,
            fontSize: 20,
            fontWeight: 800,
            marginBottom: 10,
            textTransform: 'uppercase',
          }}
        >
          {beatLabels[payload.beat] || 'BÀI HỌC VẬT LÝ'}
        </div>
        <h1
          style={{
            fontSize: 48,
            fontWeight: 900,
            lineHeight: 1.2,
            margin: 0,
            background: 'linear-gradient(135deg, #FFFFFF 0%, #38BDF8 60%, #F59E0B 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {payload.headline || title}
        </h1>
        {payload.focusLabel && (
          <p style={{ color: '#BAE6FD', fontSize: 24, marginTop: 10, marginBottom: 0, fontWeight: 700 }}>
            {payload.focusLabel}
          </p>
        )}
      </div>

      {/* Context 3-Step Strip */}
      <VisualContextStrip payload={payload} />

      {/* Central Visual & Simulation Area */}
      <div
        style={{
          position: 'absolute',
          top: 535,
          left: 60,
          right: 60,
          height: 580,
          backgroundColor: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(16px)',
          borderRadius: 24,
          border: `1.5px solid ${payload.accentColor}44`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          transform: `scale(${scale}) translateX(${translateX}px)`,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          zIndex: 10,
        }}
      >
        <PhysicsSimulation payload={payload} />
      </div>

      {/* Formula Highlight Card if Available */}
      {hasFormula && (
        <div
          style={{
            position: 'absolute',
            top: 1130,
            left: 60,
            right: 60,
            backgroundColor: 'rgba(168, 85, 247, 0.12)',
            border: '2px solid rgba(168, 85, 247, 0.5)',
            borderRadius: 22,
            padding: '16px 28px',
            textAlign: 'center',
            boxShadow: '0 0 25px rgba(168, 85, 247, 0.25)',
            zIndex: 10,
          }}
        >
          <div style={{ color: '#E9D5FF', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            CÔNG THỨC TOÁN HỌC CỐT LÕI
          </div>
          <div style={{ color: '#FBBF24', fontSize: 34, fontWeight: 900, letterSpacing: '0.04em' }}>
            {(payload.simulation as { formula?: string }).formula}
          </div>
        </div>
      )}

      {/* Insight & Takeaway Card */}
      <div
        style={{
          position: 'absolute',
          top: hasFormula ? 1250 : 1160,
          left: 60,
          right: 60,
          padding: '24px 30px',
          borderRadius: 24,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          border: `1.5px solid ${payload.accentColor}55`,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          zIndex: 10,
        }}
      >
        <div style={{ color: '#FBBF24', fontSize: 18, fontWeight: 900, letterSpacing: 1.5, marginBottom: 8 }}>
          {isTakeaway ? '3 QUY TẮC CỐT LÕI CẦN NHỚ' : 'ĐIỀU CẦN GHI NHỚ'}
        </div>
        <div style={{ fontSize: 26, lineHeight: 1.4, fontWeight: 700, color: '#FFFFFF' }}>
          {payload.insight}
        </div>
      </div>

      {/* Interactive Challenge Quiz for Takeaway */}
      {isTakeaway && (
        <div
          style={{
            position: 'absolute',
            top: 1420,
            left: 60,
            right: 60,
            padding: '18px 26px',
            borderRadius: 20,
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1.5px solid rgba(239, 68, 68, 0.4)',
            zIndex: 10,
          }}
        >
          <div style={{ color: '#F87171', fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
            ❓ THỬ THÁCH TRÍ TUỆ DÀNH CHO BẠN
          </div>
          <div style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700 }}>
            Hãy thử suy nghĩ và bình luận câu trả lời của bạn ở bên dưới nhé!
          </div>
        </div>
      )}

      {/* Mascot Robot: Hook in bottom right, Takeaway in bottom center */}
      {isHook && (
        <div
          style={{
            position: 'absolute',
            bottom: 240,
            right: 40,
            transform: `scale(${mascotSpring}) translateY(${mascotHover}px)`,
            transformOrigin: 'bottom center',
            zIndex: 30,
          }}
        >
          <MascotRobot size={220} />
        </div>
      )}

      {isTakeaway && (
        <div
          style={{
            position: 'absolute',
            bottom: 240,
            left: '50%',
            transform: `translateX(-50%) scale(${mascotSpring}) translateY(${mascotHover}px)`,
            transformOrigin: 'bottom center',
            zIndex: 30,
          }}
        >
          <MascotRobot size={200} />
        </div>
      )}

      {/* Burned-in High-Contrast Subtitle Container matching Demo Videos */}
      {subtitleText && (
        <div
          style={{
            position: 'absolute',
            bottom: 100,
            left: 60,
            right: 60,
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(16px)',
            border: '1.5px solid rgba(56, 189, 248, 0.35)',
            borderRadius: 24,
            padding: '22px 34px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            zIndex: 90,
          }}
        >
          <p
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1.45,
              margin: 0,
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.7)',
            }}
          >
            {subtitleText}
          </p>
        </div>
      )}
    </AbsoluteFill>
  );
};
