import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from 'remotion';
import { Audio } from '@remotion/media';
import { ConceptTitleReveal, StepFormulaReveal } from '@luminalearn/animation';
import {
  RenderManifestV2Schema,
  type RenderManifestV2,
  type TimelineSceneV2
} from '@luminalearn/scene-schema';

export interface LuminaDynamicV2Props {
  manifest: RenderManifestV2;
  [key: string]: unknown;
}

const colors = {
  background: '#070B14',
  panel: '#0F172A',
  cyan: '#22D3EE',
  blue: '#38BDF8',
  violet: '#A78BFA',
  text: '#F8FAFC',
  muted: '#94A3B8',
  amber: '#FBBF24'
};

const shellStyle: React.CSSProperties = {
  backgroundColor: colors.background,
  backgroundImage:
    'radial-gradient(circle at 50% 15%, rgba(56,189,248,.16), transparent 45%), radial-gradient(circle at 80% 80%, rgba(167,139,250,.13), transparent 48%)',
  color: colors.text,
  fontFamily: 'Arial, sans-serif',
  padding: '112px 54px 92px',
  justifyContent: 'center'
};

const BrandHeader: React.FC<{ topicTitle?: string }> = ({ topicTitle }) => (
  <div
    style={{
      position: 'absolute',
      top: 38,
      left: 48,
      right: 48,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 20
    }}
  >
    <div style={{ fontSize: 24, fontWeight: 900, color: colors.cyan }}>LuminaLearn</div>
    <div
      style={{
        border: `1px solid ${colors.cyan}`,
        borderRadius: 999,
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: 1,
        color: colors.cyan
      }}
    >
      ARCH V2 DYNAMIC
    </div>
  </div>
);

const DynamicTextScene: React.FC<{ scene: TimelineSceneV2 }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });
  const isIntro = scene.sceneType === 'intro';
  const openingOpacity = isIntro ? 1 : 0;
  const opacity = interpolate(
    frame,
    [0, 10, scene.durationFrames - 12, scene.durationFrames],
    [openingOpacity, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const formulas = scene.content.formulas ?? [];
  const chalkboard = scene.parameters.visualStyleId === 'math_chalkboard';
  const sceneShellStyle: React.CSSProperties = chalkboard
    ? { ...shellStyle, backgroundColor: '#102A24', backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(245,241,223,.06), transparent 55%)', color: '#F5F1DF' }
    : shellStyle;

  if (isIntro) {
    return (
      <AbsoluteFill style={sceneShellStyle}>
        <BrandHeader />
        <ConceptTitleReveal
          title={scene.content.title}
          eyebrow={scene.content.eyebrow}
          accentColor={colors.cyan}
        />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={sceneShellStyle}>
      <BrandHeader />
      <div
        style={{
          opacity,
          transform: `translateY(${isIntro ? 0 : (1 - enter) * 44}px)`
        }}
      >
        {scene.content.eyebrow ? (
          <div style={{ color: colors.cyan, fontWeight: 800, letterSpacing: 2.2, fontSize: 17, marginBottom: 24 }}>
            {scene.content.eyebrow}
          </div>
        ) : null}
        <div
          style={{
            fontWeight: 900,
            fontSize: scene.sceneType === 'summary' ? 44 : 50,
            lineHeight: 1.15,
            letterSpacing: -1.2
          }}
        >
          {scene.content.title}
        </div>
        {scene.content.body ? (
          <div style={{ marginTop: 26, color: colors.muted, fontSize: 27, lineHeight: 1.45 }}>
            {scene.content.body}
          </div>
        ) : null}
        {formulas.length ? <StepFormulaReveal formulas={formulas} accentColor={colors.violet} /> : null}
      </div>
    </AbsoluteFill>
  );
};

const DynamicMathClipScene: React.FC<{
  manifest: RenderManifestV2;
  scene: TimelineSceneV2;
}> = ({ manifest, scene }) => {
  const asset = manifest.visualAssets.find((a) => a.id === scene.assetId);
  if (!asset) {
    throw new Error(`Missing verified visual asset: ${scene.assetId} for scene ${scene.id}`);
  }

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <OffthreadVideo
        src={staticFile(asset.publicPath)}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </AbsoluteFill>
  );
};

const DynamicSubtitleOverlay: React.FC<{ manifest: RenderManifestV2 }> = ({ manifest }) => {
  const frame = useCurrentFrame();
  if (!manifest.subtitleTrack?.cues?.length) return null;

  const cue = manifest.subtitleTrack.cues.find(
    (candidate) => frame >= candidate.startFrame && frame < candidate.endFrame
  );
  if (!cue) return null;
  const activeScene = manifest.timeline.find(
    (scene) => frame >= scene.startFrame && frame < scene.startFrame + scene.durationFrames
  );
  const overlaysVerifiedMath = Boolean(activeScene?.assetId);

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 40,
        left: 48,
        right: 48,
        bottom: overlaysVerifiedMath ? 190 : 58,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          maxWidth: 620,
          padding: '13px 20px',
          borderRadius: 14,
          background: 'rgba(3, 8, 18, .9)',
          border: '1px solid rgba(148, 163, 184, .28)',
          color: colors.text,
          fontSize: 25,
          fontWeight: 700,
          lineHeight: 1.35,
          textAlign: 'center',
          whiteSpace: 'pre-line',
          boxShadow: '0 8px 30px rgba(0,0,0,.4)'
        }}
      >
        {cue.text}
      </div>
    </div>
  );
};

export const LuminaDynamicV2: React.FC<LuminaDynamicV2Props> = ({ manifest: input }) => {
  const manifest = RenderManifestV2Schema.parse(input);
  const frame = useCurrentFrame();
  const progress = Math.min(1, frame / Math.max(1, manifest.totalFrames - 1));

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      {manifest.timeline.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.durationFrames}
          name={`${scene.id} (${scene.templateId})`}
        >
          {scene.assetId ? (
            <DynamicMathClipScene manifest={manifest} scene={scene} />
          ) : (
            <DynamicTextScene scene={scene} />
          )}
        </Sequence>
      ))}

      {manifest.audioAssets.map((asset) => (
        <Audio
          key={asset.id}
          src={staticFile(asset.path)}
          from={asset.startFrame ?? 0}
          volume={0.92}
        />
      ))}

      <DynamicSubtitleOverlay manifest={manifest} />

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          zIndex: 30,
          left: 0,
          right: 0,
          bottom: 0,
          height: 7,
          background: 'rgba(255,255,255,.08)'
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${colors.cyan}, ${colors.blue}, ${colors.violet})`
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

