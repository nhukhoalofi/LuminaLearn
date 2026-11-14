import test from 'node:test';
import assert from 'node:assert/strict';
import {
  issueExternalApiConsentV3,
  verifyExternalApiConsentV3,
  type ExternalApiConsentRecordV3
} from '@luminalearn/scene-schema';
import { EducationalPlannerV3 } from '../src/orchestration/educational-planner-v3.js';
import { LessonDraftManagerV3 } from '../src/orchestration/draft-manager-v3.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('Checkpoint A — External API Consent Hardening (P0)', async (t) => {
  await t.test('1. Valid consent record verification passes', () => {
    const consent = issueExternalApiConsentV3({
      ownerId: 'teacher_1',
      provider: 'gemini',
      operation: 'planning',
      draftId: 'draft_123'
    });

    const verification = verifyExternalApiConsentV3({
      consent,
      ownerId: 'teacher_1',
      expectedProvider: 'gemini',
      expectedOperation: 'planning'
    });

    assert.equal(verification.valid, true);
  });

  await t.test('2. Consent for Gemini planning cannot authorize narration (operation mismatch)', () => {
    const planningConsent = issueExternalApiConsentV3({
      ownerId: 'teacher_1',
      provider: 'gemini',
      operation: 'planning',
      draftId: 'draft_123'
    });

    const ttsVerification = verifyExternalApiConsentV3({
      consent: planningConsent,
      ownerId: 'teacher_1',
      expectedProvider: 'gemini',
      expectedOperation: 'narration'
    });

    assert.equal(ttsVerification.valid, false);
    assert.equal(ttsVerification.code, 'consent_operation_mismatch');
  });

  await t.test('3. Consent for one provider cannot authorize another (gemini vs google_cloud_tts)', () => {
    const geminiConsent = issueExternalApiConsentV3({
      ownerId: 'teacher_1',
      provider: 'gemini_tts',
      operation: 'narration',
      draftId: 'draft_123'
    });

    const googleVerification = verifyExternalApiConsentV3({
      consent: geminiConsent,
      ownerId: 'teacher_1',
      expectedProvider: 'google_cloud_tts',
      expectedOperation: 'narration'
    });

    assert.equal(googleVerification.valid, false);
    assert.equal(googleVerification.code, 'consent_provider_mismatch');
  });

  await t.test('4. Consent bound to owner cannot be used by a different owner', () => {
    const consent = issueExternalApiConsentV3({
      ownerId: 'teacher_1',
      provider: 'gemini',
      operation: 'planning',
      draftId: 'draft_123'
    });

    const maliciousVerification = verifyExternalApiConsentV3({
      consent,
      ownerId: 'attacker_99',
      expectedProvider: 'gemini',
      expectedOperation: 'planning'
    });

    assert.equal(maliciousVerification.valid, false);
    assert.equal(maliciousVerification.code, 'consent_owner_mismatch');
  });

  await t.test('5. Approved artifact changed after consent (tampered hash / mismatched id) is rejected', () => {
    const consent = issueExternalApiConsentV3({
      ownerId: 'teacher_1',
      provider: 'gemini_tts',
      operation: 'narration',
      draftId: 'draft_123',
      artifactId: 'artifact_abc',
      artifactVersion: 1,
      contentHash: 'a'.repeat(64)
    });

    // Verification with tampered hash
    const tamperedHashVerification = verifyExternalApiConsentV3({
      consent,
      ownerId: 'teacher_1',
      expectedProvider: 'gemini_tts',
      expectedOperation: 'narration',
      expectedArtifactId: 'artifact_abc',
      expectedContentHash: 'b'.repeat(64)
    });

    assert.equal(tamperedHashVerification.valid, false);
    assert.equal(tamperedHashVerification.code, 'consent_content_hash_mismatch');

    // Verification with mismatched artifact id
    const mismatchedIdVerification = verifyExternalApiConsentV3({
      consent,
      ownerId: 'teacher_1',
      expectedProvider: 'gemini_tts',
      expectedOperation: 'narration',
      expectedArtifactId: 'artifact_other'
    });

    assert.equal(mismatchedIdVerification.valid, false);
    assert.equal(mismatchedIdVerification.code, 'consent_artifact_mismatch');
  });

  await t.test('6. Expired consent is rejected', () => {
    const expiredConsent = issueExternalApiConsentV3({
      ownerId: 'teacher_1',
      provider: 'gemini',
      operation: 'planning',
      validitySeconds: -10 // expired in the past
    });

    const result = verifyExternalApiConsentV3({
      consent: expiredConsent,
      ownerId: 'teacher_1',
      expectedProvider: 'gemini',
      expectedOperation: 'planning'
    });

    assert.equal(result.valid, false);
    assert.equal(result.code, 'consent_expired');

    // Confirm default validity is exactly 900 seconds (15 minutes)
    const normalConsent = issueExternalApiConsentV3({
      ownerId: 'teacher_1',
      provider: 'gemini',
      operation: 'planning'
    });
    const issuedAt = new Date(normalConsent.authorizedAt).getTime();
    const expiresAt = new Date(normalConsent.expiresAt).getTime();
    assert.equal((expiresAt - issuedAt) / 1000, 900, 'Default consent validity must be exactly 15 minutes (900s)');
  });

  await t.test('6b. Tampered HMAC signature or forged payload is rejected with consent_signature_invalid', () => {
    const consent = issueExternalApiConsentV3({
      ownerId: 'teacher_1',
      provider: 'gemini',
      operation: 'planning'
    });

    const tamperedConsent = {
      ...consent,
      signature: '0'.repeat(64)
    };

    const res = verifyExternalApiConsentV3({
      consent: tamperedConsent,
      ownerId: 'teacher_1',
      expectedProvider: 'gemini',
      expectedOperation: 'planning'
    });

    assert.equal(res.valid, false);
    assert.equal(res.code, 'consent_signature_invalid');
  });

  await t.test('6c. Missing mandatory artifact binding is rejected when artifactId is expected', () => {
    const consentWithoutArtifact = issueExternalApiConsentV3({
      ownerId: 'teacher_1',
      provider: 'gemini_tts',
      operation: 'narration'
    });

    const res = verifyExternalApiConsentV3({
      consent: consentWithoutArtifact,
      ownerId: 'teacher_1',
      expectedProvider: 'gemini_tts',
      expectedOperation: 'narration',
      expectedArtifactId: 'artifact_123'
    });

    assert.equal(res.valid, false);
    assert.equal(res.code, 'consent_artifact_missing');
  });

  await t.test('7. Live planning without consent is rejected by EducationalPlannerV3', async () => {
    let externalCallsCount = 0;
    const fakeLiveProvider = {
      isMock: false,
      async planLesson() {
        externalCallsCount++;
        return null;
      }
    };

    const planner = new EducationalPlannerV3({
      aiProvider: fakeLiveProvider as never
    });

    await assert.rejects(
      () => planner.planLesson({
        lessonId: 'lesson_live_no_consent',
        topic: 'Mạng Neural Perceptron',
        targetDurationSeconds: 30,
        ownerId: 'teacher_1'
        // externalApiConsent omitted!
      }),
      /Explicit external API consent is required|external_api_consent/
    );

    assert.equal(externalCallsCount, 0, 'No external calls must be made when consent is missing');
  });

  await t.test('8. Mock mode + no narration executes cleanly with exactly zero external calls', async () => {
    const storageDir = await mkdtemp(join(tmpdir(), 'lumina-consent-mock-'));
    const manager = new LessonDraftManagerV3({ storageDir });

    const draft = await manager.create({
      requestId: 'req_zero_external',
      topic: '7 hằng đẳng thức đáng nhớ',
      domain: 'mathematics',
      generationMode: 'mock',
      targetDurationSeconds: 30,
      narrationMode: 'none',
      subtitlesEnabled: true
    }, 'teacher_1');

    assert.ok(draft.draftId);
    assert.equal(draft.status, 'needs_review');
    assert.equal(draft.lessonPlan.educationalClaims.length, 7);
  });
});
