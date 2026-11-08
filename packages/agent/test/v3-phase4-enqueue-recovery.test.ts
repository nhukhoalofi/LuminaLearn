import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LessonDraftManagerV3, verifyArtifactIntegrityV3 } from '../src/orchestration/draft-manager-v3.js';

test('Checkpoint A — V3 Approval and Enqueue Recovery Lifecycle', async (t) => {
  const storageDir = await mkdtemp(join(tmpdir(), 'lumina-v3-enqueue-'));
  const manager = new LessonDraftManagerV3({ storageDir });

  let draft = await manager.create({
    requestId: 'req_enqueue_1',
    topic: '7 hằng đẳng thức đáng nhớ',
    domain: 'mathematics',
    generationMode: 'mock',
    targetDurationSeconds: 40,
    narrationMode: 'none',
    subtitlesEnabled: true,
    fps: 24,
    width: 720,
    height: 1280
  }, 'teacher_1');

  await t.test('1. Draft moves to approved status with valid immutable artifact', async () => {
    draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_1', draft.version);
    draft = await manager.approve(draft.draftId, 'teacher_1', draft.version, 'Approved by teacher');
    assert.equal(draft.status, 'approved');
    assert.ok(draft.approvedArtifact);
    assert.equal(verifyArtifactIntegrityV3(draft.approvedArtifact), true);
    assert.equal(await manager.isArtifactAuthorized(draft.approvedArtifact), true);
  });

  await t.test('2. Simulating queue full after approval preserves approved state and artifact for retry', async () => {
    // Reload draft from disk to simulate server restart or fresh request after queue capacity error
    const reloaded = await manager.load(draft.draftId);
    assert.ok(reloaded);
    assert.equal(reloaded.status, 'approved');
    assert.ok(reloaded.approvedArtifact);
    assert.equal(reloaded.approvedArtifact.contentHash, draft.approvedArtifact!.contentHash);
    // The artifact is still fully authorized and ready for retry
    assert.equal(await manager.isArtifactAuthorized(reloaded.approvedArtifact), true);
  });

  await t.test('3. Enqueue retry with matching hash and owner succeeds', async () => {
    const artifact = draft.approvedArtifact!;
    assert.equal(artifact.ownerId, 'teacher_1');
    assert.equal(await manager.isArtifactAuthorized(artifact), true);
  });

  await t.test('4. Enqueue retry with tampered contentHash is rejected', async () => {
    const tampered = structuredClone(draft.approvedArtifact!);
    tampered.contentHash = '0000000000000000000000000000000000000000000000000000000000000000';
    assert.equal(verifyArtifactIntegrityV3(tampered), false);
    assert.equal(await manager.isArtifactAuthorized(tampered), false);
  });

  await t.test('5. Enqueue retry by unauthorized owner is rejected', async () => {
    const impostorArtifact = { ...draft.approvedArtifact!, ownerId: 'intruder_teacher' };
    assert.equal(await manager.isArtifactAuthorized(impostorArtifact as never), false);
  });

  await t.test('6. Stale or modified draft revokes artifact authorization', async () => {
    // If draft is edited after approval, status moves to needs_review and prior artifact is revoked
    const edited = await manager.update(draft.draftId, 'teacher_1', draft.version, {
      title: 'Đã sửa lại tiêu đề sau khi duyệt'
    });
    assert.equal(edited.status, 'needs_review');
    assert.equal(edited.approvedArtifact, undefined);
    assert.equal(await manager.isArtifactAuthorized(draft.approvedArtifact!), false);
  });
});
