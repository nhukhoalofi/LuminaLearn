import { NextResponse } from 'next/server';
import { documentStore, ingestionService } from '@/server/v2-services';

export async function POST(req: Request) {
  try {
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

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await ingestionService.ingestFile({
        filename: file.name,
        buffer,
        mimeType: file.type
      });

      // Index chunks into memory document store
      documentStore.addChunks(result.chunks);

      return NextResponse.json(result);
    }

    // JSON upload
    const body = await req.json();
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

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('file_too_large') || message.includes('path_traversal') ? 400 : 500;
    return NextResponse.json(
      { error: 'ingestion_failed', message },
      { status }
    );
  }
}

