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
  AnimatedVisualDslSceneV3,
  VisualDslSceneV3,
  FormulaSequenceSceneV3,
  supportedSubtitleMathLatex,
  adaptScalarFunctionGraphV3,
  adaptGeometry2dV3,
  adaptDirectedDiagramV3,
  adaptAttentionMatrixV3,
  adaptProbabilityTreeV3
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
  const subtitleMath = supportedSubtitleMathLatex(activeCue.text);
  // Legacy approved artifacts may contain a formula-only subtitle. The same
  // expression is now typeset in the scene, so suppress the duplicate raw cue.
  if (subtitleMath) return null;

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
export const SceneDispatcherV3: React.FC<{
  scene: EducationalSceneV3;
  subtitlesEnabled: boolean;
  trustedProofContext?: TrustedProofContextV3;
  sceneDurationFrames?: number;
  scalarGraphPhase?: 'introduce_curve' | 'secant_step' | 'secant_motion' | 'tangent_hold';
}> = ({ scene, subtitlesEnabled, trustedProofContext, sceneDurationFrames, scalarGraphPhase }) => {
  const subtitle = subtitlesEnabled ? (scene.narration.subtitleVietnamese || scene.narration.vietnamese) : undefined;
  if (scene.visualDefinition) {
    return (
      <AnimatedVisualDslSceneV3
        definition={scene.visualDefinition}
        trustedProofContext={trustedProofContext}
        durationInFrames={sceneDurationFrames}
          subtitleText={subtitle}
      />
    );
  }
  const payload = scene.visualPayload;

  // Universal Scientific Visual Engine auto-dispatch when typed scientificData is bound
  if ('scientificData' in payload && payload.scientificData) {
    const sci = payload.scientificData;
    if (sci.kind === 'verified_formula_steps') {
      return (
        <FormulaSequenceSceneV3
          data={sci}
          subtitleText={subtitle}
          durationInFrames={sceneDurationFrames}
          trustedProofContext={trustedProofContext}
        />
      );
    }
    if (sci.kind === 'scalar_function_1d') {
      if ((payload.visualIntent === 'formula_focus' || payload.displayMath?.presentation === 'formula_focus') && payload.sceneType === 'formula_derivation') {
        return <GenericPlotScene title={scene.title} payload={payload} subtitleText={subtitle} durationInFrames={sceneDurationFrames} />;
      }
      return (
        <AnimatedVisualDslSceneV3
          definition={adaptScalarFunctionGraphV3(sci, scene.sceneId, {
            phase: scalarGraphPhase,
            formulaTex: payload.sceneType === 'formula_derivation' ? (payload.displayMath?.latex ?? payload.formulaTex) : undefined
          })}
          trustedProofContext={trustedProofContext}
          durationInFrames={sceneDurationFrames}
          subtitleText={subtitle}
        />
      );
    }
    if (sci.kind === 'geometry_2d') {
      return (
        <AnimatedVisualDslSceneV3
          definition={adaptGeometry2dV3(sci, scene.sceneId)}
          trustedProofContext={trustedProofContext}
          durationInFrames={sceneDurationFrames}
          subtitleText={subtitle}
        />
      );
    }
    if (sci.kind === 'directed_diagram') {
      return (
        <AnimatedVisualDslSceneV3
          definition={adaptDirectedDiagramV3(sci, scene.sceneId)}
          trustedProofContext={trustedProofContext}
          durationInFrames={sceneDurationFrames}
          subtitleText={subtitle}
        />
      );
    }
    if (sci.kind === 'attention_matrix') {
      return (
        <AnimatedVisualDslSceneV3
          definition={adaptAttentionMatrixV3(sci, scene.sceneId)}
          trustedProofContext={trustedProofContext}
          durationInFrames={sceneDurationFrames}
          subtitleText={subtitle}
        />
      );
    }
    if (sci.kind === 'probability_tree') {
      return (
        <AnimatedVisualDslSceneV3
          definition={adaptProbabilityTreeV3(sci, scene.sceneId)}
          trustedProofContext={trustedProofContext}
          durationInFrames={sceneDurationFrames}
          subtitleText={subtitle}
        />
      );
    }
  }

  switch (payload.sceneType) {
    case 'concept_intro':
      return <ConceptIntroScene title={scene.title} payload={payload} subtitleText={subtitle} durationInFrames={sceneDurationFrames} />;
    case 'neural_architecture':
      return <NeuralArchitectureScene title={scene.title} payload={payload} subtitleText={subtitle} durationInFrames={sceneDurationFrames} />;
    case 'loss_landscape':
      return <LossLandscapeScene title={scene.title} payload={payload} subtitleText={subtitle} durationInFrames={sceneDurationFrames} />;
    case 'attention_heatmap':
      return <AttentionHeatmapScene title={scene.title} payload={payload} subtitleText={subtitle} durationInFrames={sceneDurationFrames} />;
    case 'algebra_identity':
      return (
        <AlgebraIdentityScene
          title={scene.title}
          payload={payload}
          subtitleText={subtitle}
          durationInFrames={sceneDurationFrames}
          trustedProofContext={trustedProofContext}
        />
      );
    case 'summary':
      return <SummaryScene title={scene.title} payload={payload} subtitleText={subtitle} durationInFrames={sceneDurationFrames} />;
    case 'formula_derivation':
    case 'graph_plot':
    case 'flowchart_simulation':
    case 'comparison_table':
      return <GenericPlotScene title={scene.title} payload={payload} subtitleText={subtitle} durationInFrames={sceneDurationFrames} />;
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
        const scalarGraphScenes = storyboard.scenes.filter((candidate) =>
          'scientificData' in candidate.visualPayload &&
          candidate.visualPayload.scientificData?.kind === 'scalar_function_1d'
        );
        const scalarGraphIndex = scalarGraphScenes.findIndex((candidate) => candidate.sceneId === scene.sceneId);
        const typedVisualIntent = 'visualIntent' in scene.visualPayload ? scene.visualPayload.visualIntent : undefined;
        const scalarGraphPhase = scalarGraphIndex < 0
          ? undefined
          : typedVisualIntent === 'curve_introduction'
            ? 'introduce_curve' as const
            : typedVisualIntent === 'limit_transition'
              ? 'secant_motion' as const
              : typedVisualIntent === 'secant_measurement'
                ? 'secant_step' as const
                : typedVisualIntent === 'tangent_result' || typedVisualIntent === 'formula_focus'
                  ? 'tangent_hold' as const
          : scalarGraphIndex === 0
            ? 'introduce_curve' as const
            : 'scientificData' in scene.visualPayload && scene.visualPayload.scientificData?.kind === 'scalar_function_1d' && scene.visualPayload.scientificData.secantFromX !== undefined
              ? 'secant_step' as const
              : 'tangent_hold' as const;

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
              sceneDurationFrames={sceneDurationFrames}
              scalarGraphPhase={scalarGraphPhase}
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
