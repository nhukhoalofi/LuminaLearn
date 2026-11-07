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

export interface StoryboardCompilerOptions {
  jobId: string;
  lessonTitle: string;
  topicId: string;
  fps?: number;
  aspectRatio?: SupportedAspectRatio;
  verifiedClaims?: VerifiedClaim[];
  sourceReferences?: SourceReference[];
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
 * - Tự động map phân đoạn lời dẫn thành subtitle track khớp khung hình.
 */
export function compileStoryboardV2(
  storyboard: StoryboardV2,
  narrationPlan: NarrationPlanV2,
  options: StoryboardCompilerOptions
): RenderManifestV2 {
  const fps = options.fps ?? 24;
  const aspectRatio = options.aspectRatio ?? '9:16';
  const dimensions = DIMENSIONS_BY_ASPECT_RATIO[aspectRatio];

  let currentFrame = 0;
  const timeline: TimelineSceneV2[] = [];
  const subtitleCues: Array<{ id: string; startFrame: number; endFrame: number; text: string }> = [];

  const narrationMap = new Map(narrationPlan.segments.map((seg) => [seg.sceneId, seg]));

  for (let index = 0; index < storyboard.scenes.length; index++) {
    const sceneSpec = storyboard.scenes[index];
    const startFrame = currentFrame;
    const durationFrames = sceneSpec.durationFrames;
    const endFrame = startFrame + durationFrames;

    // Gắn narration tương ứng nếu có
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

    // Tìm asset clip nếu có cho cảnh animation hoặc khớp sceneId
    const asset = options.assets?.find(
      (a) => a.id === `asset_${sceneSpec.sceneId}` || (sceneSpec.sceneType === 'animation' && a.id === 'asset_manim')
    );

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
    audioAssets: [],
    subtitleTrack: subtitleCues.length > 0 ? {
      trackId: `subtitles_${options.jobId}`,
      cues: subtitleCues
    } : undefined,
    verifiedClaims: options.verifiedClaims ?? [],
    sourceReferences: options.sourceReferences ?? []
  };

  return RenderManifestV2Schema.parse(manifestData);
}

