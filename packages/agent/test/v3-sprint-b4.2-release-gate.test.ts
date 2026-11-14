import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { EducationalSupervisorV3, LessonDraftManagerV3 } from '../src/orchestration/index.js';
import { verifyArtifactIntegrityV3 } from '../src/orchestration/draft-manager-v3.js';

test('B.4.2 offline Derivative preset reaches approval and edit revokes render authorization', async () => {
  const storageDir = await mkdtemp(join(tmpdir(), 'lumina-b42-release-gate-'));
  try {
    const manager = new LessonDraftManagerV3({ storageDir });
    const supervisor = new EducationalSupervisorV3({ draftManager: manager, storageDir });
    const coordinated = await supervisor.coordinate({
      requestId: 'req_b42_derivative_release_gate',
      ownerId: 'teacher_b42',
      topic: 'Đạo hàm từ cát tuyến đến tiếp tuyến',
      domain: 'mathematics',
      generationMode: 'mock',
      targetAudience: 'high_school',
      targetDurationSeconds: 60,
      narrationMode: 'none',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280
    });

    const draft = await manager.load(coordinated.draftId);
    assert.ok(draft);
    assert.equal(draft.lessonPlan.generationProvenance, 'deterministic_mock');
    assert.notEqual(draft.lessonPlan.validationReport?.overallStatus, 'failed');
    assert.ok(draft.lessonPlan.educationalClaims.some((claim) => claim.formalExpressionVerified === true));

    const reviewed = await manager.confirmSemanticReview(draft.draftId, draft.ownerId, draft.version);
    assert.equal(reviewed.status, 'ready_for_approval');
    assert.equal(reviewed.semanticReviewConfirmed, true);

    const approved = await manager.approve(reviewed.draftId, reviewed.ownerId, reviewed.version, 'B.4.2 offline smoke');
    assert.equal(approved.status, 'approved');
    assert.ok(approved.approvedArtifact);
    assert.ok(verifyArtifactIntegrityV3(approved.approvedArtifact));
    assert.equal(await manager.isArtifactAuthorized(approved.approvedArtifact), true);

    const firstScene = approved.lessonPlan.storyboard?.scenes[0];
    assert.ok(firstScene);
    const edited = await manager.update(approved.draftId, approved.ownerId, approved.version, {
      narrationTexts: {
        [firstScene.sceneId]: `${firstScene.narration.vietnamese} Bản chỉnh sửa sau phê duyệt.`
      }
    });
    assert.equal(edited.status, 'needs_review');
    assert.equal(edited.approvedArtifact, undefined);
    assert.equal(await manager.isArtifactAuthorized(approved.approvedArtifact), false);
  } finally {
    await rm(storageDir, { recursive: true, force: true });
  }
});
