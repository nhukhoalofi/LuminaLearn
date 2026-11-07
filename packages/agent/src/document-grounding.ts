import { z } from 'zod';

/**
 * Source text must be extracted by a trusted server-side PDF/DOCX/TXT adapter.
 * This module deliberately does not accept arbitrary URLs or execute document content.
 */
export const SourcePageSchema = z.object({
  pageNumber: z.number().int().positive().max(10_000),
  text: z.string().trim().min(1).max(30_000)
}).strict();

export const SourceDocumentSchema = z.object({
  documentId: z.string().regex(/^doc_[a-z0-9_-]{1,48}$/),
  fileName: z.string().trim().min(1).max(200),
  mediaType: z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]),
  pages: z.array(SourcePageSchema).min(1).max(250)
}).strict().superRefine((document, ctx) => {
  const seen = new Set<number>();
  for (const [index, page] of document.pages.entries()) {
    if (seen.has(page.pageNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom, path: ['pages', index, 'pageNumber'],
        message: 'Duplicate page number'
      });
    }
    seen.add(page.pageNumber);
  }
});

export const SourceDocumentsSchema = z.array(SourceDocumentSchema).min(1).max(12).superRefine((documents, ctx) => {
  const seen = new Set<string>();
  for (const [index, document] of documents.entries()) {
    if (seen.has(document.documentId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom, path: [index, 'documentId'],
        message: 'Duplicate document ID'
      });
    }
    seen.add(document.documentId);
  }
});

export const EvidenceReferenceSchema = z.object({
  documentId: SourceDocumentSchema.shape.documentId,
  pageNumber: z.number().int().positive(),
  quote: z.string().trim().min(4).max(800)
}).strict();

export const DocumentGroundedClaimSchema = z.object({
  claimId: z.string().regex(/^claim_[a-z0-9_]+$/),
  statement: z.string().trim().min(4).max(600),
  evidence: z.array(EvidenceReferenceSchema).min(1).max(8)
}).strict();

export type SourceDocument = z.infer<typeof SourceDocumentSchema>;
export type DocumentGroundedClaim = z.infer<typeof DocumentGroundedClaimSchema>;

export interface EvidenceFinding {
  claimId: string;
  documentId: string;
  pageNumber: number;
  status: 'quote_found' | 'missing_document' | 'missing_page' | 'quote_not_found';
}

/** Verifies that exact supporting excerpts occur in source pages; NOT that a claim is mathematically true. */
export function checkDocumentEvidence(
  documentsInput: unknown,
  claimsInput: unknown
): { status: 'evidence_linked' | 'needs_review'; findings: EvidenceFinding[] } {
  const documents = SourceDocumentsSchema.parse(documentsInput);
  const claims = z.array(DocumentGroundedClaimSchema).min(1).max(100).parse(claimsInput);
  const byId = new Map(documents.map((document) => [document.documentId, document] as const));
  const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  const findings: EvidenceFinding[] = [];

  for (const claim of claims) {
    for (const reference of claim.evidence) {
      const document = byId.get(reference.documentId);
      const page = document?.pages.find((candidate) => candidate.pageNumber === reference.pageNumber);
      const status: EvidenceFinding['status'] = !document
        ? 'missing_document'
        : !page
          ? 'missing_page'
          : normalize(page.text).includes(normalize(reference.quote))
            ? 'quote_found'
            : 'quote_not_found';
      findings.push({ claimId: claim.claimId, documentId: reference.documentId, pageNumber: reference.pageNumber, status });
    }
  }

  return {
    status: findings.every((finding) => finding.status === 'quote_found') ? 'evidence_linked' : 'needs_review',
    findings
  };
}

export interface SourceExcerpt {
  documentId: string;
  pageNumber: number;
  text: string;
  truncated: boolean;
}

/**
 * Deterministic context budget for a future Document Analyst Agent.
 * These excerpts are UNTRUSTED DATA, never instructions to a model or executable code.
 */
export function selectSourceExcerpts(documentsInput: unknown, characterBudget = 12_000): SourceExcerpt[] {
  const documents = SourceDocumentsSchema.parse(documentsInput);
  if (!Number.isInteger(characterBudget) || characterBudget < 100 || characterBudget > 100_000) {
    throw new Error('characterBudget must be an integer between 100 and 100000');
  }

  const excerpts: SourceExcerpt[] = [];
  let remaining = characterBudget;
  for (const document of documents) {
    for (const page of document.pages) {
      if (remaining === 0) return excerpts;
      const text = page.text.slice(0, remaining);
      excerpts.push({
        documentId: document.documentId,
        pageNumber: page.pageNumber,
        text,
        truncated: text.length < page.text.length
      });
      remaining -= text.length;
    }
  }
  return excerpts;
}
