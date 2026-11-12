import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
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
  computeSecantLine,
  generateAxesAndGrid,
  type CoordinateTransform,
  type ScreenBox
} from './graph-math';
import { deriveMotionRecipeFrameV3 } from './motion-recipes-v3';

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
  if (element.elementType === 'callout') return { x: 360, y: 1080 };
  if (element.elementType === 'shape') return { x: 360, y: 640 };
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
  verifiedBindingFingerprints: readonly string[];
}

const normalizeProofExpression = (value: string): string => value
  .replace(/\\left|\\right/g, '')
  .replace(/\\cdot|\\times/g, '*')
  .replace(/\^\{([^{}]+)\}/g, '^$1')
  .replace(/[{}\s]/g, '')
  .toLowerCase();

export const VisualDslSceneV3: React.FC<{ definition: VisualSceneDefinitionV3; trustedProofContext?: TrustedProofContextV3; frame?: number; durationInFrames?: number }> = ({ definition, trustedProofContext, frame = 0, durationInFrames = definition.timeline?.durationFrames ?? 240 }) => {
  const graphTrace = deriveMotionRecipeFrameV3({ recipeId: 'R03', frame, endFrame: Math.min(durationInFrames, 72) });
  const tangentStartFrame = Math.min(12, Math.floor(durationInFrames * 0.15));
  const tangentReveal = deriveMotionRecipeFrameV3({ recipeId: 'R05', frame, startFrame: tangentStartFrame, endFrame: Math.min(durationInFrames, tangentStartFrame + 72) });
  const parameterMotion = deriveMotionRecipeFrameV3({ recipeId: 'R04', frame, startFrame: Math.floor(durationInFrames * 0.2), endFrame: Math.floor(durationInFrames * 0.82) });
  const informationFlow = deriveMotionRecipeFrameV3({ recipeId: 'R07', frame, endFrame: durationInFrames, itemCount: Math.max(1, definition.elements.filter((element) => element.elementType === 'neural_connection').length) });
  const supported = new Set<VisualElementV3['elementType']>([
    'text', 'formula', 'graph', 'axes', 'point', 'vector', 'arrow',
    'matrix', 'labeled_step', 'neural_node', 'neural_connection',
    'shape', 'highlighted_region', 'polygon', 'segment', 'callout'
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
  const shouldAnimateGraphTrace = graphElement?.animation === 'draw_line';
  const shouldHoldSecantStep = graphElement?.animation === 'step_reveal';
  const axesElement = definition.elements.find((element) => element.elementType === 'axes');

  const isGeometryScene = definition.elements.some((el) => el.elementType === 'polygon' || el.elementType === 'segment');
  let geomXRange: [number, number] | undefined;
  let geomYRange: [number, number] | undefined;

  if (isGeometryScene) {
    const xs: number[] = [];
    const ys: number[] = [];
    definition.elements.forEach((el) => {
      if (el.elementType === 'point') {
        xs.push(el.coordinates[0]);
        ys.push(el.coordinates[1]);
      } else if (el.elementType === 'segment') {
        const seg = el as any;
        xs.push(seg.start[0], seg.end[0]);
        ys.push(seg.start[1], seg.end[1]);
      } else if (el.elementType === 'polygon') {
        const poly = el as any;
        poly.points.forEach(([x, y]: [number, number]) => {
          xs.push(x);
          ys.push(y);
        });
      }
    });
    if (xs.length > 0 && ys.length > 0) {
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const spanX = Math.max(0.1, maxX - minX);
      const spanY = Math.max(0.1, maxY - minY);
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;

      // Isometric aspect ratio (1:1): guarantee pixelsPerMathUnitX === pixelsPerMathUnitY
      // DEFAULT_GRAPH_BOX is 560 x 480. We use 78% of the viewport for comfortable margin.
      const usableW = DEFAULT_GRAPH_BOX.width * 0.78;
      const usableH = DEFAULT_GRAPH_BOX.height * 0.78;
      const pixelsPerMathUnit = Math.min(usableW / spanX, usableH / spanY);

      const totalMathX = DEFAULT_GRAPH_BOX.width / pixelsPerMathUnit;
      const totalMathY = DEFAULT_GRAPH_BOX.height / pixelsPerMathUnit;

      geomXRange = [Number((midX - totalMathX / 2).toFixed(4)), Number((midX + totalMathX / 2).toFixed(4))];
      geomYRange = [Number((midY - totalMathY / 2).toFixed(4)), Number((midY + totalMathY / 2).toFixed(4))];
    }
  }

  const xRange: [number, number] = graphElement?.xRange ?? geomXRange ?? [-3, 3];
  const yRange: [number, number] = graphElement?.yRange ?? geomYRange ?? [-1, 9];

  let transform: CoordinateTransform;
  try {
    transform = createCoordinateTransform(xRange, yRange, DEFAULT_GRAPH_BOX);
  } catch {
    transform = createCoordinateTransform([-3, 3], [-1, 9], DEFAULT_GRAPH_BOX);
  }

  // Pre-calculate real graph curve, tangent, and axes
  let graphPath = '';
  let tangentLine: ReturnType<typeof computeTangentLine> | null = null;
  let secantLine: ReturnType<typeof computeSecantLine> | null = null;
  let secantMovingPoint: { x: number; y: number; mathX: number; mathY: number; slope: number } | null = null;
  const axesGrid = generateAxesAndGrid(transform);

  if (graphElement) {
    try {
      if (graphElement.showSecantLine && (graphElement.secantFromX === undefined || graphElement.secantToX === undefined || graphElement.secantFromX === graphElement.secantToX)) {
        throw new Error('invalid_secant_endpoints');
      }
      const parsedFn = parseGraphFunction(graphElement.functionType, graphElement.expression);
      const points = sampleGraphPoints(parsedFn, transform, 120);
      graphPath = generateGraphSvgPath(points);

      if (graphElement.showTangentLine && typeof graphElement.tangentAtX === 'number') {
        tangentLine = computeTangentLine(parsedFn, graphElement.tangentAtX, transform);
      }
      if (graphElement.showSecantLine && typeof graphElement.secantFromX === 'number' && typeof graphElement.secantToX === 'number') {
        const movingX = shouldHoldSecantStep
          ? graphElement.secantToX
          : graphElement.secantToX + (graphElement.secantFromX - graphElement.secantToX) * parameterMotion.progress;
        if (Math.abs(movingX - graphElement.secantFromX) >= 1e-8) {
          secantLine = computeSecantLine(parsedFn, graphElement.secantFromX, movingX, transform);
          const mathY = parsedFn.evaluate(movingX);
          secantMovingPoint = {
            x: transform.toScreenX(movingX),
            y: transform.toScreenY(mathY),
            mathX: movingX,
            mathY,
            slope: secantLine.slope
          };
        }
      }
    } catch (error) {
      // Re-throw with clear message to prevent substituting fake graphics
      throw new Error(`graph_render_failed: ${(error as Error).message}`);
    }
  }

  const isChalkboard = definition.style === 'math_chalkboard';
  const isWhiteboard = definition.style === 'systems_whiteboard';
  const bgColor = isChalkboard ? '#102A22' : isWhiteboard ? '#F8FAFC' : '#070B14';
  const foregroundColor = isWhiteboard ? '#0F172A' : '#F8FAFC';
  const axisColor = isChalkboard ? '#4E7D6A' : isWhiteboard ? '#64748B' : '#334155';
  const gridColor = isChalkboard ? 'rgba(78, 125, 106, 0.3)' : isWhiteboard ? 'rgba(148, 163, 184, 0.3)' : 'rgba(51, 65, 85, 0.4)';

  return (
    <AbsoluteFill
      style={{
        background: bgColor,
        color: foregroundColor,
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
          <clipPath id="graph-trace-clip">
            <rect x={DEFAULT_GRAPH_BOX.xMin - 2} y={DEFAULT_GRAPH_BOX.yMin - 2} width={(DEFAULT_GRAPH_BOX.width + 4) * (shouldAnimateGraphTrace ? graphTrace.progress : 1)} height={DEFAULT_GRAPH_BOX.height + 4} />
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
              {axesElement?.xLabel ?? 'x'}
            </text>
            <text
              x={(axesGrid.yAxisScreenX ?? DEFAULT_GRAPH_BOX.xMin) - 15}
              y={DEFAULT_GRAPH_BOX.yMin - 35}
              fill="#E2E8F0"
              fontSize="16"
              fontWeight="bold"
            >
              {axesElement?.yLabel ?? 'f(x)'}
            </text>
          </g>
        )}

        {/* 2. Real Mathematical Graph Curve (Clipped to Viewport) */}
        {graphElement && graphPath && (
          <g clipPath="url(#graph-trace-clip)" data-motion-recipe="R03" data-progress={(shouldAnimateGraphTrace ? graphTrace.progress : 1).toFixed(4)}>
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

        {/* 3. Secant approaches the verified tangent; intermediate positions are illustrative, not iterations. */}
        {secantLine && (
          <g clipPath="url(#graph-viewport-clip)" opacity={shouldHoldSecantStep ? 1 : 1 - parameterMotion.progress * 0.72} data-motion-recipe="R04" data-scientific-role="illustrative-secant-transition">
            <line x1={secantLine.screenX1} y1={secantLine.screenY1} x2={secantLine.screenX2} y2={secantLine.screenY2} stroke="#A78BFA" strokeWidth="3" strokeDasharray="8 5" />
            {secantMovingPoint && <circle cx={secantMovingPoint.x} cy={secantMovingPoint.y} r="7" fill="#A78BFA" stroke="#FFFFFF" strokeWidth="2.5" />}
            {secantMovingPoint && (
              <g data-dynamic-label="secant-motion">
                <rect
                  x={Math.min(410, Math.max(85, secantMovingPoint.x - 95))}
                  y={Math.max(DEFAULT_GRAPH_BOX.yMin + 8, secantMovingPoint.y - 44)}
                  width="210"
                  height="38"
                  rx="8"
                  fill="rgba(15, 23, 42, 0.9)"
                  stroke="#A78BFA"
                  strokeWidth="1.2"
                />
                <text
                  x={Math.min(410, Math.max(85, secantMovingPoint.x - 95)) + 10}
                  y={Math.max(DEFAULT_GRAPH_BOX.yMin + 8, secantMovingPoint.y - 44) + 15}
                  fill="#DDD6FE"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {`Q(${secantMovingPoint.mathX.toFixed(2)}, ${secantMovingPoint.mathY.toFixed(2)}) · m=${secantMovingPoint.slope.toFixed(2)}`}
                </text>
                <text
                  x={Math.min(410, Math.max(85, secantMovingPoint.x - 95)) + 10}
                  y={Math.max(DEFAULT_GRAPH_BOX.yMin + 8, secantMovingPoint.y - 44) + 31}
                  fill="#C4B5FD"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  cát tuyến → tiếp tuyến
                </text>
              </g>
            )}
          </g>
        )}

        {/* 4. Real Tangent Line & Derivative indicator with dynamic numeric label */}
        {tangentLine && (
          <g clipPath="url(#graph-viewport-clip)" opacity={shouldHoldSecantStep || graphElement?.animation === 'fade_in' ? 1 : graphElement?.showSecantLine ? parameterMotion.progress : tangentReveal.opacity} data-motion-recipe="R05">
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
            {/* Dynamic numeric label for tangent slope and contact point */}
            <g data-dynamic-label="tangent-slope">
              <rect
                x={Math.min(540, tangentLine.screenX0 + 18)}
                y={Math.min(DEFAULT_GRAPH_BOX.yMin + DEFAULT_GRAPH_BOX.height - 34, tangentLine.screenY0 + 24)}
                width="140"
                height="26"
                rx="6"
                fill="rgba(15, 23, 42, 0.9)"
                stroke="#F59E0B"
                strokeWidth="1.2"
              />
              <text
                x={Math.min(540, tangentLine.screenX0 + 18) + 8}
                y={Math.min(DEFAULT_GRAPH_BOX.yMin + DEFAULT_GRAPH_BOX.height - 34, tangentLine.screenY0 + 24) + 17}
                fill="#FDE68A"
                fontSize="12"
                fontWeight="bold"
                fontFamily="monospace"
              >
                f'({tangentLine.x0}) = {tangentLine.slope.toFixed(2)}
              </text>
            </g>
          </g>
        )}

        {/* 5. Vectors, Segments, Polygons, and Points mapped on the Mathematical Coordinate System */}
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
                    x={sx - 14}
                    y={sy - 16}
                    fill="#F8FAFC"
                    fontSize="15"
                    fontWeight="600"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {element.label}
                  </text>
                )}
              </g>
            );
          }

          if (element.elementType === 'segment') {
            const seg = element as any;
            const sx1 = transform.toScreenX(seg.start[0]);
            const sy1 = transform.toScreenY(seg.start[1]);
            const sx2 = transform.toScreenX(seg.end[0]);
            const sy2 = transform.toScreenY(seg.end[1]);
            return (
              <g key={element.elementId} data-geometry-primitive="segment">
                <line
                  x1={sx1}
                  y1={sy1}
                  x2={sx2}
                  y2={sy2}
                  stroke={seg.color ?? '#E2E8F0'}
                  strokeWidth={seg.strokeWidth ?? 2.5}
                  strokeDasharray={seg.strokeDasharray}
                />
                {seg.label && (
                  <text
                    x={(sx1 + sx2) / 2 + 8}
                    y={(sy1 + sy2) / 2 - 8}
                    fill={seg.color ?? '#E2E8F0'}
                    fontSize="13"
                    fontWeight="bold"
                  >
                    {seg.label}
                  </text>
                )}
              </g>
            );
          }

          if (element.elementType === 'polygon') {
            const poly = element as any;
            const polygonElements = definition.elements.filter((el) => el.elementType === 'polygon');
            const polyIndex = Math.max(0, polygonElements.findIndex((el) => el.elementId === element.elementId));
            const polyCount = Math.max(1, polygonElements.length);
            const polyReveal = deriveMotionRecipeFrameV3({
              recipeId: 'R02',
              frame,
              endFrame: durationInFrames,
              itemCount: polyCount
            });
            const isRevealed = polyIndex <= polyReveal.completedCount || polyIndex === polyReveal.activeIndex;
            const isActivePoly = polyIndex === polyReveal.activeIndex;
            const svgPoints = poly.points
              .map(([mx, my]: [number, number]) => `${transform.toScreenX(mx)},${transform.toScreenY(my)}`)
              .join(' ');
            const baseFillOpacity = poly.fillOpacity ?? 0.28;
            return (
              <g
                key={element.elementId}
                data-geometry-primitive="polygon"
                opacity={isRevealed ? 1 : 0.2}
              >
                <polygon
                  points={svgPoints}
                  fill={poly.fill ?? '#38BDF8'}
                  fillOpacity={isActivePoly ? Math.min(0.62, baseFillOpacity + 0.22) : baseFillOpacity}
                  stroke={isActivePoly ? '#FFFFFF' : (poly.strokeColor ?? '#38BDF8')}
                  strokeWidth={isActivePoly ? (poly.strokeWidth ?? 2.5) + 1.5 : (poly.strokeWidth ?? 2)}
                  strokeLinejoin="round"
                />
                {poly.label && (() => {
                  const centerX = poly.points.reduce((sum: number, [x]: [number, number]) => sum + x, 0) / poly.points.length;
                  const centerY = poly.points.reduce((sum: number, [, y]: [number, number]) => sum + y, 0) / poly.points.length;
                  return (
                    <text
                      x={transform.toScreenX(centerX)}
                      y={transform.toScreenY(centerY)}
                      fill={isActivePoly ? '#FFFFFF' : (poly.strokeColor ?? '#38BDF8')}
                      fontSize={isActivePoly ? '16' : '14'}
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {poly.label}
                    </text>
                  );
                })()}
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
            const edgeIndex = definition.elements.filter((candidate) => candidate.elementType === 'neural_connection').findIndex((candidate) => candidate.elementId === element.elementId);
            const revealed = edgeIndex < informationFlow.completedCount || edgeIndex === informationFlow.activeIndex;
            return (
              <g key={element.elementId} opacity={revealed ? 1 : 0.16} data-motion-recipe="R07">
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
          const formulaReveal = deriveMotionRecipeFrameV3({ recipeId: 'R01', frame, endFrame: Math.min(durationInFrames, 48) });
          const trustedBinding = trustedProofContext && element.claimId
            ? definition.trustedMathBindings.find((binding) =>
                binding.elementId === element.elementId &&
                binding.claimId === element.claimId &&
                binding.approvedDraftVersion === trustedProofContext.approvedDraftVersion &&
                binding.authority === 'server_sympy_v3' &&
                binding.verificationResult === 'formally_verified' &&
                binding.sourceSceneId === definition.sceneId &&
                trustedProofContext.verifiedBindingFingerprints.includes(binding.normalizedExpressionFingerprint) &&
                normalizeProofExpression(binding.verifiedExpression) === normalizeProofExpression(element.latex)
              )
            : undefined;
          return (
            <div
              key={element.elementId}
              style={{
                ...baseStyle,
                opacity: formulaReveal.opacity,
                transform: `translate(-50%, -50%) translateY(${formulaReveal.translateY}px)`,
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
          const matrixReveal = deriveMotionRecipeFrameV3({ recipeId: 'R08', frame, endFrame: durationInFrames, itemCount: element.rows * element.cols });
          const hasRowLabels = Array.isArray(element.rowLabels) && element.rowLabels.length > 0;
          const hasColLabels = Array.isArray(element.colLabels) && element.colLabels.length > 0;
          const cellWidth = element.cols <= 4 ? 68 : element.cols <= 6 ? 58 : 50;

          return (
            <div
              key={element.elementId}
              style={{
                ...baseStyle,
                background: 'rgba(15, 23, 42, 0.92)',
                padding: '16px 20px',
                borderRadius: 14,
                border: '1px solid #334155',
                maxWidth: 660,
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
              }}
            >
              {/* Optional Column Header Tokens */}
              {hasColLabels && (
                <div style={{ display: 'flex', marginLeft: hasRowLabels ? 70 : 0, gap: 6, marginBottom: 8 }}>
                  {element.colLabels!.map((colLabel, colIdx) => (
                    <div
                      key={`col_${colIdx}`}
                      style={{
                        width: cellWidth,
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#38BDF8',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {colLabel}
                    </div>
                  ))}
                </div>
              )}

              {/* Rows with optional row labels and heatmap cells */}
              <div style={{ display: 'grid', gap: 6 }}>
                {element.values.map((row, rowIdx) => (
                  <div key={`row_${rowIdx}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {hasRowLabels && (
                      <div
                        style={{
                          width: 64,
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#94A3B8',
                          textAlign: 'right',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {element.rowLabels![rowIdx] ?? ''}
                      </div>
                    )}
                    {row.map((value, colIdx) => {
                      const flatIndex = rowIdx * element.cols + colIdx;
                      const intensity = Math.min(1, Math.max(0, Math.abs(value)));
                      const revealed = flatIndex < matrixReveal.completedCount || flatIndex === matrixReveal.activeIndex;
                      const cellBg = element.showHeatmap
                        ? `rgba(56, 189, 248, ${0.12 + intensity * 0.78})`
                        : '#1E293B';

                      return (
                        <div
                          key={`cell_${rowIdx}_${colIdx}`}
                          style={{
                            width: cellWidth,
                            padding: '8px 2px',
                            textAlign: 'center',
                            background: cellBg,
                            borderRadius: 6,
                            fontFamily: 'monospace',
                            fontSize: element.cols <= 5 ? 13 : 11,
                            fontWeight: 'bold',
                            color: intensity > 0.55 ? '#FFFFFF' : '#E2E8F0',
                            opacity: revealed ? 1 : 0.12,
                            border: '1px solid rgba(255, 255, 255, 0.08)'
                          }}
                          data-motion-recipe="R08"
                        >
                          {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : value}
                        </div>
                      );
                    })}
                  </div>
                ))}
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

        if (element.elementType === 'callout') {
          const callout = element as any;
          const isWarning = callout.calloutType === 'warning';
          const isTip = callout.calloutType === 'pedagogical_tip';
          const borderColor = isWarning ? '#F59E0B' : isTip ? '#10B981' : '#38BDF8';
          return (
            <div
              key={element.elementId}
              style={{
                ...baseStyle,
                width: 620,
                padding: '14px 20px',
                background: 'rgba(15, 23, 42, 0.94)',
                borderLeft: `4px solid ${borderColor}`,
                borderRadius: 10,
                fontSize: 16,
                color: '#E2E8F0',
                lineHeight: 1.4,
                boxShadow: '0 6px 16px rgba(0,0,0,0.35)'
              }}
            >
              {callout.text}
            </div>
          );
        }

        if (element.elementType === 'shape') {
          const shape = element as any;
          const isCircle = shape.shapeType === 'circle';
          return (
            <div
              key={element.elementId}
              style={{
                ...baseStyle,
                width: shape.width,
                height: shape.height,
                borderRadius: isCircle ? '50%' : 10,
                background: shape.fill,
                border: shape.borderColor ? `${shape.borderWidth ?? 1}px solid ${shape.borderColor}` : 'none'
              }}
            />
          );
        }

        return null;
      })}
    </AbsoluteFill>
  );
};

/** Remotion runtime wrapper; the core component remains deterministic and server-render-testable. */
export const AnimatedVisualDslSceneV3: React.FC<{
  definition: VisualSceneDefinitionV3;
  trustedProofContext?: TrustedProofContextV3;
  durationInFrames?: number;
}> = (props) => {
  const frame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const durationInFrames = props.durationInFrames ?? props.definition.timeline?.durationFrames ?? videoConfig.durationInFrames;
  return <VisualDslSceneV3 {...props} frame={frame} durationInFrames={durationInFrames} />;
};
