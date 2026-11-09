'use client';

import React, { useState } from 'react';

export interface PreviewPanelProps {
  draftId: string;
  draftVersion: number;
  scene: {
    sceneId: string;
    title: string;
    sceneType: string;
    durationSeconds: number;
    narration: { vietnamese: string; subtitleVietnamese: string };
    visualPayload: unknown;
  };
  subtitlesEnabled?: boolean;
  isDraftDirty?: boolean;
}

export function EducationalPreviewPanelV3({
  draftId,
  draftVersion,
  scene,
  subtitlesEnabled = true,
  isDraftDirty = false
}: PreviewPanelProps) {
  const [frame, setFrame] = useState(24);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maxFrames = Math.max(1, Math.round(scene.durationSeconds * 24));

  async function handleRenderPreview() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v3/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          draftVersion,
          sceneId: scene.sceneId,
          frame,
          subtitlesEnabled
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Preview render failed');
      }

      setPreviewUrl(data.previewDataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        marginTop: '12px',
        padding: '12px',
        background: 'rgba(15, 23, 42, 0.85)',
        borderRadius: '8px',
        border: '1px solid rgba(56, 189, 248, 0.25)'
      }}
      data-testid="v3-preview-panel"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '13px', color: '#38BDF8' }}>
          👁️ Remotion Live Preview (Frame-Accurate)
        </h4>
        <span style={{ fontSize: '11px', color: '#94A3B8' }}>
          Độ phân giải: 720×1280 @ 24fps
        </span>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', color: '#CBD5E1', minWidth: '70px' }}>
          Frame: {frame} ({(frame / 24).toFixed(1)}s)
        </label>
        <input
          type="range"
          min={0}
          max={maxFrames - 1}
          value={frame}
          onChange={(e) => setFrame(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="quick-chip"
          style={{ background: '#0284C7', color: '#FFFFFF', padding: '4px 10px' }}
          disabled={loading || isDraftDirty}
          onClick={handleRenderPreview}
        >
          {loading ? 'Đang render...' : '📸 Render Preview Frame'}
        </button>
      </div>

      {isDraftDirty && (
        <div role="status" style={{ fontSize: '11px', color: '#FBBF24', marginBottom: '8px' }}>
          Hãy lưu và tái kiểm định bản nháp trước khi preview để khung hình luôn lấy từ phiên bản máy chủ đã xác thực.
        </div>
      )}

      {error && (
        <div style={{ fontSize: '11px', color: '#F87171', background: 'rgba(248, 113, 113, 0.1)', padding: '6px', borderRadius: '4px', marginBottom: '8px' }}>
          {error}
        </div>
      )}

      {previewUrl && (
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <img
            src={previewUrl}
            alt={`Preview frame ${frame}`}
            style={{
              maxHeight: '320px',
              maxWidth: '100%',
              borderRadius: '6px',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
            }}
          />
        </div>
      )}
    </div>
  );
}

