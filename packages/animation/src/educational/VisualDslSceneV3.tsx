import React from 'react';
import { AbsoluteFill } from 'remotion';
import katex from 'katex';
import type {
  VisualElementV3,
  VisualSceneDefinitionV3,
  VisualGraphElement,
  VisualPointElement,
  VisualVectorElement
} from '@luminalearn/scene-schema';
import {
  parseGraphFunction,
  createCoordinateTransform,
  sampleGraphPoints,
  generateGraphSvgPath,
  computeTangentLine,
  generateAxesAndGrid,
  type CoordinateTransform,
  type ScreenBox
} from './graph-math';

// Standard 9:16 vertical coordinate box for graph/axes (centered with safe margins)
const DEFAULT_GRAPH_BOX: ScreenBox = {
  xMin: 80,
  yMin: 320,
  width: 560,
  height: 480
};

const positionOf = (element: VisualElementV3, index: number) => {
  if ('position' in element && element.position && typeof element.position === 'object') {
    return element.position;
  }
  if (element.elementType === 'formula') return { x: 360, y: 190 };
  if (element.elementType === 'labeled_step') return { x: 360, y: 880 };
  if (element.elementType === 'matrix') return { x: 360, y: 920 };
  if (element.elementType === 'neural_node') {
    return { x: 140 + element.layerIndex * 210, y: 880 + element.nodeIndex * 110 };
  }
  return { x: 70 + (index % 2) * 330, y: 190 + Math.floor(index / 2) * 150 };
};

const neuralPosition = (layerIndex: number, nodeIndex: number) => ({
  x: 140 + layerIndex * 210,
  y: 880 + nodeIndex * 110
});

function renderKatexHtml(latex: string, displayMode = true): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: 'html'
    });
  } catch {
    // Fallback: escaped text
    return `<span class="katex-fallback">${latex.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
  }
}

export interface TrustedProofContextV3 {
  artifactIntegrityVerified: true;
  approvedDraftVersion: number;
}

export const VisualDslSceneV3: React.FC<{ definition: VisualSceneDefinitionV3; trustedProofContext?: TrustedProofContextV3 }> = ({ definition, trustedProofContext }) => {
  const supported = new Set<VisualElementV3['elementType']>([
    'text', 'formula', 'graph', 'axes', 'point', 'vector', 'arrow',
    'matrix', 'labeled_step', 'neural_node', 'neural_connection'
  ]);

  const unsupported = definition.elements.find((element) => !supported.has(element.elementType));
  if (unsupported) {
    throw new Error(`Unsupported Visual DSL primitive: ${unsupported.elementType}`);
  }

  const positions = new Map(
    definition.elements.map((element, index) => [element.elementId, positionOf(element, index)])
  );

  // Find any axes/graph element to establish coordinate transform for mathematical points/vectors
  const graphElement = definition.elements.find(
    (el): el is VisualGraphElement => el.elementType === 'graph'
  );

  const xRange: [number, number] = graphElement?.xRange ?? [-3, 3];
  const yRange: [number, number] = graphElement?.yRange ?? [-1, 9];

  let transform: CoordinateTransform;
  try {
    transform = createCoordinateTransform(xRange, yRange, DEFAULT_GRAPH_BOX);
  } catch {
    transform = createCoordinateTransform([-3, 3], [-1, 9], DEFAULT_GRAPH_BOX);
  }

  // Pre-calculate real graph curve, tangent, and axes
  let graphPath = '';
  let tangentLine: ReturnType<typeof computeTangentLine> | null = null;
  const axesGrid = generateAxesAndGrid(transform);

  if (graphElement) {
    try {
      const parsedFn = parseGraphFunction(graphElement.functionType, graphElement.expression);
      const points = sampleGraphPoints(parsedFn, transform, 120);
      graphPath = generateGraphSvgPath(points);

      if (graphElement.showTangentLine && typeof graphElement.tangentAtX === 'number') {
        tangentLine = computeTangentLine(parsedFn, graphElement.tangentAtX, transform);
      }
    } catch (error) {
      // Re-throw with clear message to prevent substituting fake graphics
      throw new Error(`graph_render_failed: ${(error as Error).message}`);
    }
  }

  const isChalkboard = definition.style === 'math_chalkboard';
  const bgColor = isChalkboard ? '#102A22' : '#070B14';
  const axisColor = isChalkboard ? '#4E7D6A' : '#334155';
  const gridColor = isChalkboard ? 'rgba(78, 125, 106, 0.3)' : 'rgba(51, 65, 85, 0.4)';

  return (
    <AbsoluteFill
      style={{
        background: bgColor,
        color: '#F8FAFC',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden'
      }}
    >
      {/* KaTeX Layout and Visual DSL styling */}
      <style>{`
        .katex-display { margin: 0; text-align: center; }
        .katex { font: normal 1.25em KaTeX_Main, Times New Roman, serif; line-height: 1.2; }
        .katex .mfrac .frac-line { width: 100%; border-bottom: 2px solid currentColor; }
        .math-badge { font-family: monospace; font-size: 11px; padding: 3px 8px; border-radius: 6px; letter-spacing: 0.5px; }
      `}</style>

      {/* SVG Canvas for Axes, Curves, Points, Vectors, and Neural Synapses */}
      <svg
        width="720"
        height="1280"
        viewBox="0 0 720 1280"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <defs>
          {/* Clip path for graph and tangent lines so nothing spills out */}
          <clipPath id="graph-viewport-clip">
            <rect
              x={DEFAULT_GRAPH_BOX.xMin - 2}
              y={DEFAULT_GRAPH_BOX.yMin - 2}
              width={DEFAULT_GRAPH_BOX.width + 4}
              height={DEFAULT_GRAPH_BOX.height + 4}
            />
          </clipPath>

          {/* Arrow markers for axes, vectors, and connections */}
          <marker id="axis-arrow-x" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={axisColor} />
          </marker>
          <marker id="axis-arrow-y" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={axisColor} />
          </marker>
          <marker id="vector-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10B981" />
          </marker>
          <marker id="generic-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38BDF8" />
          </marker>
        </defs>

        {/* 1. Axes & Grid lines (rendered when axes or graph is present) */}
        {definition.elements.some((el) => el.elementType === 'axes' || el.elementType === 'graph') && (
          <g id="scientific-axes-layer">
            {/* Grid lines */}
            {axesGrid.xGridLines.map((line, i) => (
              <line
                key={`grid-x-${i}`}
                x1={line.screenX}
                y1={DEFAULT_GRAPH_BOX.yMin}
                x2={line.screenX}
                y2={DEFAULT_GRAPH_BOX.yMin + DEFAULT_GRAPH_BOX.height}
                stroke={gridColor}
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            ))}
            {axesGrid.yGridLines.map((line, i) => (
              <line
                key={`grid-y-${i}`}
                x1={DEFAULT_GRAPH_BOX.xMin}
                y1={line.screenY}
                x2={DEFAULT_GRAPH_BOX.xMin + DEFAULT_GRAPH_BOX.width}
                y2={line.screenY}
                stroke={gridColor}
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            ))}

            {/* X Axis */}
            {axesGrid.xAxisScreenY !== null && (
              <line
                x1={DEFAULT_GRAPH_BOX.xMin - 10}
                y1={axesGrid.xAxisScreenY}
                x2={DEFAULT_GRAPH_BOX.xMin + DEFAULT_GRAPH_BOX.width + 25}
                y2={axesGrid.xAxisScreenY}
                stroke={axisColor}
                strokeWidth="2.5"
                markerEnd="url(#axis-arrow-x)"
              />
            )}

            {/* Y Axis */}
            {axesGrid.yAxisScreenX !== null && (
              <line
                x1={axesGrid.yAxisScreenX}
                y1={DEFAULT_GRAPH_BOX.yMin + DEFAULT_GRAPH_BOX.height + 10}
                x2={axesGrid.yAxisScreenX}
                y2={DEFAULT_GRAPH_BOX.yMin - 25}
                stroke={axisColor}
                strokeWidth="2.5"
                markerEnd="url(#axis-arrow-y)"
              />
            )}

            {/* Tick labels */}
            {axesGrid.xTicks.map((tick, i) => (
              <text
                key={`tick-x-${i}`}
                x={tick.screenCoord}
                y={(axesGrid.xAxisScreenY ?? DEFAULT_GRAPH_BOX.yMin + DEFAULT_GRAPH_BOX.height) + 20}
                fill="#94A3B8"
                fontSize="13"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                {tick.label}
              </text>
            ))}

            {axesGrid.yTicks.map((tick, i) => (
              <text
                key={`tick-y-${i}`}
                x={(axesGrid.yAxisScreenX ?? DEFAULT_GRAPH_BOX.xMin) - 12}
                y={tick.screenCoord + 5}
                fill="#94A3B8"
                fontSize="13"
                fontFamily="sans-serif"
                textAnchor="end"
              >
                {tick.label}
              </text>
            ))}

            {/* Axis variable labels */}
            <text
              x={DEFAULT_GRAPH_BOX.xMin + DEFAULT_GRAPH_BOX.width + 35}
              y={(axesGrid.xAxisScreenY ?? DEFAULT_GRAPH_BOX.yMin + DEFAULT_GRAPH_BOX.height) + 5}
              fill="#E2E8F0"
              fontSize="16"
              fontWeight="bold"
            >
              w
            </text>
            <text
              x={(axesGrid.yAxisScreenX ?? DEFAULT_GRAPH_BOX.xMin) - 15}
              y={DEFAULT_GRAPH_BOX.yMin - 35}
              fill="#E2E8F0"
              fontSize="16"
              fontWeight="bold"
            >
              L(w)
            </text>
          </g>
        )}

        {/* 2. Real Mathematical Graph Curve (Clipped to Viewport) */}
        {graphElement && graphPath && (
          <g clipPath="url(#graph-viewport-clip)">
            <path
              key={`graph-${graphElement.elementId}`}
              d={graphPath}
              fill="none"
              stroke="#38BDF8"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}

        {/* 3. Real Tangent Line & Derivative indicator */}
        {tangentLine && (
          <g clipPath="url(#graph-viewport-clip)">
            <line
              x1={tangentLine.screenX1}
              y1={tangentLine.screenY1}
              x2={tangentLine.screenX2}
              y2={tangentLine.screenY2}
              stroke="#F59E0B"
              strokeWidth="3.5"
              strokeDasharray="6 4"
            />
            {/* Tangent point on curve */}
            <circle
              cx={tangentLine.screenX0}
              cy={tangentLine.screenY0}
              r="7"
              fill="#F59E0B"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
          </g>
        )}

        {/* 4. Vectors and Points mapped on the Mathematical Coordinate System */}
        {definition.elements.map((element) => {
          if (element.elementType === 'point') {
            const [mx, my] = (element as VisualPointElement).coordinates;
            const sx = transform.toScreenX(mx);
            const sy = transform.toScreenY(my);

            return (
              <g key={element.elementId}>
                {element.pulse && (
                  <circle cx={sx} cy={sy} r="14" fill={element.color} opacity="0.35" />
                )}
                <circle cx={sx} cy={sy} r="8" fill={element.color} stroke="#FFFFFF" strokeWidth="2.5" />
                {element.label && (
                  <text
                    x={sx + 12}
                    y={sy - 12}
                    fill="#F8FAFC"
                    fontSize="15"
                    fontWeight="600"
                    fontFamily="monospace"
                  >
                    {element.label}
                  </text>
                )}
              </g>
            );
          }

          if (element.elementType === 'vector') {
            const vec = element as VisualVectorElement;
            const sx1 = transform.toScreenX(vec.start[0]);
            const sy1 = transform.toScreenY(vec.start[1]);
            const sx2 = transform.toScreenX(vec.end[0]);
            const sy2 = transform.toScreenY(vec.end[1]);

            return (
              <g key={element.elementId}>
                <line
                  x1={sx1}
                  y1={sy1}
                  x2={sx2}
                  y2={sy2}
                  stroke={vec.color}
                  strokeWidth="3.5"
                  markerEnd="url(#vector-arrow)"
                />
                {vec.label && (
                  <text
                    x={(sx1 + sx2) / 2 + 10}
                    y={(sy1 + sy2) / 2 - 10}
                    fill={vec.color}
                    fontSize="14"
                    fontWeight="bold"
                  >
                    {vec.label}
                  </text>
                )}
              </g>
            );
          }

          if (element.elementType === 'arrow') {
            const from = positions.get(element.fromElementId);
            const to = positions.get(element.toElementId);
            if (!from || !to) return null;
            return (
              <line
                key={element.elementId}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={element.color}
                strokeWidth="3.5"
                markerEnd="url(#generic-arrow)"
              />
            );
          }

          if (element.elementType === 'neural_connection') {
            const from = neuralPosition(element.fromLayer, element.fromNode);
            const to = neuralPosition(element.toLayer, element.toNode);
            return (
              <g key={element.elementId}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={element.signalActive ? '#22D3EE' : '#475569'}
                  strokeWidth={element.signalActive ? 4 : 2}
                  opacity={element.signalActive ? 0.95 : 0.6}
                />
              </g>
            );
          }

          return null;
        })}
      </svg>

      {/* HTML Layout Layer for Typography, Typeset KaTeX Math, Matrices and Steps */}
      {definition.elements.map((element, index) => {
        const pos = positions.get(element.elementId)!;
        const baseStyle: React.CSSProperties = {
          position: 'absolute',
          left: pos.x,
          top: pos.y,
          transform: 'translate(-50%, -50%)',
          zIndex: 10
        };

        if (element.elementType === 'text') {
          const fontSize =
            element.typography === 'heading_1'
              ? 42
              : element.typography === 'heading_2'
              ? 30
              : element.typography === 'caption'
              ? 16
              : 22;

          return (
            <div
              key={element.elementId}
              style={{
                ...baseStyle,
                width: 640,
                textAlign: 'center',
                color: element.color,
                fontSize,
                fontWeight: element.typography.startsWith('heading') ? 700 : 400,
                lineHeight: 1.35
              }}
            >
              {element.content}
            </div>
          );
        }

        if (element.elementType === 'formula') {
          const html = renderKatexHtml(element.latex, true);
          const trustedBinding = trustedProofContext && element.claimId
            ? definition.trustedMathBindings.find((binding) =>
                binding.elementId === element.elementId &&
                binding.claimId === element.claimId &&
                binding.approvedDraftVersion === trustedProofContext.approvedDraftVersion &&
                binding.authority === 'server_sympy_v3'
              )
            : undefined;
          return (
            <div
              key={element.elementId}
              style={{
                ...baseStyle,
                background: 'rgba(15, 23, 42, 0.88)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '16px 28px',
                borderRadius: 16,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
                maxWidth: 660,
                overflowX: 'hidden'
              }}
            >
              <div
                style={{ color: element.color, fontSize: element.fontSize }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
              {trustedBinding ? (
                <div style={{ marginTop: 6, textAlign: 'right' }}>
                  <span
                    className="math-badge"
                    style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ADE80', border: '1px solid rgba(34, 197, 94, 0.4)' }}
                  >
                    ✓ SymPy Verified: {trustedBinding.claimId}
                  </span>
                </div>
              ) : element.claimId ? (
                <div style={{ marginTop: 6, textAlign: 'right' }}><span className="math-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.4)' }}>Chưa có proof binding hợp lệ</span></div>
              ) : null}
            </div>
          );
        }

        if (element.elementType === 'matrix') {
          return (
            <div
              key={element.elementId}
              style={{
                ...baseStyle,
                background: 'rgba(15, 23, 42, 0.85)',
                padding: 16,
                borderRadius: 14,
                border: '1px solid #334155'
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${element.cols}, 62px)`,
                  gap: 6
                }}
              >
                {element.values.flat().map((value, i) => {
                  const intensity = Math.min(1, Math.max(0, Math.abs(value)));
                  const cellBg = element.showHeatmap
                    ? `rgba(56, 189, 248, ${0.15 + intensity * 0.75})`
                    : '#1E293B';

                  return (
                    <div
                      key={i}
                      style={{
                        padding: '10px 4px',
                        textAlign: 'center',
                        background: cellBg,
                        borderRadius: 6,
                        fontFamily: 'monospace',
                        fontSize: 14,
                        fontWeight: 'bold',
                        color: intensity > 0.6 ? '#FFFFFF' : '#E2E8F0'
                      }}
                    >
                      {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : value}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        if (element.elementType === 'labeled_step') {
          const formulaHtml = renderKatexHtml(element.formula ?? '', false);
          return (
            <div
              key={element.elementId}
              style={{
                ...baseStyle,
                width: 580,
                padding: '16px 22px',
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1.5px solid #38BDF8',
                borderRadius: 16,
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span
                  style={{
                    background: '#0284C7',
                    color: '#FFFFFF',
                    borderRadius: '50%',
                    width: 28,
                    height: 28,
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 'bold',
                    fontSize: 14
                  }}
                >
                  {element.stepNumber}
                </span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC' }}>
                  {element.title}
                </span>
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  background: 'rgba(30, 41, 59, 0.7)',
                  borderRadius: 8,
                  marginBottom: 8,
                  fontSize: 20
                }}
                dangerouslySetInnerHTML={{ __html: formulaHtml }}
              />
              <div style={{ fontSize: 14, color: '#CBD5E1', lineHeight: 1.4 }}>
                {element.explanation}
              </div>
            </div>
          );
        }

        if (element.elementType === 'neural_node') {
          const isFiring = element.state === 'firing';
          const isActive = element.state === 'active';
          const nodeBg = isFiring ? '#F59E0B' : isActive ? '#0EA5E9' : '#1E293B';

          return (
            <div
              key={element.elementId}
              style={{
                ...baseStyle,
                width: 68,
                height: 68,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: nodeBg,
                border: '3px solid #FFFFFF',
                boxShadow: isFiring ? '0 0 16px #F59E0B' : '0 4px 10px rgba(0, 0, 0, 0.4)',
                fontWeight: 'bold',
                fontSize: 15,
                color: '#FFFFFF'
              }}
            >
              {element.label ?? (typeof element.value === 'number' ? element.value.toFixed(2) : '')}
            </div>
          );
        }

        return null;
      })}
    </AbsoluteFill>
  );
};
