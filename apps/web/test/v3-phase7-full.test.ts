import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  visualRegistryV3,
  EDUCATIONAL_VISUAL_DSL_VERSION_V3,
  VisualSceneDefinitionV3Schema,
  VisualTextElementSchema,
  VisualFormulaElementSchema,
  VisualNeuralNodeElementSchema,
  VisualMatrixElementSchema,
  ConceptIntroVisualPayloadSchema,
  AlgebraIdentityVisualPayloadSchema,
  NeuralArchitectureVisualPayloadSchema,
  LossLandscapeVisualPayloadSchema,
  AttentionHeatmapVisualPayloadSchema,
  SummaryVisualPayloadSchema,
  REGISTERED_TOPICS_V3
} from '@luminalearn/scene-schema';
import { VisualDirectorAgent } from '../../../packages/agent/src/orchestration/educational-supervisor-v3';
import { EducationalPlannerV3 } from '../../../packages/agent/src/orchestration/educational-planner-v3';
import { POST as previewHandler } from '../src/app/api/v3/preview/route';
import { NextRequest } from 'next/server';

test('PHASE 7 ACCEPTANCE SUITE — UNIVERSAL MATH/AI VISUAL DSL & ADVANCED TEACHER STUDIO', async (t) => {
  // ==========================================================================
  // LEVEL 1: STATIC CONTRACT & VISUAL REGISTRY VALIDATION
  // ==========================================================================
  await t.test('1. Visual DSL V3.1 primitives validate strict mathematical and AI constructs', () => {
    assert.equal(EDUCATIONAL_VISUAL_DSL_VERSION_V3, 'visual-dsl-v3.1');

    // 1a. Visual text element
    const textElem = VisualTextElementSchema.parse({
      elementType: 'text',
      elementId: 'txt_01',
      content: 'Khai triển hằng đẳng thức đáng nhớ',
      position: { x: 50, y: 100 },
      typography: 'heading_1',
      color: '#F8FAFC',
      animation: 'fade_in'
    });
    assert.equal(textElem.elementType, 'text');

    // 1b. Visual formula element
    const formulaElem = VisualFormulaElementSchema.parse({
      elementType: 'formula',
      elementId: 'frm_01',
      latex: '(a + b)^2 = a^2 + 2ab + b^2',
      highlightTerms: ['2ab'],
      color: '#38BDF8',
      animation: 'step_reveal'
    });
    assert.equal(formulaElem.elementType, 'formula');

    // 1c. Visual neural node element
    const nodeElem = VisualNeuralNodeElementSchema.parse({
      elementType: 'neural_node',
      elementId: 'node_w1',
      layerIndex: 0,
      nodeIndex: 0,
      label: 'x₁',
      value: 0.85,
      state: 'active'
    });
    assert.equal(nodeElem.value, 0.85);

    // 1d. Complete VisualSceneDefinition V3.1
    const sceneDef = VisualSceneDefinitionV3Schema.parse({
      schemaVersion: 'visual-dsl-v3.1',
      sceneId: 'scene_dsl_01',
      sceneType: 'algebra_identity',
      layout: 'split_horizontal',
      style: 'clean_educational_infographic',
      animation: 'step_reveal',
      elements: [textElem, formulaElem],
      mathBindings: [
        {
          bindingId: 'bnd_01',
          claimId: 'claim_alg_01',
          elementId: 'frm_01',
          formalExpression: '(a + b)^2 = a^2 + 2*a*b + b^2',
          mathSymbol: '(a+b)^2',
          sympySummary: 'SymPy verified exact polynomial expansion',
          isVerified: true
        }
      ]
    });
    assert.equal(sceneDef.schemaVersion, 'visual-dsl-v3.1');
    assert.equal(sceneDef.elements.length, 2);
    assert.equal(sceneDef.mathBindings[0].isVerified, true);
  });

  await t.test('2. EducationalVisualRegistryV3 correctly indexes canonical math/AI components', () => {
    const allComponents = visualRegistryV3.listAll();
    assert.ok(allComponents.length >= 7, 'Registry must have at least 7 canonical components');

    // 2a. Component retrieval & categories
    const algebraComp = visualRegistryV3.get('algebra_identity');
    assert.ok(algebraComp, 'algebra_identity must be registered');
    assert.equal(algebraComp.category, 'mathematics');
    assert.equal(algebraComp.requiresMathVerification, true);
    assert.ok(algebraComp.supportedBackends.includes('remotion'));

    const neuralComp = visualRegistryV3.get('neural_architecture');
    assert.ok(neuralComp, 'neural_architecture must be registered');
    assert.equal(neuralComp.category, 'ai_ml');

    const lossComp = visualRegistryV3.get('loss_landscape');
    assert.ok(lossComp, 'loss_landscape must be registered');
    assert.equal(lossComp.category, 'ai_ml');

    const attentionComp = visualRegistryV3.get('attention_heatmap');
    assert.ok(attentionComp, 'attention_heatmap must be registered');
    assert.equal(attentionComp.category, 'ai_ml');

    // 2b. Filtering by category
    const mathComponents = visualRegistryV3.listByCategory('mathematics');
    assert.ok(mathComponents.some((c) => c.componentId === 'algebra_identity'));

    const aiComponents = visualRegistryV3.listByCategory('ai_ml');
    assert.ok(aiComponents.some((c) => c.componentId === 'neural_architecture'));
    assert.ok(aiComponents.some((c) => c.componentId === 'loss_landscape'));
    assert.ok(aiComponents.some((c) => c.componentId === 'attention_heatmap'));

    // 2c. Backend support checking
    assert.equal(visualRegistryV3.isRenderSupported('algebra_identity', 'remotion'), true);
    assert.equal(visualRegistryV3.isRenderSupported('concept_intro', 'remotion'), true);

    // 2d. Topic matching
    assert.equal(visualRegistryV3.isTopicSupported('algebra_identity', 'seven_algebraic_identities'), true);
    assert.equal(visualRegistryV3.isTopicSupported('neural_architecture', 'perceptron'), true);
    assert.equal(visualRegistryV3.isTopicSupported('loss_landscape', 'gradient_descent'), true);
    assert.equal(visualRegistryV3.isTopicSupported('attention_heatmap', 'self_attention'), true);
  });

  await t.test('3. Visual registry validates payload integrity and rejects invalid structures', () => {
    // Valid algebra payload
    const validAlgebra = {
      sceneType: 'algebra_identity',
      identityId: 'square_sum',
      leftExpression: '(a + b)^2',
      rightExpression: 'a^2 + 2*a*b + b^2',
      transformationSteps: [
        { expression: '(a + b)^2', explanationVietnamese: 'Xuất phát từ vế trái' },
        { expression: '(a + b)*(a + b)', explanationVietnamese: 'Định nghĩa lũy thừa bậc 2' },
        { expression: 'a^2 + 2*a*b + b^2', explanationVietnamese: 'Khai triển và thu gọn' }
      ],
      presentation: 'expansion'
    };
    const validCheck = visualRegistryV3.validatePayload('algebra_identity', validAlgebra);
    assert.equal(validCheck.success, true);

    // Invalid algebra payload: first step doesn't match leftExpression
    const invalidAlgebra = {
      ...validAlgebra,
      transformationSteps: [
        { expression: 'a^2 + b^2', explanationVietnamese: 'Bước đầu sai' },
        { expression: 'a^2 + 2*a*b + b^2', explanationVietnamese: 'Vế phải' }
      ]
    };
    const invalidCheck = visualRegistryV3.validatePayload('algebra_identity', invalidAlgebra);
    assert.equal(invalidCheck.success, false);
    assert.ok(invalidCheck.error?.includes('Bước đầu phải giữ nguyên vế trái'));
  });

  // ==========================================================================
  // LEVEL 2: VISUAL DIRECTOR AGENT & DESIGN SYSTEM PRESETS
  // ==========================================================================
  await t.test('4. VisualDirectorAgent directs layout, style and motion following Shotcraft principles', async () => {
    const planner = new EducationalPlannerV3();
    const plan = await planner.planLesson({
      lessonId: 'lesson_dir_test',
      topic: '7 hằng đẳng thức đáng nhớ',
      targetDurationSeconds: 60
    });

    const director = new VisualDirectorAgent();
    const capability = REGISTERED_TOPICS_V3['algebra.identities.seven'];

    const { decisions, updatedScenes } = await director.directVisuals(plan, capability);
    assert.ok(decisions.length > 0);
    assert.equal(decisions.length, plan.storyboard!.scenes.length);

    // Check decisions for algebra scenes
    const algebraDecision = decisions.find((d) => d.sceneType === 'algebra_identity');
    assert.ok(algebraDecision, 'Must find algebra_identity decision');
    assert.equal(algebraDecision.layoutPreset, 'split_horizontal');
    assert.equal(algebraDecision.stylePreset, 'clean_educational_infographic');
    assert.equal(algebraDecision.cameraMotion, 'zoom_in');
    assert.equal(algebraDecision.rhythmPacing, 'dynamic_reveal');
    assert.equal(algebraDecision.preservesVerifiedMath, true);

    // Check first scene decision
    const firstDecision = decisions[0];
    assert.equal(firstDecision.layoutPreset, 'split_horizontal');
    assert.equal(firstDecision.stylePreset, 'clean_educational_infographic');
  });

  // ==========================================================================
  // LEVEL 3: REAL REMOTION PREVIEW ENGINE (/api/v3/preview)
  // ==========================================================================
  await t.test('5. POST /api/v3/preview rejects a client-supplied arbitrary scene', async () => {
    const req = new NextRequest('http://localhost:3000/api/v3/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scene: { sceneId: 'scene_prev_01' },
        frame: 24,
        subtitlesEnabled: true
      })
    });

    const res = await previewHandler(req);
    assert.equal(res.status, 400);

    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'invalid_preview_request');
  });

  await t.test('6. POST /api/v3/preview rejects invalid scene schema fail-closed', async () => {
    const invalidScene = {
      sceneId: 'bad_scene',
      sceneType: 'unknown_type', // Invalid scene type
      title: 'Scene sai',
      durationSeconds: 10
    };

    const req = new NextRequest('http://localhost:3000/api/v3/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scene: invalidScene,
        frame: 24
      })
    });

    const res = await previewHandler(req);
    assert.equal(res.status, 400);

    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'invalid_preview_request');
  });
});
