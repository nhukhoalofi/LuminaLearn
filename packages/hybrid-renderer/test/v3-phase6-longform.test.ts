import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LongFormSegmentPlannerV3
} from '@luminalearn/agent';
import {
  LongFormRenderCoordinatorV3,
  SegmentCacheV3,
  RenderCheckpointRepositoryV3,
  SyntheticMediaFixtureWorkerV3,
  LongFormMediaAssemblerV3,
  probeMediaWithFFprobe
} from '../src';
import {
  type EducationalStoryboardV3,
  type ApprovedRenderArtifactV3,
  ApprovedRenderArtifactV3Schema,
  secondsToFrames
} from '@luminalearn/scene-schema';
import { computeV3ContentHash } from '../src/pipeline-v3';

function makeMockApprovedArtifact(artifactId: string, storyboard: EducationalStoryboardV3): ApprovedRenderArtifactV3 {
  const lessonId = storyboard.lessonId ?? `lesson_test_${storyboard.totalDurationSeconds}s`;
  const validationTimestamp = '2026-11-10T00:00:00.000Z';
  const report = {
    reportId: `rep_${artifactId}`,
    lessonId,
    domain: 'mathematics' as const,
    overallStatus: 'verified' as const,
    claimReports: [
      {
        claimId: 'claim_test',
        claimType: 'formal_mathematics' as const,
        status: 'formally_verified' as const,
        verifierNotes: 'Verified for longform tests'
      }
    ],
    requiresHumanPedagogicalSignoff: true,
    validationTimestamp
  };

  const rawCore = {
    schemaVersion: 'approved-render-artifact-v3' as const,
    artifactId,
    draftId: `draft_${artifactId}`,
    ownerId: 'teacher_pilot',
    approvedVersion: 1,
    request: {
      requestId: `req_${artifactId}`,
      topic: '7 hằng đẳng thức đáng nhớ',
      domain: 'mathematics' as const,
      generationMode: 'mock' as const,
      targetDurationSeconds: storyboard.totalDurationSeconds,
      narrationMode: 'none' as const,
      subtitlesEnabled: true,
      fps: 24 as const,
      width: 720 as const,
      height: 1280 as const
    },
    lessonPlan: {
      schemaVersion: 'lesson-v3' as const,
      generationProvenance: 'deterministic_mock' as const,
      lessonId,
      domain: 'mathematics' as const,
      topicId: 'algebra.identities.seven',
      title: '7 hằng đẳng thức đáng nhớ',
      summary: 'Tóm tắt bài học kiểm thử longform',
      learningObjectives: ['Nắm vững cấu trúc longform video'],
      prerequisites: [],
      keyConcepts: ['Phân đoạn longform'],
      educationalClaims: [
        {
          id: 'claim_test',
          claimType: 'formal_mathematics' as const,
          statement: '7 hằng đẳng thức đáng nhớ là các đẳng thức cơ bản trong đại số.',
          formalExpression: '(a+b)^2 = a^2+2*a*b+b^2',
          verificationStatus: 'formally_verified' as const,
          formalProofSummary: 'Kiểm định đại số qua SymPy thành công'
        }
      ],
      capabilityReport: {
        topicId: 'algebra.identities.seven',
        domain: 'mathematics' as const,
        displayName: '7 hằng đẳng thức đáng nhớ',
        subCategory: 'Đại số cơ bản',
        supportedCapabilities: ['formal_math_verification' as const],
        requiredValidationTypes: ['formal_math' as const],
        availableRenderers: ['remotion_infographic' as const],
        evidenceRequirements: ['mathematical_proof' as const],
        renderReadiness: 'render_ready' as const
      },
      validationReport: report,
      sourceEvidence: [],
      storyboard: {
        storyboardId: storyboard.storyboardId,
        lessonId,
        totalDurationSeconds: storyboard.totalDurationSeconds,
        scenes: storyboard.scenes
      }
    },
    verificationReport: report,
    teacherApproval: {
      approvedBy: 'teacher_pilot',
      approvedAt: validationTimestamp,
      semanticReviewConfirmed: true as const
    },
    createdAt: validationTimestamp
  };

  const parsedTemp = ApprovedRenderArtifactV3Schema.parse({
    ...rawCore,
    contentHash: '0'.repeat(64)
  });
  const { contentHash: _ch, ...normalizedCore } = parsedTemp;
  return {
    ...normalizedCore,
    contentHash: computeV3ContentHash(normalizedCore)
  };
}

function makeMockStoryboard(totalSeconds: number): EducationalStoryboardV3 {
  const sceneCount = totalSeconds === 60 ? 3 : totalSeconds === 180 ? 5 : totalSeconds === 300 ? 10 : 20;
  const durationPerScene = Number((totalSeconds / sceneCount).toFixed(1));
  const scenes: EducationalStoryboardV3['scenes'] = [];
  let runningTotal = 0;

  for (let i = 0; i < sceneCount; i++) {
    const isLast = i === sceneCount - 1;
    const dur = isLast ? Number((totalSeconds - runningTotal).toFixed(1)) : durationPerScene;
    runningTotal += dur;

    scenes.push({
      sceneId: `sc_test_${i + 1}`,
      sceneType: 'concept_intro',
      title: `Phân cảnh kiểm thử ${i + 1}`,
      pedagogicalGoal: `Mục tiêu sư phạm phân cảnh ${i + 1}`,
      durationSeconds: dur,
      boundClaimIds: ['claim_test'],
      rendererTarget: 'remotion_infographic',
      narration: {
        vietnamese: `Lời giảng phân cảnh ${i + 1} giải thích bản chất kiến thức một cách sâu sắc.`,
        subtitleVietnamese: `Phụ đề phân cảnh ${i + 1}.`
      },
      visualPayload: {
        sceneType: 'concept_intro',
        centralQuestion: 'Khái niệm là gì trong bài học kiểm thử?',
        keyConcept: 'Trực quan hóa',
        visualStyleId: 'clean_educational_infographic',
        accentColor: '#38BDF8',
        reducedMotion: false
      }
    });
  }

  return {
    storyboardId: `sb_test_${totalSeconds}s`,
    lessonId: `lesson_test_${totalSeconds}s`,
    scenes,
    totalDurationSeconds: totalSeconds
  };
}

test('PHASE 6: LongFormSegmentPlannerV3 produces contiguous non-overlapping segments for 60s, 180s, 300s, 600s', () => {
  const planner = new LongFormSegmentPlannerV3();

  for (const preset of [60, 180, 300, 600]) {
    const sb = makeMockStoryboard(preset);
    const manifest = planner.planSegments({
      artifactId: `art_test_${preset}s`,
      storyboard: sb,
      targetSegmentDurationSeconds: 30,
      fps: 24,
      width: 720,
      height: 1280
    });

    assert.ok(manifest.segments.length >= 2, `Preset ${preset}s must produce at least 2 segments`);
    assert.equal(manifest.totalFrames, secondsToFrames(preset, 24));
    assert.equal(manifest.targetDurationSeconds, preset);

    // Verify complete frame continuity
    let currentFrame = 0;
    for (let i = 0; i < manifest.segments.length; i++) {
      const seg = manifest.segments[i];
      assert.equal(seg.segmentIndex, i);
      assert.equal(seg.startFrame, currentFrame, `Segment ${i} startFrame must match expected cursor`);
      assert.ok(seg.endFrame > seg.startFrame, `Segment ${i} endFrame must be strictly greater than startFrame`);
      assert.equal(seg.durationFrames, seg.endFrame - seg.startFrame);
      currentFrame = seg.endFrame;
    }
    assert.equal(currentFrame, manifest.totalFrames, `Sum of all segments must equal totalFrames`);
  }
});

test('PHASE 6: SegmentCacheV3 content-addressable caching, hit/miss, and corrupt cache rejection', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'lumina-cache-test-'));
  try {
    const cache = new SegmentCacheV3({ cacheDir: tempDir });
    const planner = new LongFormSegmentPlannerV3();
    const sb = makeMockStoryboard(60);
    const manifest = planner.planSegments({ artifactId: 'art_cache', storyboard: sb });
    const segment = manifest.segments[0];

    const cacheKey = cache.computeCacheKey(segment);

    // 1. Initial state: cache miss
    const initialGet = await cache.get(cacheKey);
    assert.equal(initialGet, undefined);

    // 2. Render dummy valid segment file and set into cache
    const worker = new SyntheticMediaFixtureWorkerV3();
    const rendered = await worker.renderSegment(segment, manifest, tempDir);
    const cachedPath = await cache.set(cacheKey, rendered.outputPath);
    assert.ok(cachedPath);

    // 3. Cache hit: returns valid cached MP4
    const hitPath = await cache.get(cacheKey);
    assert.equal(hitPath, cachedPath);

    // 4. Corrupt cache file: writing garbage into the cached file must cause rejection
    await writeFile(cachedPath, 'corrupted_garbage_content_not_a_valid_mp4');
    const corruptGet = await cache.get(cacheKey);
    assert.equal(corruptGet, undefined, 'Corrupted MP4 in cache must be rejected');

    // 5. Invalidation
    await cache.invalidate(cacheKey);
    assert.equal(await cache.get(cacheKey), undefined);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('PHASE 6: End-to-End Resumable Segment Rendering & FFmpeg Concatenation (60s acceptance)', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'lumina-e2e-render-'));
  try {
    const planner = new LongFormSegmentPlannerV3();
    const sb = makeMockStoryboard(60);
    const manifest = planner.planSegments({ artifactId: 'art_e2e_60s', storyboard: sb });
    const artifact = makeMockApprovedArtifact(manifest.artifactId, sb);

    const cacheDir = join(tempDir, 'cache');
    const checkpointDir = join(tempDir, 'checkpoints');
    const outputDir = join(tempDir, 'outputs');

    const cache = new SegmentCacheV3({ cacheDir });
    const checkpointRepo = new RenderCheckpointRepositoryV3({ storageDir: checkpointDir });
    const worker = new SyntheticMediaFixtureWorkerV3();
    const coordinator = new LongFormRenderCoordinatorV3({ cache, checkpointRepo, worker });

    const jobId = 'job_test_resume_60s';

    // 1. First run: simulate failure at segment 1 (interruption)
    await assert.rejects(
      coordinator.render({
        manifest,
        artifact,
        authorizeArtifact: () => true,
        jobId,
        outputDir,
        simulateFailureAtSegment: 1
      }),
      /simulated_render_interruption_at_segment_1/
    );

    // Verify checkpoint recorded interruption
    const checkpoint = await checkpointRepo.load(jobId);
    assert.ok(checkpoint);
    assert.equal(checkpoint.status, 'interrupted');
    assert.ok(checkpoint.completedSegments >= 1, 'Previous completed segments must be preserved');

    // 2. Second run: resume rendering without failure
    const progressUpdates: number[] = [];
    const result = await coordinator.render({
      manifest,
      artifact,
      authorizeArtifact: () => true,
      jobId,
      outputDir,
      onProgress: (j) => progressUpdates.push(j.progress),
      subtitlesSrtContent: '1\n00:00:00,000 --> 00:00:30,000\nPhụ đề tiếng Việt phân đoạn 1\n\n2\n00:00:30,000 --> 00:01:00,000\nPhụ đề tiếng Việt phân đoạn 2\n'
    });

    assert.equal(result.job.status, 'completed');
    assert.equal(result.job.progress, 100);
    assert.ok(result.finalMp4Path);

    // 3. Inspect final MP4 with real FFprobe
    const probe = await probeMediaWithFFprobe(result.finalMp4Path);
    assert.equal(probe.width, 720);
    assert.equal(probe.height, 1280);
    assert.equal(probe.fps, 24);
    assert.equal(probe.videoCodec, 'h264');
    assert.ok(Math.abs(probe.durationSeconds - 60) <= 1.0, `Expected duration ~60s, got ${probe.durationSeconds}s`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('PHASE 6: 180-second multi-segment render acceptance', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'lumina-180s-render-'));
  try {
    const planner = new LongFormSegmentPlannerV3();
    const sb = makeMockStoryboard(180);
    const manifest = planner.planSegments({ artifactId: 'art_e2e_180s', storyboard: sb });
    const artifact = makeMockApprovedArtifact(manifest.artifactId, sb);

    const coordinator = new LongFormRenderCoordinatorV3({
      cache: new SegmentCacheV3({ cacheDir: join(tempDir, 'cache') }),
      checkpointRepo: new RenderCheckpointRepositoryV3({ storageDir: join(tempDir, 'checkpoints') }),
      worker: new SyntheticMediaFixtureWorkerV3()
    });

    const result = await coordinator.render({
      manifest,
      artifact,
      authorizeArtifact: () => true,
      jobId: 'job_180s',
      outputDir: join(tempDir, 'output')
    });

    assert.equal(result.job.status, 'completed');
    const probe = await probeMediaWithFFprobe(result.finalMp4Path);
    assert.equal(probe.width, 720);
    assert.equal(probe.height, 1280);
    assert.equal(probe.fps, 24);
    assert.ok(Math.abs(probe.durationSeconds - 180) <= 1.5, `Expected duration ~180s, got ${probe.durationSeconds}s`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('PHASE 6: 300-second (5 min) long-form multi-segment render acceptance with caching', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'lumina-300s-render-'));
  try {
    const planner = new LongFormSegmentPlannerV3();
    const sb = makeMockStoryboard(300);
    const manifest = planner.planSegments({ artifactId: 'art_e2e_300s', storyboard: sb });
    const artifact = makeMockApprovedArtifact(manifest.artifactId, sb);

    const cache = new SegmentCacheV3({ cacheDir: join(tempDir, 'cache') });
    const coordinator = new LongFormRenderCoordinatorV3({
      cache,
      checkpointRepo: new RenderCheckpointRepositoryV3({ storageDir: join(tempDir, 'checkpoints') }),
      worker: new SyntheticMediaFixtureWorkerV3()
    });

    const result = await coordinator.render({
      manifest,
      artifact,
      authorizeArtifact: () => true,
      jobId: 'job_300s',
      outputDir: join(tempDir, 'output')
    });

    assert.equal(result.job.status, 'completed');
    assert.equal(result.job.totalSegments, manifest.segments.length);
    const probe = await probeMediaWithFFprobe(result.finalMp4Path);
    assert.equal(probe.width, 720);
    assert.equal(probe.height, 1280);
    assert.equal(probe.fps, 24);
    assert.ok(Math.abs(probe.durationSeconds - 300) <= 2.0, `Expected duration ~300s, got ${probe.durationSeconds}s`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('PHASE 6: 600-second (10 min) masterclass segmented render and manifest continuity acceptance', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'lumina-600s-render-'));
  try {
    const planner = new LongFormSegmentPlannerV3();
    const sb = makeMockStoryboard(600);
    const manifest = planner.planSegments({ artifactId: 'art_e2e_600s', storyboard: sb });
    const artifact = makeMockApprovedArtifact(manifest.artifactId, sb);

    assert.equal(manifest.totalFrames, 14400); // 600s * 24fps
    assert.ok(manifest.segments.length >= 10);

    const coordinator = new LongFormRenderCoordinatorV3({
      cache: new SegmentCacheV3({ cacheDir: join(tempDir, 'cache') }),
      checkpointRepo: new RenderCheckpointRepositoryV3({ storageDir: join(tempDir, 'checkpoints') }),
      worker: new SyntheticMediaFixtureWorkerV3()
    });

    const result = await coordinator.render({
      manifest,
      artifact,
      authorizeArtifact: () => true,
      jobId: 'job_600s',
      outputDir: join(tempDir, 'output')
    });

    assert.equal(result.job.status, 'completed');
    const probe = await probeMediaWithFFprobe(result.finalMp4Path);
    assert.equal(probe.width, 720);
    assert.equal(probe.height, 1280);
    assert.equal(probe.fps, 24);
    assert.ok(Math.abs(probe.durationSeconds - 600) <= 3.0, `Expected duration ~600s, got ${probe.durationSeconds}s`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
