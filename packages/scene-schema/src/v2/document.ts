import { z } from 'zod';

export const DOCUMENT_CONTENT_TYPES = ['text/plain', 'text/markdown', 'application/pdf', 'application/docx'] as const;

export const NoExecutableString = z.string().trim().min(1).max(5000).refine(
  (val) => !/```|\b(?:import|from|exec|eval|os\.system|subprocess|child_process)\s+[A-Za-z_]|<script/i.test(val),
  'Executable code or script tags are strictly forbidden'
);

export const SafeIdString = z.string().regex(/^[a-z0-9_-]{3,64}$/i, 'ID must be 3-64 alphanumeric characters, dash or underscore');

/**
 * Phân đoạn tài liệu đã được trích xuất an toàn (Trusted Document Chunk)
 */
export const DocumentChunkSchema = z.object({
  chunkId: SafeIdString,
  documentId: SafeIdString,
  documentTitle: z.string().trim().min(1).max(200),
  pageNumber: z.number().int().positive().max(10000),
  sectionTitle: z.string().trim().max(200).optional(),
  text: NoExecutableString,
  contentType: z.enum(DOCUMENT_CONTENT_TYPES),
  tokenEstimate: z.number().int().nonnegative().max(10000),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({})
}).strict();

export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;

/**
 * Trích dẫn nguồn (Source Reference) gắn với phân đoạn tài liệu cụ thể
 */
export const SourceReferenceSchema = z.object({
  id: SafeIdString,
  documentId: SafeIdString,
  pageNumber: z.number().int().positive(),
  exactQuote: z.string().trim().min(3).max(1000),
  summary: z.string().trim().min(3).max(500).optional(),
  relevanceScore: z.number().min(0).max(1).default(1)
}).strict();

export type SourceReference = z.infer<typeof SourceReferenceSchema>;

/**
 * Bằng chứng đối chiếu nguồn tài liệu (Grounding Evidence)
 * RẤT QUAN TRỌNG: Phân biệt rõ "evidence_found" (nội dung có trong tài liệu)
 * với "mathematically_verified" (nội dung đã qua kiểm định toán học hình thức).
 */
export const GroundingEvidenceSchema = z.object({
  evidenceId: SafeIdString,
  claimId: SafeIdString,
  sourceReference: SourceReferenceSchema,
  evidenceFound: z.boolean(),
  evidenceMatchConfidence: z.number().min(0).max(1),
  notes: z.string().max(500).optional()
}).strict();

export type GroundingEvidence = z.infer<typeof GroundingEvidenceSchema>;

