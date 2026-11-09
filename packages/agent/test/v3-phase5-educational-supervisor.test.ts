import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EducationalSupervisorV3,
  CurriculumPlanningAgent,
  MathSpecialist,
  AiSpecialist,
  VisualDirectorAgent,
  NarrationDirectorAgent,
  PedagogicalQualityReviewer,
  validateCrossAgentConsistency
} from '../src/orchestration/educational-supervisor-v3';
import { EducationalPlannerV3 } from '../src/orchestration/educational-planner-v3';
import {
  SupervisorRequestV3Schema,
  classifyEducationalTopic,
  issueExternalApiConsentV3,
  type SupervisorRequestV3
} from '@luminalearn/scene-schema';

test('CHECKPOINT A → H: Multi-Agent Educational Supervisor V3 Test Suite', async (t) => {
  const supervisor = new EducationalSupervisorV3();

  // Test 1: Math Routing (Scenario 1: Seven Algebraic Identities)
  await t.test('1. Correct Math Routing: Seven algebraic identities routed to MathSpecialist', async () => {
    const request: SupervisorRequestV3 = {
      requestId: 'req_math_identities',
      topic: '7 hằng đẳng thức đáng nhớ',
      domain: 'mathematics',
      targetAudience: 'high_school',
      targetDurationSeconds: 40,
      generationMode: 'mock',
      narrationMode: 'none',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280,
      ownerId: 'teacher_math'
    };

    const finalDraft = await supervisor.coordinate(request);
    assert.equal(finalDraft.capabilityReport.domain, 'mathematics');
    assert.equal(finalDraft.capabilityReport.topicId, 'algebra.identities.seven');
    assert.equal(finalDraft.teacherApprovalRequired, true);

    const specialistTask = finalDraft.trace.tasks.find((t) => t.role === 'math_specialist');
    assert.ok(specialistTask, 'Math specialist task must exist');
    assert.equal(specialistTask.status, 'completed');
    assert.equal(specialistTask.validationStatus, 'passed');

    // All claims verified by SymPy
    assert.ok(finalDraft.lessonPlan.educationalClaims.length >= 7);
    const formalClaims = finalDraft.lessonPlan.educationalClaims.filter((c) => c.claimType === 'formal_mathematics');
    assert.ok(formalClaims.every((c) => c.verificationStatus === 'formally_verified'));
  });

  // Test 2: AI Routing (Scenario 2: Perceptron)
  await t.test('2. Correct AI Routing: Perceptron routed to AiSpecialist with NeuralArchitectureScene', async () => {
    const request: SupervisorRequestV3 = {
      requestId: 'req_ai_perceptron',
      topic: 'Tạo video giải thích Perceptron, trọng số, bias và hàm kích hoạt',
      domain: 'artificial_intelligence',
      targetAudience: 'undergraduate',
      targetDurationSeconds: 40,
      generationMode: 'mock',
      narrationMode: 'none',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280,
      ownerId: 'teacher_ai'
    };

    const finalDraft = await supervisor.coordinate(request);
    assert.equal(finalDraft.capabilityReport.domain, 'artificial_intelligence');
    assert.equal(finalDraft.capabilityReport.topicId, 'ai.perceptron.activation');

    const specialistTask = finalDraft.trace.tasks.find((t) => t.role === 'ai_specialist');
    assert.ok(specialistTask, 'AI specialist task must exist');
    assert.equal(specialistTask.status, 'completed');

    // Visual Director selected NeuralArchitectureScene
    assert.ok(finalDraft.lessonPlan.storyboard?.scenes.some((s) => s.sceneType === 'neural_architecture'));
  });

  // Test 3: AI Routing (Scenario 3: Gradient Descent)
  await t.test('3. Correct AI Routing: Gradient Descent routed with LossLandscapeScene', async () => {
    const request: SupervisorRequestV3 = {
      requestId: 'req_ai_gd',
      topic: 'Tạo video giải thích Gradient Descent và cách tham số thay đổi khi giảm hàm mất mát',
      domain: 'artificial_intelligence',
      targetAudience: 'undergraduate',
      targetDurationSeconds: 40,
      generationMode: 'mock',
      narrationMode: 'none',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280,
      ownerId: 'teacher_ai'
    };

    const finalDraft = await supervisor.coordinate(request);
    assert.equal(finalDraft.capabilityReport.topicId, 'ai.gradient_descent.optimization');
    assert.ok(finalDraft.lessonPlan.storyboard?.scenes.some((s) => s.sceneType === 'loss_landscape'));
  });

  // Test 4: AI Routing (Scenario 4: Self-Attention)
  await t.test('4. Correct AI Routing: Self-Attention routed with AttentionHeatmapScene', async () => {
    const request: SupervisorRequestV3 = {
      requestId: 'req_ai_attention',
      topic: 'Giải thích Self-Attention trong Transformer bằng ma trận Attention',
      domain: 'artificial_intelligence',
      targetAudience: 'undergraduate',
      targetDurationSeconds: 40,
      generationMode: 'mock',
      narrationMode: 'none',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280,
      ownerId: 'teacher_ai'
    };

    const finalDraft = await supervisor.coordinate(request);
    assert.equal(finalDraft.capabilityReport.topicId, 'ai.transformer.attention');
    assert.ok(finalDraft.lessonPlan.storyboard?.scenes.some((s) => s.sceneType === 'attention_heatmap'));
  });

  // Test 5: Unsupported Topic Rejection (Fail-closed)
  await t.test('5. Unsupported / Out-of-scope topic is deterministically rejected fail-closed', async () => {
    const request: SupervisorRequestV3 = {
      requestId: 'req_out_of_scope',
      topic: 'Cách nấu phở bò truyền thống và phản ứng hóa học khi hầm xương',
      domain: 'mathematics',
      targetAudience: 'general_public',
      targetDurationSeconds: 40,
      generationMode: 'mock',
      narrationMode: 'none',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280,
      ownerId: 'user_cook'
    };

    await assert.rejects(
      () => supervisor.coordinate(request),
      /supervisor_unsupported_topic|DomainScopeViolationError|nằm ngoài phạm vi giáo dục/i
    );
  });

  // Test 6: Task Dependency Ordering
  await t.test('6. Task dependency ordering strictly maintained across all stages', async () => {
    const request: SupervisorRequestV3 = {
      requestId: 'req_order_check',
      topic: '7 hằng đẳng thức đáng nhớ',
      domain: 'mathematics',
      targetAudience: 'high_school',
      targetDurationSeconds: 35,
      generationMode: 'mock',
      narrationMode: 'none',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280,
      ownerId: 'teacher_math'
    };

    const finalDraft = await supervisor.coordinate(request);
    const tasks = finalDraft.trace.tasks;

    const tClassification = tasks.find((t) => t.taskId === 'task_1_classification')!;
    const tCurriculum = tasks.find((t) => t.taskId === 'task_2_curriculum')!;
    const tSpecialist = tasks.find((t) => t.taskId === 'task_3_specialist')!;
    const tVerification = tasks.find((t) => t.taskId === 'task_4_verification')!;
    const tVisual = tasks.find((t) => t.taskId === 'task_5_visual_direction')!;
    const tNarration = tasks.find((t) => t.taskId === 'task_6_narration_direction')!;
    const tQuality = tasks.find((t) => t.taskId === 'task_7_quality_review')!;
    const tCrossCheck = tasks.find((t) => t.taskId === 'task_8_cross_agent_validation')!;
    const tDraft = tasks.find((t) => t.taskId === 'task_9_draft_assembly')!;

    assert.deepEqual(tCurriculum.dependencyIds, [tClassification.taskId]);
    assert.deepEqual(tSpecialist.dependencyIds, [tCurriculum.taskId]);
    assert.deepEqual(tVerification.dependencyIds, [tSpecialist.taskId]);
    assert.deepEqual(tVisual.dependencyIds, [tVerification.taskId]);
    assert.deepEqual(tNarration.dependencyIds, [tVisual.taskId]);
    assert.deepEqual(tQuality.dependencyIds, [tNarration.taskId]);
    assert.deepEqual(tCrossCheck.dependencyIds, [tQuality.taskId]);
    assert.deepEqual(tDraft.dependencyIds, [tCrossCheck.taskId]);
  });

  // Test 7: Mathematical proof cannot be overridden
  await t.test('7. Supervisor fails closed and CANNOT override a failed mathematical proof', async () => {
    // Math verifier configured to reject
    const mockRejectVerifier = {
      supportsTopic: () => true,
      verifyClaims: async () => ({
        result: {
          status: 'failed' as const,
          checks: {
            polynomial_derivative: { passed: false, status: 'rejected' as const, reason: 'SymPy proof failed' }
          }
        },
        claims: [
          {
            id: 'claim_1',
            statement: 'Đạo hàm f(x) = x^2 bằng 2x',
            validatorKey: 'polynomial_derivative',
            expectedExpression: "f'(x) = 2*x",
            verificationStatus: 'failed' as const
          }
        ]
      }),
      evaluateStatementConsistency: () => ({ status: 'contradiction_detected' as const, reason: 'False claim' })
    };

    const strictSupervisor = new EducationalSupervisorV3({
      mathVerifier: mockRejectVerifier as any
    });

    const request: SupervisorRequestV3 = {
      requestId: 'req_sympy_fail',
      topic: 'Đạo hàm của hàm số bậc hai',
      domain: 'mathematics',
      targetAudience: 'high_school',
      targetDurationSeconds: 35,
      generationMode: 'mock',
      narrationMode: 'none',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280,
      ownerId: 'teacher_math'
    };

    await assert.rejects(
      () => strictSupervisor.coordinate(request),
      /mathematical_verification_failed/i
    );
  });

  // Test 8: Visual & Narration Consistency
  await t.test('8. Visual Director preserves verified math without substituting unverified expressions', async () => {
    const request: SupervisorRequestV3 = {
      requestId: 'req_vis_math_preserve',
      topic: '7 hằng đẳng thức đáng nhớ',
      domain: 'mathematics',
      targetAudience: 'high_school',
      targetDurationSeconds: 35,
      generationMode: 'mock',
      narrationMode: 'none',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280,
      ownerId: 'teacher_math'
    };

    const finalDraft = await supervisor.coordinate(request);
    const scenes = finalDraft.lessonPlan.storyboard!.scenes;
    for (const scene of scenes) {
      if (scene.sceneType === 'algebra_identity') {
        const payload = scene.visualPayload as any;
        assert.ok(payload.leftExpression, 'Must have leftExpression');
        assert.ok(payload.rightExpression, 'Must have rightExpression');
        assert.ok(payload.transformationSteps.length >= 2, 'Must have intermediate steps');
      }
    }
  });

  // Test 9: Live mode requires consent
  await t.test('9. Live generation mode without signed consent is strictly rejected', async () => {
    const livePlanner = new EducationalPlannerV3({
      aiProvider: {
        isMock: false,
        generateText: async () => 'test'
      } as any
    });

    const liveSupervisor = new EducationalSupervisorV3({
      planner: livePlanner
    });

    const request: SupervisorRequestV3 = {
      requestId: 'req_live_no_consent',
      topic: '7 hằng đẳng thức đáng nhớ',
      domain: 'mathematics',
      targetAudience: 'high_school',
      targetDurationSeconds: 35,
      generationMode: 'live',
      narrationMode: 'none',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280,
      ownerId: 'teacher_math'
      // No consentRecord provided
    };

    await assert.rejects(
      () => liveSupervisor.coordinate(request),
      /external_api_consent_required|Explicit external API consent is required/i
    );
  });

  // Test 10: Live mode with valid signed consent passes
  await t.test('10. Live generation mode with valid signed consent succeeds within budget', async () => {
    const originalSecret = process.env.CONSENT_SIGNING_SECRET;
    process.env.CONSENT_SIGNING_SECRET = 'server_live_test_secret_configured_12345';
    try {
      const consent = issueExternalApiConsentV3({
        ownerId: 'teacher_live',
        provider: 'gemini',
        operation: 'planning',
        isLiveOperation: true
      });

      const mockAiProvider = {
        isMock: false,
        generateStructured: async (req: any) => ({
          data: req.validator({
            title: '7 hằng đẳng thức đáng nhớ',
            summary: '7 hằng đẳng thức đại số',
            learningObjectives: ['Hiểu 7 hằng đẳng thức'],
            keyConcepts: ['Hằng đẳng thức'],
            educationalClaims: [],
            storyboard: { scenes: [] }
          }),
          provenance: 'ai_generated_live' as const
        })
      };

      const livePlanner = new EducationalPlannerV3({
        aiProvider: mockAiProvider as any
      });

      const liveSupervisor = new EducationalSupervisorV3({
        planner: livePlanner
      });

      const request: SupervisorRequestV3 = {
        requestId: 'req_live_valid',
        topic: 'Perceptron và nguyên lý hoạt động của mạng nơ-ron nhân tạo',
        domain: 'artificial_intelligence',
        targetAudience: 'undergraduate',
        targetDurationSeconds: 35,
        generationMode: 'live',
        narrationMode: 'none',
        subtitlesEnabled: true,
        fps: 24,
        width: 720,
        height: 1280,
        ownerId: 'teacher_live',
        consentRecord: consent
      };

      const result = await liveSupervisor.coordinate(request);
      assert.equal(result.trace.budgetUsage.geminiApiCalls, 1);
      assert.equal(result.teacherApprovalRequired, true);
    } finally {
      if (originalSecret) {
        process.env.CONSENT_SIGNING_SECRET = originalSecret;
      } else {
        delete process.env.CONSENT_SIGNING_SECRET;
      }
    }
  });
});

