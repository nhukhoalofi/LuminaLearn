import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DocumentExtractor,
  DocumentChunker,
  DocumentIngestionService,
  DocumentStore,
  DocumentAnalyst,
  DocumentGroundingService,
  LessonOrchestrator,
  MathVerificationService,
  MockMathVerifier,
  DerivativeSymPyVerifier,
  RiemannSymPyVerifier,
  LessonDraftManager,
  MockAIProvider,
  LiveGeminiAIProvider
} from '../src/orchestration';
import type { LessonRequestV2 } from '@luminalearn/scene-schema';

describe('Document Ingestion, Grounding & Verification Gate', () => {
  it('extracts Markdown text and creates structured pages and chunks', () => {
    const mdContent = `# Giới thiệu Giải tích
Đạo hàm mô tả tốc độ thay đổi tức thời của đại lượng.

## Bản chất tiếp tuyến
Khi hai điểm P và Q trên đồ thị x^2 tiến lại gần nhau, cát tuyến trở thành tiếp tuyến.
Đạo hàm của hàm f(x) = x^2 là f'(x) = 2x.`;

    const extracted = DocumentExtractor.extractText(mdContent, 'giai-tich.md');
    assert.equal(extracted.contentType, 'text/markdown');
    assert.equal(extracted.title, 'giai-tich');
    assert.equal(extracted.pages.length, 2);
    assert.equal(extracted.pages[0].sectionTitle, 'Giới thiệu Giải tích');
    assert.equal(extracted.pages[1].sectionTitle, 'Bản chất tiếp tuyến');

    const chunks = DocumentChunker.chunk(extracted, 'doc_giai_tich');
    assert.ok(chunks.length >= 2);
    assert.equal(chunks[0].documentId, 'doc_giai_tich');
    assert.ok(chunks[0].text.length > 0);
  });

  it('detects scanned PDF without text layer and flags needs_ocr', () => {
    // PDF header without text streams (simulating scanned image PDF)
    const scannedPdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\ntrailer\n<< /Root 1 0 R >>\n%%EOF',
      'utf8'
    );

    const extracted = DocumentExtractor.extractPdf(scannedPdfBuffer, 'scanned_exam.pdf');
    assert.equal(extracted.contentType, 'application/pdf');
    assert.equal(extracted.hasTextLayer, false);
    assert.equal(extracted.needsOcr, true);
    assert.ok(extracted.ocrReason?.includes('needs_ocr'));
  });

  it('extracts DOCX files by reading word/document.xml entry', () => {
    // Construct a minimal uncompressed zip buffer with word/document.xml
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Tổng Riemann và Tích phân</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Tích phân xác định của x^2 từ 0 đến 1 bằng 1/3.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

    const entryName = 'word/document.xml';
    const nameBuffer = Buffer.from(entryName, 'utf8');
    const dataBuffer = Buffer.from(docXml, 'utf8');

    // ZIP Local file header (30 bytes)
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); // signature
    header.writeUInt16LE(20, 4);         // version needed
    header.writeUInt16LE(0, 6);          // flags
    header.writeUInt16LE(0, 8);          // compMethod: 0 (uncompressed)
    header.writeUInt16LE(0, 10);         // time
    header.writeUInt16LE(0, 12);         // date
    header.writeUInt32LE(0, 14);         // crc-32 (unverified in extractor)
    header.writeUInt32LE(dataBuffer.length, 18); // compSize
    header.writeUInt32LE(dataBuffer.length, 22); // uncompSize
    header.writeUInt16LE(nameBuffer.length, 26); // nameLen
    header.writeUInt16LE(0, 28);                 // extraLen

    const zipBuffer = Buffer.concat([header, nameBuffer, dataBuffer]);

    const extracted = DocumentExtractor.extractDocx(zipBuffer, 'lesson.docx');
    assert.equal(extracted.contentType, 'application/docx');
    assert.ok(extracted.pages.length >= 1);
    assert.ok(extracted.pages[0].text.includes('Tích phân xác định của x^2'));
  });

  it('rejects path traversal and oversized documents in DocumentIngestionService', async () => {
    const testDir = mkdtempSync(join(tmpdir(), 'lumina-doc-test-'));
    try {
      const service = new DocumentIngestionService({ storageDir: testDir });

      // Path traversal check
      await assert.rejects(
        async () => service.ingestFile({ filename: '../../../evil.txt', buffer: Buffer.from('secret') }),
        /path_traversal/
      );

      // Oversized document check (>10MB)
      const oversized = 'A'.repeat(10 * 1024 * 1024 + 100);
      await assert.rejects(
        async () => service.ingestText(oversized, 'huge.txt'),
        /file_too_large/
      );
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('fails closed when document contains an erroneous mathematical claim (f\'(x) = 3x)', async () => {
    const docStore = new DocumentStore();
    const grounding = new DocumentGroundingService(docStore);

    // Document with a mathematically wrong claim: derivative of x^2 is 3x
    const docId = 'doc_flawed_calculus';
    docStore.saveDocument({
      documentId: docId,
      title: 'Tài liệu giải tích sai số',
      chunks: [
        {
          chunkId: 'c1',
          documentId: docId,
          documentTitle: 'Tài liệu giải tích sai số',
          pageNumber: 1,
          sectionTitle: 'Quy tắc lũy thừa sai',
          contentType: 'text/markdown',
          tokenEstimate: 20,
          metadata: {},
          text: 'Đạo hàm của hàm số f(x) = x^2 là f\'(x) = 3x theo định lý mới.'
        }
      ]
    });

    const analyst = new DocumentAnalyst(docStore, grounding);
    const analysis = analyst.analyze([docId], 'đạo hàm của x^2');

    assert.equal(analysis.candidateClaims.length, 1);
    assert.equal(analysis.candidateClaims[0].expectedExpression, '3*x');

    // Evidence is found in text
    assert.equal(analysis.evidence.length, 1);
    assert.equal(analysis.evidence[0].evidenceFound, true);

    // But formal verification MUST FAIL via SymPy
    const orchestrator = new LessonOrchestrator({
      documentStore: docStore,
      verifier: new MathVerificationService() // Real SymPy
    });

    const request: LessonRequestV2 = {
      requestId: 'req_wrong_claim_doc',
      inputMode: 'source_document',
      sourceDocumentIds: [docId],
      topic: 'đạo hàm của x^2',
      audience: 'Học sinh lớp 11',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16'
    };

    const result = await orchestrator.orchestrate(request);
    assert.equal(result.stage, 'failed');
    assert.equal(result.error?.code, 'mathematical_verification_failed');
  });

  it('rejects unsupported topics from document without falling back to derivative', async () => {
    const docStore = new DocumentStore();
    const docId = 'doc_topology';
    docStore.saveDocument({
      documentId: docId,
      title: 'Nhập môn Tô pô Đại số',
      chunks: [
        {
          chunkId: 'top1',
          documentId: docId,
          documentTitle: 'Nhập môn Tô pô Đại số',
          pageNumber: 1,
          sectionTitle: 'Nhóm đồng điều',
          contentType: 'text/markdown',
          tokenEstimate: 20,
          metadata: {},
          text: 'Nhóm đồng điều bậc một của hình xuyến torus bằng Z cộng Z.'
        }
      ]
    });

    const orchestrator = new LessonOrchestrator({ documentStore: docStore });
    const request: LessonRequestV2 = {
      requestId: 'req_unsupported_doc',
      inputMode: 'source_document',
      sourceDocumentIds: [docId],
      topic: 'Nhóm đồng điều Tô pô Đại số',
      audience: 'Sinh viên đại học',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16'
    };

    const result = await orchestrator.orchestrate(request);
    assert.equal(result.stage, 'needs_review');
    assert.equal(result.error?.code, 'unsupported_topic');
    assert.equal(result.topicInfo?.isSupported, false);
  });
});

describe('LessonDraftManager & Verification Gate', () => {
  it('manages draft lifecycle and blocks approval when claims are unverified or failed', async (t) => {
    const storageRoot = mkdtempSync(join(tmpdir(), 'lumina-draft-lifecycle-'));
    t.after(() => rmSync(storageRoot, { recursive: true, force: true }));
    const draftManager = new LessonDraftManager({ artifactsDir: storageRoot });

    const request: LessonRequestV2 = {
      requestId: 'draft_test_01',
      inputMode: 'topic_prompt',
      sourceDocumentIds: [],
      topic: 'Bản chất hình học của đạo hàm',
      audience: 'Học sinh THPT',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16'
    };

    // 1. Create draft
    const draft = await draftManager.createDraft(request);
    assert.equal(draft.status, 'draft');
    assert.ok(draft.context.lessonPlan);
    assert.equal(draft.context.mathVerification?.status, 'verified');

    // 2. Update narration text
    const updated = await draftManager.updateDraft(draft.draftId, {
      title: 'Đạo hàm qua góc nhìn trực quan mới'
    });
    assert.equal(updated.context.lessonPlan?.title, 'Đạo hàm qua góc nhìn trực quan mới');

    // 3. User attempts to inject a mathematically false claim into the draft
    await draftManager.updateDraft(draft.draftId, {
      mathematicalClaims: [
        {
          id: 'claim_false_poly',
          statement: 'Đạo hàm của x^2 là 3x',
          validatorKey: 'polynomial_derivative',
          expectedExpression: '3*x',
          verificationStatus: 'unverified'
        }
      ]
    });

    assert.equal(draft.context.mathVerification?.status, 'failed');
    assert.equal(draft.status, 'reviewing');

    // 4. Attempt to approve draft with failed claim MUST be rejected
    await assert.rejects(
      async () => draftManager.approveDraft(draft.draftId),
      /Cannot approve draft/
    );

    // 5. Restore valid claim and reverify
    await draftManager.updateDraft(draft.draftId, {
      mathematicalClaims: [
        {
          id: 'claim_true_poly',
          statement: 'Đạo hàm của x^2 là 2x',
          validatorKey: 'polynomial_derivative',
          expectedExpression: '2*x',
          verificationStatus: 'unverified'
        }
      ]
    });

    assert.equal(draft.context.mathVerification?.status, 'verified');

    // 6. Approval succeeds and transitions to ready_to_render
    const approved = await draftManager.approveDraft(draft.draftId, 'Kiểm duyệt viên đã đồng ý');
    assert.equal(approved.status, 'approved');
    assert.equal(approved.context.stage, 'ready_to_render');
    assert.ok(approved.context.manifest);
  });
});

describe('AIProvider & Structured Multi-Agent Output', () => {
  it('MockAIProvider returns deterministic validated output and logs mode', async () => {
    const mockProvider = new MockAIProvider();
    assert.equal(mockProvider.isMock, true);

    const orchestrator = new LessonOrchestrator({
      aiProvider: mockProvider
    });

    const request: LessonRequestV2 = {
      requestId: 'req_ai_test_01',
      inputMode: 'topic_prompt',
      sourceDocumentIds: [],
      topic: 'Tổng Riemann trực quan',
      audience: 'Học sinh lớp 12',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      aspectRatio: '9:16'
    };

    const result = await orchestrator.orchestrate(request);
    assert.equal(result.stage, 'ready_to_render');

    // Verify AI mode is logged
    const planLog = result.logs.find((l) => l.step === 'curriculum_planning');
    assert.ok(planLog);
    assert.equal(planLog?.details?.aiMode, 'deterministic_mock');

    const narrLog = result.logs.find((l) => l.step === 'narration_planning');
    assert.ok(narrLog);
    assert.equal(narrLog?.details?.aiMode, 'deterministic_mock');
  });

  it('LiveGeminiAIProvider throws descriptive error if GEMINI_API_KEY is not set', () => {
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      delete process.env.GEMINI_API_KEY;
      assert.throws(
        () => new LiveGeminiAIProvider({ apiKey: undefined }),
        /GEMINI_API_KEY is required/
      );
    } finally {
      if (originalKey) process.env.GEMINI_API_KEY = originalKey;
    }
  });
});
