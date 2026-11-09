import { SubtitleTrackSchema, type HybridTimelineScene, type NarrationAudioAsset, type NarrationScript, type SubtitleTrack } from '@luminalearn/scene-schema';

export function buildSubtitleTrack(options: {
  narration: NarrationScript;
  scenes: HybridTimelineScene[];
  burnedIn: boolean;
  audioAssets?: NarrationAudioAsset[];
}): SubtitleTrack {
  const scenes = new Map(options.scenes.map((scene) => [scene.id, scene]));
  const audioBySegment = new Map((options.audioAssets ?? []).flatMap((asset) => asset.narrationSegmentId ? [[asset.narrationSegmentId, asset] as const] : []));
  return SubtitleTrackSchema.parse({
    schemaVersion: 'subtitles-v1', language: 'vi', timingLevel: 'segment', burnedIn: options.burnedIn,
    cues: options.narration.segments.map((segment, index) => {
      const scene = scenes.get(segment.sceneId);
      if (!scene) throw new Error(`subtitle_scene_missing: ${segment.sceneId}`);
      const targetFrames = audioBySegment.get(segment.id)?.durationFrames ?? Math.max(1, Math.round(segment.targetDurationSeconds * 24));
      return {
        id: `subtitle_${String(index + 1).padStart(2, '0')}`,
        text: segment.subtitleText,
        startFrame: scene.startFrame,
        endFrame: Math.min(scene.startFrame + scene.durationFrames, scene.startFrame + targetFrames),
        sceneId: scene.id,
        narrationSegmentId: segment.id
      };
    })
  });
}

export function srtTimestamp(frame: number, fps = 24): string {
  const milliseconds = Math.round(frame * 1000 / fps);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

export function exportSrt(trackInput: SubtitleTrack): string {
  const track = SubtitleTrackSchema.parse(trackInput);
  return `${track.cues.map((cue, index) => [
    String(index + 1),
    `${srtTimestamp(cue.startFrame)} --> ${srtTimestamp(cue.endFrame)}`,
    cue.text,
    ''
  ].join('\n')).join('\n')}\n`;
}

/**
 * P0 0.B: Generates SubRip (.srt) subtitles automatically from an approved educational storyboard.
 * Cues use exact integer-frame positions, prevent drift and overlaps, and do not exceed total duration.
 */
export function generateSrtFromStoryboardV3(
  storyboard: {
    totalDurationSeconds: number;
    scenes: Array<{
      durationSeconds: number;
      narration?: { subtitleVietnamese?: string; vietnamese?: string };
    }>;
  },
  fps = 24
): string {
  let currentFrame = 0;
  const maxFrames = Math.max(1, Math.round(storyboard.totalDurationSeconds * fps));
  const cues: string[] = [];
  let cueIndex = 1;

  for (const scene of storyboard.scenes) {
    const durationFrames = Math.max(1, Math.round(scene.durationSeconds * fps));
    const startFrame = currentFrame;
    const rawEndFrame = startFrame + durationFrames;
    const endFrame = Math.min(rawEndFrame, maxFrames);
    currentFrame = rawEndFrame;

    const text = (scene.narration?.subtitleVietnamese || scene.narration?.vietnamese || '').trim();
    if (!text) continue;
    if (startFrame >= maxFrames) break;

    cues.push(
      [
        String(cueIndex),
        `${srtTimestamp(startFrame, fps)} --> ${srtTimestamp(endFrame, fps)}`,
        text,
        ''
      ].join('\n')
    );
    cueIndex++;
  }

  return cues.length > 0 ? cues.join('\n') + '\n' : '';
}
