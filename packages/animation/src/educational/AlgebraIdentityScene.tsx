import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AlgebraIdentityVisualPayload } from '@luminalearn/scene-schema';
import { StepFormulaReveal } from '../StepFormulaReveal';

export const AlgebraIdentityScene: React.FC<{ title: string; payload: AlgebraIdentityVisualPayload; subtitleText?: string }> = ({ title, payload, subtitleText }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const comparisonOpacity = interpolate(frame, [0, Math.max(1, durationInFrames - 12)], [0.65, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ padding: '150px 52px 70px', color: '#F8FAFC', background: 'radial-gradient(circle at 50% 30%, #172554, #070B14 68%)', fontFamily: 'Arial, sans-serif' }}>
    <div style={{ color: '#67E8F9', fontSize: 22, fontWeight: 800, letterSpacing: 1.2 }}>ĐẠI SỐ · BIẾN ĐỔI TỪNG BƯỚC</div>
    <h1 style={{ fontSize: 45, lineHeight: 1.1, margin: '18px 0 8px' }}>{title}</h1>
    <StepFormulaReveal formulas={payload.transformationSteps.map((step) => step.expression)} accentColor="#FBBF24" />
    <div style={{ marginTop: 28, opacity: comparisonOpacity, borderRadius: 18, border: '1px solid rgba(251,191,36,.55)', padding: '18px 22px', background: 'rgba(15,23,42,.86)', fontSize: 25, textAlign: 'center' }}>
      {payload.leftExpression} <span style={{ color: '#FBBF24', padding: '0 12px' }}>=</span> {payload.rightExpression}
    </div>
    {subtitleText ? <div style={{ position: 'absolute', left: 48, right: 48, bottom: 52, borderRadius: 16, padding: '14px 18px', background: 'rgba(2,6,23,.88)', fontSize: 23, lineHeight: 1.3, textAlign: 'center' }}>{subtitleText}</div> : null}
  </AbsoluteFill>;
};

