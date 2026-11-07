import React from 'react';
import { Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import type { LessonStoryboard } from '@luminalearn/scene-schema';
import { QuestionReveal } from '../components/QuestionReveal';
import { DualComparison } from '../components/DualComparison';
import { DataMerge } from '../components/DataMerge';
import { ConceptSummary } from '../components/ConceptSummary';

export interface LuminaVideoProps {
  storyboard: LessonStoryboard;
  [key: string]: unknown;
}

export const LuminaVideo: React.FC<LuminaVideoProps> = ({ storyboard }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Bottom progress bar calculation
  const progressRatio = Math.min(1, Math.max(0, frame / durationInFrames));

  let accumulatedFrames = 0;

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#070B14',
        backgroundImage: `
          radial-gradient(circle at 50% 15%, rgba(56, 189, 248, 0.14) 0%, transparent 60%),
          radial-gradient(circle at 80% 80%, rgba(167, 139, 250, 0.12) 0%, transparent 50%),
          radial-gradient(circle at 20% 90%, rgba(34, 211, 238, 0.08) 0%, transparent 40%)
        `,
        position: 'relative',
        overflow: 'hidden',
        color: '#F8FAFC'
      }}
    >
      {/* Brand Header / Watermark */}
      <div
        style={{
          position: 'absolute',
          top: 36,
          left: 48,
          right: 48,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #22D3EE, #38BDF8, #A78BFA)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)'
            }}
          >
            <span style={{ color: '#070B14', fontSize: 16, fontWeight: 900 }}>L</span>
          </div>
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #22D3EE, #38BDF8, #A78BFA)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            LuminaLearn
          </span>
        </div>

        <div
          style={{
            fontSize: 13,
            color: '#64748B',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          DevFest 2026
        </div>
      </div>

      {/* Render Scenes in Sequence */}
      {storyboard.scenes.map((scene) => {
        const from = accumulatedFrames;
        accumulatedFrames += scene.durationFrames;

        return (
          <Sequence
            key={scene.id}
            from={from}
            durationInFrames={scene.durationFrames}
            name={`${scene.id} (${scene.template})`}
          >
            {scene.template === 'question_reveal' && (
              <QuestionReveal content={scene.content} />
            )}

            {scene.template === 'dual_comparison' && (
              <DualComparison content={scene.content} facts={storyboard.facts} />
            )}

            {scene.template === 'data_merge' && (
              <DataMerge content={scene.content} facts={storyboard.facts} />
            )}

            {scene.template === 'concept_summary' && (
              <ConceptSummary content={scene.content} />
            )}
          </Sequence>
        );
      })}

      {/* Persistent Bottom Video Progress Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: 'rgba(255, 255, 255, 0.08)',
          zIndex: 20
        }}
      >
        <div
          style={{
            width: `${progressRatio * 100}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #22D3EE, #38BDF8, #A78BFA)',
            boxShadow: '0 0 10px rgba(56, 189, 248, 0.6)'
          }}
        />
      </div>
    </div>
  );
};
