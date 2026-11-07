import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  GeminiTtsProvider,
  buildSpokenNarrationText,
  probeAudio,
  type GeminiAudioClient,
  type GeminiSpeechRequest,
  type GeminiSpeechResponse
} from '../src';
import { compileStoryboardV2, type NarrationPlanV2, type StoryboardV2 } from '@luminalearn/scene-schema';
import { synthesizeNarrationV2 } from '../src/audio';

function wavFixture(durationSeconds = 1, sampleRate = 24_000): Buffer {
  const dataLength = Math.round(durationSeconds * sampleRate) * 2;
  const wav = Buffer.alloc(44 + dataLength);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(36 + dataLength, 4);
  wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(dataLength, 40);
  return wav;
}

class FakeGeminiAudioClient implements GeminiAudioClient {
  readonly requests: GeminiSpeechRequest[] = [];
  readonly checkedModels: string[] = [];

  constructor(private readonly response: GeminiSpeechResponse | Error) {}

  async assertModelAvailable(model: string): Promise<void> {
    this.checkedModels.push(model);
  }

  async generateSpeech(request: GeminiSpeechRequest): Promise<GeminiSpeechResponse> {
    this.requests.push(request);
    if (this.response instanceof Error) throw this.response;
    return this.response;
  }
}

describe('Gemini TTS provider (offline fake client)', () => {
  it('selects the configured model/voice, decodes WAV, normalizes MP3, and reports real duration', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lumina-gemini-tts-'));
    try {
      const client = new FakeGeminiAudioClient({ data: wavFixture(1), mimeType: 'audio/wav' });
      const provider = new GeminiTtsProvider({
        client,
        model: 'gemini-3.8-flash-lite-tts',
        voice: 'Kore',
        language: 'vi',
        retryBaseDelayMs: 1
      });
      const output = join(directory, 'narration.mp3');

      await provider.synthesize('x bình phương', output);

      assert.deepEqual(client.checkedModels, ['gemini-3.8-flash-lite-tts']);
      assert.equal(client.requests.length, 1);
      assert.equal(client.requests[0].model, 'gemini-3.8-flash-lite-tts');
      assert.equal(client.requests[0].voice, 'Kore');
      assert.equal(client.requests[0].languageCode, 'vi-VN');
      assert.equal(client.requests[0].text, 'x bình phương');
      const metadata = await probeAudio(output, 5);
      assert.equal(metadata.codec, 'mp3');
      assert.ok(Math.abs(metadata.durationSeconds - 1) < 0.1);
      assert.deepEqual((await readdir(directory)).filter((name) => name.startsWith('.gemini-tts-')), []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('fails explicitly for missing API key and unsupported model', () => {
    assert.throws(
      () => new GeminiTtsProvider({ apiKey: '', model: 'gemini-3.8-flash-lite-tts' }),
      /tts_api_key_missing/
    );
    assert.throws(
      () => new GeminiTtsProvider({ client: new FakeGeminiAudioClient({ data: wavFixture(), mimeType: 'audio\/wav' }), model: 'gemini-not-a-tts-model' }),
      /tts_model_unsupported/
    );
  });

  it('rejects empty or incorrectly declared audio and cleans temporary files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lumina-gemini-invalid-'));
    try {
      const empty = new GeminiTtsProvider({
        client: new FakeGeminiAudioClient({ data: '', mimeType: 'audio/wav' }),
        retryBaseDelayMs: 1
      });
      await assert.rejects(() => empty.synthesize('Nội dung', join(directory, 'empty.mp3')), /tts_empty_audio/);

      const invalid = new GeminiTtsProvider({
        client: new FakeGeminiAudioClient({ data: Buffer.from('not wav'), mimeType: 'audio/wav' }),
        retryBaseDelayMs: 1
      });
      await assert.rejects(() => invalid.synthesize('Nội dung', join(directory, 'invalid.mp3')), /tts_invalid_audio_format/);
      assert.deepEqual((await readdir(directory)).filter((name) => name.startsWith('.gemini-tts-')), []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('never leaks the API key through provider errors', async () => {
    const secret = 'secret-test-key-never-log';
    const client = new FakeGeminiAudioClient(new Error(`request failed using ${secret}`));
    const provider = new GeminiTtsProvider({ apiKey: secret, client, maxAttempts: 1 });
    await assert.rejects(
      () => provider.synthesize('Nội dung', join(tmpdir(), `lumina-${Date.now()}.mp3`)),
      (error: Error) => error.message.includes('[REDACTED]') && !error.message.includes(secret)
    );
  });

  it('uses one finalized timeline for Gemini audio positions and subtitles', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lumina-gemini-timeline-'));
    try {
      const storyboard: StoryboardV2 = {
        storyboardId: 'sb_gemini_timeline', lessonId: 'lesson_gemini_timeline',
        topicId: 'calculus.derivative.intuition',
        scenes: [
          { sceneId: 'scene_a', templateId: 'function_graph', sceneType: 'intro', durationFrames: 48, parameters: { title: 'A' }, layout: { aspectRatio: '9:16', safeAreaPadding: 32 }, mathematicalBinding: { boundClaimIds: [], latexFormulas: [] }, sourceReferenceIds: [] },
          { sceneId: 'scene_b', templateId: 'function_graph', sceneType: 'summary', durationFrames: 48, parameters: { title: 'B' }, layout: { aspectRatio: '9:16', safeAreaPadding: 32 }, mathematicalBinding: { boundClaimIds: [], latexFormulas: [] }, sourceReferenceIds: [] }
        ],
        visualTemplateIds: ['function_graph'], mathematicalData: {}, narrationObjectives: [],
        estimatedDurationFrames: 96, sourceReferences: []
      };
      const narration: NarrationPlanV2 = {
        planId: 'narr_gemini_timeline', storyboardId: storyboard.storyboardId, language: 'vi',
        segments: [
          { segmentId: 'seg_a', sceneId: 'scene_a', text: 'x²', subtitleText: 'x²', targetDurationSeconds: 2, pronunciationHints: [] },
          { segmentId: 'seg_b', sceneId: 'scene_b', text: 'lim', subtitleText: 'lim', targetDurationSeconds: 2, pronunciationHints: [] }
        ],
        totalWords: 2, estimatedDurationSeconds: 4,
        mathematicalReview: { status: 'verified', verifiedClaimIds: [] }
      };
      const provider = new GeminiTtsProvider({
        client: new FakeGeminiAudioClient({ data: wavFixture(1), mimeType: 'audio/wav' })
      });
      const assets = await synthesizeNarrationV2({
        provider, narrationPlan: narration, storyboard, jobId: 'job_gemini_timeline',
        jobDirectory: join(directory, 'job'), stagedDirectory: join(directory, 'staged'), fps: 24,
        alignmentPolicy: 'strict'
      });
      const manifest = compileStoryboardV2(storyboard, narration, {
        jobId: 'job_gemini_timeline', lessonTitle: 'Kiểm thử',
        topicId: storyboard.topicId, fps: 24, audioAssets: assets
      });

      assert.deepEqual(assets.map((asset) => asset.startFrame), [0, 48]);
      assert.deepEqual(manifest.subtitleTrack?.cues.map((cue) => cue.startFrame), [0, 48]);
      assert.deepEqual(manifest.subtitleTrack?.cues.map((cue) => cue.endFrame), [24, 72]);
      assert.equal(manifest.audioAssets.length, 2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('Vietnamese mathematical spoken-text rules', () => {
  it('keeps display/subtitle inputs untouched while producing approved spoken wording', () => {
    const cases: Array<[string, string]> = [
      ["f'(x)", 'f phẩy của x'],
      ['x²', 'x bình phương'],
      ['x³', 'x lập phương'],
      ['∫₀¹ x² dx', 'tích phân từ không đến một của x bình phương theo x'],
      ['Δx', 'đen-ta x'],
      ['lim', 'giới hạn']
    ];
    for (const [written, spoken] of cases) {
      const displayText = written;
      const subtitleText = written;
      assert.equal(buildSpokenNarrationText(written), spoken);
      assert.equal(displayText, written);
      assert.equal(subtitleText, written);
    }
  });

  it('applies explicit approved pronunciation hints before defaults', () => {
    assert.equal(
      buildSpokenNarrationText('Q tiến về P', [{ written: 'Q', spoken: 'quy' }, { written: 'P', spoken: 'pê' }]),
      'quy tiến về pê'
    );
  });
});
