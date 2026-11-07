import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ConceptSummaryContent } from '@luminalearn/scene-schema';

interface Props {
  content: ConceptSummaryContent;
}

export const ConceptSummary: React.FC<Props> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance
  const badgeOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  const cardProgress = spring({
    frame: frame - 15,
    fps,
    config: { damping: 14, stiffness: 90 }
  });

  const disclaimerOpacity = interpolate(frame, [45, 70], [0, 1], {
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
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Category Pill */}
      <div
        style={{
          opacity: badgeOpacity,
          transform: `scale(${badgeOpacity})`,
          padding: '8px 22px',
          borderRadius: 9999,
          background: 'rgba(167, 139, 250, 0.15)',
          border: '1px solid rgba(167, 139, 250, 0.35)',
          color: '#A78BFA',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: 32
        }}
      >
        🎓 Bài Học Rút Ra
      </div>

      {/* Main Concept Card */}
      <div
        style={{
          opacity: cardProgress,
          transform: `translateY(${(1 - cardProgress) * 24}px)`,
          background: 'linear-gradient(135deg, rgba(17, 26, 48, 0.95), rgba(11, 17, 32, 0.95))',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: 24,
          padding: '36px 32px',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.1)',
          maxWidth: 620,
          marginBottom: 36
        }}
      >
        <h2
          style={{
            fontSize: 34,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #22D3EE, #38BDF8, #A78BFA)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: '0 0 20px'
          }}
        >
          {content.principle}
        </h2>

        <p
          style={{
            fontSize: 22,
            lineHeight: 1.6,
            color: '#E2E8F0',
            margin: 0,
            fontWeight: 500
          }}
        >
          {content.explanation}
        </p>
      </div>

      {/* Disclaimer Box */}
      <div
        style={{
          opacity: disclaimerOpacity,
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: '12px 20px',
          fontSize: 15,
          color: '#94A3B8',
          maxWidth: 560,
          lineHeight: 1.5
        }}
      >
        ℹ️ {content.disclaimer}
      </div>
    </div>
  );
};

