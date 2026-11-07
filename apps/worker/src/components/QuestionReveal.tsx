import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { QuestionRevealContent } from '@luminalearn/scene-schema';

interface Props {
  content: QuestionRevealContent;
}

export const QuestionReveal: React.FC<Props> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance animations
  const badgeOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp'
  });

  const questionProgress = spring({
    frame: frame - 15,
    fps,
    config: { damping: 14, stiffness: 100 }
  });

  const subtitleOpacity = interpolate(frame, [40, 65], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const subtitleY = interpolate(frame, [40, 65], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const noteOpacity = interpolate(frame, [65, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Exit transition towards end of scene (frame 105-120)
  const exitOpacity = interpolate(frame, [105, 120], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 48px',
        textAlign: 'center',
        opacity: exitOpacity,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Category Pill */}
      <div
        style={{
          opacity: badgeOpacity,
          transform: `scale(${badgeOpacity})`,
          padding: '8px 20px',
          borderRadius: 9999,
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          color: '#38BDF8',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: 36
        }}
      >
        💡 Câu Hỏi Thống Kê
      </div>

      {/* Main Question */}
      <h1
        style={{
          fontSize: 46,
          fontWeight: 800,
          lineHeight: 1.3,
          color: '#F8FAFC',
          marginBottom: 32,
          opacity: questionProgress,
          transform: `translateY(${(1 - questionProgress) * 30}px)`
        }}
      >
        {content.question}
      </h1>

      {/* Subtitle Card */}
      {content.subtitle && (
        <div
          style={{
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
            background: 'rgba(17, 26, 48, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: '16px 28px',
            color: '#A78BFA',
            fontSize: 22,
            fontWeight: 600,
            marginBottom: 28,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}
        >
          {content.subtitle}
        </div>
      )}

      {/* Hook Note */}
      {content.hookNote && (
        <div
          style={{
            opacity: noteOpacity,
            color: '#94A3B8',
            fontSize: 18,
            maxWidth: 540,
            lineHeight: 1.5
          }}
        >
          {content.hookNote}
        </div>
      )}
    </div>
  );
};

