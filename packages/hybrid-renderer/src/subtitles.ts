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

function srtTimestamp(frame: number, fps = 24): string {
  const milliseconds = Math.round(frame * 1000 / fps);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor(milliseconds % 3_600_000 / 60_000);
  const seconds = Math.floor(milliseconds % 60_000 / 1000);
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
