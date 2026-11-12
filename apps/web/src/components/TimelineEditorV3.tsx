'use client';

import React from 'react';

export interface TimelineProps {
  scenes: Array<{
    sceneId: string;
    title: string;
    sceneType: string;
    durationSeconds: number;
  }>;
  totalDurationSeconds: number;
  selectedSceneId: string;
  onSelectScene: (sceneId: string) => void;
  fps?: number;
}

export function TimelineViewerV3({
  scenes,
  totalDurationSeconds,
  selectedSceneId,
  onSelectScene,
  fps = 24
}: TimelineProps) {
  const totalFrames = Math.round(totalDurationSeconds * fps);

  return (
    <div
      style={{
        marginBottom: '16px',
        padding: '12px',
        background: 'rgba(15, 23, 42, 0.9)',
        borderRadius: '8px',
        border: '1px solid rgba(148, 163, 184, 0.2)'
      }}
      data-testid="v3-timeline-viewer"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h4 style={{ margin: 0, color: '#F8FAFC', fontSize: '13px' }}>
          ⏱️ Trình xem thời gian — chỉ đọc ({totalDurationSeconds}s · {totalFrames} frames @ {fps}fps)
        </h4>
        <span style={{ fontSize: '11px', color: '#94A3B8' }}>
          An toàn phụ đề: Đáy 80px
        </span>
      </div>

      {/* Visual Timeline Bar */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '38px',
          background: 'rgba(30, 41, 59, 0.6)',
          borderRadius: '6px',
          overflow: 'hidden',
          padding: '2px',
          gap: '2px'
        }}
      >
        {scenes.map((scene, idx) => {
          const widthPct = totalDurationSeconds > 0 ? (scene.durationSeconds / totalDurationSeconds) * 100 : 0;
          const isSelected = scene.sceneId === selectedSceneId;
          return (
            <button
              type="button"
              key={scene.sceneId}
              onClick={() => onSelectScene(scene.sceneId)}
              title={`${scene.title} (${scene.durationSeconds}s / ${Math.round(scene.durationSeconds * fps)} frames)`}
              style={{
                width: `${widthPct}%`,
                height: '100%',
                background: isSelected
                  ? 'linear-gradient(180deg, #38BDF8, #0284C7)'
                  : idx % 2 === 0
                  ? 'rgba(51, 65, 85, 0.8)'
                  : 'rgba(71, 85, 105, 0.8)',
                border: isSelected ? '1px solid #FFFFFF' : 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                color: isSelected ? '#FFFFFF' : '#E2E8F0',
                fontSize: '10px',
                fontWeight: isSelected ? 700 : 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: '0 4px',
                transition: 'all 0.15s ease'
              }}
            >
              {scene.durationSeconds}s
            </button>
          );
        })}
      </div>

      {/* Frame Markers */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '4px',
          fontSize: '10px',
          color: '#64748B'
        }}
      >
        <span>0s (f0)</span>
        <span>{Math.round(totalDurationSeconds / 4)}s</span>
        <span>{Math.round(totalDurationSeconds / 2)}s</span>
        <span>{Math.round((3 * totalDurationSeconds) / 4)}s</span>
        <span>{totalDurationSeconds}s (f{totalFrames})</span>
      </div>
    </div>
  );
}

/** @deprecated Phase 8 exposes this read-only control honestly as TimelineViewerV3. */
export const TimelineEditorV3 = TimelineViewerV3;

