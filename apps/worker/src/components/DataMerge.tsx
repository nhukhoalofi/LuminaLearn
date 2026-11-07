import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { DataMergeContent, Fact } from '@luminalearn/scene-schema';
import { computePercentage, formatPercentage, formatRatio, sumFacts } from '../utils/math';

interface Props {
  content: DataMergeContent;
  facts: Fact[];
}

export const DataMerge: React.FC<Props> = ({ content, facts }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const factA1 = facts.find((f) => f.id === content.factAId1) || { success: 0, total: 1 };
  const factA2 = facts.find((f) => f.id === content.factAId2) || { success: 0, total: 1 };
  const factB1 = facts.find((f) => f.id === content.factBId1) || { success: 0, total: 1 };
  const factB2 = facts.find((f) => f.id === content.factBId2) || { success: 0, total: 1 };

  // Pure dynamic calculation
  const totalA = sumFacts(factA1, factA2);
  const totalB = sumFacts(factB1, factB2);

  const percentA = computePercentage(totalA.success, totalA.total);
  const percentB = computePercentage(totalB.success, totalB.total);

  // Entrance
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const tableOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: 'clamp' });

  // Bar growth starts after table is revealed (frame 45)
  const barProgress = spring({
    frame: frame - 45,
    fps,
    config: { damping: 14, stiffness: 75 }
  });

  const animatedPercentA = interpolate(frame, [45, 105], [0, percentA], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const animatedPercentB = interpolate(frame, [45, 105], [0, percentB], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Paradox alert callout (frame 110-140)
  const alertProgress = spring({
    frame: frame - 110,
    fps,
    config: { damping: 12, stiffness: 100 }
  });

  // Note card (frame 145-175)
  const noteOpacity = interpolate(frame, [145, 170], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Exit transition (frame 225-240)
  const exitOpacity = interpolate(frame, [225, 240], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const MAX_BAR_HEIGHT = 280;
  const heightA = Math.max(16, (percentA / 100) * MAX_BAR_HEIGHT * barProgress);
  const heightB = Math.max(16, (percentB / 100) * MAX_BAR_HEIGHT * barProgress);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '70px 48px 80px',
        opacity: exitOpacity,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Title */}
      <div style={{ textAlign: 'center', opacity: titleOpacity }}>
        <div
          style={{
            display: 'inline-block',
            padding: '6px 18px',
            borderRadius: 9999,
            background: 'rgba(251, 191, 36, 0.15)',
            border: '1px solid rgba(251, 191, 36, 0.35)',
            color: '#FBBF24',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '0.04em',
            marginBottom: 10
          }}
        >
          ⚡ ĐẢO CHIỀU KẾT QUẢ
        </div>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
          {content.title}
        </h2>
      </div>

      {/* Breakdown Sum Table */}
      <div
        style={{
          opacity: tableOpacity,
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 14,
          padding: '12px 20px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16
        }}
      >
        <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 13, color: '#22D3EE', fontWeight: 700 }}>
            PHƯƠNG PHÁP A (TỔNG)
          </div>
          <div style={{ fontSize: 16, color: '#F8FAFC', marginTop: 4 }}>
            {formatRatio(factA1.success, factA1.total)} + {formatRatio(factA2.success, factA2.total)} ={' '}
            <strong style={{ color: '#22D3EE' }}>{formatRatio(totalA.success, totalA.total)}</strong>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#A78BFA', fontWeight: 700 }}>
            PHƯƠNG PHÁP B (TỔNG)
          </div>
          <div style={{ fontSize: 16, color: '#F8FAFC', marginTop: 4 }}>
            {formatRatio(factB1.success, factB1.total)} + {formatRatio(factB2.success, factB2.total)} ={' '}
            <strong style={{ color: '#A78BFA' }}>{formatRatio(totalB.success, totalB.total)}</strong>
          </div>
        </div>
      </div>

      {/* Merged Bar Chart Comparison */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: 64,
          height: 340,
          position: 'relative'
        }}
      >
        {/* Column A (Merged) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 220 }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#22D3EE', marginBottom: 8 }}>
            {formatPercentage(animatedPercentA)}
          </div>
          <div
            style={{
              width: '100%',
              height: heightA,
              background: 'linear-gradient(180deg, #22D3EE 0%, #0284C7 100%)',
              borderRadius: '14px 14px 4px 4px',
              border: '2px solid rgba(34, 211, 238, 0.6)',
              display: 'flex',
              justifyContent: 'center',
              paddingTop: 10
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#070B14',
                background: 'rgba(255, 255, 255, 0.9)',
                padding: '2px 8px',
                borderRadius: 4
              }}
            >
              {formatRatio(totalA.success, totalA.total)}
            </span>
          </div>
          <div style={{ marginTop: 12, fontSize: 20, fontWeight: 700, color: '#F8FAFC' }}>
            A: 26.4%
          </div>
        </div>

        {/* Column B (Merged) - The Winner! */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 220 }}>
          <div
            style={{
              opacity: alertProgress,
              transform: `scale(${Math.max(0, alertProgress)})`,
              background: 'linear-gradient(135deg, #10B981, #059669)',
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: 800,
              marginBottom: 8,
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
            }}
          >
            🏆 B THẮNG ÁP ĐẢO!
          </div>

          <div
            style={{
              fontSize: 42,
              fontWeight: 800,
              color: '#A78BFA',
              marginBottom: 8,
              textShadow: '0 0 24px rgba(167, 139, 250, 0.5)'
            }}
          >
            {formatPercentage(animatedPercentB)}
          </div>
          <div
            style={{
              width: '100%',
              height: heightB,
              background: 'linear-gradient(180deg, #A78BFA 0%, #7C3AED 100%)',
              borderRadius: '14px 14px 4px 4px',
              boxShadow: '0 0 32px rgba(167, 139, 250, 0.4)',
              border: '2px solid rgba(167, 139, 250, 0.7)',
              display: 'flex',
              justifyContent: 'center',
              paddingTop: 10
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#070B14',
                background: 'rgba(255, 255, 255, 0.9)',
                padding: '2px 8px',
                borderRadius: 4
              }}
            >
              {formatRatio(totalB.success, totalB.total)}
            </span>
          </div>
          <div style={{ marginTop: 12, fontSize: 20, fontWeight: 700, color: '#F8FAFC' }}>
            B: 73.6%
          </div>
        </div>
      </div>

      {/* Paradox Explanation Note */}
      <div
        style={{
          opacity: noteOpacity,
          background: 'rgba(251, 191, 36, 0.08)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: 14,
          padding: '14px 20px',
          textAlign: 'center'
        }}
      >
        <p style={{ margin: 0, fontSize: 16, color: '#FDE68A', lineHeight: 1.45, fontWeight: 500 }}>
          {content.paradoxNote}
        </p>
      </div>
    </div>
  );
};

