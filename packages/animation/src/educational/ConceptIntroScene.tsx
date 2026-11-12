import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ConceptIntroVisualPayload } from '@luminalearn/scene-schema';

export interface ConceptIntroSceneProps {
  title: string;
  payload: ConceptIntroVisualPayload;
  subtitleText?: string;
  durationInFrames?: number;
}

export const ConceptIntroScene: React.FC<ConceptIntroSceneProps> = ({
  title,
  payload,
  subtitleText,
  durationInFrames: propDuration
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: videoDuration } = useVideoConfig();
  const effectiveDuration = propDuration ?? videoDuration;

  const isReduced = payload.reducedMotion;
  const accentColor = payload.accentColor || '#22D3EE';

  // Entry animation
  const titleProgress = isReduced
    ? Math.min(1, frame / 10)
    : spring({ frame, fps, config: { damping: 14, stiffness: 100 } });

  const questionProgress = isReduced
    ? Math.min(1, Math.max(0, (frame - 15) / 10))
    : spring({ frame: frame - 15, fps, config: { damping: 14, stiffness: 100 } });

  const chipProgress = isReduced
    ? Math.min(1, Math.max(0, (frame - 25) / 10))
    : spring({ frame: frame - 25, fps, config: { damping: 14, stiffness: 100 } });

  // Fade out at scene end
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
        padding: '120px 48px 240px 48px', // 9:16 safe margins
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        opacity: exitOpacity,
        boxSizing: 'border-box'
      }}
    >
      {/* Top Header / Key Concept Chip */}
      <div
        style={{
          opacity: chipProgress,
          transform: `translateY(${interpolate(chipProgress, [0, 1], [-20, 0])}px)`,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}
      >
        <span
          style={{
            backgroundColor: `${accentColor}22`,
            color: accentColor,
            border: `1.5px solid ${accentColor}66`,
            padding: '6px 16px',
            borderRadius: 9999,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: 'uppercase'
          }}
        >
          {payload.keyConcept}
        </span>
        <span style={{ color: '#64748B', fontSize: 18, fontWeight: 500 }}>LuminaLearn V3</span>
      </div>

      {/* Center: Main Title */}
      <div
        style={{
          opacity: titleProgress,
          transform: `translateY(${interpolate(titleProgress, [0, 1], [30, 0])}px)`,
          textAlign: 'left'
        }}
      >
        <h1
          style={{
            fontSize: title.length > 40 ? 44 : 52,
            lineHeight: 1.15,
            fontWeight: 800,
            margin: 0,
            background: `linear-gradient(135deg, #FFFFFF 60%, ${accentColor})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: -0.5
          }}
        >
          {title}
        </h1>
      </div>

      {/* Central Question Callout Box */}
      <div
        style={{
          opacity: questionProgress,
          transform: `translateY(${interpolate(questionProgress, [0, 1], [30, 0])}px)`,
          backgroundColor: '#1E293B99',
          border: '1px solid #334155',
          borderLeft: `4px solid ${accentColor}`,
          borderRadius: 16,
          padding: '24px 28px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        }}
      >
        <div style={{ color: accentColor, fontSize: 16, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>
          Câu hỏi trọng tâm
        </div>
        <p
          style={{
            fontSize: 24,
            lineHeight: 1.4,
            fontWeight: 600,
            color: '#E2E8F0',
            margin: 0
          }}
        >
          {payload.centralQuestion}
        </p>
      </div>

      {/* Subtitle Bar in Safe Zone */}
      {subtitleText && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 20,
            color: '#94A3B8',
            fontStyle: 'italic',
            marginTop: 16
          }}
        >
          {subtitleText}
        </div>
      )}
    </AbsoluteFill>
  );
};

