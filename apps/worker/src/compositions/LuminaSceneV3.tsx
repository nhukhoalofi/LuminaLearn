import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
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

export interface SubtitleCueV3 {
  cueId?: string;
  sceneId: string;
  text: string;
  startFrame: number;
  endFrame: number;
}

export interface LuminaSceneV3Props {
  storyboard: EducationalStoryboardV3;
  subtitlesEnabled?: boolean;
  trustedProofContext?: TrustedProofContextV3;
  subtitleCues?: SubtitleCueV3[];
  [key: string]: unknown;
}

/**
 * Authoritative Burned-in Subtitle Overlay:
 * Renders the active subtitle cue strictly between speechStartFrame and speechEndFrame.
 * Positioned in the bottom safe area to never obstruct centered formulas or chalkboard derivations.
 */
export const BurnedInSubtitleOverlayV3: React.FC<{
  cues: SubtitleCueV3[];
  enabled: boolean;
}> = ({ cues, enabled }) => {
  const frame = useCurrentFrame();
  if (!enabled || !cues || cues.length === 0) return null;

  const activeCue = cues.find((c) => frame >= c.startFrame && frame < c.endFrame);
  if (!activeCue || !activeCue.text.trim()) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 110,
        left: 40,
        right: 40,
        zIndex: 45,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.90)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: 14,
          padding: '12px 24px',
          maxWidth: '92%',
          textAlign: 'center',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)'
        }}
      >
        <span
          style={{
            fontSize: 26,
            lineHeight: 1.4,
            fontWeight: 600,
            color: '#F8FAFC',
            letterSpacing: '0.2px',
            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
            wordBreak: 'break-word'
          }}
        >
          {activeCue.text}
        </span>
      </div>
    </div>
  );
};

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
export const LuminaSceneV3: React.FC<LuminaSceneV3Props> = ({
  storyboard,
  subtitlesEnabled = true,
  trustedProofContext,
  subtitleCues
}) => {
  const { fps } = useVideoConfig();
  const hasAuthoritativeCues = Array.isArray(subtitleCues) && subtitleCues.length > 0;

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
            {/* If authoritative top-level subtitle cues are active, disable nested subtitles to avoid duplicate overlays */}
            <SceneDispatcherV3
              scene={scene}
              subtitlesEnabled={hasAuthoritativeCues ? false : subtitlesEnabled}
              trustedProofContext={trustedProofContext}
            />
          </Sequence>
        );
      })}

      {/* 2. Authoritative Burned-in Subtitle Overlay (Frame-accurate with speech start/end frames) */}
      {hasAuthoritativeCues && (
        <BurnedInSubtitleOverlayV3 cues={subtitleCues} enabled={subtitlesEnabled} />
      )}

      {/* 3. Brand Overlay cố định trên cùng */}
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
