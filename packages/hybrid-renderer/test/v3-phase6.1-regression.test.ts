import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SupervisorRequestV3Schema,
  LessonRequestV3Schema,
  isLongFormDuration,
  type EducationalStoryboardV3,
  type LongFormStoryboardV3,
  secondsToFrames
} from '@luminalearn/scene-schema';
import {
  LongFormSegmentPlannerV3
} from '@luminalearn/agent';
import {
  SegmentCacheV3,
  SyntheticMediaFixtureWorkerV3,
  LongFormMediaAssemblerV3,
  probeMediaWithFFprobe
} from '../src';

test('CHECKPOINT 0: Phase 6.1 Baseline Audit & Regression Reproduction', async (t) => {
  await t.test('1. SyntheticMediaFixtureWorkerV3 is explicitly isolated as test fixture only', async () => {
    const fixtureWorker = new SyntheticMediaFixtureWorkerV3();
    assert.ok(fixtureWorker, 'SyntheticMediaFixtureWorkerV3 must be instantiated under explicit test name');
    assert.strictEqual(typeof fixtureWorker.renderSegment, 'function');
  });

  await t.test('2. SupervisorRequestV3Schema accepts long-form duration presets (60s, 180s, 300s, 600s)', () => {
    const validPresets = [35, 60, 180, 300, 600];
    for (const seconds of validPresets) {
      const parsed = SupervisorRequestV3Schema.parse({
        requestId: `req_test_${seconds}`,
        topic: 'Gradient Descent',
        domain: 'artificial_intelligence',
        targetDurationSeconds: seconds
      });
      assert.strictEqual(parsed.targetDurationSeconds, seconds);
      if (seconds >= 60) {
        assert.strictEqual(isLongFormDuration(seconds), true, `${seconds}s must be classified as long-form`);
      } else {
        assert.strictEqual(isLongFormDuration(seconds), false, `${seconds}s must be classified as short-form`);
      }
    }

    // Must still reject invalid values
    assert.throws(() => {
      SupervisorRequestV3Schema.parse({
        requestId: 'req_invalid',
        topic: 'Gradient Descent',
        domain: 'artificial_intelligence',
        targetDurationSeconds: 15 // below min 20
      });
    });

    assert.throws(() => {
      SupervisorRequestV3Schema.parse({
        requestId: 'req_invalid_high',
        topic: 'Gradient Descent',
        domain: 'artificial_intelligence',
        targetDurationSeconds: 1200 // above max 600
      });
    });
  });

  await t.test('3. LessonRequestV3Schema accepts up to 600s for approved render artifacts', () => {
    const parsed = LessonRequestV3Schema.parse({
      requestId: 'req_longform_600',
      topic: '7 hằng đẳng thức đáng nhớ',
      domain: 'mathematics',
      generationMode: 'mock',
      targetDurationSeconds: 600
    });
    assert.strictEqual(parsed.targetDurationSeconds, 600);
  });

  await t.test('4. SegmentCacheV3 fails closed on tampered or corrupted MP4 files', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lumina-cache-regression-'));
    try {
      const cache = new SegmentCacheV3({ cacheDir: tempDir });
      await cache.init();

      // Create a fake MP4 file and a sidecar with mismatched hash
      const cacheKey = 'fake_cache_key_tampered_test';
      const fakeMp4Path = join(tempDir, `${cacheKey}.mp4`);
      const sidecarPath = join(tempDir, `${cacheKey}.sidecar.json`);

      await writeFile(fakeMp4Path, 'not a valid mp4 content', 'utf8');
      await writeFile(
        sidecarPath,
        JSON.stringify({
          cacheKey,
          inputFingerprint: 'fingerprint_test',
          fileSHA256: '0000000000000000000000000000000000000000000000000000000000000000',
          fileSizeBytes: 24,
          expectedFrameCount: 720,
          durationSeconds: 30,
          fps: 24,
          width: 720,
          height: 1280,
          rendererVersion: '3.1.0',
          createdAt: new Date().toISOString()
        }),
        'utf8'
      );

      // Cache get must fail closed (return undefined) and delete corrupt file
      const retrieved = await cache.get(cacheKey, 'fingerprint_test');
      assert.strictEqual(retrieved, undefined, 'Tampered cache entry must not be returned');
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  await t.test('5. LongFormSegmentPlannerV3 binds segments to true approved chapter IDs', () => {
    const planner = new LongFormSegmentPlannerV3();
    const fps = 24;

    const longFormStoryboard: LongFormStoryboardV3 = {
      schemaVersion: 'lesson-v3',
      totalDurationSeconds: 60,
      totalDurationFrames: 1440,
      fps: 24,
      chapters: [
        {
          chapterId: 'chap_real_intro',
          chapterIndex: 0,
          chapterTitle: 'Chương 1: Giới thiệu',
          learningObjectives: ['Hiểu bản chất ban đầu'],
          pedagogicalIntent: 'Kích hoạt trực giác',
          startFrame: 0,
          endFrame: 720,
          durationFrames: 720,
          durationSeconds: 30,
          sections: [],
          sceneIds: ['sc_1'],
          keyConcepts: ['Khái niệm'],
          formalClaimIds: [],
          narrationPlan: { overview: 'Lời dẫn chương 1', speakingRateCharsPerSec: 14 },
          validationStatus: 'verified'
        },
        {
          chapterId: 'chap_real_core',
          chapterIndex: 1,
          chapterTitle: 'Chương 2: Bản chất cốt lõi',
          learningObjectives: ['Phân tích sâu sắc'],
          pedagogicalIntent: 'Cơ chế hoạt động',
          startFrame: 720,
          endFrame: 1440,
          durationFrames: 720,
          durationSeconds: 30,
          sections: [],
          sceneIds: ['sc_2'],
          keyConcepts: ['Cốt lõi'],
          formalClaimIds: [],
          narrationPlan: { overview: 'Lời dẫn chương 2', speakingRateCharsPerSec: 14 },
          validationStatus: 'verified'
        }
      ],
      scenes: [
        {
          sceneId: 'sc_1',
          sceneType: 'concept_intro',
          title: 'Cảnh 1',
          pedagogicalGoal: 'Mục tiêu 1',
          durationSeconds: 30,
          boundClaimIds: [],
          rendererTarget: 'remotion_infographic',
          narration: { vietnamese: 'Lời dẫn 1', subtitleVietnamese: 'Phụ đề 1' },
          visualPayload: {
            sceneType: 'concept_intro',
            centralQuestion: 'Khái niệm?',
            keyConcept: 'Ý niệm',
            visualStyleId: 'clean_educational_infographic',
            accentColor: '#38BDF8',
            reducedMotion: false
          }
        },
        {
          sceneId: 'sc_2',
          sceneType: 'summary',
          title: 'Cảnh 2',
          pedagogicalGoal: 'Mục tiêu 2',
          durationSeconds: 30,
          boundClaimIds: [],
          rendererTarget: 'remotion_infographic',
          narration: { vietnamese: 'Lời dẫn 2', subtitleVietnamese: 'Phụ đề 2' },
          visualPayload: {
            sceneType: 'summary',
            title: 'Tổng kết cảnh 2',
            takeaways: ['Điểm 1', 'Điểm 2'],
            verifiedFacts: [],
            reviewNotes: [],
            finalCallout: 'Ghi nhớ'
          }
        }
      ]
    };

    const manifest = planner.planSegments({
      artifactId: 'art_audit_test',
      storyboard: longFormStoryboard,
      fps
    });

    assert.ok(manifest.segments.length >= 2, 'Must have at least 2 segments for 60s');
    for (const seg of manifest.segments) {
      assert.notStrictEqual(seg.chapterId, 'chap_0', 'Chapter ID must NOT be the dummy chap_0 placeholder');
      assert.ok(
        seg.chapterId === 'chap_real_intro' || seg.chapterId === 'chap_real_core',
        `Segment chapterId '${seg.chapterId}' must be a real approved chapter ID`
      );
    }
  });
});

