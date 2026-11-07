import assert from 'node:assert/strict';
import test from 'node:test';
import type { HybridTimelineScene, NarrationScript } from '@luminalearn/scene-schema';
import { buildSubtitleTrack, exportSrt } from '../src/subtitles';

const scenes: HybridTimelineScene[] = Array.from({ length: 5 }, (_, index) => ({
  id: `scene_${index}`, template: index === 0 ? 'hook' : index === 4 ? 'summary' : 'equation_explanation',
  startFrame: index * 192, durationFrames: 192, content: { title: 'Scene' }
} as HybridTimelineScene));
const narration: NarrationScript = {
  schemaVersion: 'narration-v1', topicId: 'calculus.derivative.intuition', language: 'vi', audience: 'Học sinh lớp 11', timingLevel: 'segment',
  mathematicalReview: { status: 'verified', verifiedClaimIds: ['claim_a', 'claim_b', 'claim_c', 'claim_d'] },
  segments: scenes.map((scene, index) => ({ id: `narration_${index}`, sceneId: scene.id, text: 'Lời dẫn.', subtitleText: `Đạo hàm tiếng Việt ${index}.`, targetDurationSeconds: 3, pronunciationHints: [] }))
};

test('subtitle builder maps narration to bounded segment-level timing', () => {
  const track = buildSubtitleTrack({ narration, scenes, burnedIn: true });
  assert.equal(track.cues[4].endFrame <= 960, true);
  assert.equal(track.timingLevel, 'segment');
});

test('subtitle cue uses verified synthesized segment duration when available', () => {
  const track = buildSubtitleTrack({ narration, scenes, burnedIn: true, audioAssets: [{
    id: 'audio_0', narrationSegmentId: 'narration_0', sceneId: 'scene_0',
    publicPath: 'generated/job-test-12345678/narration_0.mp3', startFrame: 0,
    durationFrames: 24, durationSeconds: 1, codec: 'mp3', sampleRate: 24000,
    channels: 1, verificationStatus: 'verified'
  }] });
  assert.equal(track.cues[0].endFrame, 24);
});

test('SRT export preserves Vietnamese UTF-8 and frame timestamps', () => {
  const srt = exportSrt(buildSubtitleTrack({ narration, scenes, burnedIn: true }));
  assert.match(srt, /00:00:00,000 --> 00:00:03,000/);
  assert.match(srt, /Đạo hàm tiếng Việt/);
  assert.equal(srt.endsWith('\n'), true);
});
