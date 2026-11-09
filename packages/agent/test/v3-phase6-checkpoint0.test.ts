import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  EducationalSupervisorV3,
  LessonDraftManagerV3
} from '../src/orchestration';
import {
  verifyArtifactIntegrityV3
} from '../src/orchestration/draft-manager-v3';
import {
  type SupervisorRequestV3
} from '@luminalearn/scene-schema';

test('CHECKPOINT 0: Multi-Agent Supervisor Draft Persistence & End-to-End Approval Lifecycle', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'lumina-phase6-ck0-'));
  try {
    const draftManager = new LessonDraftManagerV3({ storageDir: tempDir });
    const supervisor = new EducationalSupervisorV3({ draftManager, storageDir: tempDir });

    // 1. Coordinate a Math draft (Seven algebraic identities)
    const mathRequest: SupervisorRequestV3 = {
      requestId: 'req_ck0_math',
      ownerId: 'teacher_ph6_ck0',
      topic: '7 hằng đẳng thức đáng nhớ',
      domain: 'mathematics',
      generationMode: 'mock',
      targetAudience: 'high_school',
      targetDurationSeconds: 40,
      narrationMode: 'none',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280
    };

    const coordResult = await supervisor.coordinate(mathRequest);
    assert.ok(coordResult.draftId, 'Supervisor must return a non-empty draftId');
    assert.ok(coordResult.trace, 'Supervisor must return execution trace');
    assert.equal(coordResult.teacherApprovalRequired, true);

    // 2. Verify draft is physically and atomically persisted in draftManager
    const loadedDraft = await draftManager.load(coordResult.draftId);
    assert.ok(loadedDraft, 'Draft must be loadable from LessonDraftManagerV3');
    assert.equal(loadedDraft.draftId, coordResult.draftId);
    assert.equal(loadedDraft.ownerId, mathRequest.ownerId);
    assert.equal(loadedDraft.status, 'needs_review');
    assert.equal(loadedDraft.version, 1);
    assert.equal(loadedDraft.request.targetDurationSeconds, 40);
    assert.ok(loadedDraft.lessonPlan.educationalClaims.length >= 1);

    // 3. Teacher PATCHes draft narration (minor pedagogical polish)
    const firstSceneId = loadedDraft.lessonPlan.storyboard!.scenes[0].sceneId;
    const patchedDraft = await draftManager.update(
      loadedDraft.draftId,
      loadedDraft.ownerId,
      loadedDraft.version,
      {
        narrationTexts: {
          [firstSceneId]: 'Chào mừng các em đến với bài học 7 hằng đẳng thức đáng nhớ chuẩn chương trình.'
        }
      }
    );
    assert.equal(patchedDraft.version, 2);
    assert.equal(patchedDraft.status, 'needs_review');
    assert.equal(
      patchedDraft.lessonPlan.storyboard!.scenes[0].narration.vietnamese,
      'Chào mừng các em đến với bài học 7 hằng đẳng thức đáng nhớ chuẩn chương trình.'
    );

    // 4. Confirm semantic review
    const reviewedDraft = await draftManager.confirmSemanticReview(
      patchedDraft.draftId,
      patchedDraft.ownerId,
      patchedDraft.version
    );
    assert.equal(reviewedDraft.version, 3);
    assert.equal(reviewedDraft.status, 'ready_for_approval');
    assert.equal(reviewedDraft.semanticReviewConfirmed, true);

    // 5. Teacher Approval produces immutable signed ApprovedRenderArtifactV3
    const approvedDraft = await draftManager.approve(
      reviewedDraft.draftId,
      reviewedDraft.ownerId,
      reviewedDraft.version,
      'Phê duyệt bản thảo 7 hằng đẳng thức đáng nhớ sau kiểm tra'
    );
    assert.equal(approvedDraft.status, 'approved');
    assert.ok(approvedDraft.approvedArtifact, 'Approved draft must embed approvedArtifact');
    assert.ok(verifyArtifactIntegrityV3(approvedDraft.approvedArtifact), 'Approved artifact must satisfy cryptographic hash integrity');
    assert.equal(approvedDraft.approvedArtifact?.teacherApproval.approvedBy, mathRequest.ownerId);

    // 6. Coordinate an AI draft (Perceptron) and verify it also persists and approves
    const aiRequest: SupervisorRequestV3 = {
      requestId: 'req_ck0_ai',
      ownerId: 'teacher_ph6_ck0',
      topic: 'Perceptron và nguyên lý hoạt động của mạng nơ-ron nhân tạo',
      domain: 'artificial_intelligence',
      generationMode: 'mock',
      targetAudience: 'undergraduate',
      targetDurationSeconds: 40,
      narrationMode: 'none',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280
    };

    const aiResult = await supervisor.coordinate(aiRequest);
    const loadedAiDraft = await draftManager.load(aiResult.draftId);
    assert.ok(loadedAiDraft, 'AI Draft must be loadable from LessonDraftManagerV3');
    assert.equal(loadedAiDraft.status, 'needs_review');

    const reviewedAi = await draftManager.confirmSemanticReview(
      loadedAiDraft.draftId,
      loadedAiDraft.ownerId,
      loadedAiDraft.version
    );
    const approvedAi = await draftManager.approve(
      reviewedAi.draftId,
      reviewedAi.ownerId,
      reviewedAi.version,
      'Phê duyệt bài giảng Perceptron'
    );
    assert.equal(approvedAi.status, 'approved');
    assert.ok(approvedAi.approvedArtifact);
    assert.ok(verifyArtifactIntegrityV3(approvedAi.approvedArtifact));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('CHECKPOINT 0: Stale draft version and tampered drafts fail closed', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'lumina-phase6-stale-'));
  try {
    const draftManager = new LessonDraftManagerV3({ storageDir: tempDir });
    const supervisor = new EducationalSupervisorV3({ draftManager, storageDir: tempDir });

    const result = await supervisor.coordinate({
      requestId: 'req_ck0_stale',
      ownerId: 'teacher_ph6_ck0',
      topic: '7 hằng đẳng thức đáng nhớ',
      domain: 'mathematics',
      generationMode: 'mock',
      targetAudience: 'high_school',
      targetDurationSeconds: 40,
      narrationMode: 'none',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280
    });

    // Attempting update with stale version 99 must fail
    await assert.rejects(
      draftManager.update(result.draftId, 'teacher_ph6_ck0', 99, { title: 'New title' }),
      /Draft version conflict/i
    );

    // Attempting update with wrong owner must fail
    await assert.rejects(
      draftManager.update(result.draftId, 'attacker_user', 1, { title: 'New title' }),
      /forbidden_owner_mismatch/i
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
