import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AttentionHeatmapVisualPayload } from '@luminalearn/scene-schema';

export interface AttentionHeatmapSceneProps {
  title: string;
  payload: AttentionHeatmapVisualPayload;
  subtitleText?: string;
}

export const AttentionHeatmapScene: React.FC<AttentionHeatmapSceneProps> = ({
  title,
  payload,
  subtitleText
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const sceneProgress = spring({ frame, fps, config: { damping: 15, stiffness: 90 } });

  const exitOpacity = interpolate(
    frame,
    [Math.max(0, durationInFrames - 12), durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const tokens = payload.tokens;
  const matrix = payload.matrix;
  const n = tokens.length;
  const activeTokenIdx = payload.highlightTokenIndex ?? 0;

  // Grid sizing
  const cellSize = Math.min(100, Math.floor(480 / n));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0B0F19',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '110px 40px 220px 40px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        opacity: exitOpacity,
        boxSizing: 'border-box'
      }}
    >
      {/* Title & Badge */}
      <div style={{ opacity: sceneProgress }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span
            style={{
              backgroundColor: '#8B5CF622',
              color: '#A78BFA',
              border: '1px solid #8B5CF666',
              padding: '4px 12px',
              borderRadius: 9999,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 1
            }}
          >
            MA TRẬN CHÚ Ý (ATTENTION HEATMAP)
          </span>
          {payload.isIllustrative && (
            <span
              style={{
                backgroundColor: '#F59E0B22',
                color: '#FBBF24',
                padding: '3px 10px',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600
              }}
            >
              Ví dụ sư phạm minh họa
            </span>
          )}
        </div>
        <h2 style={{ fontSize: 36, fontWeight: 800, margin: '8px 0', color: '#F1F5F9' }}>{title}</h2>
      </div>

      {/* Heatmap Grid Container */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: '#11182788',
          borderRadius: 20,
          border: '1px solid #1F2937',
          padding: '24px 16px'
        }}
      >
        <div style={{ marginBottom: 12, color: '#94A3B8', fontSize: 16, fontWeight: 600 }}>
          Trục ngang: Khóa (Keys) &mdash; Trục dọc: Truy vấn (Queries)
        </div>

        {/* Top Header Labels (Keys) */}
        <div style={{ display: 'flex', marginLeft: 100, marginBottom: 8 }}>
          {tokens.map((token, colIdx) => (
            <div
              key={`key_lbl_${colIdx}`}
              style={{
                width: cellSize,
                textAlign: 'center',
                color: '#38BDF8',
                fontWeight: 700,
                fontSize: 18,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {token}
            </div>
          ))}
        </div>

        {/* Matrix Rows */}
        {matrix.map((row, rowIdx) => {
          const isHighlightedRow = rowIdx === activeTokenIdx;
          return (
            <div key={`row_${rowIdx}`} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              {/* Row Label (Query) */}
              <div
                style={{
                  width: 90,
                  marginRight: 10,
                  textAlign: 'right',
                  color: isHighlightedRow ? '#FCD34D' : '#E2E8F0',
                  fontWeight: isHighlightedRow ? 800 : 600,
                  fontSize: 18,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {tokens[rowIdx]}
              </div>

              {/* Cells */}
              {row.map((weight, colIdx) => {
                // Color intensity from dark slate to deep cyan/blue
                const intensity = Math.max(0, Math.min(1, weight));
                const bgAlpha = Math.max(0.12, intensity * 0.9);
                const isCellHighlighted = isHighlightedRow && intensity >= 0.3;

                return (
                  <div
                    key={`cell_${rowIdx}_${colIdx}`}
                    style={{
                      width: cellSize,
                      height: cellSize * 0.8,
                      backgroundColor: `rgba(56, 189, 248, ${bgAlpha})`,
                      border: isCellHighlighted ? '2px solid #F59E0B' : '1px solid #1E293B',
                      borderRadius: 8,
                      margin: '0 3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: intensity > 0.4 ? '#FFFFFF' : '#94A3B8',
                      fontWeight: 700,
                      fontSize: 17,
                      boxShadow: isCellHighlighted ? '0 0 12px rgba(245, 158, 11, 0.5)' : undefined
                    }}
                  >
                    {weight.toFixed(2)}
                  </div>
                );
              })}
            </div>
          );
        })}

        <div style={{ marginTop: 14, fontSize: 15, color: '#64748B' }}>
          Tổng các trọng số mỗi hàng sau Softmax xấp xỉ 1.0 (100%)
        </div>
      </div>

      {/* Subtitle */}
      <div style={{ textAlign: 'center', minHeight: 48 }}>
        <p style={{ margin: 0, fontSize: 20, color: '#CBD5E1', fontStyle: 'italic' }}>
          {subtitleText || `Từ "${tokens[activeTokenIdx]}" tập trung trọng số lớn nhất vào ngữ cảnh tương quan gần.`}
        </p>
      </div>
    </AbsoluteFill>
  );
};

