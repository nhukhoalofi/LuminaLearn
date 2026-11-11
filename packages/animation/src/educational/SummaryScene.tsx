import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { SummaryVisualPayload } from '@luminalearn/scene-schema';

export interface SummarySceneProps {
  title: string;
  payload: SummaryVisualPayload;
  subtitleText?: string;
  durationInFrames?: number;
}

export const SummaryScene: React.FC<SummarySceneProps> = ({
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
              backgroundColor: '#6366F122',
              color: '#818CF8',
              border: '1px solid #6366F166',
              padding: '4px 14px',
              borderRadius: 9999,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 1
            }}
          >
            TỔNG KẾT BÀI HỌC
          </span>
          <span style={{ color: '#64748B', fontSize: 16 }}>LuminaLearn Studio</span>
        </div>
        <h2 style={{ fontSize: 40, fontWeight: 800, margin: '8px 0', color: '#FFFFFF' }}>{payload.title || title}</h2>
      </div>

      {/* Takeaway Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {payload.takeaways.map((takeaway, idx) => {
          const itemProgress = spring({
            frame: frame - 10 * idx,
            fps,
            config: { damping: 14, stiffness: 100 }
          });
          return (
            <div
              key={`takeaway_${idx}`}
              style={{
                opacity: itemProgress,
                transform: `translateX(${interpolate(itemProgress, [0, 1], [-20, 0])}px)`,
                backgroundColor: '#1E293B88',
                border: '1px solid #334155',
                borderRadius: 14,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#38BDF822',
                  color: '#38BDF8',
                  border: '1px solid #38BDF866',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 18,
                  flexShrink: 0
                }}
              >
                {idx + 1}
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#E2E8F0', lineHeight: 1.35 }}>
                {takeaway}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary facts are pedagogical content, not formula-level proof bindings. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {payload.verifiedFacts.length > 0 && (
          <div
            style={{
              backgroundColor: '#10B98115',
              border: '1px solid #10B98144',
              borderRadius: 10,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}
          >
            <span style={{ color: '#10B981', fontWeight: 800 }}>Kết quả trọng tâm:</span>
            <span style={{ color: '#A7F3D0', fontSize: 16 }}>{payload.verifiedFacts.join(' • ')}</span>
          </div>
        )}
      </div>

      {/* Final Callout Banner */}
      {payload.finalCallout && (
        <div
          style={{
            textAlign: 'center',
            backgroundColor: '#0F172A',
            borderTop: '2px solid #38BDF8',
            borderRadius: 12,
            padding: '16px 20px',
            color: '#38BDF8',
            fontSize: 20,
            fontWeight: 700
          }}
        >
          {payload.finalCallout}
        </div>
      )}

      {/* Subtitle */}
      {subtitleText && (
        <div style={{ textAlign: 'center', fontSize: 18, color: '#94A3B8', fontStyle: 'italic' }}>
          {subtitleText}
        </div>
      )}
    </AbsoluteFill>
  );
};

