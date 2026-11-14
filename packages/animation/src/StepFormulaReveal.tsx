import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { durationBoundedFrame, progressBetween } from './motion';

export interface StepFormulaRevealProps { formulas: string[]; accentColor?: string; reducedMotion?: boolean; }

/** Split/stagger assembly adapted from Shotcraft's `type-assembly-moves` recipe. */
export const StepFormulaReveal: React.FC<StepFormulaRevealProps> = ({ formulas, accentColor = '#A78BFA', reducedMotion = false }) => {
  const rawFrame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const frame = durationBoundedFrame(rawFrame, durationInFrames);
  const stagger = Math.max(4, Math.min(14, Math.floor(durationInFrames / Math.max(3, formulas.length + 2))));
  const enterDuration = Math.max(6, Math.min(Math.round(fps * 0.45), stagger + 6));
  return (
    <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {formulas.map((formula, index) => {
        const start = reducedMotion ? 0 : 12 + index * stagger;
        const progress = progressBetween(frame, start, reducedMotion ? 5 : enterDuration);
        const translate = reducedMotion ? 0 : interpolate(progress, [0, 1], [30, 0]);
        return (
          <div key={`${index}-${formula}`} style={{ display: 'grid', gridTemplateColumns: '34px 1fr', alignItems: 'center', opacity: progress }}>
            <div style={{ color: accentColor, fontSize: 15, fontWeight: 900 }}>{String(index + 1).padStart(2, '0')}</div>
            <div style={{ transform: `translateY(${translate}px)`, padding: '19px 22px', borderRadius: 16, background: 'rgba(15,23,42,.94)', border: `1px solid ${index === formulas.length - 1 ? accentColor : '#1E3A5F'}`, color: index === formulas.length - 1 ? accentColor : '#F8FAFC', fontSize: 28, fontWeight: 750, textAlign: 'center' }}>{formula}</div>
          </div>
        );
      })}
    </div>
  );
};
