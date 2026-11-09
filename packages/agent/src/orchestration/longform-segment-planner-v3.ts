import { createHash, randomUUID } from 'node:crypto';
import {
  SegmentManifestV3Schema,
  type SegmentManifestV3,
  type RenderSegmentV3,
  type EducationalStoryboardV3,
  type LongFormStoryboardV3,
  secondsToFrames,
  framesToSeconds
} from '@luminalearn/scene-schema';
import { canonicalJsonStringify } from './draft-manager';

export interface PlanSegmentsOptions {
  artifactId: string;
  storyboard: EducationalStoryboardV3 | LongFormStoryboardV3;
  targetSegmentDurationSeconds?: number;
  fps?: 24;
  width?: 720;
  height?: 1280;
}

export class LongFormSegmentPlannerV3 {
  /**
   * CHECKPOINT C: Deterministic segmentation of a long-form storyboard into
   * contiguous, non-overlapping 15–45 second render segments with exact frame math.
   */
  public planSegments(options: PlanSegmentsOptions): SegmentManifestV3 {
    const {
      artifactId,
      storyboard,
      targetSegmentDurationSeconds = 30,
      fps = 24,
      width = 720,
      height = 1280
    } = options;

    if (!storyboard.scenes || storyboard.scenes.length === 0) {
      throw new Error('segment_planner_empty_storyboard: Storyboard contains no scenes');
    }

    const minSegmentFrames = secondsToFrames(15, fps); // 360 frames
    const maxSegmentFrames = secondsToFrames(45, fps); // 1080 frames
    const targetSegmentFrames = secondsToFrames(targetSegmentDurationSeconds, fps); // 720 frames

    const totalSeconds = storyboard.totalDurationSeconds;
    const totalFrames = secondsToFrames(totalSeconds, fps);

    // Group scenes into segments
    const segments: RenderSegmentV3[] = [];
    let currentSegmentScenes: typeof storyboard.scenes = [];
    let currentSegmentFrames = 0;
    let globalFrameCursor = 0;
    let segmentIndex = 0;

    const manifestPrefix = `man_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

    for (let i = 0; i < storyboard.scenes.length; i++) {
      const scene = storyboard.scenes[i];
      const sceneFrames = secondsToFrames(scene.durationSeconds, fps);
      const isLastScene = i === storyboard.scenes.length - 1;

      currentSegmentScenes.push(scene);
      currentSegmentFrames += sceneFrames;

      const shouldFlush =
        isLastScene ||
        currentSegmentFrames >= targetSegmentFrames ||
        currentSegmentFrames + (i + 1 < storyboard.scenes.length ? secondsToFrames(storyboard.scenes[i + 1].durationSeconds, fps) : 0) > maxSegmentFrames;

      if (shouldFlush && currentSegmentScenes.length > 0) {
        const segStart = globalFrameCursor;
        const segEnd = globalFrameCursor + currentSegmentFrames;
        const segDurationFrames = currentSegmentFrames;
        const segDurationSeconds = framesToSeconds(segDurationFrames, fps);

        const sceneIds = currentSegmentScenes.map((s) => s.sceneId);
        const chapterId = `chap_${Math.floor(segmentIndex / 2)}`;

        // Hash content for exact caching
        const contentPayload = {
          scenes: currentSegmentScenes,
          startFrame: segStart,
          endFrame: segEnd,
          durationFrames: segDurationFrames,
          fps
        };
        const inputContentHash = createHash('sha256')
          .update(canonicalJsonStringify(contentPayload), 'utf8')
          .digest('hex');

        const cacheKey = createHash('sha256')
          .update(canonicalJsonStringify({ inputContentHash, fps, width, height, rendererVersion: '3.0.0' }), 'utf8')
          .digest('hex');

        const segmentId = `seg_${manifestPrefix.slice(4, 12)}_${String(segmentIndex).padStart(2, '0')}`;
        segments.push({
          segmentId,
          segmentIndex,
          chapterId,
          sceneIds,
          startFrame: segStart,
          endFrame: segEnd,
          durationFrames: segDurationFrames,
          durationSeconds: segDurationSeconds,
          inputContentHash,
          status: 'pending',
          attemptCount: 0,
          cacheKey
        });

        globalFrameCursor = segEnd;
        currentSegmentScenes = [];
        currentSegmentFrames = 0;
        segmentIndex++;
      }
    }

    // Invariant checks
    if (globalFrameCursor !== totalFrames) {
      throw new Error(
        `segment_planner_frame_mismatch: Segment total frames (${globalFrameCursor}) does not equal expected totalFrames (${totalFrames})`
      );
    }

    // Compute manifest fingerprint
    const contentFingerprint = createHash('sha256')
      .update(canonicalJsonStringify({ segments, artifactId, totalFrames, fps, width, height }), 'utf8')
      .digest('hex');

    const manifest: SegmentManifestV3 = {
      manifestId: manifestPrefix,
      artifactId,
      targetDurationSeconds: totalSeconds,
      totalFrames,
      fps,
      width,
      height,
      segments,
      contentFingerprint,
      createdAt: new Date().toISOString()
    };

    return SegmentManifestV3Schema.parse(manifest);
  }
}

