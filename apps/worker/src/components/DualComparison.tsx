import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { DualComparisonContent, Fact } from '@luminalearn/scene-schema';
import { computePercentage, formatPercentage, formatRatio } from '../utils/math';

interface Props {
  content: DualComparisonContent;
  facts: Fact[];
}

export const DualComparison: React.FC<Props> = ({ content, facts }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const factA = facts.find((f) => f.id === content.factAId);
  const factB = facts.find((f) => f.id === content.factBId);

  const rawPercentA = factA ? computePercentage(factA.success, factA.total) : 0;
  const rawPercentB = factB ? computePercentage(factB.success, factB.total) : 0;

  // Header entrance
  const headerOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const headerY = interpolate(frame, [0, 20], [-20, 0], { extrapolateRight: 'clamp' });

  // Bar chart growth animation with spring
  const barProgress = spring({
    frame: frame - 25,
    fps,
    config: { damping: 15, stiffness: 80 }
  });

  // Animated counter
  const animatedPercentA = interpolate(frame, [25, 75], [0, rawPercentA], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const animatedPercentB = interpolate(frame, [25, 75], [0, rawPercentB], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Winner highlight badge entrance (frame 80-110)
  const winnerBadgeOpacity = interpolate(frame, [80, 105], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const winnerBadgeScale = spring({
    frame: frame - 80,
    fps,
    config: { damping: 12, stiffness: 120 }
  });

  // Takeaway card entrance (frame 110-140)
  const takeawayOpacity = interpolate(frame, [110, 135], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const takeawayY = interpolate(frame, [110, 135], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Exit transition (frame 225-240)
  const exitOpacity = interpolate(frame, [225, 240], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Maximum visual bar height in pixels (100% = 360px)
  const MAX_BAR_HEIGHT = 360;
  const heightA = Math.max(20, (rawPercentA / 100) * MAX_BAR_HEIGHT * barProgress);
  const heightB = Math.max(20, (rawPercentB / 100) * MAX_BAR_HEIGHT * barProgress);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '80px 48px 90px',
        opacity: exitOpacity,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Top Header */}
      <div
        style={{
          textAlign: 'center',
          opacity: headerOpacity,
          transform: `translateY(${headerY}px)`
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '6px 18px',
            borderRadius: 9999,
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            color: '#38BDF8',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '0.04em',
            marginBottom: 12
          }}
        >
          SO SÁNH THEO PHÂN NHÓM
        </div>
        <h2
          style={{
            fontSize: 34,
            fontWeight: 800,
            color: '#F8FAFC',
            margin: 0
          }}
        >
          {content.groupLabel}
        </h2>
      </div>

      {/* Center Dual Comparison Bars */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: 64,
          height: 480,
          position: 'relative'
        }}
      >
        {/* Column A */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: 220
          }}
        >
          {/* Winner Callout */}
          {content.highlightWinner === 'A' && (
            <div
              style={{
                opacity: winnerBadgeOpacity,
                transform: `scale(${Math.max(0, winnerBadgeScale)})`,
                background: 'linear-gradient(135deg, #10B981, #059669)',
                color: '#FFFFFF',
                padding: '6px 14px',
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 12,
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
              }}
            >
              👑 TỶ LỆ CAO HƠN
            </div>
          )}

          {/* Animated Percentage Label */}
          <div
            style={{
              fontSize: 42,
              fontWeight: 800,
              color: '#22D3EE',
              marginBottom: 8,
              textShadow: '0 0 20px rgba(34, 211, 238, 0.4)'
            }}
          >
            {formatPercentage(animatedPercentA)}
          </div>

          {/* Bar Pillar */}
          <div
            style={{
              width: '100%',
              height: heightA,
              background: 'linear-gradient(180deg, #22D3EE 0%, #0284C7 100%)',
              borderRadius: '16px 16px 4px 4px',
              boxShadow: '0 0 28px rgba(34, 211, 238, 0.3)',
              border: '2px solid rgba(34, 211, 238, 0.6)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              paddingTop: 12
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#070B14',
                background: 'rgba(255, 255, 255, 0.85)',
                padding: '2px 8px',
                borderRadius: 4
              }}
            >
              {factA ? formatRatio(factA.success, factA.total) : ''}
            </span>
          </div>

          {/* Bottom Card Title */}
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#F8FAFC' }}>
              Phương pháp A
            </div>
            <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 2 }}>
              {factA?.note || ''}
            </div>
          </div>
        </div>

        {/* Column B */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: 220
          }}
        >
          {/* Winner Callout */}
          {content.highlightWinner === 'B' && (
            <div
              style={{
                opacity: winnerBadgeOpacity,
                transform: `scale(${Math.max(0, winnerBadgeScale)})`,
                background: 'linear-gradient(135deg, #10B981, #059669)',
                color: '#FFFFFF',
                padding: '6px 14px',
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 12,
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
              }}
            >
              👑 TỶ LỆ CAO HƠN
            </div>
          )}

          {/* Animated Percentage Label */}
          <div
            style={{
              fontSize: 42,
              fontWeight: 800,
              color: '#A78BFA',
              marginBottom: 8,
              textShadow: '0 0 20px rgba(167, 139, 250, 0.4)'
            }}
          >
            {formatPercentage(animatedPercentB)}
          </div>

          {/* Bar Pillar */}
          <div
            style={{
              width: '100%',
              height: heightB,
              background: 'linear-gradient(180deg, #A78BFA 0%, #7C3AED 100%)',
              borderRadius: '16px 16px 4px 4px',
              boxShadow: '0 0 28px rgba(167, 139, 250, 0.3)',
              border: '2px solid rgba(167, 139, 250, 0.6)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              paddingTop: 12
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#070B14',
                background: 'rgba(255, 255, 255, 0.85)',
                padding: '2px 8px',
                borderRadius: 4
              }}
            >
              {factB ? formatRatio(factB.success, factB.total) : ''}
            </span>
          </div>

          {/* Bottom Card Title */}
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#F8FAFC' }}>
              Phương pháp B
            </div>
            <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 2 }}>
              {factB?.note || ''}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Takeaway Card */}
      {content.takeaway && (
        <div
          style={{
            opacity: takeawayOpacity,
            transform: `translateY(${takeawayY}px)`,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: 16,
            padding: '16px 24px',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 19,
              fontWeight: 600,
              color: '#38BDF8',
              lineHeight: 1.4
            }}
          >
            {content.takeaway}
          </p>
        </div>
      )}
    </div>
  );
};

