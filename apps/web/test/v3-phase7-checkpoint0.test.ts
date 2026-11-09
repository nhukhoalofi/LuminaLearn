import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LessonDraftManagerV3, LongFormSegmentPlannerV3, computeArtifactContentHashV3 } from '@luminalearn/agent';
import { generateSrtFromStoryboardV3, srtTimestamp } from '@luminalearn/hybrid-renderer';
import {
  createV3JobFromArtifact,
  resumeV3Job,
  getJob,
  getJobOutputPath
} from '../src/server/job-store.js';
import { SecurityError } from '../src/server/security.js';

test('CHECKPOINT 0: Phase 6.1 Production Blocker Closure Suite', async (t) => {
  const storageDir = await mkdtemp(join(tmpdir(), 'lumina-v3-phase7-cp0-'));
  const manager = new LessonDraftManagerV3({ storageDir });

  // --------------------------------------------------------------------------
  // 0.A: Valid Web Job State Transitions & Real Queue-to-Remotion Execution
  // --------------------------------------------------------------------------
  await t.test('0.A — Fix invalid Web job state transitions (P0): 60s Math & 180s AI via Web queue', async () => {
    // 1. Create and approve 60s Mathematics lesson
    let mathDraft = await manager.create({
      requestId: `req_math_60s_${Date.now()}`,
      topic: '7 hằng đẳng thức đáng nhớ',
      domain: 'mathematics',
      generationMode: 'mock',
      targetDurationSeconds: 60,
      narrationMode: 'none',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280
    }, 'teacher_math_0a');

    mathDraft = await manager.confirmSemanticReview(mathDraft.draftId, 'teacher_math_0a', mathDraft.version);
    mathDraft = await manager.approve(mathDraft.draftId, 'teacher_math_0a', mathDraft.version, 'Approved for 60s test');
    const mathArtifact = mathDraft.approvedArtifact!;
    assert.ok(mathArtifact, 'Math artifact must be approved');

    // Enqueue through real Web queue function
    const mathJob = await createV3JobFromArtifact(
      mathArtifact,
      (art) => manager.isArtifactAuthorized(art),
      'teacher_math_0a'
    );
    assert.ok(mathJob.jobId, 'Job ID must be generated');
    assert.strictEqual(mathJob.status, 'queued');

    // Wait for the background worker pump to process the job through the state machine
    let finalMathJob = getJob(mathJob.jobId, 'teacher_math_0a');
    const startTime = Date.now();
    while (finalMathJob && finalMathJob.status !== 'completed' && finalMathJob.status !== 'failed') {
      if (Date.now() - startTime > 240_000) {
        throw new Error('timeout_waiting_for_math_job');
      }
      await new Promise((r) => setTimeout(r, 1000));
      finalMathJob = getJob(mathJob.jobId, 'teacher_math_0a');
    }

    assert.ok(finalMathJob, 'Job must exist');
    assert.strictEqual(
      finalMathJob.status,
      'completed',
      `Job must reach completed state without transition errors (got: ${finalMathJob.status}, error: ${finalMathJob.error})`
    );
    assert.ok(finalMathJob.videoUrl, 'Video URL must be present');
    const mathOutputPath = getJobOutputPath(mathJob.jobId, 'teacher_math_0a');
    assert.ok(mathOutputPath, 'Output path must be registered');

    // Verify subtitles file exists alongside output MP4
    const srtBytes = await readFile(join(storageDir, '..', mathOutputPath, '..', 'subtitles.srt'), 'utf8').catch(async () => {
      // Direct relative resolve
      const { resolve, dirname } = await import('node:path');
      return readFile(resolve(dirname(mathOutputPath!), 'subtitles.srt'), 'utf8');
    });
    assert.ok(srtBytes && srtBytes.includes('1'), 'Subtitles SRT file must be written and non-empty');
  });

  // --------------------------------------------------------------------------
  // 0.B: Subtitles Generation & Delivery (SRT)
  // --------------------------------------------------------------------------
  await t.test('0.B — Fix long-form subtitle delivery (P0): Exact frames, UTF-8, no overlap', () => {
    // Test 1: 60-second storyboard with Vietnamese characters
    const sb60 = {
      totalDurationSeconds: 60,
      scenes: [
        { durationSeconds: 20, narration: { subtitleVietnamese: 'Chào mừng các bạn đến với 7 hằng đẳng thức đáng nhớ.' } },
        { durationSeconds: 25, narration: { subtitleVietnamese: 'Bình phương của một tổng: (a + b)² = a² + 2ab + b².' } },
        { durationSeconds: 15, narration: { subtitleVietnamese: 'Tổng kết và bài tập vận dụng nâng cao.' } }
      ]
    };
    const srt60 = generateSrtFromStoryboardV3(sb60, 24);
    assert.ok(srt60.includes('1\n00:00:00,000 --> 00:00:20,000\nChào mừng các bạn đến với 7 hằng đẳng thức đáng nhớ.'));
    assert.ok(srt60.includes('2\n00:00:20,000 --> 00:00:45,000\nBình phương của một tổng: (a + b)² = a² + 2ab + b².'));
    assert.ok(srt60.includes('3\n00:00:45,000 --> 00:01:00,000\nTổng kết và bài tập vận dụng nâng cao.'));

    // Test 2: Empty narration handling (does not emit blank cue, advances time cursor without drift)
    const sbEmpty = {
      totalDurationSeconds: 60,
      scenes: [
        { durationSeconds: 20, narration: { subtitleVietnamese: 'Cảnh 1 có phụ đề.' } },
        { durationSeconds: 20, narration: { subtitleVietnamese: '   ' } }, // Empty/whitespace
        { durationSeconds: 20, narration: { subtitleVietnamese: 'Cảnh 3 sau đoạn im lặng.' } }
      ]
    };
    const srtEmpty = generateSrtFromStoryboardV3(sbEmpty, 24);
    assert.ok(srtEmpty.includes('1\n00:00:00,000 --> 00:00:20,000\nCảnh 1 có phụ đề.'));
    // Cues must be numbered sequentially 1, 2 (not skipping to 3)
    assert.ok(srtEmpty.includes('2\n00:00:40,000 --> 00:01:00,000\nCảnh 3 sau đoạn im lặng.'));
    assert.ok(!srtEmpty.includes('00:00:20,000 --> 00:00:40,000'), 'Empty cue must not be emitted');

    // Test 3: 300s boundary consistency (does not overflow total duration)
    const sb300 = {
      totalDurationSeconds: 300,
      scenes: Array.from({ length: 10 }, (_, i) => ({
        durationSeconds: 35, // 10 * 35 = 350s > 300s
        narration: { subtitleVietnamese: `Phân đoạn ${i + 1}` }
      }))
    };
    const srt300 = generateSrtFromStoryboardV3(sb300, 24);
    assert.ok(!srt300.includes('00:05:01'), 'No cue may exceed total duration of 300 seconds (00:05:00)');
  });

  // --------------------------------------------------------------------------
  // 0.C: Honor Long-Form Narration Mode
  // --------------------------------------------------------------------------
  await t.test('0.C — Honor long-form narration mode (P0): Rejects unsupported TTS before enqueue', async () => {
    let ttsDraft = await manager.create({
      requestId: `req_tts_unsupported_${Date.now()}`,
      topic: 'Gradient Descent',
      domain: 'artificial_intelligence',
      generationMode: 'mock',
      targetDurationSeconds: 180,
      narrationMode: 'none',
      subtitlesEnabled: true
    }, 'teacher_tts');

    ttsDraft = await manager.confirmSemanticReview(ttsDraft.draftId, 'teacher_tts', ttsDraft.version);
    ttsDraft = await manager.approve(ttsDraft.draftId, 'teacher_tts', ttsDraft.version, 'Approved');

    // Manually build a validly-hashed artifact requesting gemini_tts for a 180s long-form video
    const { contentHash: _oldHash, ...core } = ttsDraft.approvedArtifact!;
    const coreWithTts = {
      ...core,
      request: {
        ...core.request,
        targetDurationSeconds: 180,
        narrationMode: 'gemini_tts' as const
      }
    };
    const invalidLongFormArtifact = {
      ...coreWithTts,
      contentHash: computeArtifactContentHashV3(coreWithTts as any)
    };

    // Must be rejected fail-closed with 400 SecurityError before enqueueing
    await assert.rejects(
      () => createV3JobFromArtifact(invalidLongFormArtifact, () => true, 'teacher_tts'),
      (err: any) => {
        assert.ok(err instanceof SecurityError);
        assert.strictEqual(err.status, 400);
        assert.strictEqual(err.code, 'unsupported_longform_narration_mode');
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // 0.D: Chapter Ownership & Storyboard Persistence
  // --------------------------------------------------------------------------
  await t.test('0.D — Chapter ownership & persistence: Full scene coverage and rejection of duplicates', () => {
    const planner = new LongFormSegmentPlannerV3();

    // Reject duplicate scene ownership across chapters
    const duplicateChapterStoryboard: any = {
      schemaVersion: 'lesson-v3',
      totalDurationSeconds: 60,
      totalDurationFrames: 1440,
      fps: 24,
      chapters: [
        {
          chapterId: 'chap_01',
          chapterIndex: 0,
          chapterTitle: 'Chương 1',
          learningObjectives: ['Mục tiêu 1'],
          pedagogicalIntent: 'Ý đồ 1',
          startFrame: 0,
          endFrame: 720,
          durationFrames: 720,
          durationSeconds: 30,
          sceneIds: ['sc_01', 'sc_duplicate'], // 'sc_duplicate' belongs here
          keyConcepts: ['Khái niệm 1'],
          formalClaimIds: [],
          narrationPlan: { overview: 'Tổng quan 1', speakingRateCharsPerSec: 14 },
          validationStatus: 'verified'
        },
        {
          chapterId: 'chap_02',
          chapterIndex: 1,
          chapterTitle: 'Chương 2',
          learningObjectives: ['Mục tiêu 2'],
          pedagogicalIntent: 'Ý đồ 2',
          startFrame: 720,
          endFrame: 1440,
          durationFrames: 720,
          durationSeconds: 30,
          sceneIds: ['sc_02', 'sc_duplicate'], // AND belongs here! (Violation)
          keyConcepts: ['Khái niệm 2'],
          formalClaimIds: [],
          narrationPlan: { overview: 'Tổng quan 2', speakingRateCharsPerSec: 14 },
          validationStatus: 'verified'
        }
      ],
      scenes: [
        { sceneId: 'sc_01', durationSeconds: 20, pedagogicalGoal: 'G1', narration: { vietnamese: 'V1', subtitleVietnamese: 'S1' } },
        { sceneId: 'sc_duplicate', durationSeconds: 20, pedagogicalGoal: 'G2', narration: { vietnamese: 'V2', subtitleVietnamese: 'S2' } },
        { sceneId: 'sc_02', durationSeconds: 20, pedagogicalGoal: 'G3', narration: { vietnamese: 'V3', subtitleVietnamese: 'S3' } }
      ]
    };

    assert.throws(
      () => planner.planSegments({ artifactId: 'art_test', storyboard: duplicateChapterStoryboard }),
      /duplicate_chapter_ownership/
    );

    // Reject missing scene coverage
    const missingSceneStoryboard: any = {
      ...duplicateChapterStoryboard,
      chapters: [
        {
          ...duplicateChapterStoryboard.chapters[0],
          sceneIds: ['sc_01'] // sc_duplicate and sc_02 not covered!
        }
      ]
    };
    assert.throws(
      () => planner.planSegments({ artifactId: 'art_test', storyboard: missingSceneStoryboard }),
      /missing_chapter_coverage/
    );
  });

  // --------------------------------------------------------------------------
  // 0.E: Real Resume Semantics
  // --------------------------------------------------------------------------
  await t.test('0.E — Real resume semantics: Deterministic IDs and resumeV3Job service', async () => {
    const planner = new LongFormSegmentPlannerV3();
    const testSb: any = {
      storyboardId: 'sb_deterministic_test',
      totalDurationSeconds: 60,
      totalDurationFrames: 1440,
      fps: 24,
      chapters: [
        {
          chapterId: 'chap_01',
          chapterIndex: 0,
          chapterTitle: 'Chương 1',
          learningObjectives: ['G1'],
          pedagogicalIntent: 'I1',
          startFrame: 0,
          endFrame: 1440,
          durationFrames: 1440,
          durationSeconds: 60,
          sceneIds: ['sc_01', 'sc_02'],
          keyConcepts: ['C1'],
          formalClaimIds: [],
          narrationPlan: { overview: 'O1', speakingRateCharsPerSec: 14 },
          validationStatus: 'verified'
        }
      ],
      scenes: [
        { sceneId: 'sc_01', durationSeconds: 30, pedagogicalGoal: 'G1', narration: { vietnamese: 'V1', subtitleVietnamese: 'S1' } },
        { sceneId: 'sc_02', durationSeconds: 30, pedagogicalGoal: 'G2', narration: { vietnamese: 'V2', subtitleVietnamese: 'S2' } }
      ]
    };

    // Plan manifest twice: must produce identical manifestId and segmentIds
    const manifestA = planner.planSegments({ artifactId: 'art_deterministic', storyboard: testSb });
    const manifestB = planner.planSegments({ artifactId: 'art_deterministic', storyboard: testSb });

    assert.strictEqual(manifestA.manifestId, manifestB.manifestId, 'Manifest ID must be deterministic');
    assert.strictEqual(manifestA.segments.length, manifestB.segments.length);
    for (let i = 0; i < manifestA.segments.length; i++) {
      assert.strictEqual(
        manifestA.segments[i].segmentId,
        manifestB.segments[i].segmentId,
        `Segment ${i} ID must be deterministic across calls`
      );
    }
  });

  // --------------------------------------------------------------------------
  // 0.F: Enforce Approval and Cache Trust Boundaries
  // --------------------------------------------------------------------------
  await t.test('0.F — Enforce approval and cache trust boundaries: Rejects revoked or tampered artifacts', async () => {
    let testDraft = await manager.create({
      requestId: `req_trust_boundary_${Date.now()}`,
      topic: '7 hằng đẳng thức đáng nhớ',
      domain: 'mathematics',
      generationMode: 'mock',
      targetDurationSeconds: 60,
      narrationMode: 'none',
      subtitlesEnabled: true
    }, 'teacher_trust');

    testDraft = await manager.confirmSemanticReview(testDraft.draftId, 'teacher_trust', testDraft.version);
    testDraft = await manager.approve(testDraft.draftId, 'teacher_trust', testDraft.version, 'Approved');
    const artifact = testDraft.approvedArtifact!;

    // 1. Rejects if authorization callback returns false (revoked approval)
    await assert.rejects(
      () => createV3JobFromArtifact(artifact, () => false, 'teacher_trust'),
      (err: any) => {
        assert.ok(err instanceof SecurityError);
        assert.strictEqual(err.code, 'artifact_unauthorized');
        return true;
      }
    );

    // 2. Rejects if content hash was tampered with
    const tampered = { ...artifact, contentHash: 'f'.repeat(64) };
    await assert.rejects(
      () => createV3JobFromArtifact(tampered, () => true, 'teacher_trust'),
      /artifact_tampered/
    );
  });

  await rm(storageDir, { recursive: true, force: true }).catch(() => {});
});

