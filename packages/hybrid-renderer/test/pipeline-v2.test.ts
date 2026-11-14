import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  LessonRequestV2Schema,
  RenderManifestV2Schema,
  type LessonRequestV2
} from '@luminalearn/scene-schema';
import {
  LessonOrchestrator,
  DocumentStore
} from '@luminalearn/agent';

describe('Architecture V2.1 Pipeline Orchestration & Riemann Topic', () => {
  test('validates a Riemann Sum LessonRequestV2', () => {
    const request: LessonRequestV2 = {
      requestId: 'req_riemann_test_001',
      inputMode: 'topic_prompt',
      topic: 'Tổng Riemann và trực giác tích phân',
      audience: 'Học sinh phổ thông',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16',
      sourceDocumentIds: []
    };

    const parsed = LessonRequestV2Schema.parse(request);
    assert.equal(parsed.topic, 'Tổng Riemann và trực giác tích phân');
    assert.equal(parsed.aspectRatio, '9:16');
  });

  test('orchestrates Riemann topic into ready_to_render manifest with riemann_sum visual template', async () => {
    const orchestrator = new LessonOrchestrator();
    const result = await orchestrator.orchestrate({
      requestId: 'req_riemann_002',
      inputMode: 'topic_prompt',
      topic: 'Tổng tích phân Riemann x^2',
      audience: 'Học sinh phổ thông',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16',
      sourceDocumentIds: []
    });

    assert.equal(result.stage, 'ready_to_render');
    assert.ok(result.manifest);
    assert.equal(result.manifest.topicId, 'calculus.integral.riemann_sum');
    assert.equal(result.manifest.dimensions.width, 720);
    assert.equal(result.manifest.dimensions.height, 1280);
    assert.equal(result.manifest.totalFrames, 960);

    // Verify storyboard contains riemann_sum visual template
    const riemannScene = result.manifest.timeline.find((s) => s.templateId === 'riemann_sum');
    assert.ok(riemannScene, 'Manifest must contain a scene with riemann_sum template');
    assert.equal(riemannScene.sceneType, 'animation');

    // Verify mathematical claims verified by sympy gate
    assert.ok(result.lessonPlan);
    const limitClaim = result.lessonPlan.mathematicalClaims.find((c) => c.validatorKey === 'riemann_sum_limit');
    assert.ok(limitClaim);
    assert.equal(limitClaim.expectedExpression, '1/3');
  });

  test('orchestrates source_document mode with genuine grounding evidence', async () => {
    const documentStore = new DocumentStore();
    documentStore.addChunk({
      chunkId: 'chunk_riemann_01',
      documentId: 'doc_giai_tich_12',
      documentTitle: 'Giáo trình Giải tích - Tích phân Riemann',
      pageNumber: 1,
      text: 'Xét hàm số f(x) = x^2 trên đoạn [0, 1]. Chia đoạn thành n cột chữ nhật mỏng. Khi n tiến ra vô cực, tổng diện tích xấp xỉ hội tụ về tích phân xác định bằng 1/3.',
      contentType: 'text/markdown',
      tokenEstimate: 50,
      metadata: {}
    });

    const orchestrator = new LessonOrchestrator({ documentStore });
    const result = await orchestrator.orchestrate({
      requestId: 'req_riemann_doc_003',
      inputMode: 'source_document',
      topic: 'Tổng Riemann và tích phân xác định',
      sourceDocumentIds: ['doc_giai_tich_12'],
      audience: 'Học sinh lớp 12',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16'
    });

    assert.equal(result.stage, 'ready_to_render');
    assert.ok(result.documentAnalysis);
    assert.ok(result.documentAnalysis.totalChunks > 0);
    assert.ok(result.manifest);
  });
});
