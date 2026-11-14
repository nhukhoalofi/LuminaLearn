import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AIProvider, AIStructuredRequest, AIProviderResult } from '../src/orchestration/ai-provider';
import {
  EducationalGenerationError,
  EducationalPlannerV3,
  KnowledgeValidationServiceV3,
  LessonDraftManagerV3,
  verifyArtifactIntegrityV3
} from '../src/orchestration';
import type { EducationalClaimV3, GroundingEvidence } from '@luminalearn/scene-schema';

class ThrowingProvider implements AIProvider {
  readonly isMock = false;
  calls = 0;
  constructor(private readonly providerCode: string) {}
  async generateStructured<T>(_request: AIStructuredRequest<T>): Promise<AIProviderResult<T>> {
    this.calls += 1;
    throw Object.assign(new Error(`provider failed: ${this.providerCode}`), { code: this.providerCode });
  }
}

for (const code of ['model_unavailable', 'quota_exhausted', 'invalid_json', 'timeout', 'permission_denied']) {
  test(`live V3 preserves ${code} and never falls back to deterministic content`, async () => {
    const provider = new ThrowingProvider(code);
    const planner = new EducationalPlannerV3({ aiProvider: provider });
    await assert.rejects(
      planner.planLesson({ lessonId: `live_${code}`, topic: 'Perceptron và mạng nơ-ron', externalApiConsent: true }),
      (error: unknown) => error instanceof EducationalGenerationError && error.code === code && error.provenance === 'generation_failed'
    );
    assert.equal(provider.calls, 1);
  });
}

test('live V3 requires explicit external API consent before provider invocation', async () => {
  const provider = new ThrowingProvider('must_not_run');
  const planner = new EducationalPlannerV3({ aiProvider: provider });
  await assert.rejects(planner.planLesson({ lessonId: 'live_no_consent', topic: 'Perceptron và mạng nơ-ron' }), /consent/i);
  assert.equal(provider.calls, 0);
});

test('forged evidenceFound and plausible quote cannot establish source grounding', async () => {
  const claim: EducationalClaimV3 = { id: 'claim_forged', claimType: 'ai_concept', statement: 'Perceptron dùng tổng có trọng số.', verificationStatus: 'unverified' };
  const evidence: GroundingEvidence = {
    evidenceId: 'evidence_forged', claimId: claim.id, evidenceFound: true, evidenceMatchConfidence: 1,
    matchType: 'exact', isExactQuote: true,
    sourceReference: { id: 'reference_forged', documentId: 'document_forged', chunkId: 'chunk_forged', pageNumber: 1, exactQuote: 'Perceptron uses a weighted sum.', relevanceScore: 1 }
  };
  const result = await new KnowledgeValidationServiceV3().validateClaims({
    lessonId: 'forged_lesson', topicId: 'ai.perceptron.activation', domain: 'artificial_intelligence', claims: [claim], sourceEvidence: [evidence]
  });
  assert.equal(result.validatedClaims[0].verificationStatus, 'human_review_required');
});

test('V3 draft approval creates immutable hash-bound artifact and stale edit revokes authorization', async () => {
  const storageDir = await mkdtemp(join(tmpdir(), 'lumina-v3-drafts-'));
  const manager = new LessonDraftManagerV3({ storageDir });
  let draft = await manager.create({
    requestId: 'request_v3_secure', topic: 'Perceptron và nguyên lý hoạt động của mạng nơ-ron nhân tạo',
    domain: 'artificial_intelligence', generationMode: 'mock', targetDurationSeconds: 35,
    narrationMode: 'none', subtitlesEnabled: true, fps: 24, width: 720, height: 1280
  }, 'owner_secure');
  assert.equal(draft.lessonPlan.generationProvenance, 'deterministic_mock');
  assert.equal(draft.lessonPlan.storyboard?.totalDurationSeconds, 35);
  draft = await manager.confirmSemanticReview(draft.draftId, 'owner_secure', draft.version);
  draft = await manager.approve(draft.draftId, 'owner_secure', draft.version);
  assert.ok(draft.approvedArtifact);
  assert.ok(verifyArtifactIntegrityV3(draft.approvedArtifact));
  assert.equal(await manager.isArtifactAuthorized(draft.approvedArtifact), true);

  const tampered = structuredClone(draft.approvedArtifact);
  tampered.lessonPlan.title = 'Tampered';
  assert.equal(verifyArtifactIntegrityV3(tampered), false);

  const edited = await manager.update(draft.draftId, 'owner_secure', draft.version, { title: 'Tiêu đề giáo viên sửa' });
  assert.equal(edited.status, 'needs_review');
  assert.equal(edited.approvedArtifact, undefined);
  assert.equal(await manager.isArtifactAuthorized(draft.approvedArtifact), false);
});

test('V3 draft optimistic concurrency rejects stale saves', async () => {
  const manager = new LessonDraftManagerV3();
  const draft = await manager.create({
    requestId: 'request_v3_tabs', topic: 'Perceptron và mạng nơ-ron', domain: 'artificial_intelligence',
    generationMode: 'mock', targetDurationSeconds: 35, narrationMode: 'none', subtitlesEnabled: true,
    fps: 24, width: 720, height: 1280
  }, 'owner_tabs');
  await manager.update(draft.draftId, 'owner_tabs', draft.version, { title: 'Tab A' });
  await assert.rejects(manager.update(draft.draftId, 'owner_tabs', draft.version, { title: 'Tab B' }), /version conflict/i);
  await assert.rejects(manager.update(draft.draftId, 'different_owner', draft.version + 1, { title: 'Intruder' }), /forbidden_owner_mismatch/);
});

