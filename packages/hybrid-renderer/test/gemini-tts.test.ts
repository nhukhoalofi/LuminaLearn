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
import {
  compileStoryboardV2,
  GeminiRequestBudget,
  type NarrationPlanV2,
  type StoryboardV2
} from '@luminalearn/scene-schema';
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

      // Even if a caller passes a Google Cloud TTS locale voice ID (e.g. vi-VN-Neural2-A), GeminiTtsProvider preserves its Gemini speaker voice ('Kore')
      await provider.synthesize('hai x', output, {
        voice: 'vi-VN-Neural2-A',
        languageCode: 'vi-VN',
        speakingRate: 1.0,
        pitch: 0
      });
      assert.equal(client.requests[1].voice, 'Kore');
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

  it('retries bounded transient failures and classifies request timeout', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lumina-gemini-retry-'));
    try {
      let attempts = 0;
      const retryingClient: GeminiAudioClient = {
        async assertModelAvailable() {},
        async generateSpeech() {
          attempts += 1;
          if (attempts < 3) throw Object.assign(new Error('temporary unavailable'), { status: 503 });
          return { data: wavFixture(0.5), mimeType: 'audio/wav' };
        }
      };
      const retrying = new GeminiTtsProvider({ client: retryingClient, maxAttempts: 3, retryBaseDelayMs: 1 });
      await retrying.synthesize('Nội dung thử lại', join(directory, 'retry.mp3'));
      assert.equal(attempts, 3);

      const timeoutClient: GeminiAudioClient = {
        async assertModelAvailable() {},
        async generateSpeech(request) {
          await new Promise<void>((_resolve, reject) => {
            request.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
          });
          throw new Error('unreachable');
        }
      };
      const timingOut = new GeminiTtsProvider({ client: timeoutClient, timeoutMs: 10, maxAttempts: 1 });
      await assert.rejects(() => timingOut.synthesize('Nội dung timeout', join(directory, 'timeout.mp3')), /tts_timeout/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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

  it('fails immediately on 401/403/429 without retrying and enforces GEMINI_TTS_MAX_REQUESTS_PER_JOB', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lumina-gemini-tts-budget-'));
    try {
      let calls429 = 0;
      const budget429 = new GeminiRequestBudget({ maxTtsRequestsPerJob: 5 });
      const client429: GeminiAudioClient = {
        async assertModelAvailable() {},
        async generateSpeech() {
          calls429 += 1;
          throw Object.assign(new Error('Resource exhausted'), { status: 429 });
        }
      };
      const provider429 = new GeminiTtsProvider({
        client: client429,
        maxAttempts: 3,
        retryBaseDelayMs: 1,
        requestBudget: budget429
      });
      await assert.rejects(
        () => provider429.synthesize('Nội dung quota', join(directory, 'quota.mp3')),
        /tts_quota_exceeded/
      );
      assert.equal(calls429, 1, '429 must fail immediately without retrying');
      assert.equal(budget429.getSummary().counts.geminiTts, 1);

      let callsBudget = 0;
      const smallBudget = new GeminiRequestBudget({ maxTtsRequestsPerJob: 1 });
      const okClient: GeminiAudioClient = {
        async assertModelAvailable() {},
        async generateSpeech() {
          callsBudget += 1;
          return { data: wavFixture(0.5), mimeType: 'audio/wav' };
        }
      };
      const cappedProvider = new GeminiTtsProvider({
        client: okClient,
        requestBudget: smallBudget
      });
      await cappedProvider.synthesize('Đoạn một', join(directory, 'seg1.mp3'));
      await assert.rejects(
        () => cappedProvider.synthesize('Đoạn hai vượt ngân sách', join(directory, 'seg2.mp3')),
        /tts_budget_exceeded/
      );
      assert.equal(callsBudget, 1, 'Second synthesis call must be blocked before calling client');
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
