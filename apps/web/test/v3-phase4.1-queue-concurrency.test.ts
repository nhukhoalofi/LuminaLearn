import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LessonDraftManagerV3 } from '@luminalearn/agent';
import { createV3JobFromArtifact, getJob, withArtifactEnqueueLock, getArtifactEnqueueLockCount } from '../src/server/job-store.js';
import { SecurityError } from '../src/server/security.js';

test('Checkpoint F — Queue Concurrency, Idempotency and Recovery (P1)', async (t) => {
  const storageDir = await mkdtemp(join(tmpdir(), 'lumina-v3-queue-concurrency-'));
  const manager = new LessonDraftManagerV3({ storageDir });

  // Create and approve a valid test artifact (using AI domain for fast instant planning)
  let draft = await manager.create({
    requestId: 'req_queue_concurrency_1',
    topic: 'Mạng Neural Perceptron',
    domain: 'artificial_intelligence',
    generationMode: 'mock',
    targetDurationSeconds: 30,
    narrationMode: 'none',
    subtitlesEnabled: true
  }, 'teacher_1');

  draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_1', draft.version);
  draft = await manager.approve(draft.draftId, 'teacher_1', draft.version, 'Approved for queue test');
  const artifact = draft.approvedArtifact!;
  assert.ok(artifact, 'Approved artifact must exist');

  await t.test('1. Concurrent Promise.all enqueue requests for the same artifact atomically return the EXACT SAME jobId', async () => {
    const authorize = (art: typeof artifact) => manager.isArtifactAuthorized(art);

    // Launch 5 concurrent enqueue calls simultaneously
    const results = await Promise.all([
      createV3JobFromArtifact(artifact, authorize, 'teacher_1'),
      createV3JobFromArtifact(artifact, authorize, 'teacher_1'),
      createV3JobFromArtifact(artifact, authorize, 'teacher_1'),
      createV3JobFromArtifact(artifact, authorize, 'teacher_1'),
      createV3JobFromArtifact(artifact, authorize, 'teacher_1')
    ]);

    const firstJobId = results[0].jobId;
    assert.ok(firstJobId, 'JobId must be non-empty');
    for (let i = 1; i < results.length; i++) {
      assert.equal(
        results[i].jobId,
        firstJobId,
        `Concurrent request ${i} must return identical jobId due to atomic mutex`
      );
    }
  });

  await t.test('2. Tampered content hash in artifact is rejected fail-closed before enqueueing', async () => {
    const tamperedArtifact = {
      ...artifact,
      contentHash: '0'.repeat(64) // Forged hash!
    };

    await assert.rejects(
      () => createV3JobFromArtifact(tamperedArtifact, () => true, 'teacher_1'),
      /artifact_tampered/
    );
  });

  await t.test('3. Caller owner mismatch is rejected with 403 SecurityError', async () => {
    await assert.rejects(
      () => createV3JobFromArtifact(artifact, () => true, 'unauthorized_attacker'),
      (err: unknown) => err instanceof SecurityError && err.status === 403 && err.code === 'artifact_unauthorized'
    );
  });

  await t.test('4. Stale or revoked artifact is rejected', async () => {
    // When the artifact is revoked, authorization returns false
    await assert.rejects(
      () => createV3JobFromArtifact(artifact, () => false, 'teacher_1'),
      (err: unknown) => err instanceof SecurityError && err.status === 403 && err.code === 'artifact_unauthorized'
    );
  });

  await t.test('5. 50 sequential and 50 concurrent requests cleanly release lock without memory leaks', async () => {
    const testArtifactId = 'art_mutex_test_leak_check';

    // 50 sequential runs
    for (let i = 0; i < 50; i++) {
      await withArtifactEnqueueLock(testArtifactId, async () => {
        return i;
      });
    }
    assert.equal(getArtifactEnqueueLockCount(), 0, 'Lock map must be empty after 50 sequential requests');

    // 50 concurrent runs
    const promises = Array.from({ length: 50 }, (_, i) =>
      withArtifactEnqueueLock(testArtifactId, async () => {
        return i;
      })
    );
    const results = await Promise.all(promises);
    assert.equal(results.length, 50);
    assert.equal(getArtifactEnqueueLockCount(), 0, 'Lock map must return to 0 size after 50 concurrent requests resolve');
  });

  await t.test('6. Exception inside locked action does not deadlock subsequent requests and cleans up lock map', async () => {
    const testArtifactId = 'art_mutex_error_test';

    await assert.rejects(
      () => withArtifactEnqueueLock(testArtifactId, async () => {
        throw new Error('deliberate_failure_in_lock');
      }),
      /deliberate_failure_in_lock/
    );

    // Ensure next request unblocks cleanly
    const result = await withArtifactEnqueueLock(testArtifactId, async () => {
      return 'success_after_failure';
    });
    assert.equal(result, 'success_after_failure');
    assert.equal(getArtifactEnqueueLockCount(), 0, 'Lock map must clean up even after error');
  });
});
