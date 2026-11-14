import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { durationBoundedFrame, progressBetween } from './motion';

export interface BeforeAfterComparisonProps { before: React.ReactNode; after: React.ReactNode; beforeLabel?: string; afterLabel?: string; reducedMotion?: boolean; }

/** Fast declaration, slow proof, and final hold from Shotcraft's slider-scrub recipe. */
export const BeforeAfterComparison: React.FC<BeforeAfterComparisonProps> = ({ before, after, beforeLabel = 'TRƯỚC', afterLabel = 'SAU', reducedMotion = false }) => {
  const rawFrame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const frame = durationBoundedFrame(rawFrame, durationInFrames);
  const flingEnd = Math.max(8, Math.floor(durationInFrames * 0.2));
  const holdEnd = Math.max(flingEnd + 4, Math.floor(durationInFrames * 0.38));
  const scrubEnd = Math.max(holdEnd + 8, Math.floor(durationInFrames * 0.72));
  const position = reducedMotion ? 50 : frame < flingEnd
    ? interpolate(progressBetween(frame, 0, flingEnd), [0, 1], [12, 76])
    : frame < holdEnd ? 70 : interpolate(progressBetween(frame, holdEnd, scrubEnd - holdEnd), [0, 1], [70, 42]);
  return (
    <div style={{ position: 'relative', width: '100%', height: 460, overflow: 'hidden', borderRadius: 22, border: '1px solid #334155' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.58, filter: 'saturate(.35) contrast(.8)' }}>{before}</div>
      <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - position}% 0 0)` }}>{after}</div>
      <div style={{ position: 'absolute', top: 20, right: 20, padding: '7px 12px', borderRadius: 999, background: '#E2E8F0', color: '#0F172A', fontSize: 14, fontWeight: 900 }}>{beforeLabel}</div>
      <div style={{ position: 'absolute', top: 20, left: 20, padding: '7px 12px', borderRadius: 999, background: '#0F172A', color: '#F8FAFC', fontSize: 14, fontWeight: 900 }}>{afterLabel}</div>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${position}%`, width: 3, transform: 'translateX(-1.5px)', background: '#fff', boxShadow: '0 0 18px rgba(0,0,0,.35)' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 60, height: 60, transform: 'translate(-50%,-50%)', borderRadius: 999, background: '#fff', color: '#0F172A', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 900 }}>↔</div>
      </div>
    </div>
  );
};
