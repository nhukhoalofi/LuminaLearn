import { NextResponse } from 'next/server';
import { documentStore, ensureDocumentsLoaded } from '@/server/v2-services';
import { assertRequestAuthorized, resolveOwnerId, SecurityError } from '@/server/security';

export async function GET(req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    assertRequestAuthorized(req);
    const ownerId = resolveOwnerId(req);
    const { documentId } = await params;
    await ensureDocumentsLoaded([documentId], ownerId);
    const chunks = documentStore.getChunksByDocument(documentId);
    if (chunks.length === 0) {
      return NextResponse.json({ error: 'not_found', message: `Không tìm thấy tài liệu với ID: ${documentId}` }, { status: 404 });
    }
    return NextResponse.json({ documentId, totalChunks: chunks.length, documentTitle: chunks[0]?.documentTitle || 'Tài liệu', chunks });
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'document_access_denied', message: 'Document ownership could not be verified' }, { status: 403 });
  }
}
