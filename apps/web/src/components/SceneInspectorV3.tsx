'use client';

import React, { useState } from 'react';
import { VisualPropertyPanelV3 } from './VisualPropertyPanelV3';
import { EducationalPreviewPanelV3 } from './EducationalPreviewPanelV3';
import { visualRegistryV3 } from '@luminalearn/scene-schema';

export interface SceneInspectorProps {
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
  onUpdateScene: (updated: any) => void;
  onMathModified?: () => void;
  subtitlesEnabled?: boolean;
  isDraftDirty?: boolean;
}

export function SceneInspectorV3({
  draftId,
  draftVersion,
  scene,
  onUpdateScene,
  onMathModified,
  subtitlesEnabled = true,
  isDraftDirty = false
}: SceneInspectorProps) {
  const allComponents = visualRegistryV3.listAll();

  // Audio Preview State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [normalizedNarration, setNormalizedNarration] = useState<string | null>(null);
  const [audioCacheHit, setAudioCacheHit] = useState<boolean | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const charCount = scene.narration.vietnamese.length;
  const wordCount = scene.narration.vietnamese.split(/\s+/).filter(Boolean).length;

  const handlePreviewAudio = async () => {
    setIsPlayingAudio(true);
    setAudioError(null);
    try {
      const response = await fetch(`/api/v3/lessons/${draftId}/preview-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftVersion,
          sceneId: scene.sceneId,
          customNarrationText: scene.narration.vietnamese
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'preview_audio_failed');
      }

      setAudioUrl(data.audioDataUrl);
      setAudioDuration(data.durationSeconds);
      setNormalizedNarration(data.normalizedText);
      setAudioCacheHit(data.cacheHit);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPlayingAudio(false);
    }
  };

  return (
    <div
      style={{
        padding: '14px',
        background: 'rgba(30, 41, 59, 0.4)',
        borderRadius: '8px',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        marginBottom: '16px'
      }}
      data-testid="v3-scene-inspector"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <strong style={{ fontSize: '14px', color: '#F8FAFC' }}>
          🎬 Phân cảnh: {scene.title} ({scene.sceneId})
        </strong>
        <span style={{ fontSize: '11px', color: '#38BDF8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
          {scene.durationSeconds}s · {Math.round(scene.durationSeconds * 24)} frames
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <div>
          <label style={{ fontSize: '11px', color: '#94A3B8' }}>Tiêu đề phân cảnh</label>
          <input
            className="form-input"
            value={scene.title}
            onChange={(e) => onUpdateScene({ ...scene, title: e.target.value })}
          />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: '#94A3B8' }}>Loại cảnh (Visual Component)</label>
          <select
            className="form-input"
            value={scene.sceneType}
            disabled
            aria-label="Loại cảnh chỉ đọc"
          >
            {allComponents.map((c) => (
              <option key={c.componentId} value={c.componentId}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', color: '#94A3B8' }}>Thời lượng (giây, chỉ đọc)</label>
          <input
            type="number"
            min={1}
            max={120}
            className="form-input"
            value={scene.durationSeconds}
            disabled
          />
        </div>
      </div>

      {/* Narration and Subtitle Editors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <div>
          <label style={{ fontSize: '11px', color: '#94A3B8' }}>Lời dẫn tiếng Việt (Narration)</label>
          <textarea
            className="form-textarea"
            rows={3}
            aria-label={`Lời dẫn V3 ${scene.sceneId}`}
            value={scene.narration.vietnamese}
            onChange={(e) =>
              onUpdateScene({
                ...scene,
                narration: { ...scene.narration, vietnamese: e.target.value }
              })
            }
          />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: '#94A3B8' }}>Phụ đề tiếng Việt (Subtitle)</label>
          <textarea
            className="form-textarea"
            rows={3}
            aria-label={`Phụ đề V3 ${scene.sceneId}`}
            value={scene.narration.subtitleVietnamese}
            onChange={(e) =>
              onUpdateScene({
                ...scene,
                narration: { ...scene.narration, subtitleVietnamese: e.target.value }
              })
            }
          />
        </div>
      </div>

      {/* Audio Preview and Normalization Controls (Phase 11) */}
      <div
        style={{
          padding: '10px 12px',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: '6px',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          marginBottom: '12px'
        }}
        data-testid="v3-audio-preview-section"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="quick-chip"
              style={{
                background: isPlayingAudio ? 'rgba(56, 189, 248, 0.2)' : 'rgba(56, 189, 248, 0.1)',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                cursor: isPlayingAudio ? 'wait' : 'pointer'
              }}
              disabled={isPlayingAudio || !scene.narration.vietnamese.trim()}
              onClick={handlePreviewAudio}
              data-testid="btn-preview-audio"
            >
              {isPlayingAudio ? '⏳ Đang tạo audio...' : '🔊 Nghe thử giọng đọc (TTS Preview)'}
            </button>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              {charCount} ký tự · {wordCount} từ
            </span>
          </div>

          {audioDuration !== null && (
            <div style={{ display: 'flex', gap: '6px', fontSize: '11px' }}>
              <span style={{ color: '#4ade80', background: 'rgba(74, 222, 128, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                ⏱️ {audioDuration.toFixed(1)}s
              </span>
              <span style={{ color: audioCacheHit ? '#38bdf8' : '#fbbf24', background: 'rgba(15, 23, 42, 0.6)', padding: '2px 6px', borderRadius: '4px' }}>
                {audioCacheHit ? '⚡ Cache HIT' : '🎙️ Cache MISS'}
              </span>
            </div>
          )}
        </div>

        {audioUrl && (
          <div style={{ marginTop: '8px' }}>
            <audio controls src={audioUrl} style={{ width: '100%', height: '36px' }} />
            {normalizedNarration && (
              <details style={{ marginTop: '6px' }}>
                <summary style={{ fontSize: '11px', color: '#94a3b8', cursor: 'pointer' }}>
                  Xem văn bản chuẩn hóa phát âm tiếng Việt
                </summary>
                <p style={{ fontSize: '12px', color: '#cbd5e1', fontStyle: 'italic', marginTop: '4px', background: 'rgba(0, 0, 0, 0.2)', padding: '6px', borderRadius: '4px' }}>
                  "{normalizedNarration}"
                </p>
              </details>
            )}
          </div>
        )}

        {audioError && (
          <p role="alert" style={{ color: '#f87171', fontSize: '11px', marginTop: '4px' }}>
            ⚠️ {audioError}
          </p>
        )}
      </div>

      {/* Typed Visual Property Controls */}
      <VisualPropertyPanelV3
        sceneType={scene.sceneType}
        visualPayload={scene.visualPayload}
        onChange={(updatedPayload) =>
          onUpdateScene({ ...scene, visualPayload: updatedPayload })
        }
        onMathModified={onMathModified}
      />

      {/* Frame Preview Panel */}
      <EducationalPreviewPanelV3
        draftId={draftId}
        draftVersion={draftVersion}
        scene={scene}
        subtitlesEnabled={subtitlesEnabled}
        isDraftDirty={isDraftDirty}
      />
    </div>
  );
}

