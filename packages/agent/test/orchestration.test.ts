import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DocumentAnalyst,
  DocumentGroundingService,
  DocumentStore,
  LessonOrchestrator,
  QualityReviewer,
  TopicRouter,
  type OrchestrationContext
} from '../src/orchestration/index';

describe('Architecture V2 Multi-Agent Orchestrator', () => {
  describe('TopicRouter', () => {
    const router = new TopicRouter();

    it('classifies derivative topics with supported templates', () => {
      const result = router.route({
        requestId: 'req_01',
        inputMode: 'topic_prompt',
        topic: 'Bản chất trực quan của đạo hàm từ cát tuyến',
        audience: 'Lớp 11',
        language: 'vi',
        targetDurationSeconds: 40,
        renderMode: 'mock',
        narrationMode: 'none',
        aspectRatio: '9:16',
        sourceDocumentIds: []
      });

      assert.equal(result.isSupported, true);
      assert.equal(result.topicId, 'calculus.derivative.intuition');
      assert.ok(result.supportedTemplates.includes('secant_to_tangent'));
      assert.ok(result.supportedTemplates.includes('function_graph'));
    });

    it('classifies riemann sum topics with supported templates', () => {
      const result = router.route({
        requestId: 'req_02',
        inputMode: 'topic_prompt',
        topic: 'Tổng tích phân Riemann trực quan',
        audience: 'Sinh viên',
        language: 'vi',
        targetDurationSeconds: 40,
        renderMode: 'mock',
        narrationMode: 'none',
        aspectRatio: '9:16',
        sourceDocumentIds: []
      });

      assert.equal(result.isSupported, true);
      assert.equal(result.topicId, 'calculus.integral.riemann_sum');
      assert.ok(result.supportedTemplates.includes('riemann_sum'));
    });

    it('rejects unsupported topics and never substitutes derivative', () => {
      const result = router.route({
        requestId: 'req_03',
        inputMode: 'topic_prompt',
        topic: 'Lịch sử kiến trúc La Mã cổ đại',
        audience: 'Đại chúng',
        language: 'vi',
        targetDurationSeconds: 40,
        renderMode: 'mock',
        narrationMode: 'none',
        aspectRatio: '9:16',
        sourceDocumentIds: []
      });

      assert.equal(result.isSupported, false);
      assert.equal(result.topicId, 'unknown');
      assert.notEqual(result.topicId, 'calculus.derivative.intuition');
      assert.match(result.unsupportedReason!, /unsupported_topic/);
    });
  });

  describe('Document Grounding Foundation', () => {
    it('verifies genuine quotes and catches fabricated citations', () => {
      const store = new DocumentStore();
      store.addChunk({
        chunkId: 'chunk_sgk_p20',
        documentId: 'doc_sgk_toan_11',
        documentTitle: 'Sách giáo khoa Toán 11',
        pageNumber: 20,
        text: 'Giả sử hàm số y = f(x) có đạo hàm tại x0. Hệ số góc của tiếp tuyến tại M0 là f\'(x0).',
        contentType: 'text/plain',
        tokenEstimate: 30,
        metadata: {}
      });

      const grounding = new DocumentGroundingService(store);

      // Quote có thật tại trang 20
      const genuineEvidence = grounding.buildEvidence(
        'claim_slope',
        'doc_sgk_toan_11',
        20,
        'Hệ số góc của tiếp tuyến tại M0 là f\'(x0)'
      );
      assert.equal(genuineEvidence.evidenceFound, true);
      assert.equal(genuineEvidence.evidenceMatchConfidence, 1.0);

      // Trích dẫn ngụy tạo hoặc sai trang
      const fabricatedEvidence = grounding.buildEvidence(
        'claim_fake',
        'doc_sgk_toan_11',
        99, // Trang 99 không tồn tại
        'Mọi hàm số đều có đạo hàm liên tục'
      );
      assert.equal(fabricatedEvidence.evidenceFound, false);
      assert.equal(fabricatedEvidence.evidenceMatchConfidence, 0.0);
    });

    it('extracts candidate claims via DocumentAnalyst', () => {
      const store = new DocumentStore();
      store.addChunk({
        chunkId: 'chunk_sgk_p15',
        documentId: 'doc_calculus',
        documentTitle: 'Giáo trình Giải tích 1',
        pageNumber: 15,
        text: 'Xét hàm số f(x) = x^2. Ta có đạo hàm của x^2 là 2x bằng cách xét giới hạn cát tuyến khi h tiến về 0.',
        contentType: 'text/plain',
        tokenEstimate: 35,
        metadata: {}
      });

      const grounding = new DocumentGroundingService(store);
      const analyst = new DocumentAnalyst(store, grounding);

      const result = analyst.analyze(['doc_calculus'], 'Đạo hàm');
      assert.equal(result.totalChunks, 1);
      assert.ok(result.extractedConcepts.includes('Đạo hàm'));
      assert.equal(result.candidateClaims.length, 1);
      assert.equal(result.candidateClaims[0].expectedExpression, '2*x');
      assert.equal(result.evidence[0].evidenceFound, true);
    });
  });

  describe('QualityReviewer Validation Gates', () => {
    const reviewer = new QualityReviewer();

    it('fails review if any mathematical claim failed formal verification', () => {
      const context: OrchestrationContext = {
        request: {
          requestId: 'req_test',
          inputMode: 'topic_prompt',
          topic: 'Đạo hàm',
          audience: 'Lớp 11',
          language: 'vi',
          targetDurationSeconds: 40,
          renderMode: 'mock',
          narrationMode: 'none',
          aspectRatio: '9:16',
          sourceDocumentIds: []
        },
        stage: 'planned',
        logs: [],
        retryCount: 0,
        maxRetries: 2,
        lessonPlan: {
          schemaVersion: 'lesson-v2',
          lessonId: 'lesson_test',
          topicId: 'calculus.derivative.intuition',
          title: 'Bài học',
          learningObjectives: ['Mục tiêu'],
          prerequisites: [],
          keyConcepts: ['Khái niệm'],
          mathematicalClaims: [
            {
              id: 'claim_false',
              statement: 'Mệnh đề sai toán học',
              validatorKey: 'derivative',
              expectedExpression: '3*x',
              verificationStatus: 'failed' // Thất bại
            }
          ],
          sourceEvidence: [],
          pedagogicalSequence: [
            { stepNumber: 1, pedagogicalGoal: 'Goal', intuitiveConcept: 'Concept', targetDurationSeconds: 40 }
          ],
          summary: 'Tóm tắt'
        }
      };

      const review = reviewer.review(context);
      assert.equal(review.valid, false);
      assert.ok(review.errors.some((e) => e.includes('mathematical_verification_failed')));
    });

    it('fails review if storyboard uses an unregistered visual template', () => {
      const context: OrchestrationContext = {
        request: {
          requestId: 'req_test',
          inputMode: 'topic_prompt',
          topic: 'Đạo hàm',
          audience: 'Lớp 11',
          language: 'vi',
          targetDurationSeconds: 40,
          renderMode: 'mock',
          narrationMode: 'none',
          aspectRatio: '9:16',
          sourceDocumentIds: []
        },
        stage: 'storyboarded',
        logs: [],
        retryCount: 0,
        maxRetries: 2,
        storyboard: {
          storyboardId: 'sb_test',
          lessonId: 'lesson_test',
          topicId: 'calculus.derivative.intuition',
          scenes: [
            {
              sceneId: 'sc_unregistered',
              templateId: 'holographic_3d_portal', // Chưa đăng ký
              sceneType: 'animation',
              durationFrames: 240,
              parameters: {},
              layout: { aspectRatio: '9:16', safeAreaPadding: 32 },
              mathematicalBinding: { boundClaimIds: [], latexFormulas: [] },
              sourceReferenceIds: []
            }
          ],
          visualTemplateIds: ['holographic_3d_portal'],
          mathematicalData: {},
          narrationObjectives: [],
          estimatedDurationFrames: 240,
          sourceReferences: []
        }
      };

      const review = reviewer.review(context);
      assert.equal(review.valid, false);
      assert.ok(review.errors.some((e) => e.includes('unsupported_visualization')));
    });
  });

  describe('LessonOrchestrator End-to-End Coordination', () => {
    it('orchestrates a topic prompt request to ready_to_render', async () => {
      const orchestrator = new LessonOrchestrator();

      const context = await orchestrator.orchestrate({
        requestId: 'req_pipeline_demo_01',
        inputMode: 'topic_prompt',
        topic: 'Giải thích bản chất hình học của đạo hàm',
        audience: 'Học sinh lớp 11',
        language: 'vi',
        targetDurationSeconds: 40,
        renderMode: 'mock',
        narrationMode: 'none',
        aspectRatio: '9:16'
      });

      assert.equal(context.stage, 'ready_to_render');
      assert.equal(context.topicInfo?.topicId, 'calculus.derivative.intuition');
      assert.ok(context.lessonPlan);
      assert.ok(context.storyboard);
      assert.ok(context.narrationPlan);
      assert.ok(context.manifest);
      assert.equal(context.manifest?.totalFrames, context.storyboard?.estimatedDurationFrames);
      assert.ok(context.logs.length >= 8);
    });

    it('orchestrates a document-grounded request with DocumentStore', async () => {
      const store = new DocumentStore();
      store.addChunk({
        chunkId: 'chunk_sgk_01',
        documentId: 'doc_toan_giai_tich',
        documentTitle: 'Giáo trình Giải tích nâng cao',
        pageNumber: 42,
        text: 'Đạo hàm của hàm đa thức f(x) = x^2 là 2x. Xét giới hạn cát tuyến tiến về tiếp tuyến khi h tiến về 0.',
        contentType: 'text/plain',
        tokenEstimate: 40,
        metadata: {}
      });

      const orchestrator = new LessonOrchestrator({ documentStore: store });

      const context = await orchestrator.orchestrate({
        requestId: 'req_doc_demo_02',
        inputMode: 'source_document',
        topic: 'Đạo hàm',
        sourceDocumentIds: ['doc_toan_giai_tich'],
        audience: 'Học sinh lớp 11',
        language: 'vi',
        targetDurationSeconds: 40,
        renderMode: 'mock',
        narrationMode: 'none',
        aspectRatio: '9:16'
      });

      assert.equal(context.stage, 'ready_to_render');
      assert.equal(context.documentAnalysis?.totalChunks, 1);
      assert.ok(context.documentAnalysis?.candidateClaims.length! > 0);
      assert.equal(context.documentAnalysis?.evidence[0].evidenceFound, true);
    });

    it('handles unsupported topic by transitioning to needs_review and halting', async () => {
      const orchestrator = new LessonOrchestrator();

      const context = await orchestrator.orchestrate({
        requestId: 'req_unsupported_03',
        inputMode: 'topic_prompt',
        topic: 'Lập trình vi điều khiển ARM Cortex-M',
        audience: 'Sinh viên',
        language: 'vi',
        targetDurationSeconds: 40,
        renderMode: 'mock',
        narrationMode: 'none',
        aspectRatio: '9:16'
      });

      assert.equal(context.stage, 'needs_review');
      assert.equal(context.error?.code, 'unsupported_topic');
      assert.equal(context.manifest, undefined);
    });

    it('rejects invalid schema with failed stage and invalid_request code', async () => {
      const orchestrator = new LessonOrchestrator();

      const context = await orchestrator.orchestrate({
        requestId: 'invalid!!id##',
        inputMode: 'topic_prompt',
        topic: 'ab' // quá ngắn (< 3 ký tự)
      });

      assert.equal(context.stage, 'failed');
      assert.equal(context.error?.code, 'invalid_request');
    });
  });
});

