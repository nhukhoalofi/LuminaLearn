import assert from 'node:assert/strict';
import test from 'node:test';
import { NarrationScriptSchema, SubtitleTrackSchema } from '../src/index';

const segments = Array.from({ length: 5 }, (_, index) => ({
  id: `narration_${index}`, sceneId: `scene_${index}`, text: 'Lời dẫn toán học rõ ràng.',
  subtitleText: 'Phụ đề tiếng Việt có dấu.', targetDurationSeconds: 3, pronunciationHints: []
}));

test('NarrationScript accepts five reviewed scene segments', () => {
  const parsed = NarrationScriptSchema.parse({
    schemaVersion: 'narration-v1', topicId: 'calculus.derivative.intuition', language: 'vi',
    audience: 'Học sinh lớp 11', timingLevel: 'segment',
    mathematicalReview: { status: 'verified', verifiedClaimIds: ['claim_a', 'claim_b', 'claim_c', 'claim_d'] }, segments
  });
  assert.equal(parsed.segments.length, 5);
});

test('NarrationScript rejects duplicated scene narration', () => {
  assert.throws(() => NarrationScriptSchema.parse({
    schemaVersion: 'narration-v1', topicId: 'calculus.derivative.intuition', language: 'vi',
    audience: 'Học sinh lớp 11', timingLevel: 'segment',
    mathematicalReview: { status: 'verified', verifiedClaimIds: ['claim_a', 'claim_b', 'claim_c', 'claim_d'] },
    segments: segments.map((segment) => ({ ...segment, sceneId: 'scene_same' }))
  }), /Each scene must have one narration segment/);
});

test('SubtitleTrack rejects negative, reversed, overflowing and overlapping cues', () => {
  const base = { schemaVersion: 'subtitles-v1', language: 'vi', timingLevel: 'segment', burnedIn: true };
  assert.equal(SubtitleTrackSchema.safeParse({ ...base, cues: [{ id: 'subtitle_a', text: 'A', startFrame: -1, endFrame: 2, sceneId: 'scene_a' }] }).success, false);
  assert.equal(SubtitleTrackSchema.safeParse({ ...base, cues: [{ id: 'subtitle_a', text: 'A', startFrame: 4, endFrame: 3, sceneId: 'scene_a' }] }).success, false);
  assert.equal(SubtitleTrackSchema.safeParse({ ...base, cues: [{ id: 'subtitle_a', text: 'A', startFrame: 959, endFrame: 961, sceneId: 'scene_a' }] }).success, false);
  assert.equal(SubtitleTrackSchema.safeParse({ ...base, cues: [
    { id: 'subtitle_a', text: 'A', startFrame: 0, endFrame: 20, sceneId: 'scene_a' },
    { id: 'subtitle_b', text: 'B', startFrame: 19, endFrame: 30, sceneId: 'scene_b' }
  ] }).success, false);
});
