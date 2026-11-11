import {
  AttentionMatrixDataV1Schema,
  DirectedDiagramDataV1Schema,
  Geometry2dDataV1Schema,
  ProbabilityTreeDataV1Schema,
  ScalarFunctionDataV1Schema,
  VerifiedFormulaStepsDataV1Schema,
  VisualSceneDefinitionV3Schema,
  type ScientificVisualDataV1,
  type VisualSceneDefinitionV3
} from '@luminalearn/scene-schema';
import { parseGraphFunction } from './graph-math';

type FormulaData = Extract<ScientificVisualDataV1, { kind: 'verified_formula_steps' }>;
type ScalarData = Extract<ScientificVisualDataV1, { kind: 'scalar_function_1d' }>;
type DiagramData = Extract<ScientificVisualDataV1, { kind: 'directed_diagram' }>;
type AttentionData = Extract<ScientificVisualDataV1, { kind: 'attention_matrix' }>;
type GeometryData = Extract<ScientificVisualDataV1, { kind: 'geometry_2d' }>;
type ProbabilityTreeData = Extract<ScientificVisualDataV1, { kind: 'probability_tree' }>;

export function adaptFormulaSequenceV3(input: FormulaData): FormulaData {
  return VerifiedFormulaStepsDataV1Schema.parse(input);
}

export function adaptScalarFunctionGraphV3(input: ScalarData, sceneId = 'scientific_graph_scene'): VisualSceneDefinitionV3 {
  const data = ScalarFunctionDataV1Schema.parse(input);
  const fn = parseGraphFunction(data.functionType, data.expression);
  const elements: VisualSceneDefinitionV3['elements'] = [
    { elementType: 'text', elementId: `${sceneId}_title`, content: 'Đồ thị hàm số và tiếp tuyến', typography: 'heading_1', color: '#F8FAFC', position: { x: 360, y: 105 }, animation: 'fade_in' },
    { elementType: 'axes', elementId: `${sceneId}_axes`, xLabel: 'x', yLabel: 'f(x)', showGrid: true, gridColor: '#334155' },
    { elementType: 'graph', elementId: `${sceneId}_graph`, functionType: data.functionType, expression: data.expression, claimId: data.claimId, contentPolicy: 'formal_verified', xRange: data.xRange, yRange: data.yRange, showTangentLine: data.tangentAtX !== undefined, tangentAtX: data.tangentAtX, showSecantLine: data.secantFromX !== undefined, secantFromX: data.secantFromX, secantToX: data.secantToX, animation: 'draw_line' }
  ];
  if (data.pointX !== undefined) elements.push({ elementType: 'point', elementId: `${sceneId}_point`, coordinates: [data.pointX, fn.evaluate(data.pointX)], label: `(${data.pointX}, ${Number(fn.evaluate(data.pointX).toFixed(3))})`, color: '#F59E0B', pulse: true, animation: 'highlight_pulse' });
  return VisualSceneDefinitionV3Schema.parse({ schemaVersion: 'visual-dsl-v3.1', sceneId, sceneType: 'graph_plot', layout: 'full_canvas', style: 'ai_data_story', animation: 'draw_line', elements, timeline: { startFrame: 0, durationFrames: 240, fps: 24, markers: [{ frame: 12, label: 'Vẽ đường cong', eventType: 'reveal' }, { frame: 96, label: 'Hiện tiếp tuyến', eventType: 'highlight' }] }, mathBindings: [{ bindingId: `${sceneId}_binding`, claimId: data.claimId, elementId: `${sceneId}_graph`, formalExpression: data.expression, mathSymbol: 'f', isVerified: true }], trustedMathBindings: [], dataBindings: [] });
}

export function adaptDirectedDiagramV3(input: DiagramData, sceneId = 'scientific_diagram_scene'): VisualSceneDefinitionV3 {
  const data = DirectedDiagramDataV1Schema.parse(input);
  const nodesByLayer = new Map<number, typeof data.nodes>();
  data.nodes.forEach((node) => nodesByLayer.set(node.layer, [...(nodesByLayer.get(node.layer) ?? []), node]));
  const nodeIndex = new Map<string, { layer: number; index: number }>();
  for (const [layer, nodes] of nodesByLayer) nodes.forEach((node, index) => nodeIndex.set(node.nodeId, { layer, index }));
  const elements: VisualSceneDefinitionV3['elements'] = [
    { elementType: 'text', elementId: `${sceneId}_title`, content: 'Luồng thông tin có cấu trúc', typography: 'heading_1', color: '#0F172A', position: { x: 360, y: 110 }, animation: 'fade_in' },
    ...data.nodes.map((node) => ({ elementType: 'neural_node' as const, elementId: node.nodeId, layerIndex: node.layer, nodeIndex: nodeIndex.get(node.nodeId)!.index, activation: 'linear' as const, state: 'idle' as const, value: node.value, label: node.label })),
    ...data.edges.map((edge) => ({ elementType: 'neural_connection' as const, elementId: edge.edgeId, fromLayer: nodeIndex.get(edge.fromNodeId)!.layer, fromNode: nodeIndex.get(edge.fromNodeId)!.index, toLayer: nodeIndex.get(edge.toNodeId)!.layer, toNode: nodeIndex.get(edge.toNodeId)!.index, weight: edge.weight ?? 1, signalActive: true }))
  ];
  return VisualSceneDefinitionV3Schema.parse({ schemaVersion: 'visual-dsl-v3.1', sceneId, sceneType: 'flowchart_simulation', layout: 'full_canvas', style: 'systems_whiteboard', animation: 'fade_in', elements, timeline: { durationFrames: 240, fps: 24, markers: [{ frame: 24, label: 'Luồng tín hiệu', eventType: 'transition' }] }, mathBindings: [], trustedMathBindings: [], dataBindings: [] });
}

export function adaptAttentionMatrixV3(input: AttentionData, sceneId = 'attention_matrix_scene'): VisualSceneDefinitionV3 {
  const data = AttentionMatrixDataV1Schema.parse(input);
  return VisualSceneDefinitionV3Schema.parse({ schemaVersion: 'visual-dsl-v3.1', sceneId, sceneType: 'attention_heatmap', layout: 'centered_focus', style: 'ai_data_story', animation: 'fade_in', elements: [
    { elementType: 'text', elementId: `${sceneId}_title`, content: 'Ma trận trọng số attention', typography: 'heading_1', color: '#F8FAFC', position: { x: 360, y: 120 }, animation: 'fade_in' },
    { elementType: 'matrix', elementId: `${sceneId}_matrix`, rows: data.tokens.length, cols: data.tokens.length, values: data.weights, rowLabels: data.tokens, colLabels: data.tokens, showHeatmap: true, animation: 'fade_in' }
  ], timeline: { durationFrames: 240, fps: 24, markers: [{ frame: 24, label: 'Hiện từng ô', eventType: 'reveal' }] }, mathBindings: [], trustedMathBindings: [], dataBindings: [] });
}

export function adaptGeometry2dV3(input: GeometryData, sceneId = 'scientific_geometry_scene'): VisualSceneDefinitionV3 {
  const data = Geometry2dDataV1Schema.parse(input);
  const pointMap = new Map(data.points.map((p) => [p.pointId, p]));
  const xs = data.points.map((p) => p.x);
  const ys = data.points.map((p) => p.y);
  const minX = Math.min(...xs, 0) - 1;
  const maxX = Math.max(...xs, 2) + 1;
  const minY = Math.min(...ys, 0) - 1;
  const maxY = Math.max(...ys, 2) + 1;

  const elements: VisualSceneDefinitionV3['elements'] = [
    { elementType: 'text', elementId: `${sceneId}_title`, content: 'Hình học tọa độ & Miền diện tích', typography: 'heading_1', color: '#F8FAFC', position: { x: 360, y: 110 }, animation: 'fade_in' },
    { elementType: 'axes', elementId: `${sceneId}_axes`, xLabel: 'x', yLabel: 'y', showGrid: true, gridColor: '#334155' }
  ];

  // Render polygons as area visualization first (background layer)
  data.polygons.forEach((poly, index) => {
    const coords = poly.pointIds.map((id) => {
      const p = pointMap.get(id)!;
      return [p.x, p.y] as [number, number];
    });
    elements.push({
      elementType: 'polygon',
      elementId: `${sceneId}_poly_${index + 1}`,
      points: coords,
      fill: '#38BDF8',
      fillOpacity: 0.28,
      strokeColor: '#38BDF8',
      strokeWidth: 2.5,
      label: poly.areaClaimId ? `Diện tích: ${poly.areaClaimId}` : undefined,
      claimId: poly.areaClaimId
    });
  });

  // Render segments
  data.segments.forEach((seg, index) => {
    const p1 = pointMap.get(seg.fromPointId)!;
    const p2 = pointMap.get(seg.toPointId)!;
    elements.push({
      elementType: 'segment',
      elementId: `${sceneId}_seg_${index + 1}`,
      start: [p1.x, p1.y],
      end: [p2.x, p2.y],
      color: '#E2E8F0',
      strokeWidth: 2.5
    });
  });

  // Render points
  data.points.forEach((p) => {
    elements.push({
      elementType: 'point',
      elementId: p.pointId,
      coordinates: [p.x, p.y],
      label: `${p.pointId}(${p.x},${p.y})`,
      color: '#F59E0B',
      pulse: false,
      animation: 'highlight_pulse'
    });
  });

  return VisualSceneDefinitionV3Schema.parse({
    schemaVersion: 'visual-dsl-v3.1',
    sceneId,
    sceneType: 'algebra_identity',
    layout: 'full_canvas',
    style: 'math_chalkboard',
    animation: 'fade_in',
    elements,
    timeline: {
      durationFrames: 240,
      fps: 24,
      markers: [{ frame: 24, label: 'Dựng hình học', eventType: 'reveal' }, { frame: 96, label: 'Tô miền diện tích', eventType: 'highlight' }]
    },
    mathBindings: data.polygons.length > 0
      ? data.claimIds.map((cid, i) => ({
          bindingId: `${sceneId}_binding_${i + 1}`,
          claimId: cid,
          elementId: `${sceneId}_poly_${Math.min(i + 1, data.polygons.length)}`,
          formalExpression: 'Area(P)',
          mathSymbol: 'S',
          isVerified: data.validation === 'formally_verified'
        }))
      : [],
    trustedMathBindings: [],
    dataBindings: []
  });
}

export function adaptProbabilityTreeV3(input: ProbabilityTreeData, sceneId = 'probability_tree_scene'): VisualSceneDefinitionV3 {
  const data = ProbabilityTreeDataV1Schema.parse(input);
  // Group branches by parent to calculate hierarchical tree layout
  const childrenOf = new Map<string, typeof data.branches>();
  data.branches.forEach((b) => {
    const parent = b.parentBranchId ?? '__root__';
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), b]);
  });

  const branchLevel = new Map<string, number>();
  const calculateLevels = (parentId: string, level: number) => {
    const children = childrenOf.get(parentId) ?? [];
    children.forEach((c) => {
      branchLevel.set(c.branchId, level);
      calculateLevels(c.branchId, level + 1);
    });
  };
  calculateLevels('__root__', 1);

  const elements: VisualSceneDefinitionV3['elements'] = [
    { elementType: 'text', elementId: `${sceneId}_title`, content: `Cây xác suất: ${data.rootLabel}`, typography: 'heading_1', color: '#F8FAFC', position: { x: 360, y: 110 }, animation: 'fade_in' },
    { elementType: 'neural_node', elementId: `${sceneId}_root`, layerIndex: 0, nodeIndex: 0, label: data.rootLabel, activation: 'linear', state: 'idle' }
  ];

  const nodePositions = new Map<string, { layerIndex: number; nodeIndex: number }>();
  nodePositions.set(`${sceneId}_root`, { layerIndex: 0, nodeIndex: 0 });

  const layerCounters = new Map<number, number>();
  data.branches.forEach((b) => {
    const level = branchLevel.get(b.branchId) ?? 1;
    const idx = layerCounters.get(level) ?? 0;
    layerCounters.set(level, idx + 1);
    nodePositions.set(b.branchId, { layerIndex: level, nodeIndex: idx });
    elements.push({
      elementType: 'neural_node',
      elementId: b.branchId,
      layerIndex: level,
      nodeIndex: idx,
      label: `${b.label} (P=${b.probability.toFixed(2)})`,
      activation: 'linear',
      state: 'idle',
      value: b.probability
    });
  });

  // Create connections with accurate parent nodeIndex mapping
  data.branches.forEach((b) => {
    const childPos = nodePositions.get(b.branchId)!;
    const parentId = b.parentBranchId ?? `${sceneId}_root`;
    const parentPos = nodePositions.get(parentId) ?? { layerIndex: Math.max(0, childPos.layerIndex - 1), nodeIndex: 0 };
    elements.push({
      elementType: 'neural_connection',
      elementId: `edge_${b.branchId}`,
      fromLayer: parentPos.layerIndex,
      fromNode: parentPos.nodeIndex,
      toLayer: childPos.layerIndex,
      toNode: childPos.nodeIndex,
      weight: b.probability,
      signalActive: true
    });
  });

  return VisualSceneDefinitionV3Schema.parse({
    schemaVersion: 'visual-dsl-v3.1',
    sceneId,
    sceneType: 'flowchart_simulation',
    layout: 'full_canvas',
    style: 'systems_whiteboard',
    animation: 'fade_in',
    elements,
    timeline: {
      durationFrames: 240,
      fps: 24,
      markers: [{ frame: 24, label: 'Phân nhánh xác suất', eventType: 'reveal' }]
    },
    mathBindings: [],
    trustedMathBindings: [],
    dataBindings: []
  });
}

