import { inflateRawSync, inflateSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  DocumentChunkSchema,
  type DocumentChunk
} from '@luminalearn/scene-schema';

export interface ExtractedPage {
  pageNumber: number;
  sectionTitle?: string;
  text: string;
}

export interface ExtractedDocument {
  title: string;
  contentType: 'text/plain' | 'text/markdown' | 'application/pdf' | 'application/docx';
  pages: ExtractedPage[];
  hasTextLayer: boolean;
  needsOcr: boolean;
  ocrReason?: string;
}

export interface IngestOptions {
  storageDir?: string;
  maxFileSizeBytes?: number;
  maxTextLength?: number;
}

export interface DocumentIngestionResult {
  documentId: string;
  documentTitle: string;
  contentType: ExtractedDocument['contentType'];
  totalPages: number;
  totalChunks: number;
  chunks: DocumentChunk[];
  needsOcr: boolean;
  ocrReason?: string;
}

/**
 * Sanitizes untrusted text to remove code injection or executable scripts
 */
export function sanitizeDocumentText(text: string): string {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/```[a-z]*\n[\s\S]*?\n```/gi, (match) => match.replace(/```/g, ''))
    .trim();
}

/**
 * Pure TypeScript & Node.js Document Extractor
 * Extracts text from TXT, Markdown, DOCX (via word/document.xml inflation) and PDF text streams.
 */
export class DocumentExtractor {
  public static extractText(raw: string, filename: string): ExtractedDocument {
    const isMarkdown = /\.md$/i.test(filename);
    const sanitized = sanitizeDocumentText(raw);
    const title = basename(filename).replace(/\.[^/.]+$/, '').trim() || 'Tài liệu văn bản';

    // Split text by markdown headings or page breaks
    const sections = isMarkdown
      ? sanitized.split(/(?=^#{1,3}\s+)/m)
      : sanitized.split(/\n\s*\n\s*\n+/);

    const pages: ExtractedPage[] = [];
    let pageNum = 1;

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      let sectionTitle: string | undefined;
      if (isMarkdown && trimmed.startsWith('#')) {
        const headerMatch = trimmed.match(/^#{1,3}\s+([^\n]+)/);
        if (headerMatch) sectionTitle = headerMatch[1].trim();
      }

      pages.push({
        pageNumber: pageNum++,
        sectionTitle,
        text: trimmed
      });
    }

    if (pages.length === 0) {
      pages.push({ pageNumber: 1, text: sanitized });
    }

    return {
      title,
      contentType: isMarkdown ? 'text/markdown' : 'text/plain',
      pages,
      hasTextLayer: true,
      needsOcr: false
    };
  }

  public static extractDocx(buffer: Buffer, filename: string): ExtractedDocument {
    if (!buffer || buffer.length < 30) {
      throw new Error('invalid_docx: Buffer file Word rỗng hoặc quá ngắn');
    }
    const title = basename(filename).replace(/\.[^/.]+$/, '').trim() || 'Tài liệu Word';

    // Parse DOCX by extracting word/document.xml from PKZIP structure
    const documentXml = this.extractZipEntry(buffer, 'word/document.xml');
    if (!documentXml) {
      throw new Error('invalid_docx: Không tìm thấy nội dung word/document.xml trong file Word');
    }

    // Extract paragraphs and headings from XML
    const paragraphRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
    const pages: ExtractedPage[] = [];
    let match: RegExpExecArray | null;
    let sectionIndex = 1;
    let currentSectionTitle: string | undefined;
    let currentParagraphs: string[] = [];

    while ((match = paragraphRegex.exec(documentXml)) !== null) {
      const pXml = match[1];

      // Check if heading
      const isHeading = /<w:pStyle\s+w:val="(?:Heading|Tieude)[^"]*"/i.test(pXml);

      // Extract all text inside <w:t> tags
      const textMatches = pXml.match(/<w:t\b[^>]*>([^<]*)<\/w:t>/g);
      if (!textMatches) continue;

      const pText = textMatches
        .map((t) => t.replace(/<[^>]+>/g, ''))
        .join('')
        .trim();

      if (!pText) continue;

      if (isHeading) {
        if (currentParagraphs.length > 0) {
          pages.push({
            pageNumber: sectionIndex++,
            sectionTitle: currentSectionTitle,
            text: sanitizeDocumentText(currentParagraphs.join('\n\n'))
          });
          currentParagraphs = [];
        }
        currentSectionTitle = pText;
      } else {
        currentParagraphs.push(pText);
      }
    }

    if (currentParagraphs.length > 0) {
      pages.push({
        pageNumber: sectionIndex++,
        sectionTitle: currentSectionTitle,
        text: sanitizeDocumentText(currentParagraphs.join('\n\n'))
      });
    }

    if (pages.length === 0) {
      throw new Error('empty_document: File DOCX không chứa đoạn văn bản nào');
    }

    return {
      title,
      contentType: 'application/docx',
      pages,
      hasTextLayer: true,
      needsOcr: false
    };
  }

  public static extractPdf(buffer: Buffer, filename: string): ExtractedDocument {
    if (!buffer || buffer.length < 10) {
      throw new Error('invalid_pdf: Buffer file PDF rỗng hoặc quá ngắn');
    }
    const title = basename(filename).replace(/\.[^/.]+$/, '').trim() || 'Tài liệu PDF';
    const pdfString = buffer.toString('binary');
    if (!pdfString.includes('%PDF-')) {
      throw new Error('invalid_pdf: File không chứa header PDF hợp lệ (%PDF-)');
    }

    // Find all stream objects in PDF
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    const pages: ExtractedPage[] = [];
    let match: RegExpExecArray | null;
    let pageNumber = 1;
    let totalTextLength = 0;

    while ((match = streamRegex.exec(pdfString)) !== null) {
      const rawStream = match[1];
      let decompressed: string | null = null;

      // Try zlib inflate
      try {
        const streamBuffer = Buffer.from(rawStream, 'binary');
        decompressed = inflateSync(streamBuffer).toString('utf8');
      } catch {
        // Fallback to uncompressed stream
        decompressed = rawStream;
      }

      if (decompressed && (decompressed.includes('Tj') || decompressed.includes('TJ'))) {
        // Extract text from (text) Tj or [(text)] TJ
        const textTokens: string[] = [];
        const tjRegex = /\(([^)]+)\)\s*Tj/g;
        let tjMatch: RegExpExecArray | null;
        while ((tjMatch = tjRegex.exec(decompressed)) !== null) {
          textTokens.push(tjMatch[1]);
        }

        const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
        let arrayMatch: RegExpExecArray | null;
        while ((arrayMatch = tjArrayRegex.exec(decompressed)) !== null) {
          const innerStrings = arrayMatch[1].match(/\(([^)]+)\)/g);
          if (innerStrings) {
            for (const s of innerStrings) {
              textTokens.push(s.slice(1, -1));
            }
          }
        }

        const pageText = textTokens.join(' ').replace(/\s+/g, ' ').trim();
        if (pageText.length > 5) {
          totalTextLength += pageText.length;
          pages.push({
            pageNumber: pageNumber++,
            text: sanitizeDocumentText(pageText)
          });
        }
      }
    }

    // Scanned PDF detection: If no text layer found in stream objects
    if (pages.length === 0 || totalTextLength < 20) {
      return {
        title,
        contentType: 'application/pdf',
        pages: [],
        hasTextLayer: false,
        needsOcr: true,
        ocrReason: 'needs_ocr: File PDF là bản scan hoặc không có lớp text layer (Searchable Text)'
      };
    }

    return {
      title,
      contentType: 'application/pdf',
      pages,
      hasTextLayer: true,
      needsOcr: false
    };
  }

  private static extractZipEntry(buffer: Buffer, entryName: string): string | null {
    let offset = 0;
    while (offset < buffer.length - 30) {
      if (buffer.readUInt32LE(offset) === 0x04034b50) {
        const compMethod = buffer.readUInt16LE(offset + 8);
        const compSize = buffer.readUInt32LE(offset + 18);
        const nameLen = buffer.readUInt16LE(offset + 26);
        const extraLen = buffer.readUInt16LE(offset + 28);
        const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLen);
        const dataStart = offset + 30 + nameLen + extraLen;

        if (name === entryName) {
          const compData = buffer.subarray(dataStart, dataStart + compSize);
          try {
            return compMethod === 8
              ? inflateRawSync(compData).toString('utf8')
              : compData.toString('utf8');
          } catch (err) {
            throw new Error(`invalid_docx_zip: Lỗi giải nén entry ${entryName}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        offset = dataStart + compSize;
      } else {
        offset++;
      }
    }
    return null;
  }
}

/**
 * Splits document pages into bounded DocumentChunk objects
 */
export class DocumentChunker {
  public static chunk(
    extracted: ExtractedDocument,
    documentId: string,
    maxChunkChars = 800
  ): DocumentChunk[] {
    return this.chunkDocument(documentId, extracted, maxChunkChars);
  }

  public static chunkDocument(
    documentId: string,
    extracted: ExtractedDocument,
    maxChunkChars = 800
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let chunkIndex = 1;

    for (const page of extracted.pages) {
      const pageText = page.text.trim();
      if (!pageText) continue;

      if (pageText.length <= maxChunkChars) {
        const tokenEstimate = Math.ceil(pageText.split(/\s+/).length * 1.3);
        chunks.push(
          DocumentChunkSchema.parse({
            chunkId: `chunk_${documentId}_${chunkIndex++}`,
            documentId,
            documentTitle: extracted.title,
            pageNumber: page.pageNumber,
            sectionTitle: page.sectionTitle,
            text: pageText,
            contentType: extracted.contentType,
            tokenEstimate,
            metadata: {
              sourceOffset: 0,
              charCount: pageText.length
            }
          })
        );
      } else {
        // Split longer pages into paragraphs
        const paragraphs = pageText.split(/\n\s*\n/);
        let currentBatch = '';

        for (const p of paragraphs) {
          const trimmedP = p.trim();
          if (!trimmedP) continue;

          if ((currentBatch + '\n\n' + trimmedP).length <= maxChunkChars) {
            currentBatch = currentBatch ? `${currentBatch}\n\n${trimmedP}` : trimmedP;
          } else {
            if (currentBatch) {
              const tokenEstimate = Math.ceil(currentBatch.split(/\s+/).length * 1.3);
              chunks.push(
                DocumentChunkSchema.parse({
                  chunkId: `chunk_${documentId}_${chunkIndex++}`,
                  documentId,
                  documentTitle: extracted.title,
                  pageNumber: page.pageNumber,
                  sectionTitle: page.sectionTitle,
                  text: currentBatch,
                  contentType: extracted.contentType,
                  tokenEstimate,
                  metadata: { charCount: currentBatch.length }
                })
              );
            }
            currentBatch = trimmedP;
          }
        }

        if (currentBatch) {
          const tokenEstimate = Math.ceil(currentBatch.split(/\s+/).length * 1.3);
          chunks.push(
            DocumentChunkSchema.parse({
              chunkId: `chunk_${documentId}_${chunkIndex++}`,
              documentId,
              documentTitle: extracted.title,
              pageNumber: page.pageNumber,
              sectionTitle: page.sectionTitle,
              text: currentBatch,
              contentType: extracted.contentType,
              tokenEstimate,
              metadata: { charCount: currentBatch.length }
            })
          );
        }
      }
    }

    return chunks;
  }
}

/**
 * Service managing document upload, extraction, chunking, and secure private persistence
 */
export class DocumentIngestionService {
  private readonly storageDir: string;
  private readonly maxFileSizeBytes: number;
  private readonly maxTextLength: number;

  constructor(options: IngestOptions = {}) {
    this.storageDir = options.storageDir ?? resolve(process.cwd(), 'outputs/.documents');
    this.maxFileSizeBytes = options.maxFileSizeBytes ?? 10 * 1024 * 1024; // 10MB
    this.maxTextLength = options.maxTextLength ?? 100_000;
  }

  public async ingestFile(file: {
    filename: string;
    buffer: Buffer;
    mimeType?: string;
  }): Promise<DocumentIngestionResult> {
    // 0. Path traversal protection
    if (file.filename.includes('..') || /[<>:"|?*]/.test(file.filename)) {
      throw new Error(`path_traversal: Tên file chứa đường dẫn hoặc ký tự không hợp lệ: ${file.filename}`);
    }

    // 1. File size validation
    if (file.buffer.length > this.maxFileSizeBytes) {
      throw new Error(`file_too_large: Kích thước file (${file.buffer.length} bytes) vượt quá giới hạn cho phép 10MB`);
    }

    // 2. Extension validation
    const ext = basename(file.filename).split('.').pop()?.toLowerCase();
    if (!ext || !['txt', 'md', 'pdf', 'docx'].includes(ext)) {
      throw new Error(`unsupported_document_format: Định dạng .${ext} không được hỗ trợ. Vui lòng cung cấp file .txt, .md, .pdf hoặc .docx`);
    }

    // 3. Generate secure document ID
    const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const documentId = `doc_${timestamp}_${randomBytes(3).toString('hex')}`;

    // 4. Extract document content
    let extracted: ExtractedDocument;
    if (ext === 'txt' || ext === 'md') {
      extracted = DocumentExtractor.extractText(file.buffer.toString('utf8'), file.filename);
    } else if (ext === 'docx') {
      extracted = DocumentExtractor.extractDocx(file.buffer, file.filename);
    } else {
      extracted = DocumentExtractor.extractPdf(file.buffer, file.filename);
    }

    if (extracted.needsOcr) {
      return {
        documentId,
        documentTitle: extracted.title,
        contentType: extracted.contentType,
        totalPages: 0,
        totalChunks: 0,
        chunks: [],
        needsOcr: true,
        ocrReason: extracted.ocrReason
      };
    }

    // 5. Total text length check
    const totalChars = extracted.pages.reduce((sum, p) => sum + p.text.length, 0);
    if (totalChars > this.maxTextLength) {
      throw new Error(`document_too_long: Độ dài văn bản (${totalChars} ký tự) vượt quá giới hạn 100.000 ký tự`);
    }

    // 6. Chunking
    const chunks = DocumentChunker.chunkDocument(documentId, extracted);

    // 7. Persist to private document storage (outside public directory)
    const docFolder = join(this.storageDir, documentId);
    await mkdir(docFolder, { recursive: true });

    await writeFile(
      join(docFolder, 'metadata.json'),
      JSON.stringify(
        {
          documentId,
          documentTitle: extracted.title,
          contentType: extracted.contentType,
          totalPages: extracted.pages.length,
          totalChunks: chunks.length,
          ingestedAt: new Date().toISOString(),
          originalFilename: basename(file.filename)
        },
        null,
        2
      ),
      'utf8'
    );

    await writeFile(join(docFolder, 'chunks.json'), JSON.stringify(chunks, null, 2), 'utf8');

    return {
      documentId,
      documentTitle: extracted.title,
      contentType: extracted.contentType,
      totalPages: extracted.pages.length,
      totalChunks: chunks.length,
      chunks,
      needsOcr: false
    };
  }

  public async ingestText(text: string, filename = 'document.txt'): Promise<DocumentIngestionResult> {
    return this.ingestFile({
      filename,
      buffer: Buffer.from(text, 'utf8'),
      mimeType: filename.endsWith('.md') ? 'text/markdown' : 'text/plain'
    });
  }
}
