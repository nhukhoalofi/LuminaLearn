import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface DocumentOwnershipRecord {
  schemaVersion: 'document-ownership-v1';
  documentId: string;
  ownerId: string;
  createdAt: string;
}

const DOCUMENT_ID = /^doc_[a-zA-Z0-9_-]+$/;
const OWNER_ID = /^(?:local-single-user|tok_[a-f0-9]{16})$/;

function validateRecord(value: unknown, expectedDocumentId: string): DocumentOwnershipRecord {
  const record = value as Partial<DocumentOwnershipRecord> | null;
  if (!record || record.schemaVersion !== 'document-ownership-v1' || record.documentId !== expectedDocumentId ||
      typeof record.ownerId !== 'string' || !OWNER_ID.test(record.ownerId) ||
      typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt))) {
    throw new Error(`ownership_metadata_invalid: Invalid ownership metadata for '${expectedDocumentId}'`);
  }
  return record as DocumentOwnershipRecord;
}

export class DocumentOwnershipRepository {
  private readonly storageDir: string;

  constructor(storageDir: string) {
    this.storageDir = storageDir;
  }

  private pathFor(documentId: string): string {
    if (!DOCUMENT_ID.test(documentId)) throw new Error(`invalid_document_id: '${documentId}'`);
    return join(this.storageDir, documentId, 'ownership.json');
  }

  async load(documentId: string): Promise<DocumentOwnershipRecord> {
    const path = this.pathFor(documentId);
    let raw: string;
    try { raw = await readFile(path, 'utf8'); }
    catch { throw new Error(`ownership_metadata_missing: No ownership metadata for '${documentId}'`); }
    try { return validateRecord(JSON.parse(raw), documentId); }
    catch (error) {
      if (error instanceof Error && error.message.startsWith('ownership_metadata_invalid')) throw error;
      throw new Error(`ownership_metadata_invalid: Malformed ownership metadata for '${documentId}'`);
    }
  }

  async persist(documentId: string, ownerId: string): Promise<DocumentOwnershipRecord> {
    this.pathFor(documentId);
    if (!OWNER_ID.test(ownerId)) throw new Error(`invalid_owner_id: '${ownerId}'`);
    try {
      const existing = await this.load(documentId);
      if (existing.ownerId !== ownerId) throw new Error(`ownership_conflict: '${documentId}' already has a different owner`);
      return existing;
    } catch (error) {
      if (error instanceof Error && !error.message.startsWith('ownership_metadata_missing')) throw error;
    }
    const record: DocumentOwnershipRecord = {
      schemaVersion: 'document-ownership-v1', documentId, ownerId, createdAt: new Date().toISOString()
    };
    const folder = join(this.storageDir, documentId);
    await mkdir(folder, { recursive: true });
    const target = this.pathFor(documentId);
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(record, null, 2), 'utf8');
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
    return record;
  }
}
