import assert from 'node:assert/strict';
import test from 'node:test';
import { RenderManifestV2Schema } from '@luminalearn/scene-schema';
import { evaluateAudioTruthfulness, evaluateDeterministicVisualLayout } from '../src/visual-qa';

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

test('evaluateAudioTruthfulness separates audio_presence from audible_speech and detects silent fixtures vs live TTS failure', () => {
  // 1. Offline silent fixture (mock_tts) -> audio_presence: pass, audible_speech: requires_manual_review (silent_fixture)
  const [presenceMock, audibleMock] = evaluateAudioTruthfulness({
    hasAudioStream: true,
    ttsSelected: false,
    ttsProviderId: 'mock_tts',
    signal: {
      meanVolumeDb: -91.0,
      maxVolumeDb: -91.0,
      isSilent: true,
      audioClassification: 'silent_fixture'
    }
  });
  assert.equal(presenceMock.status, 'pass');
  assert.equal(audibleMock.status, 'requires_manual_review');
  assert.match(audibleMock.evidence, /silent_fixture/);

  // 2. Live TTS (gemini_tts) returning silence -> audible_speech: fail
  const [presenceLiveSilent, audibleLiveSilent] = evaluateAudioTruthfulness({
    hasAudioStream: true,
    ttsSelected: true,
    ttsProviderId: 'gemini_tts',
    signal: {
      meanVolumeDb: -91.0,
      maxVolumeDb: -91.0,
      isSilent: true,
      audioClassification: 'silent_fixture'
    }
  });
  assert.equal(presenceLiveSilent.status, 'pass');
  assert.equal(audibleLiveSilent.status, 'fail');
  assert.match(audibleLiveSilent.evidence, /silent_audio_error/);

  // 3. Non-silent audio signal -> audible_speech: requires_manual_review (or pass when confirmed)
  const [, audibleNonSilent] = evaluateAudioTruthfulness({
    hasAudioStream: true,
    ttsSelected: true,
    ttsProviderId: 'gemini_tts',
    signal: {
      meanVolumeDb: -18.4,
      maxVolumeDb: -3.2,
      isSilent: false,
      audioClassification: 'audible_non_silent'
    }
  });
  assert.equal(audibleNonSilent.status, 'requires_manual_review');
  assert.match(audibleNonSilent.evidence, /audible_non_silent/);
});
