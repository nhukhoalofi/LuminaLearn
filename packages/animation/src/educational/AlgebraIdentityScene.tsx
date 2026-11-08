import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AlgebraIdentityVisualPayload } from '@luminalearn/scene-schema';

export const AlgebraIdentityScene: React.FC<{
  title: string;
  payload: AlgebraIdentityVisualPayload;
  subtitleText?: string;
}> = ({ title, payload, subtitleText }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const isSquareIdentity =
    payload.identityId === 'square_sum' ||
    payload.identityId === 'square_difference' ||
    payload.identityId === 'difference_squares';

  // Smooth entrance springs
  const headerSpring = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const diagramSpring = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 12, stiffness: 90 } });
  const stepsSpring = spring({ frame: Math.max(0, frame - 25), fps, config: { damping: 14, stiffness: 95 } });

  // Compute active transformation step based on playback progress
  const stepCount = payload.transformationSteps.length;
  const stepDuration = Math.max(1, Math.floor(durationInFrames / stepCount));
  const activeStepIndex = Math.min(stepCount - 1, Math.floor(frame / stepDuration));
  const currentStep = payload.transformationSteps[activeStepIndex] ?? payload.transformationSteps[0];

  return (
    <AbsoluteFill
      style={{
        padding: '120px 48px 60px',
        color: '#F8FAFC',
        background: 'radial-gradient(circle at 50% 25%, #0F172A 0%, #030712 100%)',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      {/* Category Tag & Header */}
      <div
        style={{
          opacity: headerSpring,
          transform: `translateY(${(1 - headerSpring) * -15}px)`,
          textAlign: 'center',
          marginBottom: 16
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '4px 14px',
            borderRadius: 999,
            background: 'rgba(6, 182, 212, 0.15)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            color: '#22D3EE',
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: 1.5,
            textTransform: 'uppercase'
          }}
        >
          {isSquareIdentity ? 'Đại số hình học · Diện tích phân rã' : 'Đại số đa thức · Khai triển & Phân tích'}
        </div>
        <h1
          style={{
            fontSize: 34,
            fontWeight: 800,
            lineHeight: 1.2,
            margin: '12px 0 6px',
            color: '#F1F5F9'
          }}
        >
          {title}
        </h1>
      </div>

      {/* Visual Representation Container */}
      <div
        style={{
          width: '100%',
          maxWidth: 580,
          opacity: diagramSpring,
          transform: `scale(${0.9 + 0.1 * diagramSpring})`,
          marginBottom: 20
        }}
      >
        {isSquareIdentity ? (
          /* Geometric Area Decomposition for Square Identities */
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              borderRadius: 20,
              padding: '20px',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ textAlign: 'center', fontSize: 13, color: '#94A3B8', marginBottom: 12, fontWeight: 600 }}>
              Mô hình hình học diện tích: Cạnh (a + b)
            </div>
            {/* SVG 2D Square Area Diagram */}
            <svg viewBox="0 0 400 400" style={{ width: '100%', height: 260, overflow: 'visible' }}>
              <defs>
                <linearGradient id="gradA2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#0891B2" stopOpacity="0.95" />
                </linearGradient>
                <linearGradient id="gradAB" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#D97706" stopOpacity="0.95" />
                </linearGradient>
                <linearGradient id="gradB2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.95" />
                </linearGradient>
              </defs>

              {/* Dimension Labels Top */}
              <text x="130" y="25" fill="#38BDF8" fontSize="16" fontWeight="bold" textAnchor="middle">a</text>
              <text x="310" y="25" fill="#FBBF24" fontSize="16" fontWeight="bold" textAnchor="middle">b</text>

              {/* Dimension Labels Left */}
              <text x="25" y="155" fill="#38BDF8" fontSize="16" fontWeight="bold" textAnchor="middle">a</text>
              <text x="25" y="325" fill="#FBBF24" fontSize="16" fontWeight="bold" textAnchor="middle">b</text>

              {/* Block 1: a x a = a^2 */}
              <rect x="50" y="45" width="180" height="180" rx="10" fill="url(#gradA2)" stroke="#38BDF8" strokeWidth="2" />
              <text x="140" y="145" fill="#FFFFFF" fontSize="26" fontWeight="bold" textAnchor="middle">a²</text>

              {/* Block 2: a x b = ab */}
              <rect x="238" y="45" width="140" height="180" rx="10" fill="url(#gradAB)" stroke="#FBBF24" strokeWidth="2" />
              <text x="308" y="145" fill="#FFFFFF" fontSize="22" fontWeight="bold" textAnchor="middle">a·b</text>

              {/* Block 3: b x a = ba */}
              <rect x="50" y="233" width="180" height="140" rx="10" fill="url(#gradAB)" stroke="#FBBF24" strokeWidth="2" />
              <text x="140" y="310" fill="#FFFFFF" fontSize="22" fontWeight="bold" textAnchor="middle">b·a</text>

              {/* Block 4: b x b = b^2 */}
              <rect x="238" y="233" width="140" height="140" rx="10" fill="url(#gradB2)" stroke="#C084FC" strokeWidth="2" />
              <text x="308" y="310" fill="#FFFFFF" fontSize="22" fontWeight="bold" textAnchor="middle">b²</text>
            </svg>
          </div>
        ) : (
          /* Multi-Term Isometric / Algebraic Factor Decomposition for Cubes */
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              borderRadius: 20,
              padding: '24px',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ textAlign: 'center', fontSize: 13, color: '#94A3B8', marginBottom: 14, fontWeight: 600 }}>
              Phân rã đa thức bậc ba: Khối thể tích & Nhân tử
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'rgba(6, 182, 212, 0.2)', border: '1px solid #06B6D4', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#67E8F9', fontWeight: 700 }}>HẠNG TỬ 1</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', marginTop: 4 }}>
                  {payload.identityId.includes('difference') ? 'a³' : 'a³'}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Thể tích lập phương a</div>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #F59E0B', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#FCD34D', fontWeight: 700 }}>HẠNG TỬ 2</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', marginTop: 4 }}>
                  {payload.identityId === 'sum_cubes' || payload.identityId === 'difference_cubes' ? '(a ± b)' : '3a²b'}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Nhân tử liên hợp</div>
              </div>
              <div style={{ background: 'rgba(236, 72, 153, 0.2)', border: '1px solid #EC4899', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#F472B6', fontWeight: 700 }}>HẠNG TỬ 3</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', marginTop: 4 }}>
                  {payload.identityId === 'sum_cubes' || payload.identityId === 'difference_cubes' ? '(a² ∓ ab + b²)' : '3ab²'}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Bình phương thiếu</div>
              </div>
              <div style={{ background: 'rgba(139, 92, 246, 0.2)', border: '1px solid #8B5CF6', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#C4B5FD', fontWeight: 700 }}>HẠNG TỬ 4</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', marginTop: 4 }}>
                  {payload.identityId.includes('difference') ? '-b³' : 'b³'}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Thể tích lập phương b</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step-by-Step Derivation & Pedagogical Explanation */}
      <div
        style={{
          width: '100%',
          maxWidth: 580,
          opacity: stepsSpring,
          background: 'rgba(30, 41, 59, 0.9)',
          borderRadius: 18,
          padding: '18px 24px',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
          marginBottom: 16
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#38BDF8', letterSpacing: 1 }}>
            BƯỚC {activeStepIndex + 1} / {stepCount}
          </span>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>
            Biến đổi tương đương SymPy
          </span>
        </div>

        {/* Current Transformation Formula with Highlight */}
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: '#F8FAFC',
            textAlign: 'center',
            padding: '10px 0',
            letterSpacing: 0.5
          }}
        >
          {currentStep.expression}
        </div>

        {/* Step Pedagogical Explanation in Vietnamese */}
        <div
          style={{
            fontSize: 15,
            color: '#E2E8F0',
            textAlign: 'center',
            lineHeight: 1.4,
            marginTop: 4,
            fontWeight: 500
          }}
        >
          {currentStep.explanationVietnamese}
        </div>

        {/* Highlighted Terms Chips */}
        {currentStep.highlightTerms && currentStep.highlightTerms.length > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {currentStep.highlightTerms.map((term, i) => (
              <span
                key={i}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: 6,
                  background: 'rgba(251, 191, 36, 0.2)',
                  border: '1px solid rgba(251, 191, 36, 0.5)',
                  color: '#FDE047'
                }}
              >
                Trọng tâm: {term}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Full Canonical Identity Summary Box */}
      <div
        style={{
          width: '100%',
          maxWidth: 580,
          background: 'rgba(15, 23, 42, 0.85)',
          borderRadius: 14,
          padding: '12px 20px',
          border: '1px solid rgba(251, 191, 36, 0.4)',
          textAlign: 'center',
          fontSize: 20,
          fontWeight: 700,
          color: '#F1F5F9'
        }}
      >
        <span>{payload.leftExpression}</span>
        <span style={{ color: '#FBBF24', margin: '0 12px' }}>=</span>
        <span>{payload.rightExpression}</span>
      </div>

      {/* Burned-in Subtitles if enabled */}
      {subtitleText ? (
        <div
          style={{
            position: 'absolute',
            left: 36,
            right: 36,
            bottom: 40,
            borderRadius: 14,
            padding: '12px 20px',
            background: 'rgba(2, 6, 23, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: 20,
            lineHeight: 1.35,
            textAlign: 'center',
            color: '#F8FAFC'
          }}
        >
          {subtitleText}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
