import { VisualSceneDefinitionV3Schema } from '@luminalearn/scene-schema';

export const visualDslFixtureV3 = VisualSceneDefinitionV3Schema.parse({
  sceneId: 'visual-dsl-gradient-demo',
  sceneType: 'gradient_descent_dsl',
  layout: 'full_canvas',
  style: 'ai_neural_visualization',
  animation: 'fade_in',
  timeline: { durationFrames: 240, markers: [{ frame: 24, label: 'Hiện công thức', eventType: 'reveal' }] },
  elements: [
    { elementType: 'text', elementId: 'title', content: 'Gradient Descent trực quan', typography: 'heading_1', position: { x: 360, y: 95 } },
    { elementType: 'formula', elementId: 'loss-formula', latex: 'L(w) = (w - 2)²', claimId: 'claim-loss', fontSize: 38 },
    { elementType: 'axes', elementId: 'loss-axes', xLabel: 'w', yLabel: 'L(w)' },
    { elementType: 'graph', elementId: 'loss-graph', functionType: 'convex_quadratic', expression: '(w-2)^2', xRange: [-2, 6], yRange: [0, 16] },
    { elementType: 'point', elementId: 'current-point', coordinates: [0, 4], label: 'w₀', pulse: true },
    { elementType: 'labeled_step', elementId: 'step-one', stepNumber: 1, title: 'Tính gradient', formula: "L'(w)=2(w-2)", explanation: 'Gradient chỉ hướng tăng nhanh nhất.' },
    { elementType: 'matrix', elementId: 'weights', rows: 2, cols: 2, values: [[0.8, -0.2], [0.4, 0.6]], showHeatmap: true },
    { elementType: 'arrow', elementId: 'explain-arrow', fromElementId: 'title', toElementId: 'loss-formula' },
    { elementType: 'neural_node', elementId: 'node-input', layerIndex: 0, nodeIndex: 0, label: 'x', state: 'active' },
    { elementType: 'neural_node', elementId: 'node-output', layerIndex: 1, nodeIndex: 0, label: 'ŷ', state: 'firing' },
    { elementType: 'neural_connection', elementId: 'edge-0-0', fromLayer: 0, fromNode: 0, toLayer: 1, toNode: 0, weight: 0.8, signalActive: true }
  ],
  mathBindings: [{
    bindingId: 'binding-loss', claimId: 'claim-loss', elementId: 'loss-formula', formalExpression: 'L(w)=(w-2)^2', mathSymbol: 'L', isVerified: true
  }]
});
