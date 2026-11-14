import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { VerifiedFormulaStepsDataV1Schema, type ScientificVisualDataV1 } from '@luminalearn/scene-schema';
import { MathExpression } from './MathExpression';
import { deriveMotionRecipeFrameV3 } from './motion-recipes-v3';
import type { TrustedProofContextV3 } from './VisualDslSceneV3';

export type VerifiedFormulaStepsDataV1 = Extract<ScientificVisualDataV1, { kind: 'verified_formula_steps' }>;

export interface FormulaStepCardProps {
  step: VerifiedFormulaStepsDataV1['steps'][number];
  stepNumber: number;
  totalSteps: number;
  isActive: boolean;
  isVisible: boolean;
  revealOpacity: number;
  revealTranslateY: number;
  highlightPulseProgress: number;
  trustedProofContext?: TrustedProofContextV3;
}

/** Reusable formula step card with verified KaTeX rendering and term highlight animation. */
export const FormulaStepCard: React.FC<FormulaStepCardProps> = ({
  step,
  stepNumber,
  isActive,
  isVisible,
  revealOpacity,
  revealTranslateY,
  highlightPulseProgress
}) => {
  const isSubstitution = step.explanation.toLowerCase().includes('thay') || step.explanation.toLowerCase().includes('substitut');
  const isExpansion = step.explanation.toLowerCase().includes('khai triển') || step.explanation.toLowerCase().includes('expand');
  const isSimplification = step.explanation.toLowerCase().includes('rút gọn') || step.explanation.toLowerCase().includes('đơn giản');

  const transformationBadge = isSubstitution
    ? { label: 'Phép thay thế', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.18)' }
    : isExpansion
    ? { label: 'Khai triển', color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.18)' }
    : isSimplification
    ? { label: 'Rút gọn', color: '#34D399', bg: 'rgba(52, 211, 153, 0.18)' }
    : null;

  return (
    <div
      data-formula-step={step.stepId}
      data-active={String(isActive)}
      style={{
        opacity: isVisible ? (isActive ? revealOpacity : 0.68) : 0.12,
        transform: `translateY(${isActive ? revealTranslateY : 0}px)`,
        border: `1.5px solid ${isActive ? '#4ADE80' : '#234E3F'}`,
        background: isActive ? 'rgba(20, 83, 45, 0.48)' : 'rgba(15, 42, 34, 0.58)',
        borderRadius: 18,
        padding: '14px 18px',
        minHeight: 102,
        transition: 'border-color 0.2s ease',
        boxShadow: isActive ? '0 8px 24px rgba(74, 222, 128, 0.15)' : 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              display: 'grid',
              placeItems: 'center',
              background: isActive ? '#22C55E' : '#21483a',
              fontWeight: 900,
              fontSize: 13,
              color: '#FFFFFF'
            }}
          >
            {stepNumber}
          </div>
          {transformationBadge && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: transformationBadge.color,
                background: transformationBadge.bg,
                padding: '2px 8px',
                borderRadius: 6,
                letterSpacing: 0.4
              }}
            >
              {transformationBadge.label}
            </span>
          )}
        </div>
        {step.proofReferenceId && (
          <span
            style={{
              fontSize: 10,
              color: '#94A3B8',
              fontFamily: 'monospace'
            }}
          >
            Biến đổi đại số từng bước
          </span>
        )}
      </div>

      <div style={{ paddingLeft: 4, paddingRight: 4 }}>
        <MathExpression
          expression={step.latex}
          fontSize={isActive ? 32 : 26}
          maxWidthPx={540}
          color={isActive ? '#F8FAFC' : '#CBD5E1'}
        />
      </div>

      {isActive && (
        <div style={{ marginTop: 8, color: '#D1FAE5', fontSize: 17, lineHeight: 1.35, paddingLeft: 2 }}>
          {step.explanation}
        </div>
      )}

      {isActive && step.highlightTerms.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {step.highlightTerms.map((term, i) => (
            <span
              key={`${term}_${i}`}
              data-motion-recipe="R02"
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                background: '#78350F',
                color: '#FDE68A',
                fontSize: 14,
                fontWeight: 800,
                boxShadow: highlightPulseProgress > 0.5 ? '0 0 12px rgba(251, 191, 36, 0.6)' : 'none',
                transform: `scale(${1 + highlightPulseProgress * 0.04})`,
                transition: 'transform 0.15s ease'
              }}
            >
              🔍 {term}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/** Reusable multiline equation progression header and indicators. */
export const WorkedExampleHeader: React.FC<{
  title: string;
  activeStepIndex: number;
  totalSteps: number;
}> = ({ title, activeStepIndex, totalSteps }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ color: '#86EFAC', fontSize: 13, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
        Lập luận từng bước (Worked Example)
      </div>
      <div style={{ color: '#86EFAC', fontSize: 12, fontFamily: 'monospace' }}>
        Bước {activeStepIndex + 1}/{totalSteps}
      </div>
    </div>
    <h1 style={{ fontSize: 36, lineHeight: 1.18, margin: '8px 0 24px', maxWidth: 640 }}>{title}</h1>
  </div>
);

/** Multi-step formula renderer. It presents existing proof-bound steps and never invents transformations. */
export const FormulaSequenceSceneV3: React.FC<{
  data: VerifiedFormulaStepsDataV1;
  subtitleText?: string;
  layout?: 'stacked' | 'multiline_aligned';
  durationInFrames?: number;
  trustedProofContext?: TrustedProofContextV3;
}> = ({ data: input, subtitleText, layout = 'stacked', durationInFrames: propDuration, trustedProofContext }) => {
  const data = VerifiedFormulaStepsDataV1Schema.parse(input);
  const frame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const durationInFrames = propDuration ?? videoConfig.durationInFrames;
  const progression = deriveMotionRecipeFrameV3({
    recipeId: 'R10',
    frame,
    endFrame: durationInFrames,
    itemCount: data.steps.length
  });

  const stepDuration = Math.max(2, Math.floor(durationInFrames / data.steps.length));
  const stepRelativeFrame = frame % stepDuration;
  const reveal = deriveMotionRecipeFrameV3({
    recipeId: 'R01',
    frame: stepRelativeFrame,
    endFrame: stepDuration
  });
  const highlightMotion = deriveMotionRecipeFrameV3({
    recipeId: 'R02',
    frame: stepRelativeFrame,
    endFrame: stepDuration
  });

  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(circle at 50% 16%, #17352d 0%, #07130f 64%, #030807 100%)',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '100px 40px 140px',
        overflow: 'hidden'
      }}
    >
      <WorkedExampleHeader
        title={data.title}
        activeStepIndex={progression.activeIndex}
        totalSteps={data.steps.length}
      />

      <div
        style={{
          display: 'grid',
          gap: 12,
          maxHeight: 880,
          overflowY: 'hidden'
        }}
        data-layout-mode={layout}
      >
        {data.steps.map((step, index) => {
          const isVisible = index <= progression.activeIndex;
          const isActive = index === progression.activeIndex;
          return (
            <FormulaStepCard
              key={step.stepId}
              step={step}
              stepNumber={index + 1}
              totalSteps={data.steps.length}
              isActive={isActive}
              isVisible={isVisible}
              revealOpacity={reveal.opacity}
              revealTranslateY={reveal.translateY}
              highlightPulseProgress={isActive ? highlightMotion.progress : 0}
              trustedProofContext={trustedProofContext}
            />
          );
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 40,
          right: 40,
          bottom: 95,
          display: 'flex',
          justifyContent: 'space-between',
          color: '#86EFAC',
          fontSize: 12
        }}
      >
        <span>R01 (Reveal) · R02 (Highlight) · R10 (Worked Example)</span>
        <span>{progression.activeIndex + 1} / {data.steps.length} bước</span>
      </div>

      {subtitleText && (
        <div
          style={{
            position: 'absolute',
            left: 36,
            right: 36,
            bottom: 30,
            borderRadius: 14,
            padding: '12px 20px',
            background: 'rgba(2, 6, 23, 0.94)',
            fontSize: 19,
            lineHeight: 1.35,
            textAlign: 'center',
            border: '1px solid rgba(51, 65, 85, 0.5)'
          }}
        >
          {subtitleText}
        </div>
      )}
    </AbsoluteFill>
  );
};


