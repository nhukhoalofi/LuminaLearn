import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocumentOwnershipRepository } from '../src/server/document-ownership.ts';
import { assertOwnerMatch, SecurityError } from '../src/server/security.ts';
import { DocumentStore } from '../../../packages/agent/src/orchestration/document-grounding.ts';

const temporaryDirs: string[] = [];
afterEach(async () => Promise.all(temporaryDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))));

describe('Durable document ownership', () => {
  it('recovers ownership across fresh repositories/stores and fails closed for wrong, missing, or corrupt metadata', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lumina-owner-'));
    temporaryDirs.push(root);
    const documentId = 'doc_restart_test';
    const folder = join(root, documentId);
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'chunks.json'), JSON.stringify([{
      chunkId: 'chunk_doc_restart_test_1', documentId, documentTitle: 'Restart fixture', pageNumber: 1,
      text: "Đạo hàm của x^2 là 2x.", contentType: 'text/plain', tokenEstimate: 8, metadata: {}
    }]), 'utf8');

    const ownerA = 'tok_aaaaaaaaaaaaaaaa';
    const ownerB = 'tok_bbbbbbbbbbbbbbbb';
    await new DocumentOwnershipRepository(root).persist(documentId, ownerA);

    // Simulated restart: fresh ownership repository and fresh in-memory document store.
    const restartedOwners = new DocumentOwnershipRepository(root);
    const restartedStore = new DocumentStore();
    const record = await restartedOwners.load(documentId);
    assert.throws(() => assertOwnerMatch(record.ownerId, ownerB, documentId), (error: unknown) => error instanceof SecurityError && error.code === 'forbidden_owner_mismatch');
    assert.doesNotThrow(() => assertOwnerMatch(record.ownerId, ownerA, documentId));
    assert.equal(await restartedStore.loadFromDisk(root, documentId), true);
    assert.equal(restartedStore.getChunksByDocument(documentId).length, 1);

    await writeFile(join(folder, 'ownership.json'), '{"ownerId":"forged"}', 'utf8');
    await assert.rejects(() => new DocumentOwnershipRepository(root).load(documentId), /ownership_metadata_invalid/);
    await rm(join(folder, 'ownership.json'));
    await assert.rejects(() => new DocumentOwnershipRepository(root).load(documentId), /ownership_metadata_missing/);
    assert.throws(() => assertOwnerMatch(undefined, ownerA, documentId), (error: unknown) => error instanceof SecurityError && error.code === 'missing_resource_owner');
  });

  it('atomically rejects conflicting concurrent owner registrations', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lumina-owner-race-'));
    temporaryDirs.push(root);
    const documentId = 'doc_concurrent_test';
    const results = await Promise.allSettled([
      new DocumentOwnershipRepository(root).persist(documentId, 'tok_aaaaaaaaaaaaaaaa'),
      new DocumentOwnershipRepository(root).persist(documentId, 'tok_bbbbbbbbbbbbbbbb')
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    assert.match(String(rejected?.reason), /ownership_conflict/);
    const persisted = await new DocumentOwnershipRepository(root).load(documentId);
    assert.ok(['tok_aaaaaaaaaaaaaaaa', 'tok_bbbbbbbbbbbbbbbb'].includes(persisted.ownerId));
  });
});
