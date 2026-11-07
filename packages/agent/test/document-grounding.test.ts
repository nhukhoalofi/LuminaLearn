import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SourceDocumentsSchema, checkDocumentEvidence, selectSourceExcerpts
} from '../src/document-grounding';

const documents = [{
  documentId: 'doc_calculus',
  fileName: 'Giai-tich.txt',
  mediaType: 'text/plain' as const,
  pages: [
    { pageNumber: 1, text: 'Đạo hàm tại một điểm là giới hạn của tỷ số biến thiên khi giới hạn tồn tại.' },
    { pageNumber: 2, text: 'Với f(x) = x² thì đạo hàm là f\'(x) = 2x.' }
  ]
}];

describe('Document grounding foundation', () => {
  it('accepts extracted source pages and preserves page numbers', () => {
    const result = SourceDocumentsSchema.parse(documents);
    assert.equal(result[0].pages[1].pageNumber, 2);
  });

  it('rejects duplicate page numbers', () => {
    const broken = [{ ...documents[0], pages: [documents[0].pages[0], documents[0].pages[0]] }];
    assert.throws(() => SourceDocumentsSchema.parse(broken), /Duplicate page number/);
  });

  it('rejects duplicate document IDs', () => {
    assert.throws(() => SourceDocumentsSchema.parse([...documents, documents[0]]), /Duplicate document ID/);
  });

  it('links a claim to an exact citation found in the correct page', () => {
    const result = checkDocumentEvidence(documents, [{
      claimId: 'claim_derivative',
      statement: 'Đạo hàm của x bình phương là hai x.',
      evidence: [{ documentId: 'doc_calculus', pageNumber: 2, quote: "đạo hàm là f'(x) = 2x" }]
    }]);
    assert.equal(result.status, 'evidence_linked');
    assert.equal(result.findings[0].status, 'quote_found');
  });

  it('never treats a fabricated quotation as grounded', () => {
    const result = checkDocumentEvidence(documents, [{
      claimId: 'claim_fake',
      statement: 'Đạo hàm của x bình phương là 3x.',
      evidence: [{ documentId: 'doc_calculus', pageNumber: 2, quote: "đạo hàm là f'(x) = 3x" }]
    }]);
    assert.equal(result.status, 'needs_review');
    assert.equal(result.findings[0].status, 'quote_not_found');
  });

  it('rejects citations pointing to unknown pages or documents', () => {
    const result = checkDocumentEvidence(documents, [{
      claimId: 'claim_unavailable',
      statement: 'Trích dẫn không có nguồn hợp lệ.',
      evidence: [
        { documentId: 'doc_calculus', pageNumber: 99, quote: 'Không tìm thấy' },
        { documentId: 'doc_missing', pageNumber: 1, quote: 'Không tìm thấy' }
      ]
    }]);
    assert.deepEqual(result.findings.map((x) => x.status), ['missing_page', 'missing_document']);
  });

  it('limits context by character budget and tracks truncation', () => {
    const excerpts = selectSourceExcerpts(documents, 100);
    assert.equal(excerpts.reduce((sum, page) => sum + page.text.length, 0), 100);
    assert.equal(excerpts.at(-1)?.truncated, true);
    assert.throws(() => selectSourceExcerpts(documents, 10), /characterBudget/);
  });
});
