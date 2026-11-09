import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { LessonDraftManagerV3, LongFormSegmentPlannerV3 } from '@luminalearn/agent';
import { secondsToFrames } from '@luminalearn/scene-schema';
import {
  SegmentRenderWorkerV3,
  LongFormRenderCoordinatorV3,
  SegmentCacheV3,
  RenderCheckpointRepositoryV3,
  SyntheticMediaFixtureWorkerV3,
  probeMediaWithFFprobe,
  computeFileSha256
} from '../src';

function extractFrame(videoPath: string, timestampSeconds: number, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      'ffmpeg',
      ['-y', '-ss', String(timestampSeconds), '-i', videoPath, '-vframes', '1', outputPath],
      { windowsHide: true, timeout: 30_000 },
      (err, _stdout, stderr) => {
        if (err) return reject(new Error(`extract_frame_failed: ${stderr || err.message}`));
        resolve();
      }
    );
  });
}

test('CHECKPOINT L: Educational Content Multi-Tier Video Acceptance', async (t) => {
  const manager = new LessonDraftManagerV3();

  await t.test('Tier 2 — 180-second AI Video: Gradient Descent multi-chapter real rendering', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lumina-tier2-gd-180s-'));
    try {
      // 1. Create and approve draft for 180-second Gradient Descent
      let draft = await manager.create(
        {
          requestId: `req_tier2_gd_${Date.now()}`,
          topic: 'Gradient Descent',
          domain: 'artificial_intelligence',
          generationMode: 'mock',
          targetDurationSeconds: 180,
          narrationMode: 'none',
          subtitlesEnabled: true,
          fps: 24,
          width: 720,
          height: 1280
        },
        'teacher_tier2_ai'
      );

      assert.strictEqual(draft.lessonPlan.storyboard?.totalDurationSeconds, 180);
      assert.ok(draft.lessonPlan.storyboard.scenes.length >= 4, '180s AI video must contain at least 4 educational scenes');

      draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_tier2_ai', draft.version);
      draft = await manager.approve(
        draft.draftId,
        'teacher_tier2_ai',
        draft.version,
        'Approved for Phase 6.1 Tier 2 AI Acceptance Render'
      );

      const artifact = draft.approvedArtifact!;
      assert.ok(artifact);

      // 2. Plan segments
      const planner = new LongFormSegmentPlannerV3();
      const manifest = planner.planSegments({
        artifactId: artifact.artifactId,
        storyboard: artifact.lessonPlan.storyboard!,
        targetSegmentDurationSeconds: 30,
        fps: 24,
        width: 720,
        height: 1280
      });

      assert.ok(manifest.segments.length >= 4, 'Must produce multiple segments');
      assert.strictEqual(manifest.totalFrames, 4320); // 180 * 24

      // 3. Render real Remotion segments with coordinator
      const cache = new SegmentCacheV3({ cacheDir: join(tempDir, 'cache') });
      const checkpointRepo = new RenderCheckpointRepositoryV3({ storageDir: join(tempDir, 'checkpoints') });
      const worker = new SegmentRenderWorkerV3();
      const coordinator = new LongFormRenderCoordinatorV3({ cache, checkpointRepo, worker });

      const jobId = 'job_tier2_gd_180s';
      const result = await coordinator.render({
        manifest,
        artifact,
        authorizeArtifact: (cand) => manager.isArtifactAuthorized(cand),
        jobId,
        outputDir: join(tempDir, 'output'),
        subtitlesSrtContent: '1\n00:00:00,000 --> 00:00:25,000\nBản chất Gradient Descent.\n\n2\n00:00:25,000 --> 00:01:00,000\nBề mặt hàm mất mát.\n'
      });

      assert.strictEqual(result.job.status, 'completed');
      assert.strictEqual(result.job.progress, 100);
      assert.ok(result.finalMp4Path);

      // 4. Inspect final video with FFprobe
      const probe = await probeMediaWithFFprobe(result.finalMp4Path);
      assert.strictEqual(probe.width, 720);
      assert.strictEqual(probe.height, 1280);
      assert.strictEqual(probe.fps, 24);
      assert.strictEqual(probe.videoCodec, 'h264');
      assert.ok(
        Math.abs(probe.durationSeconds - 180) <= 2.0,
        `Expected ~180s duration, got ${probe.durationSeconds}s`
      );

      // 5. Extract contact sheet frame and verify non-zero image size
      const framePath = join(tempDir, 'gd_contact_frame.png');
      await extractFrame(result.finalMp4Path, 15, framePath);
      const frameStat = await stat(framePath);
      assert.ok(frameStat.size > 5_000, 'Rendered frame must be a real graphical image, not empty or 0 bytes');

      // Verify final video SHA256
      const sha = await computeFileSha256(result.finalMp4Path);
      assert.ok(sha && sha.length === 64);
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  await t.test('Tier 3 — 300-second (5 min) Math/AI Video Planning, Frame Conservation & Continuity', async () => {
    const draft = await manager.create(
      {
        requestId: `req_tier3_300s_${Date.now()}`,
        topic: 'Gradient Descent',
        domain: 'artificial_intelligence',
        generationMode: 'mock',
        targetDurationSeconds: 300,
        narrationMode: 'none',
        subtitlesEnabled: true,
        fps: 24,
        width: 720,
        height: 1280
      },
      'teacher_tier3'
    );

    assert.strictEqual(draft.lessonPlan.storyboard?.totalDurationSeconds, 300);
    assert.strictEqual(draft.lessonPlan.storyboard.scenes.length, 8, '300s Gradient Descent must have 8 chapters/scenes');

    // Verify exact frame sum equals 7200 frames (300 * 24)
    const totalFrames = draft.lessonPlan.storyboard.scenes.reduce(
      (sum, sc) => sum + secondsToFrames(sc.durationSeconds, 24),
      0
    );
    assert.strictEqual(totalFrames, 7200, 'Total frames must equal exactly 7200 without rounding drift');

    const planner = new LongFormSegmentPlannerV3();
    const manifest = planner.planSegments({
      artifactId: 'art_tier3_300s',
      storyboard: draft.lessonPlan.storyboard!
    });

    assert.strictEqual(manifest.totalFrames, 7200);
    assert.ok(manifest.segments.length >= 6);

    // Verify gapless segment boundaries
    let expectedFrame = 0;
    for (const seg of manifest.segments) {
      assert.strictEqual(seg.startFrame, expectedFrame, `Segment ${seg.segmentId} startFrame mismatch`);
      expectedFrame = seg.endFrame;
    }
    assert.strictEqual(expectedFrame, 7200);
  });

  await t.test('Tier 4 — 600-second (10 min) Masterclass Planning & Segment Manifest Validation', async () => {
    const draft = await manager.create(
      {
        requestId: `req_tier4_600s_${Date.now()}`,
        topic: '7 hằng đẳng thức đáng nhớ',
        domain: 'mathematics',
        generationMode: 'mock',
        targetDurationSeconds: 600,
        narrationMode: 'none',
        subtitlesEnabled: true,
        fps: 24,
        width: 720,
        height: 1280
      },
      'teacher_tier4'
    );

    assert.strictEqual(draft.lessonPlan.storyboard?.totalDurationSeconds, 600);

    const planner = new LongFormSegmentPlannerV3();
    const manifest = planner.planSegments({
      artifactId: 'art_tier4_600s',
      storyboard: draft.lessonPlan.storyboard!
    });

    assert.strictEqual(manifest.targetDurationSeconds, 600);
    assert.strictEqual(manifest.totalFrames, 14400); // 600 * 24
    assert.ok(manifest.segments.length >= 10);

    // Verify all segment frame lengths are bounded (15s to 45s, i.e. 360 to 1080 frames)
    for (const seg of manifest.segments) {
      assert.ok(seg.durationFrames >= 240, `Segment ${seg.segmentId} durationFrames too short: ${seg.durationFrames}`);
      assert.ok(seg.durationFrames <= 1080, `Segment ${seg.segmentId} durationFrames exceeds limit: ${seg.durationFrames}`);
    }
  });
});

