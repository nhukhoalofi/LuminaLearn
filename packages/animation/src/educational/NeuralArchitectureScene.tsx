import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { NeuralArchitectureVisualPayload } from '@luminalearn/scene-schema';

export interface NeuralArchitectureSceneProps {
  title: string;
  payload: NeuralArchitectureVisualPayload;
  subtitleText?: string;
}

export const NeuralArchitectureScene: React.FC<NeuralArchitectureSceneProps> = ({
  title,
  payload,
  subtitleText
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Intro fade
  const sceneProgress = spring({ frame, fps, config: { damping: 15, stiffness: 90 } });

  // Fade out
  const exitOpacity = interpolate(
    frame,
    [Math.max(0, durationInFrames - 12), durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Layout parameters for 9:16 vertical canvas (SVG 640 x 600)
  const svgWidth = 640;
  const svgHeight = 600;
  const layers = payload.layers;
  const numLayers = layers.length;

  // Compute deterministic coordinates for every node (layerIdx, nodeIdx)
  const layerSpacing = numLayers > 1 ? (svgWidth - 140) / (numLayers - 1) : 0;
  const startX = 70;

  interface NodeCoord {
    layerIdx: number;
    nodeIdx: number;
    x: number;
    y: number;
    label: string;
    activation?: string;
  }

  const nodeCoords: NodeCoord[] = [];
  layers.forEach((layer, layerIdx) => {
    const x = numLayers === 1 ? svgWidth / 2 : startX + layerIdx * layerSpacing;
    const n = layer.nodeCount;
    const nodeSpacing = (svgHeight - 140) / Math.max(1, n + 1);

    for (let nodeIdx = 0; nodeIdx < n; nodeIdx++) {
      const y = 70 + (nodeIdx + 1) * nodeSpacing;
      let label = `x${nodeIdx + 1}`;
      if (layerIdx === numLayers - 1) {
        label = payload.outputLabels[nodeIdx] ?? (n === 1 ? 'y' : `y${nodeIdx + 1}`);
      } else if (layerIdx > 0) {
        label = `h${nodeIdx + 1}`;
      }
      nodeCoords.push({
        layerIdx,
        nodeIdx,
        x,
        y,
        label,
        activation: layer.activation
      });
    }
  });

  // Signal pulse cycle (travels forward every 30 frames ~ 1.25s at 24fps)
  const pulseCycle = Math.max(20, Math.round(fps * 1.25));
  const pulseT = (frame % pulseCycle) / pulseCycle;

  // Active signal pulse position along each edge
  const getNode = (l: number, n: number) => nodeCoords.find((c) => c.layerIdx === l && c.nodeIdx === n);

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
      {/* Title & Badge */}
      <div style={{ opacity: sceneProgress }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span
            style={{
              backgroundColor: '#3B82F622',
              color: '#60A5FA',
              border: '1px solid #3B82F666',
              padding: '4px 12px',
              borderRadius: 9999,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 1
            }}
          >
            KIẾN TRÚC MẠNG NƠ-RON
          </span>
          <span style={{ color: '#94A3B8', fontSize: 16 }}>{payload.networkType.toUpperCase()}</span>
        </div>
        <h2 style={{ fontSize: 36, fontWeight: 800, margin: '8px 0', color: '#F1F5F9' }}>{title}</h2>
      </div>

      {/* Interactive SVG Neural Diagram */}
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
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', maxHeight: 560 }}>
          <defs>
            <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#818CF8" stopOpacity="0.8" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 1. Draw Edges */}
          {payload.weights.map((w, idx) => {
            const fromNode = getNode(w.fromLayer, w.fromNode);
            const toNode = getNode(w.toLayer, w.toNode);
            if (!fromNode || !toNode) return null;

            // Signal pulse dot along the edge
            const pulseX = fromNode.x + (toNode.x - fromNode.x) * pulseT;
            const pulseY = fromNode.y + (toNode.y - fromNode.y) * pulseT;

            return (
              <g key={`edge_${idx}`}>
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke="url(#edgeGrad)"
                  strokeWidth={Math.max(1.5, Math.min(4, Math.abs(w.weightValue) * 3))}
                  strokeOpacity={0.65}
                />
                {payload.highlightActiveSignal && (
                  <circle cx={pulseX} cy={pulseY} r={5} fill="#38BDF8" filter="url(#glow)" />
                )}
              </g>
            );
          })}

          {/* 2. Draw Layer Labels */}
          {layers.map((layer, lIdx) => {
            const x = numLayers === 1 ? svgWidth / 2 : startX + lIdx * layerSpacing;
            return (
              <text
                key={`layer_lbl_${lIdx}`}
                x={x}
                y={36}
                textAnchor="middle"
                fill="#94A3B8"
                fontSize={16}
                fontWeight="700"
                letterSpacing={0.5}
              >
                {layer.name}
              </text>
            );
          })}

          {/* 3. Draw Nodes */}
          {nodeCoords.map((node, idx) => {
            const isOutput = node.layerIdx === numLayers - 1;
            const nodeColor = isOutput ? '#F59E0B' : node.layerIdx === 0 ? '#38BDF8' : '#A855F7';

            return (
              <g key={`node_${idx}`}>
                {/* Node circle glow & body */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={26}
                  fill="#1E293B"
                  stroke={nodeColor}
                  strokeWidth={3}
                  filter={payload.highlightActiveSignal ? 'url(#glow)' : undefined}
                />
                {/* Inner symbol */}
                <text
                  x={node.x}
                  y={node.y + 6}
                  textAnchor="middle"
                  fill="#F8FAFC"
                  fontSize={16}
                  fontWeight="800"
                >
                  {node.label}
                </text>
                {/* Activation badge below node */}
                {node.activation && node.activation !== 'linear' && (
                  <text
                    x={node.x}
                    y={node.y + 44}
                    textAnchor="middle"
                    fill="#A78BFA"
                    fontSize={13}
                    fontWeight="600"
                  >
                    {node.activation}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom Educational Subtitle */}
      <div style={{ textAlign: 'center', minHeight: 48 }}>
        <p style={{ margin: 0, fontSize: 20, color: '#CBD5E1', fontStyle: 'italic' }}>
          {subtitleText || 'Mỗi liên kết mang một trọng số w, tín hiệu được truyền xuôi và kích hoạt phi tuyến.'}
        </p>
      </div>
    </AbsoluteFill>
  );
};

