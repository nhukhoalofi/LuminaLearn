/**
 * Authoritative V3 timeline normalization.
 *
 * This module is deliberately temporal-only: it may redistribute frames, but it
 * must never invent, split, rename, or otherwise rewrite approved lesson content.
 */
import {
  EducationalSceneV3Schema,
  type EducationalChapterV3,
  type EducationalSceneV3,
  type TopicCapabilityReportV3,
  framesToSeconds,
  secondsToFrames
} from '@luminalearn/scene-schema';

export type TimelineNormalizationStatusV3 = 'PASS' | 'NEEDS_REVIEW' | 'BLOCKED';

export interface TimelineFindingV3 {
  code: string;
  status: TimelineNormalizationStatusV3;
  message: string;
  sceneId?: string;
}

export class TimelineNormalizationError extends Error {
  public readonly code: string;
  public readonly status: Exclude<TimelineNormalizationStatusV3, 'PASS'>;
  public readonly findings: TimelineFindingV3[];

  constructor(
    code: string,
    status: Exclude<TimelineNormalizationStatusV3, 'PASS'>,
    message: string,
    findings: TimelineFindingV3[] = [{ code, status, message }]
  ) {
    super(message);
    this.name = 'TimelineNormalizationError';
    this.code = code;
    this.status = status;
    this.findings = findings;
  }
}

export interface NormalizeTimelineOptionsV3 {
  rawScenes: unknown[];
  targetDurationSeconds: number;
  fps?: number;
  capability?: TopicCapabilityReportV3;
  maxSceneDurationSeconds?: number;
  minSceneDurationSeconds?: number;
  measuredNarrationDurationSeconds?: number;
  narrationToleranceSeconds?: number;
}

export interface NormalizedTimelineResultV3 {
  success: true;
  status: 'PASS';
  scenes: EducationalSceneV3[];
  totalDurationSeconds: number;
  totalFrames: number;
  chapters: EducationalChapterV3[];
  findings: TimelineFindingV3[];
}

function finding(
  code: string,
  status: Exclude<TimelineNormalizationStatusV3, 'PASS'>,
  message: string,
  sceneId?: string
): TimelineFindingV3 {
  return sceneId === undefined ? { code, status, message } : { code, status, message, sceneId };
}

function reject(
  code: string,
  status: Exclude<TimelineNormalizationStatusV3, 'PASS'>,
  message: string,
  sceneId?: string
): never {
  throw new TimelineNormalizationError(code, status, message, [finding(code, status, message, sceneId)]);
}

function validateSourceScene(raw: unknown, index: number): EducationalSceneV3 {
  if (!raw || typeof raw !== 'object') {
    return reject('timeline_scene_invalid', 'BLOCKED', `Scene at index ${index} is not an object.`);
  }
  const candidate = raw as Record<string, unknown>;
  const sceneId = typeof candidate.sceneId === 'string' ? candidate.sceneId : undefined;
  const duration = candidate.durationSeconds;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
    return reject(
      'timeline_scene_duration_invalid',
      'BLOCKED',
      `Scene ${sceneId ?? index} has an invalid duration; content must be revised explicitly.`,
      sceneId
    );
  }

  // Validate every semantic field while allowing the temporal allocator to repair
  // an oversized source duration. No content field is synthesized here.
  const parsed = EducationalSceneV3Schema.safeParse({ ...candidate, durationSeconds: Math.min(duration, 120) });
  if (!parsed.success) {
    return reject(
      'timeline_scene_content_invalid',
      'BLOCKED',
      `Scene ${sceneId ?? index} is not schema-valid: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
      sceneId
    );
  }
  return { ...parsed.data, durationSeconds: duration };
}

function allocateFrames(
  durations: number[],
  targetFrames: number,
  minFrames: number,
  maxFrames: number,
  fps: number
): number[] {
  const minimumCapacity = durations.length * minFrames;
  const maximumCapacity = durations.length * maxFrames;
  if (targetFrames < minimumCapacity || targetFrames > maximumCapacity) {
    return reject(
      'timeline_insufficient_scene_capacity',
      'NEEDS_REVIEW',
      `The ${durations.length} approved scenes can cover ${framesToSeconds(minimumCapacity, fps)}-${framesToSeconds(maximumCapacity, fps)} seconds, not the requested timeline.`
    );
  }

  const sourceTotal = durations.reduce((sum, duration) => sum + duration, 0);
  const exact = durations.map((duration) => (duration / sourceTotal) * targetFrames);
  const allocated = exact.map((value) => Math.max(minFrames, Math.min(maxFrames, Math.floor(value))));
  let remaining = targetFrames - allocated.reduce((sum, frames) => sum + frames, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .map(({ index }) => index);

  // Bounded deterministic apportionment. It either conserves all frames or fails.
  while (remaining !== 0) {
    const direction = remaining > 0 ? 1 : -1;
    let changed = false;
    for (const index of direction > 0 ? order : [...order].reverse()) {
      const next = allocated[index] + direction;
      if (next < minFrames || next > maxFrames) continue;
      allocated[index] = next;
      remaining -= direction;
      changed = true;
      if (remaining === 0) break;
    }
    if (!changed) {
      return reject(
        'timeline_frame_conservation_failed',
        'BLOCKED',
        'Unable to conserve the exact target frame count within scene duration bounds.'
      );
    }
  }
  return allocated;
}

/** Creates one pending temporal chapter per approved scene. */
export function buildChaptersForScenes(
  scenes: Array<{
    sceneId: string;
    title: string;
    pedagogicalGoal: string;
    durationSeconds: number;
    boundClaimIds?: string[];
  }>,
  _totalDurationSeconds: number,
  fps = 24
): EducationalChapterV3[] {
  let frameCursor = 0;
  return scenes.map((scene, chapterIndex) => {
    const durationFrames = secondsToFrames(scene.durationSeconds, fps);
    const startFrame = frameCursor;
    const endFrame = startFrame + durationFrames;
    frameCursor = endFrame;
    return {
      chapterId: `chap_${String(chapterIndex + 1).padStart(2, '0')}`,
      chapterIndex,
      chapterTitle: scene.title,
      learningObjectives: [scene.pedagogicalGoal],
      pedagogicalIntent: scene.pedagogicalGoal,
      startFrame,
      endFrame,
      durationFrames,
      durationSeconds: framesToSeconds(durationFrames, fps),
      sections: [],
      sceneIds: [scene.sceneId],
      keyConcepts: [scene.title],
      formalClaimIds: scene.boundClaimIds ?? [],
      narrationPlan: { overview: scene.title, speakingRateCharsPerSec: 14 },
      validationStatus: 'pending'
    };
  });
}

export function normalizeStoryboardTimelineV3(
  options: NormalizeTimelineOptionsV3
): NormalizedTimelineResultV3 {
  const fps = options.fps ?? 24;
  // The scene schema has no five-second minimum; one frame is the smallest
  // representable positive scene and preserves valid compact recap plans.
  const minSeconds = options.minSceneDurationSeconds ?? 1 / fps;
  const maxSeconds = options.maxSceneDurationSeconds ?? 120;
  if (!Number.isInteger(fps) || fps <= 0) {
    return reject('timeline_fps_invalid', 'BLOCKED', 'FPS must be a positive integer.');
  }
  if (!Number.isFinite(options.targetDurationSeconds) || options.targetDurationSeconds <= 0) {
    return reject('timeline_target_invalid', 'BLOCKED', 'Target duration must be a finite positive number.');
  }
  if (!Array.isArray(options.rawScenes) || options.rawScenes.length === 0) {
    return reject('timeline_scenes_empty', 'BLOCKED', 'Storyboard must contain approved scenes.');
  }
  if (!(minSeconds > 0 && maxSeconds >= minSeconds && maxSeconds <= 120)) {
    return reject('timeline_bounds_invalid', 'BLOCKED', 'Scene bounds must satisfy 0 < min <= max <= 120 seconds.');
  }

  const sourceScenes = options.rawScenes.map(validateSourceScene);
  const seen = new Set<string>();
  for (const scene of sourceScenes) {
    if (seen.has(scene.sceneId)) {
      return reject(
        'timeline_duplicate_scene_id',
        'BLOCKED',
        `Duplicate sceneId '${scene.sceneId}' must be resolved by the author.`,
        scene.sceneId
      );
    }
    seen.add(scene.sceneId);
  }

  if (options.measuredNarrationDurationSeconds !== undefined) {
    const measured = options.measuredNarrationDurationSeconds;
    const tolerance = options.narrationToleranceSeconds ?? 0.5;
    if (!Number.isFinite(measured) || measured < 0) {
      return reject('timeline_narration_duration_invalid', 'BLOCKED', 'Measured narration duration is invalid.');
    }
    if (measured > options.targetDurationSeconds + tolerance) {
      return reject(
        'timeline_narration_exceeds_target',
        'NEEDS_REVIEW',
        `Measured narration (${measured}s) exceeds the target timeline (${options.targetDurationSeconds}s).`
      );
    }
  }

  const targetFrames = secondsToFrames(options.targetDurationSeconds, fps);
  const allocations = allocateFrames(
    sourceScenes.map((scene) => scene.durationSeconds),
    targetFrames,
    secondsToFrames(minSeconds, fps),
    secondsToFrames(maxSeconds, fps),
    fps
  );
  const scenes = sourceScenes.map((scene, index) =>
    EducationalSceneV3Schema.parse({
      ...scene,
      durationSeconds: framesToSeconds(allocations[index], fps)
    })
  );
  const conservedFrames = scenes.reduce(
    (total, scene) => total + secondsToFrames(scene.durationSeconds, fps),
    0
  );
  if (conservedFrames !== targetFrames) {
    return reject(
      'timeline_frame_conservation_failed',
      'BLOCKED',
      `Normalized scenes contain ${conservedFrames} frames; expected ${targetFrames}.`
    );
  }

  const chapters = buildChaptersForScenes(scenes, options.targetDurationSeconds, fps);
  if ((chapters.at(-1)?.endFrame ?? 0) !== targetFrames) {
    return reject('timeline_chapter_continuity_failed', 'BLOCKED', 'Chapter boundaries do not cover the timeline exactly.');
  }
  return {
    success: true,
    status: 'PASS',
    scenes,
    totalDurationSeconds: options.targetDurationSeconds,
    totalFrames: targetFrames,
    chapters,
    findings: []
  };
}
