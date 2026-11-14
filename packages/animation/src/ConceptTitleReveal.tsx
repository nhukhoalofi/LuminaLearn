import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { durationBoundedFrame, progressBetween } from './motion';

export interface ConceptTitleRevealProps {
  title: string;
  eyebrow?: string;
  accentColor?: string;
  reducedMotion?: boolean;
}

/** Independent adaptation of Video Shotcraft's `brace-expand` choreography. */
export const ConceptTitleReveal: React.FC<ConceptTitleRevealProps> = ({ title, eyebrow, accentColor = '#22D3EE', reducedMotion = false }) => {
  const rawFrame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const frame = durationBoundedFrame(rawFrame, durationInFrames);
  const start = Math.min(10, Math.floor(durationInFrames * 0.12));
  const settleFrames = Math.max(8, Math.min(Math.round(fps * 0.8), Math.floor(durationInFrames * 0.32)));
  const expansion = reducedMotion ? progressBetween(frame, 0, 6) : spring({
    frame: frame - start, fps, config: { damping: 16, stiffness: 120, mass: 0.9 }, durationInFrames: settleFrames
  });
  const safeExpansion = Math.max(0, Math.min(1.08, expansion));
  const maxHalfWidth = Math.min(width * 0.39, 300);
  const innerHalfWidth = maxHalfWidth * safeExpansion;
  const titleOpacity = reducedMotion ? progressBetween(frame, 0, 6) : Math.min(1, safeExpansion * 1.8);
  const exit = interpolate(frame, [Math.max(0, durationInFrames - 10), durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '110px 54px 210px', opacity: exit }}>
      {eyebrow ? <div style={{ color: accentColor, fontSize: 18, fontWeight: 800, letterSpacing: 2.4, marginBottom: 24 }}>{eyebrow}</div> : null}
      <div style={{ position: 'relative', width: '100%', height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: innerHalfWidth * 2, maxHeight: 220, overflow: 'hidden', opacity: titleOpacity, textAlign: 'center' }}>
          <div style={{ fontSize: title.length > 32 ? 43 : 50, lineHeight: 1.14, fontWeight: 900, letterSpacing: -1.2 }}>{title}</div>
        </div>
        <div style={{ position: 'absolute', left: `calc(50% - ${innerHalfWidth + 24}px)`, color: accentColor, fontSize: 92, lineHeight: 1 }}>[</div>
        <div style={{ position: 'absolute', right: `calc(50% - ${innerHalfWidth + 24}px)`, color: accentColor, fontSize: 92, lineHeight: 1 }}>]</div>
      </div>
    </AbsoluteFill>
  );
};
