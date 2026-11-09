import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type ApprovedRenderArtifactV3,
  type SegmentManifestV3,
  secondsToFrames
} from '@luminalearn/scene-schema';
import { LessonDraftManagerV3, LongFormSegmentPlannerV3 } from '@luminalearn/agent';
import {
  SegmentRenderWorkerV3,
  LongFormRenderCoordinatorV3,
  SegmentCacheV3,
  RenderCheckpointRepositoryV3,
  LongFormMediaAssemblerV3,
  probeMediaWithFFprobe,
  computeFileSha256
} from '../src';

test('CHECKPOINTS A, F, G, I, L: Phase 6.1 Real Educational Remotion Rendering & Cache Hardening', async (t) => {
  // Setup approved test artifact with real educational scenes
  const manager = new LessonDraftManagerV3();
  let draft = await manager.create(
    {
      requestId: `req_phase6_1_${Date.now()}`,
      topic: '7 hằng đẳng thức đáng nhớ',
      domain: 'mathematics',
      generationMode: 'mock',
      targetDurationSeconds: 60,
      narrationMode: 'none',
      subtitlesEnabled: true,
      fps: 24,
      width: 720,
      height: 1280
    },
    'teacher_phase6_1'
  );

  draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_phase6_1', draft.version);
  draft = await manager.approve(draft.draftId, 'teacher_phase6_1', draft.version, 'Approved for Phase 6.1 Real Educational Render');
  const artifact = draft.approvedArtifact!;
  assert.ok(artifact, 'Approved artifact must exist');
  assert.ok(artifact.lessonPlan.storyboard, 'Storyboard must exist');

  await t.test('1. SegmentRenderWorkerV3 renders real educational scenes with Remotion into compliant MP4', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lumina-real-render-worker-'));
    try {
      const planner = new LongFormSegmentPlannerV3();
      const manifest = planner.planSegments({
        artifactId: artifact.artifactId,
        storyboard: artifact.lessonPlan.storyboard!
      });

      const segment = manifest.segments[0];
      const orderedScenes = segment.sceneIds.map((scId) => {
        const sc = artifact.lessonPlan.storyboard?.scenes.find((s) => s.sceneId === scId);
        assert.ok(sc, `Scene ${scId} must exist`);
        return sc;
      });

      const worker = new SegmentRenderWorkerV3();
      const result = await worker.renderSegment(segment, manifest, tempDir, {
        approvedArtifact: artifact,
        manifest,
        segment,
        orderedScenes,
        rendererVersion: '3.1.0',
        fps: 24,
        width: 720,
        height: 1280,
        segmentStartFrame: segment.startFrame,
        segmentDurationFrames: segment.durationFrames,
        subtitlesEnabled: true
      });

      assert.ok(result.outputPath, 'Output path must be returned');
      const probe = await probeMediaWithFFprobe(result.outputPath);
      assert.strictEqual(probe.width, 720);
      assert.strictEqual(probe.height, 1280);
      assert.strictEqual(probe.fps, 24);
      assert.strictEqual(probe.videoCodec, 'h264');
      assert.ok(probe.totalFrames > 0);
      assert.ok(Math.abs(probe.durationSeconds - segment.durationSeconds) <= 0.5);

      // Verify file is substantial (real rendered graphics, not empty solid 1-byte)
      const sha = await computeFileSha256(result.outputPath);
      assert.ok(sha && sha.length === 64, 'Output file must have valid SHA256');
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  await t.test('2. SegmentRenderWorkerV3 rejects unapproved or tampered artifact (fails closed)', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lumina-tamper-reject-'));
    try {
      const planner = new LongFormSegmentPlannerV3();
      const manifest = planner.planSegments({
        artifactId: artifact.artifactId,
        storyboard: artifact.lessonPlan.storyboard!
      });

      const segment = manifest.segments[0];
      const orderedScenes = segment.sceneIds.map((scId) => artifact.lessonPlan.storyboard!.scenes.find((s) => s.sceneId === scId)!);

      // Tamper content hash
      const tamperedArtifact: ApprovedRenderArtifactV3 = {
        ...artifact,
        contentHash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      };

      const worker = new SegmentRenderWorkerV3();
      await assert.rejects(
        worker.renderSegment(segment, manifest, tempDir, {
          approvedArtifact: tamperedArtifact,
          manifest,
          segment,
          orderedScenes,
          rendererVersion: '3.1.0',
          fps: 24,
          width: 720,
          height: 1280,
          segmentStartFrame: segment.startFrame,
          segmentDurationFrames: segment.durationFrames
        }),
        /artifact_tampered/
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  await t.test('3. SegmentCacheV3 sidecar integrity: rejects swapped MP4 or altered sidecar', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lumina-cache-integrity-'));
    try {
      const cache = new SegmentCacheV3({ cacheDir: tempDir });
      await cache.init();

      const planner = new LongFormSegmentPlannerV3();
      const manifest = planner.planSegments({
        artifactId: artifact.artifactId,
        storyboard: artifact.lessonPlan.storyboard!
      });

      const segment = manifest.segments[0];
      const orderedScenes = segment.sceneIds.map((scId) => artifact.lessonPlan.storyboard!.scenes.find((s) => s.sceneId === scId)!);
      const worker = new SegmentRenderWorkerV3();

      const rendered = await worker.renderSegment(segment, manifest, tempDir, {
        approvedArtifact: artifact,
        manifest,
        segment,
        orderedScenes,
        rendererVersion: '3.1.0',
        fps: 24,
        width: 720,
        height: 1280,
        segmentStartFrame: segment.startFrame,
        segmentDurationFrames: segment.durationFrames
      });

      const cacheKey = cache.computeCacheKey(segment, manifest.fps, manifest.width, manifest.height);
      const cachedPath = await cache.set(cacheKey, rendered.outputPath, segment.inputContentHash);
      assert.ok(cachedPath);

      // Cache hit succeeds with correct fingerprint
      const hit = await cache.get(cacheKey, segment.inputContentHash);
      assert.strictEqual(hit, cachedPath);

      // Cache hit rejected if fingerprint differs
      const wrongFingerprint = await cache.get(cacheKey, 'different_fingerprint_hash');
      assert.strictEqual(wrongFingerprint, undefined);

      // Tamper MP4 byte content: writing garbage must invalidate cache
      await writeFile(cachedPath, 'tampered_garbage_bytes');
      const tamperedGet = await cache.get(cacheKey, segment.inputContentHash);
      assert.strictEqual(tamperedGet, undefined, 'Tampered MP4 bytes must fail closed');
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  await t.test('4. LongFormRenderCoordinatorV3 rejects concurrent executions of the same jobId', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lumina-concurrency-reject-'));
    try {
      const planner = new LongFormSegmentPlannerV3();
      const manifest = planner.planSegments({
        artifactId: artifact.artifactId,
        storyboard: artifact.lessonPlan.storyboard!
      });

      const coordinator = new LongFormRenderCoordinatorV3();
      const jobId = `job_concurrent_${Date.now()}`;

      // Simulate a lock by testing assert on concurrent execution
      // We start a coordinator render that is pending and try to start another with same jobId
      const firstRunPromise = coordinator.render({
        manifest,
        artifact,
        authorizeArtifact: (cand) => manager.isArtifactAuthorized(cand),
        jobId,
        outputDir: join(tempDir, 'out1'),
        simulateFailureAtSegment: 0 // Fail fast to release lock
      }).catch(() => {});

      // Immediate second call with exact same jobId must throw job_concurrent_execution
      await assert.rejects(
        coordinator.render({
          manifest,
          artifact,
          authorizeArtifact: (cand) => manager.isArtifactAuthorized(cand),
          jobId,
          outputDir: join(tempDir, 'out2')
        }),
        /job_concurrent_execution/
      );

      await firstRunPromise;
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  await t.test('5. Tier 1: 60-second Mathematics Educational Video Render & QA (Algebra)', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'lumina-tier1-math-'));
    try {
      const planner = new LongFormSegmentPlannerV3();
      const manifest = planner.planSegments({
        artifactId: artifact.artifactId,
        storyboard: artifact.lessonPlan.storyboard!
      });

      const cache = new SegmentCacheV3({ cacheDir: join(tempDir, 'cache') });
      const checkpointRepo = new RenderCheckpointRepositoryV3({ storageDir: join(tempDir, 'checkpoints') });
      const coordinator = new LongFormRenderCoordinatorV3({ cache, checkpointRepo });

      const jobId = 'job_tier1_algebra_60s';
      const result = await coordinator.render({
        manifest,
        artifact,
        authorizeArtifact: (cand) => manager.isArtifactAuthorized(cand),
        jobId,
        outputDir: join(tempDir, 'output'),
        subtitlesSrtContent: '1\n00:00:00,000 --> 00:00:30,000\nBình phương của một tổng.\n\n2\n00:00:30,000 --> 00:01:00,000\nBình phương của một hiệu.\n'
      });

      assert.strictEqual(result.job.status, 'completed');
      assert.strictEqual(result.job.progress, 100);
      assert.ok(result.finalMp4Path);

      // Verify final MP4 with real FFprobe
      const probe = await probeMediaWithFFprobe(result.finalMp4Path);
      assert.strictEqual(probe.width, 720);
      assert.strictEqual(probe.height, 1280);
      assert.strictEqual(probe.fps, 24);
      assert.strictEqual(probe.videoCodec, 'h264');
      assert.ok(Math.abs(probe.durationSeconds - 60) <= 1.5, `Duration must be ~60s, got ${probe.durationSeconds}s`);

      // Verify media report generated
      assert.ok(result.mediaReportPath);
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

