import { NextResponse } from 'next/server';
import { documentStore } from '@/server/v2-services';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const chunks = documentStore.getChunksByDocument(documentId);

  if (chunks.length === 0) {
    return NextResponse.json(
      { error: 'not_found', message: `Không tìm thấy tài liệu với ID: ${documentId}` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    documentId,
    totalChunks: chunks.length,
    documentTitle: chunks[0]?.documentTitle || 'Tài liệu',
    chunks
  });
}

