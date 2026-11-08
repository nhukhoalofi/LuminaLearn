import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { DocumentChunk, GroundingEvidence, GroundingSupportStatus } from '@luminalearn/scene-schema';
import { normalizeMathExpressionToken } from './math-verifier';
import type { DocumentAnalysisResult, SourceContextBundle } from './types';

/**
 * Kho lưu trữ tài liệu với bộ đệm bộ nhớ và khả năng lưu trữ đĩa (Persistent Document Store)
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

  public saveDocument(doc: { documentId: string; title: string; chunks: DocumentChunk[] }): void {
    this.addChunks(doc.chunks);
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

  public async loadFromDisk(storageDir: string, documentId: string): Promise<boolean> {
    try {
      const chunksPath = join(storageDir, documentId, 'chunks.json');
      const data = JSON.parse(await readFile(chunksPath, 'utf8')) as DocumentChunk[];
      this.addChunks(data);
      return true;
    } catch {
      return false;
    }
  }

  public async persistToDisk(storageDir: string, documentId: string): Promise<void> {
    const chunks = this.getChunksByDocument(documentId);
    if (chunks.length === 0) return;
    const docFolder = join(storageDir, documentId);
    await mkdir(docFolder, { recursive: true });
    await writeFile(join(docFolder, 'chunks.json'), JSON.stringify(chunks, null, 2), 'utf8');
  }
}

/**
 * Dịch vụ đối chiếu nguồn trích dẫn tài liệu (Document Grounding Service)
 * ĐẢM BẢO QUY TẮC CỐT LÕI:
 * 1. quoteExists (evidenceFound): CHỈ xác nhận rằng văn bản thực tế có xuất hiện trong tài liệu.
 * 2. claimExtracted: Xác nhận đoạn trích có thực sự phát biểu một mệnh đề toán học hay không.
 * 3. supportStatus: Xác nhận đoạn trích có hỗ trợ ngữ nghĩa cho mệnh đề toán học đó hay không.
 * 4. KHÔNG BAO GIỜ tự ý đánh dấu "mathematically_verified" (chỉ SymPy mới có quyền này).
 */
export class DocumentGroundingService {
  constructor(private readonly store: DocumentStore) {}

  /**
   * Kiểm tra xem một trích dẫn cụ thể có tồn tại trong tài liệu tại đúng trang đã chỉ định không
   */
  public verifyQuoteInDocument(documentId: string, pageNumber: number, quote: string): {
    found: boolean;
    confidence: number;
    matchType: 'exact' | 'semantic' | 'none';
    matchedChunkId?: string;
  } {
    const chunks = this.store.getChunksByDocument(documentId).filter((c) => c.pageNumber === pageNumber);
    if (chunks.length === 0) {
      return { found: false, confidence: 0, matchType: 'none' };
    }

    const normalizedQuote = quote.toLowerCase().replace(/\s+/g, ' ').trim();

    for (const chunk of chunks) {
      const normalizedChunkText = chunk.text.toLowerCase().replace(/\s+/g, ' ');
      if (normalizedChunkText.includes(normalizedQuote)) {
        return {
          found: true,
          confidence: 1.0,
          matchType: 'exact',
          matchedChunkId: chunk.chunkId
        };
      }

      const quoteWords = normalizedQuote.split(' ');
      const matchCount = quoteWords.filter((w) => w.length >= 2 && normalizedChunkText.includes(w)).length;
      const ratio = matchCount / Math.max(1, quoteWords.length);

      if (ratio > 0.85) {
        return {
          found: false,
          confidence: Number(ratio.toFixed(2)),
          matchType: 'semantic',
          matchedChunkId: chunk.chunkId
        };
      }
    }

    return { found: false, confidence: 0, matchType: 'none' };
  }

  /**
   * Kiểm tra xem đoạn trích (quote) có thực sự phát biểu và hỗ trợ mệnh đề toán học
   * (validatorKey + expectedExpression) hay chỉ nhắc tới từ khóa/hàm số mà không có kết quả.
   */
  public verifyClaimSupportInQuote(
    validatorKey: string,
    expectedExpression: string,
    quote: string
  ): {
    claimExtracted: boolean;
    supportStatus: GroundingSupportStatus;
    extractedExpression?: string;
    reason: string;
  } {
    const normalizedExpected = normalizeMathExpressionToken(expectedExpression);
    const cleanedQuote = quote
      .replace(/f\s*\(\s*x\s*\)\s*=\s*x(?:\^2|²|\*\*2)/gi, ' ')
      .replace(/y\s*=\s*x(?:\^2|²|\*\*2)/gi, ' ');

    if (validatorKey === 'polynomial_derivative') {
      const match = /(?:đạo hàm[^.;\n]{0,60}?(?:=|là|bằng)|f'\s*\(\s*x\s*\)\s*=)\s*([0-9]+\s*\*?\s*x(?:\^[0-9]+|²|³)?|hai x|ba x|bốn x)/i.exec(cleanedQuote);
      if (!match) {
        const directToken = /\b(2\s*\*?\s*x|3\s*\*?\s*x|hai x|ba x)\b/i.exec(cleanedQuote);
        if (!directToken) {
          return {
            claimExtracted: false,
            supportStatus: 'needs_review',
            reason: 'Đoạn trích không phát biểu tường minh biểu thức đạo hàm'
          };
        }
        const extracted = normalizeMathExpressionToken(directToken[1]);
        return {
          claimExtracted: true,
          supportStatus: extracted === normalizedExpected ? 'supported' : 'unsupported',
          extractedExpression: extracted,
          reason: extracted === normalizedExpected
            ? 'Đoạn trích nêu khớp biểu thức đạo hàm'
            : `Đoạn trích nêu '${extracted}' khác với mệnh đề '${expectedExpression}'`
        };
      }
      const extracted = normalizeMathExpressionToken(match[1]);
      return {
        claimExtracted: true,
        supportStatus: extracted === normalizedExpected ? 'supported' : 'unsupported',
        extractedExpression: extracted,
        reason: extracted === normalizedExpected
          ? 'Đoạn trích phát biểu trực tiếp mệnh đề đạo hàm'
          : `Đoạn trích phát biểu '${extracted}' mâu thuẫn với '${expectedExpression}'`
      };
    }

    if (validatorKey === 'definite_integral' || validatorKey === 'riemann_sum_limit') {
      const match = /(\d+\s*\/\s*\d+|một phần ba|một phần hai|một phần tư)/i.exec(cleanedQuote);
      if (!match) {
        return {
          claimExtracted: false,
          supportStatus: 'needs_review',
          reason: 'Đoạn trích không nêu giá trị tích phân hoặc giới hạn tổng Riemann'
        };
      }
      const extracted = normalizeMathExpressionToken(match[1]);
      return {
        claimExtracted: true,
        supportStatus: extracted === normalizedExpected ? 'supported' : 'unsupported',
        extractedExpression: extracted,
        reason: extracted === normalizedExpected
          ? 'Đoạn trích phát biểu trực tiếp giá trị tích phân/giới hạn'
          : `Đoạn trích phát biểu '${extracted}' khác với '${expectedExpression}'`
      };
    }

    // Other validators (secant_slope, limit_at_zero, value_at_point)
    const normalizedQuote = normalizeMathExpressionToken(cleanedQuote);
    if (normalizedQuote.includes(normalizedExpected)) {
      return {
        claimExtracted: true,
        supportStatus: 'supported',
        extractedExpression: normalizedExpected,
        reason: 'Đoạn trích chứa biểu thức kỳ vọng của mệnh đề'
      };
    }

    return {
      claimExtracted: false,
      supportStatus: 'needs_review',
      reason: 'Đoạn trích không nêu tường minh biểu thức của mệnh đề này'
    };
  }

  /**
   * Xây dựng bằng chứng đối chiếu nguồn (Grounding Evidence) cho mệnh đề bài học
   */
  public buildEvidence(
    claimId: string,
    documentId: string,
    pageNumber: number,
    quote: string,
    notes?: string,
    claimContext?: { validatorKey: string; expectedExpression: string }
  ): GroundingEvidence {
    const verification = this.verifyQuoteInDocument(documentId, pageNumber, quote);
    const cleanDoc = documentId.replace(/^doc_/, '').slice(0, 16);
    const cleanClaim = claimId.replace(/^claim_/, '').slice(0, 24);

    const isExact = verification.matchType === 'exact';
    const support = claimContext && isExact
      ? this.verifyClaimSupportInQuote(claimContext.validatorKey, claimContext.expectedExpression, quote)
      : {
          claimExtracted: isExact,
          supportStatus: (isExact ? 'supported' : 'unsupported') as GroundingSupportStatus,
          reason: isExact ? 'Trích dẫn xác thực nguyên văn trong tài liệu' : 'Không tìm thấy trích dẫn nguyên văn'
        };

    const notesResolved = notes || (
      !isExact
        ? verification.matchType === 'semantic'
          ? `Cảnh báo: Chỉ tìm thấy văn bản tương tự ngữ nghĩa (độ tin cậy ${verification.confidence}), không phải trích dẫn nguyên văn`
          : 'Cảnh báo: Không tìm thấy trích dẫn trong tài liệu'
        : support.reason
    );

    return {
      evidenceId: `ev_${cleanClaim}_p${pageNumber}`,
      claimId,
      sourceReference: {
        id: `ref_${cleanDoc}_p${pageNumber}`,
        documentId,
        chunkId: verification.matchedChunkId,
        pageNumber,
        exactQuote: quote,
        relevanceScore: verification.confidence
      },
      evidenceFound: isExact,
      evidenceMatchConfidence: verification.confidence,
      matchType: verification.matchType,
      isExactQuote: isExact,
      quoteExists: isExact,
      claimExtracted: isExact ? support.claimExtracted : false,
      supportStatus: isExact ? support.supportStatus : 'unsupported',
      verificationSeparationNote: 'Grounding verifies quote existence and semantic support only; formal mathematical validity requires SymPy.',
      notes: notesResolved
    };
  }
}

/**
 * Chuyên gia phân tích tài liệu (Document Analyst Agent)
 * Trích xuất khái niệm chính, đề xuất candidate claims có gắn kèm chunkId & pageNumber.
 * KHÔNG tự bịa mệnh đề toán học nếu tài liệu chỉ nhắc tới hàm số x^2 mà không nêu kết quả.
 */
function extractVerbatimQuoteWindow(text: string, matchIndex = 0, maxLen = 320): string {
  if (text.length <= maxLen) return text.trim();
  const start = Math.max(0, Math.min(text.length - maxLen, matchIndex - Math.floor(maxLen / 2)));
  return text.slice(start, start + maxLen).trim();
}

export class DocumentAnalyst {
  constructor(
    private readonly store: DocumentStore,
    private readonly groundingService: DocumentGroundingService
  ) {}

  public analyze(documentIds: string[], _topic: string): DocumentAnalysisResult {
    const allowedDocIds = new Set(documentIds);
    const chunks: DocumentChunk[] = [];
    for (const docId of allowedDocIds) {
      chunks.push(...this.store.getChunksByDocument(docId));
    }

    if (chunks.length === 0) {
      return {
        documentIds: [...allowedDocIds],
        totalChunks: 0,
        extractedConcepts: [],
        candidateClaims: [],
        evidence: []
      };
    }

    const extractedConcepts = new Set<string>();
    const candidateClaims: DocumentAnalysisResult['candidateClaims'] = [];
    const evidenceList: GroundingEvidence[] = [];
    const ambiguousEvidenceList: GroundingEvidence[] = [];
    let pendingUnverifiedReason: string | undefined;

    for (const chunk of chunks) {
      const defaultQuoteSnippet = extractVerbatimQuoteWindow(chunk.text, 0);

      // 1. Phân tích chủ đề Đạo hàm
      if (/đạo hàm|tiếp tuyến|cát tuyến|tốc độ thay đổi/i.test(chunk.text)) {
        extractedConcepts.add('Đạo hàm');
        extractedConcepts.add('Tiếp tuyến');
        extractedConcepts.add('Cát tuyến');

        if (/x\^2|x²|x bình phương/i.test(chunk.text)) {
          const cleaned = chunk.text
            .replace(/f\s*\(\s*x\s*\)\s*=\s*x(?:\^2|²|\*\*2)/gi, ' ')
            .replace(/y\s*=\s*x(?:\^2|²|\*\*2)/gi, ' ');

          // Chỉ trích xuất claim khi tài liệu thực sự nêu biểu thức đạo hàm (ví dụ 2x hoặc 3x)
          const explicitDeriv = /(\d+\s*\*?\s*x|hai x|ba x|bốn x)/i.exec(cleaned);
          if (explicitDeriv) {
            const quoteSnippet = extractVerbatimQuoteWindow(chunk.text, explicitDeriv.index ?? 0);
            const expr = normalizeMathExpressionToken(explicitDeriv[1]);
            const stmt = expr === '2*x'
              ? 'Đạo hàm của hàm số f(x) = x^2 là 2x'
              : `Đạo hàm của hàm số f(x) = x^2 là ${explicitDeriv[1].trim()} (Mệnh đề trích xuất nguyên văn từ tài liệu nguồn)`;

            candidateClaims.push({
              claimStatement: stmt,
              validatorKey: 'polynomial_derivative',
              expectedExpression: expr,
              quote: quoteSnippet,
              pageNumber: chunk.pageNumber,
              documentId: chunk.documentId,
              chunkId: chunk.chunkId,
              supportStatus: 'supported'
            });

            evidenceList.push(
              this.groundingService.buildEvidence(
                `claim_deriv_${chunk.chunkId}`,
                chunk.documentId,
                chunk.pageNumber,
                quoteSnippet,
                undefined,
                { validatorKey: 'polynomial_derivative', expectedExpression: expr }
              )
            );
          } else {
            const reason =
              'source_claim_unsupported: Tài liệu có nhắc tới đạo hàm và x^2 nhưng không phát biểu tường minh kết quả đạo hàm; không tự động suy diễn công thức.';
            pendingUnverifiedReason = reason;
            ambiguousEvidenceList.push({
              evidenceId: `ev_ambiguous_deriv_${chunk.chunkId.replace(/^chunk_/, '').slice(0, 20)}_p${chunk.pageNumber}`,
              claimId: `claim_ambiguous_${chunk.chunkId.replace(/^chunk_/, '').slice(0, 20)}`,
              sourceReference: {
                id: `ref_${chunk.documentId.replace(/^doc_/, '').slice(0, 16)}_p${chunk.pageNumber}`,
                documentId: chunk.documentId,
                chunkId: chunk.chunkId,
                pageNumber: chunk.pageNumber,
                exactQuote: defaultQuoteSnippet,
                relevanceScore: 1
              },
              evidenceFound: true,
              evidenceMatchConfidence: 1,
              matchType: 'exact',
              isExactQuote: true,
              quoteExists: true,
              claimExtracted: false,
              supportStatus: 'needs_review',
              verificationSeparationNote: 'Quote exists verbatim, but no explicit derivative claim could be extracted.',
              notes: reason
            });
          }
        }
      }

      // 2. Phân tích chủ đề Tích phân & Tổng Riemann
      if (/tích phân|tich phan|riemann|hình chữ nhật|diện tích cong|phân hoạch/i.test(chunk.text)) {
        extractedConcepts.add('Tích phân xác định');
        extractedConcepts.add('Tổng Riemann');
        extractedConcepts.add('Xấp xỉ diện tích');

        if (/x\^2|x²|x bình phương/i.test(chunk.text) || /\[0,\s*1\]/i.test(chunk.text)) {
          const explicitIntegral = /(\b1\s*\/\s*3\b|\b1\s*\/\s*2\b|\b1\s*\/\s*4\b|một phần ba|một phần hai|một phần tư)/i.exec(chunk.text);
          if (explicitIntegral) {
            const quoteSnippet = extractVerbatimQuoteWindow(chunk.text, explicitIntegral.index ?? 0);
            const expr = normalizeMathExpressionToken(explicitIntegral[1]);
            const stmt = expr === '1/3'
              ? 'Tích phân xác định của x^2 trên [0, 1] bằng 1/3'
              : `Tích phân xác định của x^2 trên [0, 1] là ${expr} (Mệnh đề trích xuất nguyên văn từ tài liệu nguồn)`;

            candidateClaims.push({
              claimStatement: stmt,
              validatorKey: 'definite_integral',
              expectedExpression: expr,
              quote: quoteSnippet,
              pageNumber: chunk.pageNumber,
              documentId: chunk.documentId,
              chunkId: chunk.chunkId,
              supportStatus: 'supported'
            });

            evidenceList.push(
              this.groundingService.buildEvidence(
                `claim_integral_${chunk.chunkId}`,
                chunk.documentId,
                chunk.pageNumber,
                quoteSnippet,
                undefined,
                { validatorKey: 'definite_integral', expectedExpression: expr }
              )
            );
          } else {
            const reason =
              'source_claim_unsupported: Tài liệu có nhắc tới tích phân/Riemann và x^2 nhưng không phát biểu giá trị tích phân; không tự động suy diễn.';
            pendingUnverifiedReason = reason;
            ambiguousEvidenceList.push({
              evidenceId: `ev_ambiguous_int_${chunk.chunkId.replace(/^chunk_/, '').slice(0, 20)}_p${chunk.pageNumber}`,
              claimId: `claim_ambiguous_${chunk.chunkId.replace(/^chunk_/, '').slice(0, 20)}`,
              sourceReference: {
                id: `ref_${chunk.documentId.replace(/^doc_/, '').slice(0, 16)}_p${chunk.pageNumber}`,
                documentId: chunk.documentId,
                chunkId: chunk.chunkId,
                pageNumber: chunk.pageNumber,
                exactQuote: defaultQuoteSnippet,
                relevanceScore: 1
              },
              evidenceFound: true,
              evidenceMatchConfidence: 1,
              matchType: 'exact',
              isExactQuote: true,
              quoteExists: true,
              claimExtracted: false,
              supportStatus: 'needs_review',
              verificationSeparationNote: 'Quote exists verbatim, but no explicit integral value claim could be extracted.',
              notes: reason
            });
          }
        }
      }
    }

    let unverifiedClaimsReason: string | undefined;
    if (candidateClaims.length === 0 && ambiguousEvidenceList.length > 0) {
      evidenceList.push(...ambiguousEvidenceList);
      unverifiedClaimsReason = pendingUnverifiedReason;
    }

    return {
      documentIds: [...allowedDocIds],
      totalChunks: chunks.length,
      extractedConcepts: Array.from(extractedConcepts),
      candidateClaims,
      evidence: evidenceList,
      unverifiedClaimsReason
    };
  }

  /**
   * Lựa chọn các chunk liên quan nhất (Relevance-Based Chunk Selection) trong giới hạn prompt,
   * đảm bảo chỉ lấy từ `documentIds` được phép và không bỏ sót công thức nằm ở trang cuối tài liệu dài.
   */
  public buildSourceContextBundle(
    documentIds: string[],
    analysis: DocumentAnalysisResult,
    limits: { maxExcerpts?: number; maxExcerptCharacters?: number; topicQuery?: string } = {}
  ): SourceContextBundle {
    const maxExcerpts = limits.maxExcerpts ?? 12;
    const maxExcerptCharacters = limits.maxExcerptCharacters ?? 1_200;
    const allowedDocIds = new Set(documentIds);
    const claimChunkIds = new Set(analysis.candidateClaims.map((c) => c.chunkId).filter(Boolean));
    const evidenceChunkIds = new Set(analysis.evidence.map((e) => e.sourceReference.chunkId).filter(Boolean));
    const queryWords = (limits.topicQuery ?? '')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 2);

    const scoreChunk = (chunk: DocumentChunk): number => {
      let score = 0;
      const lower = chunk.text.toLowerCase();
      if (claimChunkIds.has(chunk.chunkId)) score += 100;
      if (evidenceChunkIds.has(chunk.chunkId)) score += 40;
      if (/đạo hàm|tiếp tuyến|cát tuyến|tích phân|riemann|phân hoạch|giới hạn|lim/i.test(lower)) score += 25;
      if (/x\^2|x²|2x|2\*x|1\/3|f'\(x\)|∫/i.test(lower)) score += 25;
      for (const word of queryWords) {
        if (lower.includes(word)) score += 5;
      }
      return score;
    };

    const allAllowedChunks = [...allowedDocIds]
      .flatMap((documentId) => this.store.getChunksByDocument(documentId))
      .filter((chunk) => allowedDocIds.has(chunk.documentId));

    const selectedChunks = allAllowedChunks
      .map((chunk) => ({ chunk, score: scoreChunk(chunk) }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.chunk.documentId.localeCompare(b.chunk.documentId) ||
          a.chunk.pageNumber - b.chunk.pageNumber ||
          a.chunk.chunkId.localeCompare(b.chunk.chunkId)
      )
      .slice(0, maxExcerpts)
      .map((item) => item.chunk)
      .sort(
        (a, b) =>
          a.documentId.localeCompare(b.documentId) ||
          a.pageNumber - b.pageNumber ||
          a.chunkId.localeCompare(b.chunkId)
      );

    const excerpts = selectedChunks.map((chunk) => ({
      documentId: chunk.documentId,
      chunkId: chunk.chunkId,
      pageNumber: chunk.pageNumber,
      text: chunk.text.slice(0, maxExcerptCharacters)
    }));

    return {
      trust: 'untrusted_document_content',
      documentIds: [...allowedDocIds],
      excerpts,
      candidateClaims: analysis.candidateClaims.slice(0, 12),
      exactMatchEvidence: analysis.evidence
        .filter((item) => item.evidenceFound && item.matchType === 'exact' && item.supportStatus === 'supported')
        .slice(0, 12)
    };
  }
}
