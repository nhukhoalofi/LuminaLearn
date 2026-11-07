import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HybridTimelineScene, NarrationScript } from '@luminalearn/scene-schema';
import { synthesizeNarration, validateAudioProbe, type TtsProvider } from '../src/audio';

test('audio probe accepts supported provided MP3 metadata', () => {
  assert.deepEqual(validateAudioProbe({ streams: [{ codec_name: 'mp3', sample_rate: '24000', channels: 1 }], format: { duration: '7.5', size: '12000' } }), {
    codec: 'mp3', durationSeconds: 7.5, sampleRate: 24000, channels: 1, sizeBytes: 12000
  });
});

test('audio duration and codec validation fail closed', () => {
  assert.throws(() => validateAudioProbe({ streams: [{ codec_name: 'opus', sample_rate: '48000', channels: 2 }], format: { duration: '2', size: '12' } }), /unsupported codec/);
  assert.throws(() => validateAudioProbe({ streams: [{ codec_name: 'mp3', sample_rate: '24000', channels: 1 }], format: { duration: '41', size: '12' } }), /audio_duration_invalid/);
});

function silentWav(durationSeconds = 0.2): Buffer {
  const sampleRate = 16_000;
  const dataSize = Math.floor(sampleRate * durationSeconds) * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + dataSize, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

test('mock TTS provider synthesizes each segment without external calls', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lumina-audio-'));
  const jobDirectory = join(root, 'job'); const stagedDirectory = join(root, 'public');
  mkdirSync(jobDirectory); mkdirSync(stagedDirectory);
  let calls = 0;
  const provider: TtsProvider = { id: 'mock', async synthesize(_text, outputPath) { calls += 1; writeFileSync(outputPath, silentWav()); } };
  const scenes: HybridTimelineScene[] = Array.from({ length: 5 }, (_, index) => ({
    id: `scene_${index}`, template: index === 0 ? 'hook' : index === 4 ? 'summary' : 'equation_explanation',
    startFrame: index * 192, durationFrames: 192, content: { title: 'Scene' }
  } as HybridTimelineScene));
  const narration: NarrationScript = {
    schemaVersion: 'narration-v1', topicId: 'calculus.derivative.intuition', language: 'vi', audience: 'Học sinh lớp 11', timingLevel: 'segment',
    mathematicalReview: { status: 'verified', verifiedClaimIds: ['claim_a', 'claim_b', 'claim_c', 'claim_d'] },
    segments: scenes.map((scene, index) => ({ id: `narration_${index}`, sceneId: scene.id, text: 'Lời dẫn.', subtitleText: 'Phụ đề.', targetDurationSeconds: 3, pronunciationHints: [] }))
  };
  const assets = await synthesizeNarration({ provider, narration, scenes, jobId: 'job-test-12345678', jobDirectory, stagedDirectory });
  assert.equal(calls, 5);
  assert.equal(assets.length, 5);
  assert.equal(assets.every((asset) => asset.verificationStatus === 'verified'), true);
});
