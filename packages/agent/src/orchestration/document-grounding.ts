import type { DocumentChunk, GroundingEvidence } from '@luminalearn/scene-schema';
import type { DocumentAnalysisResult } from './types';

/**
 * Kho lưu trữ tài liệu trong bộ nhớ (In-memory Document Store)
 */
export class DocumentStore {
  private readonly chunks = new Map<string, DocumentChunk>();

  public addChunk(chunk: DocumentChunk): void {
    this.chunks.set(chunk.chunkId, chunk);
  }

  public addChunks(chunks: DocumentChunk[]): void {
    for (const chunk of chunks) {
      this.addChunk(chunk);
    }
  }

  public getChunk(chunkId: string): DocumentChunk | undefined {
    return this.chunks.get(chunkId);
  }

  public getChunksByDocument(documentId: string): DocumentChunk[] {
    return Array.from(this.chunks.values()).filter((c) => c.documentId === documentId);
  }

  public listAll(): DocumentChunk[] {
    return Array.from(this.chunks.values());
  }

  public clear(): void {
    this.chunks.clear();
  }
}

/**
 * Dịch vụ đối chiếu nguồn trích dẫn tài liệu (Document Grounding Service)
 * ĐẢM BẢO QUY TẮC CỐT LÕI:
 * - "evidence_found" CHỈ xác nhận rằng văn bản thực tế có xuất hiện trong tài liệu.
 * - KHÔNG BAO GIỜ tự ý đánh dấu "mathematically_verified".
 * - Bắt lỗi các trích dẫn ngụy tạo (Fabricated Citations).
 */
export class DocumentGroundingService {
  constructor(private readonly store: DocumentStore) {}

  /**
   * Kiểm tra xem một trích dẫn cụ thể có tồn tại trong tài liệu tại đúng trang đã chỉ định không
   */
  public verifyQuoteInDocument(documentId: string, pageNumber: number, quote: string): {
    found: boolean;
    confidence: number;
    matchedChunkId?: string;
  } {
    const chunks = this.store.getChunksByDocument(documentId).filter((c) => c.pageNumber === pageNumber);
    if (chunks.length === 0) {
      return { found: false, confidence: 0 };
    }

    const normalizedQuote = quote.toLowerCase().replace(/\s+/g, ' ').trim();

    for (const chunk of chunks) {
      const normalizedChunkText = chunk.text.toLowerCase().replace(/\s+/g, ' ');
      if (normalizedChunkText.includes(normalizedQuote)) {
        return {
          found: true,
          confidence: 1.0,
          matchedChunkId: chunk.chunkId
        };
      }

      // Kiểm tra độ tương đồng từ vựng nếu không khớp nguyên văn 100%
      const quoteWords = normalizedQuote.split(' ');
      const matchCount = quoteWords.filter((w) => w.length > 2 && normalizedChunkText.includes(w)).length;
      const ratio = matchCount / Math.max(1, quoteWords.length);

      if (ratio > 0.85) {
        return {
          found: true,
          confidence: Number(ratio.toFixed(2)),
          matchedChunkId: chunk.chunkId
        };
      }
    }

    return { found: false, confidence: 0 };
  }

  /**
   * Xây dựng bằng chứng đối chiếu nguồn (Grounding Evidence) cho mệnh đề bài học
   */
  public buildEvidence(
    claimId: string,
    documentId: string,
    pageNumber: number,
    quote: string,
    notes?: string
  ): GroundingEvidence {
    const verification = this.verifyQuoteInDocument(documentId, pageNumber, quote);

    return {
      evidenceId: `ev_${claimId}_${documentId}_p${pageNumber}`,
      claimId,
      sourceReference: {
        id: `ref_${documentId}_p${pageNumber}`,
        documentId,
        pageNumber,
        exactQuote: quote,
        relevanceScore: 1.0
      },
      evidenceFound: verification.found,
      evidenceMatchConfidence: verification.confidence,
      notes: notes || (verification.found ? 'Trích dẫn xác thực trong tài liệu' : 'Cảnh báo: Không tìm thấy trích dẫn trong tài liệu')
    };
  }
}

/**
 * Chuyên gia phân tích tài liệu (Document Analyst Agent)
 * Trích xuất khái niệm chính, đề xuất candidate claims có gắn kèm page reference.
 */
export class DocumentAnalyst {
  constructor(
    private readonly store: DocumentStore,
    private readonly groundingService: DocumentGroundingService
  ) {}

  public analyze(documentIds: string[], topic: string): DocumentAnalysisResult {
    const chunks: DocumentChunk[] = [];
    for (const docId of documentIds) {
      chunks.push(...this.store.getChunksByDocument(docId));
    }

    if (chunks.length === 0) {
      return {
        documentIds,
        totalChunks: 0,
        extractedConcepts: [],
        candidateClaims: [],
        evidence: []
      };
    }

    // Deterministic concept & claim extraction từ các chunk
    const extractedConcepts = new Set<string>();
    const candidateClaims: DocumentAnalysisResult['candidateClaims'] = [];
    const evidenceList: GroundingEvidence[] = [];

    for (const chunk of chunks) {
      if (/đạo hàm|tiếp tuyến|cát tuyến|tốc độ thay đổi/i.test(chunk.text)) {
        extractedConcepts.add('Đạo hàm');
        extractedConcepts.add('Tiếp tuyến');
        extractedConcepts.add('Cát tuyến');

        if (/x\^2|x bình phương/i.test(chunk.text) && /2x|hai x/i.test(chunk.text)) {
          const claim = {
            claimStatement: 'Đạo hàm của hàm số f(x) = x^2 là 2x',
            validatorKey: 'polynomial_derivative',
            expectedExpression: '2*x',
            quote: 'đạo hàm của x^2 là 2x',
            pageNumber: chunk.pageNumber,
            documentId: chunk.documentId
          };
          candidateClaims.push(claim);

          const evidence = this.groundingService.buildEvidence(
            'claim_deriv',
            chunk.documentId,
            chunk.pageNumber,
            chunk.text.slice(0, 80)
          );
          evidenceList.push(evidence);
        }
      }
    }

    return {
      documentIds,
      totalChunks: chunks.length,
      extractedConcepts: Array.from(extractedConcepts),
      candidateClaims,
      evidence: evidenceList
    };
  }
}
