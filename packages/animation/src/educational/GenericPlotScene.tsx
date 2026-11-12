import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { GenericSceneVisualPayload } from '@luminalearn/scene-schema';
import { MathExpression } from './MathExpression';
import { formatEducationalMathDisplay } from './educational-math-display';

export interface GenericPlotSceneProps {
  title: string;
  payload: GenericSceneVisualPayload;
  subtitleText?: string;
  durationInFrames?: number;
}

export const GenericPlotScene: React.FC<GenericPlotSceneProps> = ({
  title,
  payload,
  subtitleText,
  durationInFrames: propDuration
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: videoDuration } = useVideoConfig();
  const effectiveDuration = propDuration ?? videoDuration;

  const sceneProgress = spring({ frame, fps, config: { damping: 15, stiffness: 90 } });

  const exitOpacity = interpolate(
    frame,
    [Math.max(0, effectiveDuration - 12), effectiveDuration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0B0F19',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '110px 48px 230px 48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        opacity: exitOpacity,
        boxSizing: 'border-box'
      }}
    >
      {/* Title */}
      <div style={{ opacity: sceneProgress }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span
            style={{
              backgroundColor: '#38BDF822',
              color: '#38BDF8',
              border: '1px solid #38BDF866',
              padding: '4px 14px',
              borderRadius: 9999,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase'
            }}
          >
            {payload.sceneType.replace('_', ' ')}
          </span>
          <span style={{ color: '#64748B', fontSize: 16 }}>LuminaLearn Studio</span>
        </div>
        <h2 style={{ fontSize: 38, fontWeight: 800, margin: '8px 0', color: '#FFFFFF' }}>{title}</h2>
      </div>

      {/* Main Content Card */}
      <div
        style={{
          backgroundColor: '#1E293B88',
          border: '1px solid #334155',
          borderRadius: 20,
          padding: '36px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        }}
      >
        {payload.headline && (
          <div style={{ fontSize: 26, fontWeight: 700, color: '#38BDF8', marginBottom: 20, textAlign: 'center' }}>
            {payload.headline}
          </div>
        )}

        {(payload.displayMath?.latex || payload.formulaTex) && (
          <div
            style={{
              backgroundColor: '#0F172A',
              border: '1px solid #38BDF866',
              borderRadius: 14,
              padding: '20px 28px',
              color: '#F8FAFC',
              fontSize: 28,
              fontWeight: 800,
              textAlign: 'center',
              marginBottom: 16,
              maxWidth: '100%',
              overflowWrap: 'break-word'
            }}
          >
            <MathExpression expression={payload.displayMath?.latex ?? payload.formulaTex!} fontSize={32} maxWidthPx={560} />
          </div>
        )}

        {payload.notes && (
          <div style={{ fontSize: 18, color: '#94A3B8', textAlign: 'center', lineHeight: 1.4 }}>
            {formatEducationalMathDisplay(payload.notes)}
          </div>
        )}
      </div>

      {/* Subtitle */}
      {subtitleText && (
        <div style={{ textAlign: 'center', fontSize: 18, color: '#94A3B8', fontStyle: 'italic' }}>
          {formatEducationalMathDisplay(subtitleText)}
        </div>
      )}
    </AbsoluteFill>
  );
};

