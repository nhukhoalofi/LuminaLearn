import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import type { EducationalStoryboardV3, EducationalSceneV3 } from '@luminalearn/scene-schema';
import {
  ConceptIntroScene,
  NeuralArchitectureScene,
  LossLandscapeScene,
  AttentionHeatmapScene,
  SummaryScene,
  GenericPlotScene,
  AlgebraIdentityScene,
  VisualDslSceneV3
} from '@luminalearn/animation';
import type { TrustedProofContextV3 } from '@luminalearn/animation';

export interface LuminaSceneV3Props {
  storyboard: EducationalStoryboardV3;
  subtitlesEnabled?: boolean;
  trustedProofContext?: TrustedProofContextV3;
  [key: string]: unknown;
}

/**
 * SceneDispatcherV3: Dispatch từng phân cảnh theo sceneType với contract visualPayload nghiêm ngặt.
 */
export const SceneDispatcherV3: React.FC<{ scene: EducationalSceneV3; subtitlesEnabled: boolean; trustedProofContext?: TrustedProofContextV3 }> = ({ scene, subtitlesEnabled, trustedProofContext }) => {
  if (scene.visualDefinition) {
    return <VisualDslSceneV3 definition={scene.visualDefinition} trustedProofContext={trustedProofContext} />;
  }
  const subtitle = subtitlesEnabled ? (scene.narration.subtitleVietnamese || scene.narration.vietnamese) : undefined;
  const payload = scene.visualPayload;

  switch (payload.sceneType) {
    case 'concept_intro':
      return <ConceptIntroScene title={scene.title} payload={payload} subtitleText={subtitle} />;
    case 'neural_architecture':
      return <NeuralArchitectureScene title={scene.title} payload={payload} subtitleText={subtitle} />;
    case 'loss_landscape':
      return <LossLandscapeScene title={scene.title} payload={payload} subtitleText={subtitle} />;
    case 'attention_heatmap':
      return <AttentionHeatmapScene title={scene.title} payload={payload} subtitleText={subtitle} />;
    case 'algebra_identity':
      return <AlgebraIdentityScene title={scene.title} payload={payload} subtitleText={subtitle} />;
    case 'summary':
      return <SummaryScene title={scene.title} payload={payload} subtitleText={subtitle} />;
    case 'formula_derivation':
    case 'graph_plot':
    case 'flowchart_simulation':
    case 'comparison_table':
      return <GenericPlotScene title={scene.title} payload={payload} subtitleText={subtitle} />;
    default: {
      const unsupported: never = payload;
      throw new Error(`unsupported_v3_scene_payload: ${String(unsupported)}`);
    }
  }
};

export const LuminaBrandOverlayV3: React.FC = () => (
  <div style={{ position: 'absolute', top: 36, left: 40, right: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50, pointerEvents: 'none' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#22D3EE', boxShadow: '0 0 10px #22D3EE' }} />
      <span style={{ fontSize: 22, fontWeight: 900, color: '#F8FAFC', letterSpacing: 0.5 }}>Lumina<span style={{ color: '#22D3EE' }}>Learn</span></span>
    </div>
    <div style={{ border: '1px solid rgba(34, 211, 238, 0.4)', backgroundColor: 'rgba(15, 23, 42, 0.75)', borderRadius: 9999, padding: '6px 14px', fontSize: 13, fontWeight: 800, letterSpacing: 1.2, color: '#22D3EE' }}>STUDIO V3</div>
  </div>
);

/**
 * LuminaSceneV3: Trình dựng phân cảnh giáo dục Remotion thế hệ mới V3.
 * Đáp ứng đầy đủ CHECKPOINT G:
 * - Dispatch định kiểu qua registry.
 * - Timeline liên tục (contiguous timeline) không đè hoặc hở frame.
 * - Khung hình dọc 9:16 chuẩn Mobile/Shorts.
 * - Lớp phủ phụ đề tiếng Việt an toàn (Burned-in subtitle safe area).
 * - Hoạt động độc lập không phụ thuộc Manim cho các phân cảnh đồ họa Remotion.
 */
export const LuminaSceneV3: React.FC<LuminaSceneV3Props> = ({ storyboard, subtitlesEnabled = true, trustedProofContext }) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#070B14' }}>
      {/* 1. Sequence từng scene dọc theo timeline */}
      {storyboard.scenes.map((scene, idx) => {
        const startSeconds = storyboard.scenes.slice(0, idx).reduce((sum, item) => sum + item.durationSeconds, 0);
        const endSeconds = startSeconds + scene.durationSeconds;
        const fromFrame = Math.round(startSeconds * fps);
        const sceneDurationFrames = Math.max(1, Math.round(endSeconds * fps) - fromFrame);

        return (
          <Sequence
            key={scene.sceneId || `scene_${idx}`}
            from={fromFrame}
            durationInFrames={sceneDurationFrames}
            name={`${idx + 1}. ${scene.title}`}
          >
            <SceneDispatcherV3 scene={scene} subtitlesEnabled={subtitlesEnabled} trustedProofContext={trustedProofContext} />
          </Sequence>
        );
      })}

      {/* 2. Brand Overlay cố định trên cùng */}
      <LuminaBrandOverlayV3 />
      {/*
      <div
        style={{
          position: 'absolute',
          top: 36,
          left: 40,
          right: 40,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 50,
          pointerEvents: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: '#22D3EE',
              boxShadow: '0 0 10px #22D3EE'
            }}
          />
          <span style={{ fontSize: 22, fontWeight: 900, color: '#F8FAFC', letterSpacing: 0.5 }}>
            Lumina<span style={{ color: '#22D3EE' }}>Learn</span>
          </span>
        </div>
        <div
          style={{
            border: '1px solid rgba(34, 211, 238, 0.4)',
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            borderRadius: 9999,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 1.2,
            color: '#22D3EE'
          }}
        >
          STUDIO V3
        </div>
      </div> */}
    </AbsoluteFill>
  );
};
