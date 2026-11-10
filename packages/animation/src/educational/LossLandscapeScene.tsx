import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { LossLandscapeVisualPayload } from '@luminalearn/scene-schema';
import { deriveLossLandscapeFrameV3 } from './loss-landscape-motion-v3';

export interface LossLandscapeSceneProps {
  title: string;
  payload: LossLandscapeVisualPayload;
  subtitleText?: string;
}

export const LossLandscapeScene: React.FC<LossLandscapeSceneProps> = ({
  title,
  payload,
  subtitleText
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const sceneProgress = spring({ frame, fps, config: { damping: 15, stiffness: 90 } });

  const exitOpacity = interpolate(
    frame,
    [Math.max(0, durationInFrames - 12), durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Math parameters
  const { minimumPoint, curvature, steps } = payload;
  const wStar = minimumPoint.w;
  const lStar = minimumPoint.loss;

  // Derive viewport from validated parameters so legitimate bounded examples
  // are not clipped by a hard-coded demonstration range.
  const svgW = 640;
  const svgH = 500;
  const padX = 60;
  const padY = 50;

  const observedW = [wStar, payload.currentParam, ...steps.map((step) => step.w)];
  const rawWMin = Math.min(...observedW);
  const rawWMax = Math.max(...observedW);
  const wMargin = Math.max(0.75, (rawWMax - rawWMin) * 0.25);
  const wMin = rawWMin - wMargin;
  const wMax = rawWMax + wMargin;
  const boundaryLosses = [wMin, wMax].map((w) => curvature * Math.pow(w - wStar, 2) + lStar);
  const observedLoss = [lStar, ...steps.map((step) => step.loss), ...boundaryLosses];
  const rawLMin = Math.min(...observedLoss);
  const rawLMax = Math.max(...observedLoss);
  const lMargin = Math.max(0.25, (rawLMax - rawLMin) * 0.1);
  const lMin = rawLMin - lMargin;
  const lMax = rawLMax + lMargin;

  const toSvgX = (w: number) => padX + ((w - wMin) / (wMax - wMin)) * (svgW - 2 * padX);
  const toSvgY = (l: number) => svgH - padY - ((l - lMin) / (lMax - lMin)) * (svgH - 2 * padY);

  // Compute points along curve L(w) = curvature * (w - w*)^2 + L*
  const curvePoints: string[] = [];
  const numSamples = 60;
  for (let i = 0; i <= numSamples; i++) {
    const w = wMin + (i / numSamples) * (wMax - wMin);
    const l = curvature * Math.pow(w - wStar, 2) + lStar;
    curvePoints.push(`${toSvgX(w).toFixed(1)},${toSvgY(l).toFixed(1)}`);
  }
  const curvePath = `M ${curvePoints.join(' L ')}`;

  // Derive every animated value from one validated quadratic function, frame by frame.
  const motion = deriveLossLandscapeFrameV3(payload, frame, durationInFrames);
  const currentX = toSvgX(motion.w);
  const currentY = toSvgY(motion.loss);

  // Tangent follows the moving marker; gradient is the analytic derivative.
  const slope = motion.gradient;
  const tangentHalfWidth = Math.max(0.15, (wMax - wMin) * 0.075);
  const tanW1 = motion.w - tangentHalfWidth;
  const tanL1 = motion.loss - slope * tangentHalfWidth;
  const tanW2 = motion.w + tangentHalfWidth;
  const tanL2 = motion.loss + slope * tangentHalfWidth;

  const tanX1 = toSvgX(tanW1);
  const tanY1 = toSvgY(tanL1);
  const tanX2 = toSvgX(tanW2);
  const tanY2 = toSvgY(tanL2);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0B0F19',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '110px 40px 220px 40px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        opacity: exitOpacity,
        boxSizing: 'border-box'
      }}
    >
      {/* Title */}
      <div style={{ opacity: sceneProgress }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span
            style={{
              backgroundColor: '#10B98122',
              color: '#34D399',
              border: '1px solid #10B98166',
              padding: '4px 12px',
              borderRadius: 9999,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 1
            }}
          >
            BỀ MẶT HÀM MẤT MÁT (LOSS LANDSCAPE)
          </span>
          <span style={{ color: '#94A3B8', fontSize: 16 }}>Bước lặp {steps[Math.min(motion.completedStepIndex, steps.length - 1)]?.stepNumber ?? 1}/{steps.length}</span>
        </div>
        <h2 style={{ fontSize: 36, fontWeight: 800, margin: '8px 0', color: '#F1F5F9' }}>{title}</h2>
      </div>

      {/* SVG Canvas for Quadratic Loss Curve */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#11182788',
          borderRadius: 20,
          border: '1px solid #1F2937',
          padding: 12
        }}
      >
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', maxHeight: 500 }}>
          <defs>
            <linearGradient id="curveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
            <filter id="glowBall" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Axes */}
          <line x1={padX} y1={svgH - padY} x2={svgW - padX} y2={svgH - padY} stroke="#334155" strokeWidth={2} />
          <line x1={svgW / 2} y1={padY} x2={svgW / 2} y2={svgH - padY} stroke="#334155" strokeWidth={1} strokeDasharray="4 4" />
          <text x={svgW - padX + 10} y={svgH - padY + 6} fill="#64748B" fontSize={16} fontWeight="700">w</text>
          <text x={svgW / 2} y={padY - 14} fill="#64748B" fontSize={16} fontWeight="700" textAnchor="middle">L(w)</text>

          {/* Loss Curve */}
          <path d={curvePath} fill="none" stroke="url(#curveGrad)" strokeWidth={4} />

          {/* Global Minimum Marker (w*, L*) */}
          <circle cx={toSvgX(wStar)} cy={toSvgY(lStar)} r={8} fill="#10B981" />
          <text x={toSvgX(wStar)} y={toSvgY(lStar) + 28} fill="#10B981" fontSize={15} fontWeight="700" textAnchor="middle">
            Cực tiểu w*={wStar.toFixed(1)}
          </text>

          {/* Historical Step Dots */}
          {steps.slice(0, motion.completedStepIndex + 1).map((s, idx) => (
            <circle
              key={`step_${idx}`}
              cx={toSvgX(s.w)}
              cy={toSvgY(s.loss)}
              r={6}
              fill="#64748B"
              
            />
          ))}

          {/* Current animated parameter lies on the actual function at every frame. */}
          <circle cx={currentX} cy={currentY} r={12} fill="#F59E0B" filter="url(#glowBall)" />
          <text x={Math.max(padX + 10, Math.min(svgW - padX - 80, currentX + 12))} y={Math.max(padY + 110, currentY - 24)} fill="#FCD34D" fontSize={16} fontWeight={800}>
            w={motion.w.toFixed(2)} · L={motion.loss.toFixed(2)}
          </text>

          {/* Tangent line at current position */}
          {payload.showGradientTangent && (
            <g>
              <line x1={tanX1} y1={tanY1} x2={tanX2} y2={tanY2} stroke="#EF4444" strokeWidth={3} strokeDasharray="6 4" />
              <text x={currentX + 16} y={currentY - 12} fill="#FCD34D" fontSize={16} fontWeight="800">
                ∇L = {motion.gradient.toFixed(2)}
              </text>
            </g>
          )}

          {/* Step Formula Annotation Box */}
          <rect x={padX + 10} y={padY + 10} width={260} height={70} rx={10} fill="#1E293BCC" stroke="#334155" />
          <text x={padX + 22} y={padY + 36} fill="#94A3B8" fontSize={14} fontWeight="600">
            Tốc độ học η = {payload.learningRate}
          </text>
          <text x={padX + 22} y={padY + 62} fill="#38BDF8" fontSize={16} fontWeight="800">
            w_mới = w - η · ∇L(w)
          </text>
        </svg>
      </div>

      {/* Subtitle */}
      <div style={{ textAlign: 'center', minHeight: 48 }}>
        <p style={{ margin: 0, fontSize: 20, color: '#CBD5E1', fontStyle: 'italic' }}>
          {subtitleText || `Gradient dương chỉ dốc tăng, bước lặp di chuyển ngược hướng gradient để giảm loss.`}
        </p>
      </div>
    </AbsoluteFill>
  );
};

