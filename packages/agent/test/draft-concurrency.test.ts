import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import test from 'node:test';
import type { MathVisualizationSpecV2, VerifiedClaim } from '@luminalearn/scene-schema';
import {
  DraftVersionConflictError,
  LessonDraftManager,
  MathVerificationService
} from '../src/orchestration/index';

const request = (requestId: string) => ({
  requestId,
  inputMode: 'topic_prompt' as const,
  sourceDocumentIds: [],
  topic: 'Bản chất hình học của đạo hàm',
  audience: 'Học sinh lớp 11',
  language: 'vi' as const,
  targetDurationSeconds: 40,
  renderMode: 'mock' as const,
  narrationMode: 'none' as const,
  aspectRatio: '9:16' as const
});

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  return { promise: new Promise<void>((done) => { resolve = done; }), resolve };
}

class BarrierVerificationService extends MathVerificationService {
  private armed = false;
  private entered = deferred();
  private release = deferred();

  public arm(): Promise<void> {
    this.armed = true;
    this.entered = deferred();
    this.release = deferred();
    return this.entered.promise;
  }

  public unblock(): void {
    this.release.resolve();
  }

  public override async verifyClaims(
    topicId: string,
    claims: VerifiedClaim[],
    options?: { timeoutMs?: number; context?: Record<string, unknown>; mathSpec?: MathVisualizationSpecV2 }
  ) {
    if (this.armed) {
      this.armed = false;
      this.entered.resolve();
      await this.release.promise;
    }
    return super.verifyClaims(topicId, claims, options);
  }
}

test('duplicate external request IDs create independent durable drafts and cannot overwrite an approved draft', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lumina-draft-id-'));
  const artifactsDir = join(root, 'artifacts');
  const draftsDir = join(root, 'drafts');
  try {
    const manager = new LessonDraftManager({ artifactsDir, draftsDir });
    const [first, second] = await Promise.all([
      manager.createDraft(request('req_same_external')),
      manager.createDraft(request('req_same_external'))
    ]);

    assert.notEqual(first.draftId, second.draftId);
    assert.equal(first.requestId, 'req_same_external');
    assert.equal(second.requestId, 'req_same_external');
    assert.match(first.draftId, /^draft_[a-f0-9]{32}$/);
    assert.match(second.draftId, /^draft_[a-f0-9]{32}$/);

    const approved = await manager.approveDraft(first.draftId, 'Teacher approval');
    const approvedSnapshot = structuredClone(approved.approvedArtifact!);
    assert.equal(manager.getDraft(second.draftId)?.status, 'draft');

    const restarted = new LessonDraftManager({ artifactsDir, draftsDir });
    assert.equal(restarted.listDrafts().length, 2);
    assert.equal(restarted.getDraft(first.draftId)?.approvedArtifact?.artifactId, approvedSnapshot.artifactId);
    assert.equal(restarted.getDraft(first.draftId)?.approvedArtifact?.contentHash, approvedSnapshot.contentHash);
    assert.equal(restarted.getDraft(first.draftId)?.approvedArtifact?.version, approvedSnapshot.version);
    assert.equal(restarted.getDraft(second.draftId)?.requestId, 'req_same_external');

    const draftFiles = (await readdir(draftsDir)).filter((name) => name.endsWith('.json'));
    assert.deepEqual(new Set(draftFiles), new Set([`${first.draftId}.json`, `${second.draftId}.json`]));

    const malicious = await manager.createDraft(request('../../outputs/.artifacts/overwrite'));
    assert.match(malicious.draftId, /^draft_[a-f0-9]{32}$/);
    assert.equal(malicious.requestId, '../../outputs/.artifacts/overwrite');
    assert.equal((await readdir(draftsDir)).some((name) => name.includes('..')), false);
    assert.deepEqual(structuredClone(manager.getDraft(first.draftId)?.approvedArtifact), approvedSnapshot);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('PATCH verification and stale APPROVE are serialized with a deterministic barrier', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lumina-patch-approve-race-'));
  try {
    const verifier = new BarrierVerificationService();
    const manager = new LessonDraftManager({ verifier, artifactsDir: join(root, 'artifacts'), draftsDir: join(root, 'drafts') });
    const draft = await manager.createDraft(request('req_patch_approve_race'));
    const originalVersion = draft.version;
    const claims = structuredClone(draft.context.lessonPlan!.mathematicalClaims);
    const entered = verifier.arm();

    const patch = manager.updateDraft(
      draft.draftId,
      { mathematicalClaims: claims },
      'Concurrent edit',
      { expectedVersion: originalVersion }
    );
    await entered;
    const approval = manager.approveDraft(draft.draftId, 'Stale browser approval', {
      expectedVersion: originalVersion
    });
    verifier.unblock();

    const updated = await patch;
    assert.equal(updated.version, originalVersion + 1);
    await assert.rejects(
      () => approval,
      (error: unknown) => error instanceof DraftVersionConflictError && error.actualVersion === originalVersion + 1
    );
    assert.equal(updated.approvedArtifact, undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('racing approvals are idempotent and approve/reject cannot leave stale render authorization', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lumina-approval-races-'));
  try {
    const manager = new LessonDraftManager({ artifactsDir: join(root, 'artifacts'), draftsDir: join(root, 'drafts') });
    const draft = await manager.createDraft(request('req_approval_races'));
    const [first, second] = await Promise.all([
      manager.approveDraft(draft.draftId, 'Approval A', { expectedVersion: draft.version }),
      manager.approveDraft(draft.draftId, 'Approval B', { expectedVersion: draft.version })
    ]);
    assert.equal(first.approvedArtifact?.artifactId, second.approvedArtifact?.artifactId);
    assert.equal(first.approvalHistory.filter((entry) => entry.action === 'approved').length, 1);
    const approvedArtifact = first.approvedArtifact!;

    const rejected = await manager.rejectDraft(draft.draftId, 'Teacher revoked approval', {
      expectedVersion: draft.version
    });
    assert.equal(rejected.status, 'rejected');
    assert.equal(rejected.approvedArtifact, undefined);
    assert.equal(manager.isArtifactCurrentlyApproved(approvedArtifact), false);
    await assert.rejects(() => manager.approveDraft(draft.draftId), /Cannot approve rejected draft/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('approval configuration is atomic and a failed approval restores the exact prior draft', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lumina-approval-atomic-'));
  try {
    const manager = new LessonDraftManager({ artifactsDir: join(root, 'artifacts'), draftsDir: join(root, 'drafts') });
    const draft = await manager.createDraft(request('req_atomic_approval'));
    const badClaims = structuredClone(draft.context.lessonPlan!.mathematicalClaims);
    badClaims[0].expectedExpression = '999*x';
    await manager.updateDraft(draft.draftId, { mathematicalClaims: badClaims });
    const snapshot = structuredClone(manager.getDraft(draft.draftId)!);

    await assert.rejects(
      () => manager.approveDraftWithUpdates(
        draft.draftId,
        { narrationMode: 'gemini_tts', visualStyleId: 'math_chalkboard', subtitlesEnabled: false },
        'Must fail',
        { expectedVersion: snapshot.version }
      ),
      /Mathematical claims are not verified/
    );
    assert.deepEqual(manager.getDraft(draft.draftId), snapshot);

    const valid = await manager.createDraft(request('req_atomic_approval_valid'));
    const approved = await manager.approveDraftWithUpdates(
      valid.draftId,
      { visualStyleId: 'math_chalkboard', subtitlesEnabled: false },
      'Atomic config approval',
      { expectedVersion: valid.version }
    );
    assert.equal(approved.approvedArtifact?.version, 2);
    assert.equal(approved.approvedArtifact?.renderConfig.visualStyleId, 'math_chalkboard');
    assert.equal(approved.approvedArtifact?.renderConfig.subtitlesEnabled, false);
    assert.equal(approved.approvedArtifact?.contentHash.length, 64);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
