import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compileStoryboardV2,
  defaultTemplateRegistry,
  DocumentChunkSchema,
  GroundingEvidenceSchema,
  LessonPlanV2Schema,
  LessonRequestV2Schema,
  MathTemplateRegistry,
  StoryboardV2Schema,
  type LessonPlanV2,
  type NarrationPlanV2,
  type StoryboardV2
} from '../src/v2/index';

describe('Architecture V2 Contracts & Schemas', () => {
  it('validates a valid LessonRequestV2 for prompt mode', () => {
    const valid = LessonRequestV2Schema.parse({
      requestId: 'req_derivative_01',
      inputMode: 'topic_prompt',
      topic: 'Bản chất hình học của đạo hàm',
      audience: 'Học sinh lớp 11',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16'
    });
    assert.equal(valid.requestId, 'req_derivative_01');
    assert.equal(valid.inputMode, 'topic_prompt');
  });

  it('requires sourceDocumentIds when inputMode is source_document', () => {
    assert.throws(
      () =>
        LessonRequestV2Schema.parse({
          requestId: 'req_doc_01',
          inputMode: 'source_document',
          topic: 'Định lý giới hạn',
          sourceDocumentIds: []
        }),
      /source_document input mode requires at least one source document ID/
    );
  });

  it('rejects executable code in lesson content', () => {
    assert.throws(
      () =>
        DocumentChunkSchema.parse({
          chunkId: 'chunk_01',
          documentId: 'doc_math',
          documentTitle: 'Sách giáo khoa',
          pageNumber: 12,
          text: 'import os; os.system("rm -rf /")',
          contentType: 'text/plain',
          tokenEstimate: 50
        }),
      /Executable code or script tags are strictly forbidden/
    );
  });

  it('distinguishes evidence_found from mathematical verification in GroundingEvidence', () => {
    // Trường hợp 1: Có trong tài liệu nhưng sai toán học (evidence_found = true, mathematicalStatus = failed)
    const rawEvidence = {
      evidenceId: 'ev_01',
      claimId: 'claim_wrong_formula',
      sourceReference: {
        id: 'ref_p15',
        documentId: 'doc_misprinted_book',
        pageNumber: 15,
        exactQuote: 'Theo đó, đạo hàm của x^2 là 3x.'
      },
      evidenceFound: true,
      evidenceMatchConfidence: 0.98,
      notes: 'Tài liệu in nhầm công thức'
    };
    const evidence = GroundingEvidenceSchema.parse(rawEvidence);
    assert.equal(evidence.evidenceFound, true);
    assert.equal(evidence.evidenceMatchConfidence, 0.98);
  });

  it('validates a complete LessonPlanV2', () => {
    const plan: LessonPlanV2 = {
      schemaVersion: 'lesson-v2',
      lessonId: 'lesson_derivative_01',
      topicId: 'calculus.derivative.intuition',
      title: 'Bản chất trực quan của đạo hàm',
      learningObjectives: ['Hiểu ý nghĩa cát tuyến tiến về tiếp tuyến', 'Nắm vững công thức tốc độ thay đổi tức thời'],
      prerequisites: ['Hàm số bậc hai', 'Giới hạn hàm số'],
      keyConcepts: ['Cát tuyến', 'Tiếp tuyến', 'Khoảng cách h', 'Hệ số góc'],
      mathematicalClaims: [
        {
          id: 'claim_deriv',
          statement: 'Đạo hàm của hàm f(x)=x^2 là 2x',
          validatorKey: 'polynomial_derivative',
          expectedExpression: '2*x',
          verificationStatus: 'verified'
        },
        {
          id: 'claim_slope',
          statement: 'Hệ số góc tiếp tuyến tại x=1 bằng 2',
          validatorKey: 'value_at_point',
          expectedExpression: '2',
          verificationStatus: 'verified'
        }
      ],
      sourceEvidence: [],
      pedagogicalSequence: [
        {
          stepNumber: 1,
          pedagogicalGoal: 'Gợi mở câu hỏi thực tế',
          intuitiveConcept: 'Vận tốc tức thời tại đúng một tích tắc đo thế nào?',
          targetDurationSeconds: 8
        },
        {
          stepNumber: 2,
          pedagogicalGoal: 'Mô phỏng hình học',
          intuitiveConcept: 'Cho điểm Q tiến dần về P trên đường cong parabol',
          formalFormula: 'm(h) = (f(x+h) - f(x))/h',
          targetDurationSeconds: 16
        }
      ],
      summary: 'Đạo hàm là hệ số góc tiếp tuyến và là tốc độ thay đổi tức thời.'
    };

    const validated = LessonPlanV2Schema.parse(plan);
    assert.equal(validated.lessonId, 'lesson_derivative_01');
    assert.equal(validated.mathematicalClaims.length, 2);
  });

  it('rejects LessonPlanV2 with duplicate claim IDs', () => {
    const invalidPlan = {
      schemaVersion: 'lesson-v2',
      lessonId: 'lesson_bad_01',
      topicId: 'calculus.derivative.intuition',
      title: 'Bài học lỗi trùng claim',
      learningObjectives: ['Mục tiêu 1'],
      keyConcepts: ['Khái niệm 1'],
      mathematicalClaims: [
        { id: 'claim_dup', statement: 'Statement 1', validatorKey: 'key_1', expectedExpression: '2*x', verificationStatus: 'verified' },
        { id: 'claim_dup', statement: 'Statement 2', validatorKey: 'key_2', expectedExpression: '3*x', verificationStatus: 'verified' }
      ],
      pedagogicalSequence: [
        { stepNumber: 1, pedagogicalGoal: 'Goal 1', intuitiveConcept: 'Concept 1', targetDurationSeconds: 10 }
      ],
      summary: 'Tóm tắt bài học'
    };

    assert.throws(() => LessonPlanV2Schema.parse(invalidPlan), /Duplicate claim ID: claim_dup/);
  });

  it('validates a StoryboardV2 and catches duration inconsistencies', () => {
    const validStoryboard: StoryboardV2 = {
      storyboardId: 'sb_01',
      lessonId: 'lesson_derivative_01',
      topicId: 'calculus.derivative.intuition',
      scenes: [
        {
          sceneId: 'scene_intro',
          templateId: 'function_graph',
          sceneType: 'intro',
          durationFrames: 240, // 10s
          parameters: { coefficients: [0, 0, 1], pointX: 1 },
          layout: { aspectRatio: '9:16', safeAreaPadding: 32 },
          mathematicalBinding: { boundClaimIds: [], latexFormulas: ['f(x) = x^2'] },
          sourceReferenceIds: []
        },
        {
          sceneId: 'scene_motion',
          templateId: 'secant_to_tangent',
          sceneType: 'animation',
          durationFrames: 480, // 20s
          parameters: { coefficients: [0, 0, 1], pointX: 1, hStart: 2.0, hEnd: 0.05 },
          layout: { aspectRatio: '9:16', safeAreaPadding: 32 },
          mathematicalBinding: { boundClaimIds: ['claim_deriv'], latexFormulas: ['h \\to 0'] },
          sourceReferenceIds: []
        }
      ],
      visualTemplateIds: ['function_graph', 'secant_to_tangent'],
      mathematicalData: {},
      narrationObjectives: ['Giải thích trực quan'],
      estimatedDurationFrames: 720,
      sourceReferences: []
    };

    const parsed = StoryboardV2Schema.parse(validStoryboard);
    assert.equal(parsed.scenes.length, 2);

    // Bắt lỗi tổng duration không khớp
    assert.throws(
      () =>
        StoryboardV2Schema.parse({
          ...validStoryboard,
          estimatedDurationFrames: 960 // sai lệch so với 240 + 480 = 720
        }),
      /estimatedDurationFrames \(960\) does not match sum of scene durations \(720\)/
    );
  });
});

describe('MathTemplateRegistry', () => {
  it('registers builtin templates and validates their parameters', () => {
    const registry = new MathTemplateRegistry();
    assert.equal(registry.has('function_graph'), true);
    assert.equal(registry.has('secant_to_tangent'), true);
    assert.equal(registry.has('riemann_sum'), true);
    assert.equal(registry.has('vector_transform'), true);
    assert.equal(registry.has('unit_circle'), true);

    // Tham số hợp lệ cho secant_to_tangent
    const validParams = registry.validateParameters('secant_to_tangent', {
      coefficients: [0, 0, 1],
      pointX: 1,
      hStart: 2.5,
      hEnd: 0.1
    });
    assert.equal(validParams.pointX, 1);

    // Tham số không hợp lệ (hEnd >= hStart)
    assert.throws(
      () =>
        registry.validateParameters('secant_to_tangent', {
          coefficients: [0, 0, 1],
          pointX: 1,
          hStart: 0.1,
          hEnd: 2.5
        }),
      /hEnd must be smaller than hStart/
    );
  });

  it('rejects unregistered template queries', () => {
    assert.throws(() => defaultTemplateRegistry.getOrThrow('quantum_teleportation'), /unsupported_visualization/);
  });

  it('lists templates for specific topics', () => {
    const derivativeTemplates = defaultTemplateRegistry.listForTopic('calculus.derivative.intuition');
    assert.ok(derivativeTemplates.some((t) => t.templateId === 'secant_to_tangent'));
    assert.ok(derivativeTemplates.some((t) => t.templateId === 'function_graph'));

    const integralTemplates = defaultTemplateRegistry.listForTopic('calculus.integral.riemann_sum');
    assert.ok(integralTemplates.some((t) => t.templateId === 'riemann_sum'));
  });
});

describe('Dynamic Storyboard Compiler V2', () => {
  it('compiles StoryboardV2 and NarrationPlanV2 into RenderManifestV2 without gaps', () => {
    const storyboard: StoryboardV2 = {
      storyboardId: 'sb_test_01',
      lessonId: 'lesson_test_01',
      topicId: 'calculus.derivative.intuition',
      scenes: [
        {
          sceneId: 'sc_01',
          templateId: 'function_graph',
          sceneType: 'intro',
          durationFrames: 120,
          parameters: { title: 'Mở đầu' },
          layout: { aspectRatio: '9:16', safeAreaPadding: 32 },
          mathematicalBinding: { boundClaimIds: [], latexFormulas: [] },
          sourceReferenceIds: []
        },
        {
          sceneId: 'sc_02',
          templateId: 'secant_to_tangent',
          sceneType: 'animation',
          durationFrames: 360,
          parameters: { title: 'Hoạt họa cát tuyến' },
          layout: { aspectRatio: '9:16', safeAreaPadding: 32 },
          mathematicalBinding: { boundClaimIds: ['claim_deriv'], latexFormulas: ['m(h)=2+h'] },
          sourceReferenceIds: []
        },
        {
          sceneId: 'sc_03',
          templateId: 'function_graph',
          sceneType: 'summary',
          durationFrames: 240,
          parameters: { title: 'Tóm tắt bài học' },
          layout: { aspectRatio: '9:16', safeAreaPadding: 32 },
          mathematicalBinding: { boundClaimIds: [], latexFormulas: [] },
          sourceReferenceIds: []
        }
      ],
      visualTemplateIds: ['function_graph', 'secant_to_tangent'],
      mathematicalData: {},
      narrationObjectives: ['Giới thiệu', 'Animation', 'Tóm tắt'],
      estimatedDurationFrames: 720,
      sourceReferences: []
    };

    const narrationPlan: NarrationPlanV2 = {
      planId: 'narr_01',
      storyboardId: 'sb_test_01',
      language: 'vi',
      segments: [
        {
          segmentId: 'seg_01',
          sceneId: 'sc_01',
          text: 'Chào mừng các bạn đến với giải tích.',
          subtitleText: 'Chào mừng các bạn đến với giải tích.',
          targetDurationSeconds: 4.5,
          pronunciationHints: []
        },
        {
          segmentId: 'seg_02',
          sceneId: 'sc_02',
          text: 'Quan sát cát tuyến khi khoảng cách h tiến dần về 0.',
          subtitleText: 'Quan sát cát tuyến khi h tiến về 0.',
          targetDurationSeconds: 14.5,
          pronunciationHints: []
        },
        {
          segmentId: 'seg_03',
          sceneId: 'sc_03',
          text: 'Như vậy hệ số góc tiếp tuyến chính là đạo hàm.',
          subtitleText: 'Hệ số góc tiếp tuyến chính là đạo hàm.',
          targetDurationSeconds: 9.5,
          pronunciationHints: []
        }
      ],
      totalWords: 35,
      estimatedDurationSeconds: 28.5,
      mathematicalReview: {
        status: 'verified',
        verifiedClaimIds: ['claim_deriv']
      }
    };

    const manifest = compileStoryboardV2(storyboard, narrationPlan, {
      jobId: 'job-test-v2-001',
      lessonTitle: 'Đạo hàm V2',
      topicId: 'calculus.derivative.intuition',
      fps: 24,
      aspectRatio: '9:16'
    });

    assert.equal(manifest.schemaVersion, 'manifest-v2');
    assert.equal(manifest.totalFrames, 720);
    assert.equal(manifest.timeline.length, 3);
    assert.equal(manifest.timeline[0].startFrame, 0);
    assert.equal(manifest.timeline[0].durationFrames, 120);
    assert.equal(manifest.timeline[1].startFrame, 120);
    assert.equal(manifest.timeline[1].durationFrames, 360);
    assert.equal(manifest.timeline[2].startFrame, 480);
    assert.equal(manifest.timeline[2].durationFrames, 240);
    assert.equal(manifest.dimensions.width, 720);
    assert.equal(manifest.dimensions.height, 1280);
    assert.equal(manifest.subtitleTrack?.cues.length, 3);
    assert.equal(manifest.subtitleTrack?.cues[1].startFrame, 120);
    assert.equal(manifest.subtitleTrack?.cues[1].endFrame, 480);
  });
});
