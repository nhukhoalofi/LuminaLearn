import {
  RenderManifestV2Schema,
  type NarrationPlanV2,
  type RenderManifestV2,
  type StoryboardV2,
  type SupportedAspectRatio,
  type TimelineSceneV2,
  type VerifiedClaim
} from './contracts';
import { type SourceReference } from './document';

export type AssetAlignmentPolicy = 'adjust_timeline' | 'hold_last_frame' | 'strict';

export interface StoryboardCompilerOptions {
  jobId: string;
  lessonTitle: string;
  topicId: string;
  fps?: number;
  aspectRatio?: SupportedAspectRatio;
  verifiedClaims?: VerifiedClaim[];
  sourceReferences?: SourceReference[];
  assetAlignmentPolicy?: AssetAlignmentPolicy;
  maxHoldFrames?: number;
  assets?: Array<{
    id: string;
    publicPath: string;
    durationSeconds: number;
    frameCount: number;
    fps: number;
    width: number;
    height: number;
    codec: 'h264';
    pixelFormat: 'yuv420p';
  }>;
  audioAssets?: Array<{
    id: string;
    path: string;
    durationSeconds: number;
    codec: 'aac' | 'wav' | 'mp3';
    startFrame?: number;
  }>;
}

const DIMENSIONS_BY_ASPECT_RATIO: Record<SupportedAspectRatio, { width: number; height: number }> = {
  '9:16': { width: 720, height: 1280 },
  '16:9': { width: 1280, height: 720 },
  '1:1': { width: 1080, height: 1080 }
};

/**
 * Compiler V2 chuyển đổi StoryboardV2 và NarrationPlanV2 thành RenderManifestV2
 * - Động 100%: Không hardcode số lượng scene hay chủ đề.
 * - Phân bổ timeline liên tục, không khe hở (gap-free contiguous timeline).
 * - Kiểm tra tính toàn vẹn của asset video: khớp duration, chống black frame và lặp âm thầm.
 * - Tự động map phân đoạn lời dẫn thành subtitle track khớp khung hình cảnh.
 */
export function compileStoryboardV2(
  storyboard: StoryboardV2,
  narrationPlan: NarrationPlanV2,
  options: StoryboardCompilerOptions
): RenderManifestV2 {
  const fps = options.fps ?? 24;
  const aspectRatio = options.aspectRatio ?? '9:16';
  const dimensions = DIMENSIONS_BY_ASPECT_RATIO[aspectRatio];
  const policy: AssetAlignmentPolicy = options.assetAlignmentPolicy ?? 'adjust_timeline';
  const maxHoldFrames = options.maxHoldFrames ?? 48; // Tối đa 2 giây hold frame

  let currentFrame = 0;
  const timeline: TimelineSceneV2[] = [];
  const subtitleCues: Array<{ id: string; startFrame: number; endFrame: number; text: string }> = [];

  const narrationMap = new Map(narrationPlan.segments.map((seg) => [seg.sceneId, seg]));

  for (let index = 0; index < storyboard.scenes.length; index++) {
    const sceneSpec = storyboard.scenes[index];
    const startFrame = currentFrame;
    let durationFrames = sceneSpec.durationFrames;

    // Tìm asset clip nếu có cho cảnh animation hoặc khớp sceneId
    const asset = options.assets?.find(
      (a) => a.id === `asset_${sceneSpec.sceneId}` || (sceneSpec.sceneType === 'animation' && a.id === 'asset_manim')
    );

    if (asset) {
      if (asset.frameCount !== durationFrames) {
        if (policy === 'strict') {
          throw new Error(
            `media_timeline_mismatch: Asset '${asset.id}' frameCount (${asset.frameCount}) does not match scene '${sceneSpec.sceneId}' duration (${durationFrames} frames) under strict policy`
          );
        } else if (policy === 'hold_last_frame') {
          if (asset.frameCount > durationFrames) {
            throw new Error(
              `media_timeline_mismatch: Asset '${asset.id}' frameCount (${asset.frameCount}) exceeds scene '${sceneSpec.sceneId}' duration (${durationFrames} frames) under hold_last_frame policy`
            );
          }
          const diff = durationFrames - asset.frameCount;
          if (diff > maxHoldFrames) {
            throw new Error(
              `media_timeline_mismatch: Hold frame duration of ${diff} frames exceeds max allowed hold of ${maxHoldFrames} frames`
            );
          }
          // Giữ nguyên durationFrames, video sẽ hold frame cuối
        } else {
          // Default: adjust_timeline — Điều chỉnh timeline theo đúng frame count thực tế của verified asset
          durationFrames = asset.frameCount;
        }
      }
    }

    const endFrame = startFrame + durationFrames;

    // Gắn narration tương ứng và xác thực biên phụ đề (Subtitle boundary validation)
    const narration = narrationMap.get(sceneSpec.sceneId);
    if (narration) {
      subtitleCues.push({
        id: `cue_${sceneSpec.sceneId}`,
        startFrame,
        endFrame,
        text: narration.subtitleText
      });
    }

    const formulas = sceneSpec.mathematicalBinding?.latexFormulas ?? [];
    const contentTitle = (sceneSpec.parameters?.title as string) || `Phân đoạn ${index + 1}: ${sceneSpec.templateId}`;
    const contentBody = (sceneSpec.parameters?.description as string) || (sceneSpec.parameters?.body as string) || '';

    timeline.push({
      id: sceneSpec.sceneId,
      sceneType: sceneSpec.sceneType,
      templateId: sceneSpec.templateId,
      startFrame,
      durationFrames,
      assetId: asset?.id,
      content: {
        eyebrow: (sceneSpec.parameters?.eyebrow as string) || undefined,
        title: contentTitle,
        body: contentBody,
        formulas
      },
      parameters: sceneSpec.parameters
    });

    currentFrame += durationFrames;
  }

  const manifestData: RenderManifestV2 = {
    schemaVersion: 'manifest-v2',
    manifestId: `manifest_${options.jobId}`,
    jobId: options.jobId,
    topicId: options.topicId,
    lessonTitle: options.lessonTitle,
    language: narrationPlan.language,
    aspectRatio,
    dimensions,
    fps,
    totalFrames: currentFrame,
    timeline,
    visualAssets: options.assets ?? [],
    audioAssets: (options.audioAssets ?? []).map((a) => ({
      id: a.id,
      path: a.path,
      durationSeconds: a.durationSeconds,
      codec: a.codec,
      startFrame: a.startFrame ?? 0
    })),
    subtitleTrack: subtitleCues.length > 0 ? {
      trackId: `subtitles_${options.jobId}`,
      cues: subtitleCues
    } : undefined,
    verifiedClaims: options.verifiedClaims ?? [],
    sourceReferences: options.sourceReferences ?? []
  };

  return RenderManifestV2Schema.parse(manifestData);
}

