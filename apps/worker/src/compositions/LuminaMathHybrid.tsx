import React from 'react';
import {
  AbsoluteFill, interpolate, OffthreadVideo, Sequence, spring, staticFile,
  useCurrentFrame, useVideoConfig
} from 'remotion';
import { Audio } from '@remotion/media';
import {
  HybridVideoManifestSchema,
  type HybridTimelineScene,
  type HybridVideoManifest
} from '@luminalearn/scene-schema';

export interface LuminaMathHybridProps {
  manifest: HybridVideoManifest;
  [key: string]: unknown;
}

const colors = { background: '#070B14', panel: '#0F172A', cyan: '#22D3EE', blue: '#38BDF8', violet: '#A78BFA', text: '#F8FAFC', muted: '#94A3B8', amber: '#FBBF24' };

const shellStyle: React.CSSProperties = {
  backgroundColor: colors.background,
  backgroundImage: 'radial-gradient(circle at 50% 15%, rgba(56,189,248,.16), transparent 45%), radial-gradient(circle at 80% 80%, rgba(167,139,250,.13), transparent 48%)',
  color: colors.text,
  fontFamily: 'Arial, sans-serif',
  padding: '112px 54px 92px',
  justifyContent: 'center'
};

const Brand: React.FC<{ mode: HybridVideoManifest['renderMode'] }> = ({ mode }) => (
  <div style={{ position: 'absolute', top: 38, left: 48, right: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 20 }}>
    <div style={{ fontSize: 24, fontWeight: 900, color: colors.cyan }}>LuminaLearn</div>
    <div style={{ border: `1px solid ${mode === 'live' ? colors.violet : colors.cyan}`, borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 800, letterSpacing: 1, color: mode === 'live' ? colors.violet : colors.cyan }}>
      {mode === 'live' ? 'GEMINI LIVE' : 'MOCK AI DEMO'}
    </div>
  </div>
);

const TextScene: React.FC<{ scene: HybridTimelineScene; mode: HybridVideoManifest['renderMode'] }> = ({ scene, mode }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });
  const openingOpacity = scene.template === 'hook' ? 1 : 0;
  const opacity = interpolate(frame, [0, 10, scene.durationFrames - 12, scene.durationFrames], [openingOpacity, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const formulas = scene.content.formulas ?? [];
  return (
    <AbsoluteFill style={shellStyle}>
      <Brand mode={mode} />
      <div style={{ opacity, transform: `translateY(${scene.template === 'hook' ? 0 : (1 - enter) * 44}px)` }}>
        {scene.content.eyebrow ? <div style={{ color: colors.cyan, fontWeight: 800, letterSpacing: 2.2, fontSize: 17, marginBottom: 24 }}>{scene.content.eyebrow}</div> : null}
        <div style={{ fontWeight: 900, fontSize: scene.template === 'summary' ? 47 : 54, lineHeight: 1.12, letterSpacing: -1.5 }}>{scene.content.title}</div>
        {scene.content.body ? <div style={{ marginTop: 28, color: colors.muted, fontSize: 28, lineHeight: 1.45 }}>{scene.content.body}</div> : null}
        {formulas.length ? (
          <div style={{ marginTop: 38, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {formulas.map((formula, index) => {
              const formulaOpacity = interpolate(frame, [18 + index * 30, 28 + index * 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              return <div key={formula} style={{ opacity: formulaOpacity, padding: '22px 24px', borderRadius: 20, background: 'rgba(15,23,42,.9)', border: `1px solid ${index === formulas.length - 1 ? colors.violet : '#1E3A5F'}`, color: index === formulas.length - 1 ? colors.violet : colors.text, fontSize: 30, fontWeight: 700, textAlign: 'center' }}>{formula}</div>;
            })}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const MathClipScene: React.FC<{ manifest: HybridVideoManifest; scene: Extract<HybridTimelineScene, { template: 'math_clip' }> }> = ({ manifest, scene }) => {
  const asset = manifest.mathClipAssets.find((candidate) => candidate.id === scene.assetId);
  if (!asset) throw new Error(`Missing verified math asset: ${scene.assetId}`);
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <OffthreadVideo
        src={staticFile(asset.publicPath)}
        trimBefore={scene.sourceStartFrame}
        durationInFrames={scene.sourceDurationFrames}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <Brand mode={manifest.renderMode} />
    </AbsoluteFill>
  );
};

const SubtitleOverlay: React.FC<{ manifest: HybridVideoManifest }> = ({ manifest }) => {
  const frame = useCurrentFrame();
  if (!manifest.subtitles?.burnedIn) return null;
  const cue = manifest.subtitles.cues.find((candidate) => frame >= candidate.startFrame && frame < candidate.endFrame);
  if (!cue) return null;
  return (
    <div style={{
      position: 'absolute', zIndex: 40, left: 48, right: 48, bottom: 58,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none'
    }}>
      <div style={{
        maxWidth: 620, padding: '13px 20px', borderRadius: 14,
        background: 'rgba(3, 8, 18, .88)', border: '1px solid rgba(148, 163, 184, .26)',
        color: colors.text, fontSize: 26, fontWeight: 700, lineHeight: 1.3,
        textAlign: 'center', whiteSpace: 'pre-line', boxShadow: '0 8px 30px rgba(0,0,0,.4)'
      }}>{cue.text}</div>
    </div>
  );
};

export const LuminaMathHybrid: React.FC<LuminaMathHybridProps> = ({ manifest: input }) => {
  const manifest = HybridVideoManifestSchema.parse(input);
  const frame = useCurrentFrame();
  const progress = Math.min(1, frame / (manifest.videoSettings.durationFrames - 1));
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      {manifest.timelineScenes.map((scene) => (
        <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationFrames} name={`${scene.id} (${scene.template})`}>
          {scene.template === 'math_clip'
            ? <MathClipScene manifest={manifest} scene={scene} />
            : <TextScene scene={scene} mode={manifest.renderMode} />}
        </Sequence>
      ))}
      {manifest.narrationAudioAssets.map((asset) => (
        <Audio
          key={asset.id}
          src={staticFile(asset.publicPath)}
          from={asset.startFrame}
          volume={0.92}
        />
      ))}
      <SubtitleOverlay manifest={manifest} />
      <div style={{ position: 'absolute', zIndex: 30, left: 0, right: 0, bottom: 0, height: 7, background: 'rgba(255,255,255,.08)' }}>
        <div style={{ width: `${progress * 100}%`, height: '100%', background: `linear-gradient(90deg, ${colors.cyan}, ${colors.blue}, ${colors.violet})` }} />
      </div>
    </AbsoluteFill>
  );
};

