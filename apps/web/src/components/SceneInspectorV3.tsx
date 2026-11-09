'use client';

import React from 'react';
import { VisualPropertyPanelV3 } from './VisualPropertyPanelV3';
import { EducationalPreviewPanelV3 } from './EducationalPreviewPanelV3';
import { visualRegistryV3 } from '@luminalearn/scene-schema';

export interface SceneInspectorProps {
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
}

export function SceneInspectorV3({
  scene,
  onUpdateScene,
  onMathModified,
  subtitlesEnabled = true
}: SceneInspectorProps) {
  const allComponents = visualRegistryV3.listAll();

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
            onChange={(e) => {
              const newType = e.target.value;
              onUpdateScene({ ...scene, sceneType: newType });
            }}
          >
            {allComponents.map((c) => (
              <option key={c.componentId} value={c.componentId}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', color: '#94A3B8' }}>Thời lượng (giây)</label>
          <input
            type="number"
            min={1}
            max={120}
            className="form-input"
            value={scene.durationSeconds}
            onChange={(e) => onUpdateScene({ ...scene, durationSeconds: Number(e.target.value) })}
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
        scene={scene}
        subtitlesEnabled={subtitlesEnabled}
      />
    </div>
  );
}

