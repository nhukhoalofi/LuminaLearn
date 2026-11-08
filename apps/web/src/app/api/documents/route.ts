import { NextResponse } from 'next/server';
import { documentStore, ingestionService, registerDocumentOwner } from '@/server/v2-services';
import {
  assertRequestAuthorized,
  assertUploadSizeWithinLimit,
  readBoundedJson,
  resolveOwnerId,
  SecurityError
} from '@/server/security';

export async function POST(req: Request) {
  try {
    assertRequestAuthorized(req);
    const ownerId = resolveOwnerId(req);
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { error: 'missing_file', message: 'Vui lòng đính kèm file tài liệu' },
          { status: 400 }
        );
      }

      assertUploadSizeWithinLimit(file.size);
      const buffer = Buffer.from(await file.arrayBuffer());
      assertUploadSizeWithinLimit(buffer.byteLength);

      const result = await ingestionService.ingestFile({
        filename: file.name,
        buffer,
        mimeType: file.type
      });

      documentStore.addChunks(result.chunks);
      registerDocumentOwner(result.documentId, ownerId);

      return NextResponse.json(result);
    }

    // JSON upload
    const body = await readBoundedJson<{ text?: string; filename?: string }>(req);
    const text = String(body.text || '').trim();
    const filename = String(body.filename || 'document.txt').trim();

    if (!text) {
      return NextResponse.json(
        { error: 'empty_content', message: 'Nội dung văn bản không được để trống' },
        { status: 400 }
      );
    }

    const result = await ingestionService.ingestText(text, filename);
    documentStore.addChunks(result.chunks);
    registerDocumentOwner(result.documentId, ownerId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status }
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('file_too_large') || message.includes('path_traversal') ? 400 : 500;
    return NextResponse.json(
      { error: 'ingestion_failed', message },
      { status }
    );
  }
}

