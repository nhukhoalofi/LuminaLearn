import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { PhysicsOpticsVisualPayload } from '@luminalearn/scene-schema';

export interface PhysicsOpticsSceneProps {
  title: string;
  payload: PhysicsOpticsVisualPayload;
  subtitleText?: string;
  durationInFrames?: number;
}

const spectrum = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#6366f1', '#a855f7'];
const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

const RainField: React.FC<{ drift: number }> = ({ drift }) => (
  <svg width="100%" height="100%" viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0, opacity: 0.28 }}>
    {Array.from({ length: 42 }, (_, i) => {
      const x = (i * 157 + 61) % 1080;
      const y = ((i * 233 + drift * (12 + i % 5)) % 2100) - 90;
      return <line key={i} x1={x} y1={y} x2={x - 11} y2={y + 36} stroke="#bae6fd" strokeWidth={2 + (i % 3)} strokeLinecap="round" />;
    })}
  </svg>
);

const DropletDiagram: React.FC<{ payload: PhysicsOpticsVisualPayload; progress: number }> = ({ payload, progress }) => {
  const entry = interpolate(progress, [0.05, 0.32], [0, 1], clamp);
  const inside = interpolate(progress, [0.1, 0.35], [0, 1], clamp);
  const reflected = interpolate(progress, [0.32, 0.65], [0, 1], clamp);
  const exit = interpolate(progress, [0.58, 0.9], [0, 1], clamp);
  const showEntry = ['entry_refraction', 'internal_reflection', 'exit_angles'].includes(payload.stage);
  const showInside = ['internal_reflection', 'exit_angles'].includes(payload.stage);
  const showExit = payload.stage === 'exit_angles';
  return (
    <svg width="100%" height="100%" viewBox="0 0 900 900" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="drop" cx="35%" cy="25%">
          <stop offset="0" stopColor="#e0f2fe" stopOpacity=".64" />
          <stop offset=".6" stopColor="#38bdf8" stopOpacity=".18" />
          <stop offset="1" stopColor="#0ea5e9" stopOpacity=".36" />
        </radialGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="9" result="b" /><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx="450" cy="450" r="300" fill="url(#drop)" stroke="#7dd3fc" strokeWidth="5" />
      <ellipse cx="352" cy="300" rx="92" ry="38" fill="#fff" opacity=".16" transform="rotate(-25 352 300)" />
      {payload.showNormals && <line x1="110" y1="340" x2="790" y2="560" stroke="#cbd5e1" strokeDasharray="15 13" strokeWidth="3" opacity=".55" />}
      {showEntry && <path d={`M 0 255 L ${170 + entry * 280} ${335 + entry * 65}`} fill="none" stroke="#fff" strokeWidth="13" strokeLinecap="round" filter="url(#glow)" />}
      {showInside && spectrum.map((color, i) => <React.Fragment key={color}>
        <path d={`M 450 ${400 + i * 4} L ${450 + inside * 280} ${400 + inside * (170 + i * 5)}`} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" opacity=".95" />
        <path d={`M 730 ${570 + i * 5} L ${730 - reflected * 280} ${570 + reflected * (150 + i * 3)}`} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" opacity=".95" />
      </React.Fragment>)}
      {showExit && spectrum.map((color, i) => <path key={color} d={`M 450 ${720 + i * 8} L ${450 - exit * 390} ${720 + exit * (125 + i * 5)}`} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" filter="url(#glow)" />)}
      {payload.stage === 'entry_refraction' && <text x="450" y="830" fill="#e0f2fe" textAnchor="middle" fontSize="34" fontWeight="700">n đỏ = {payload.waterRefractiveIndices.red} · n tím = {payload.waterRefractiveIndices.violet}</text>}
      {payload.stage === 'internal_reflection' && <text x="450" y="830" fill="#e0f2fe" textAnchor="middle" fontSize="34" fontWeight="700">1 lần phản xạ trong</text>}
      {payload.stage === 'exit_angles' && <text x="450" y="830" fill="#e0f2fe" textAnchor="middle" fontSize="32" fontWeight="700">đỏ {payload.primaryRainbowAnglesDeg.red.toFixed(2)}° · tím {payload.primaryRainbowAnglesDeg.violet.toFixed(2)}°</text>}
    </svg>
  );
};

const SpectrumScene: React.FC<{ progress: number }> = ({ progress }) => {
  const beam = interpolate(progress, [0, 0.25], [0, 1], clamp);
  const spread = interpolate(progress, [0.22, 0.72], [0, 1], clamp);
  return <svg width="100%" height="100%" viewBox="0 0 900 760">
    <defs><filter id="beamGlow"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <path d={`M 0 380 L ${beam * 390} 380`} stroke="#fff" strokeWidth="20" filter="url(#beamGlow)" />
    <polygon points="390,180 390,580 650,380" fill="rgba(224,242,254,.16)" stroke="#bae6fd" strokeWidth="5" />
    {spectrum.map((color, i) => <path key={color} d={`M 650 380 L ${650 + spread * 250} ${380 + spread * ((i - 3) * 54)}`} stroke={color} strokeWidth="13" strokeLinecap="round" filter="url(#beamGlow)" />)}
    <text x="450" y="700" textAnchor="middle" fill="#cbd5e1" fontSize="30">phổ màu liên tục · các dải chỉ là cách minh họa</text>
  </svg>;
};

const ObserverScene: React.FC<{ progress: number }> = ({ progress }) => {
  const reveal = interpolate(progress, [0.08, 0.75], [0, 1], clamp);
  return <svg width="100%" height="100%" viewBox="0 0 900 920">
    <defs><filter id="arcGlow"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <circle cx="140" cy="190" r="64" fill="#fde68a" filter="url(#arcGlow)" />
    <path d="M 150 250 L 690 690" stroke="#fff" strokeDasharray="12 14" strokeWidth="4" opacity=".5" />
    <circle cx="700" cy="720" r="32" fill="#f8fafc"/><path d="M700 752v92M700 776l-54 62M700 776l54 62" stroke="#f8fafc" strokeWidth="14" strokeLinecap="round"/>
    {spectrum.map((color, i) => <path key={color} d={`M ${110 + i * 8} ${800 - i * 6} A ${340 + i * 14} ${340 + i * 14} 0 0 1 ${790 - i * 8} ${800 - i * 6}`} fill="none" stroke={color} strokeWidth="17" strokeDasharray="1100" strokeDashoffset={1100 * (1 - reveal)} filter="url(#arcGlow)" />)}
    <text x="700" y="900" textAnchor="middle" fill="#e0f2fe" fontSize="30">Mặt Trời ở sau lưng người quan sát</text>
  </svg>;
};

export const PhysicsOpticsScene: React.FC<PhysicsOpticsSceneProps> = ({ title, payload, subtitleText, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: compositionDuration } = useVideoConfig();
  const duration = durationInFrames ?? compositionDuration;
  const progress = Math.min(1, frame / Math.max(1, duration - 1));
  const intro = spring({ frame, fps, config: { damping: 18, stiffness: 110, mass: .8 } });
  const outro = interpolate(frame, [duration - Math.min(12, fps * .35), duration], [1, 0], clamp);
  const move = Easing.inOut(Easing.cubic)(progress);
  const scale = payload.cameraMove === 'push_in' ? 1 + move * .18 : payload.cameraMove === 'pull_out' ? 1.16 - move * .16 : 1.08;
  const translateX = payload.cameraMove === 'track_ray' ? interpolate(move, [0, 1], [42, -34]) : 0;
  const rotate = payload.cameraMove === 'orbit_drop' ? interpolate(move, [0, 1], [-2.5, 2.5]) : 0;
  return <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 32%, #152746 0%, #08111f 55%, #030712 100%)', color: '#f8fafc', overflow: 'hidden', fontFamily: 'Inter, Segoe UI, sans-serif', opacity: outro }}>
    <RainField drift={frame} />
    <div style={{ position: 'absolute', top: 132, left: 70, right: 70, zIndex: 5, opacity: intro, transform: `translateY(${(1 - intro) * 34}px)` }}>
      <div style={{ color: payload.accentColor, fontSize: 24, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase' }}>Quang học · theo dấu tia sáng</div>
      <div style={{ fontSize: 58, lineHeight: 1.08, fontWeight: 950, marginTop: 16, textWrap: 'balance' }}>{payload.headline || title}</div>
      <div style={{ fontSize: 29, color: '#bae6fd', marginTop: 18, fontWeight: 650 }}>{payload.focusLabel}</div>
    </div>
    <div style={{ position: 'absolute', left: 55, right: 55, top: 420, height: 1010, transform: `translateX(${translateX}px) scale(${scale}) rotate(${rotate}deg)`, transformOrigin: '50% 48%' }}>
      {payload.stage === 'white_light_spectrum' ? <SpectrumScene progress={progress} /> : payload.stage === 'observer_arc' || payload.stage === 'hook' ? <ObserverScene progress={payload.stage === 'hook' ? Math.min(.32, progress) : progress} /> : <DropletDiagram payload={payload} progress={progress} />}
    </div>
    <div style={{ position: 'absolute', left: 70, right: 70, bottom: 98, minHeight: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 8 }}>
      {subtitleText && <div style={{ fontSize: 31, lineHeight: 1.38, fontWeight: 700, textAlign: 'center', padding: '20px 28px', borderRadius: 24, background: 'rgba(3,7,18,.86)', border: '1px solid rgba(125,211,252,.36)', boxShadow: '0 20px 60px rgba(0,0,0,.45)' }}>{subtitleText}</div>}
    </div>
  </AbsoluteFill>;
};
