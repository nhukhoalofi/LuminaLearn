import assert from 'node:assert/strict';
import test from 'node:test';
import { RenderManifestV2Schema } from '@luminalearn/scene-schema';
import { evaluateDeterministicVisualLayout } from '../src/visual-qa';

function manifest(subtitleText = 'Phụ đề ngắn, rõ ràng.') {
  return RenderManifestV2Schema.parse({
    schemaVersion: 'manifest-v2', manifestId: 'manifest_qa', jobId: 'job_qa',
    topicId: 'calculus.derivative.intuition', lessonTitle: 'QA', language: 'vi', aspectRatio: '9:16',
    dimensions: { width: 720, height: 1280 }, fps: 24, totalFrames: 120,
    timeline: [
      { id: 'scene_formula', sceneType: 'formula', templateId: 'function_graph', startFrame: 0, durationFrames: 120, content: { title: 'Công thức', formulas: ['f\'(x)=2x'] }, parameters: { safeAreaPadding: 48 } }
    ], visualAssets: [], audioAssets: [],
    subtitleTrack: { trackId: 'track_qa', cues: [{ id: 'cue_qa', startFrame: 0, endFrame: 100, text: subtitleText }] },
    verifiedClaims: [], sourceReferences: []
  });
}

test('deterministic layout check passes a readable non-overlapping production fixture', () => {
  const checks = evaluateDeterministicVisualLayout(manifest());
  assert.deepEqual(checks.map((check) => check.status), ['pass', 'pass', 'pass']);
});

test('deterministic layout check catches an intentionally overlapping subtitle', () => {
  const longSubtitle = Array.from({ length: 55 }, () => 'nội dung').join(' ');
  const overlap = evaluateDeterministicVisualLayout(manifest(longSubtitle)).find((check) => check.id === 'subtitle_formula_overlap');
  assert.equal(overlap?.status, 'fail');
  assert.match(overlap?.evidence ?? '', /y=/);
});

test('deterministic layout check catches unreadable font configuration and unsafe margins', () => {
  const unsafe = manifest();
  unsafe.timeline[0].parameters.safeAreaPadding = 8;
  const checks = evaluateDeterministicVisualLayout(unsafe, { subtitleFontPx: 14 });
  assert.equal(checks.find((check) => check.id === 'safe_text_margins')?.status, 'fail');
  assert.equal(checks.find((check) => check.id === 'readable_font_size')?.status, 'fail');
});
