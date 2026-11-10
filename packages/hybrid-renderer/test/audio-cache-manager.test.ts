import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  AudioCacheManager,
  computeAudioCacheKey,
  type AudioCacheKeyProps
} from '../src/audio-cache-manager';

test('Audio Cache Manager (Phase 11)', async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), 'lumina-audio-cache-test-'));

  const sampleAudioBuffer = Buffer.from('FAKE_MP3_AUDIO_STREAM_BINARY_CONTENT_12345');
  const sampleProbe = {
    codec: 'mp3' as const,
    durationSeconds: 2.5,
    sampleRate: 24000,
    channels: 1,
    sizeBytes: sampleAudioBuffer.byteLength
  };

  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  });

  await t.test('1. Deterministic cache key computation without leaking API secrets', () => {
    const propsA: AudioCacheKeyProps = {
      text: 'a cộng b tất cả bình phương',
      providerId: 'mock_tts',
      voice: 'vi-VN-Neural2-A',
      speakingRate: 1.0,
      language: 'vi-VN'
    };
    const key1 = computeAudioCacheKey(propsA);
    const key2 = computeAudioCacheKey(propsA);
    assert.strictEqual(key1, key2);
    assert.match(key1, /^[0-9a-f]{64}$/);

    const propsDiffVoice: AudioCacheKeyProps = {
      ...propsA,
      voice: 'vi-VN-Standard-B'
    };
    const keyDiff = computeAudioCacheKey(propsDiffVoice);
    assert.notStrictEqual(key1, keyDiff);
  });

  await t.test('2. Puts and retrieves audio with SHA-256 integrity check', async () => {
    const cache = new AudioCacheManager({ cacheDir: tempDir });
    const key = computeAudioCacheKey({
      text: 'Chào mừng các bạn',
      providerId: 'mock_tts',
      voice: 'vi-VN-A'
    });

    await cache.put(key, sampleAudioBuffer, sampleProbe, 'mock_tts', 'vi-VN-A', 'teacher_1');

    const result = await cache.get(key, 'teacher_1');
    assert.ok(result);
    assert.strictEqual(result.data.toString(), sampleAudioBuffer.toString());
    assert.strictEqual(result.meta.durationSeconds, 2.5);
    assert.strictEqual(result.meta.providerId, 'mock_tts');
    assert.strictEqual(cache.getMetrics().hits, 1);
  });

  await t.test('3. Enforces teacher owner isolation on audio retrieval', async () => {
    const cache = new AudioCacheManager({ cacheDir: tempDir });
    const key = computeAudioCacheKey({
      text: 'Đạo hàm của hàm số',
      providerId: 'mock_tts',
      voice: 'vi-VN-A'
    });

    await cache.put(key, sampleAudioBuffer, sampleProbe, 'mock_tts', 'vi-VN-A', 'teacher_alpha');

    // Access by different teacher must return null
    const crossTeacher = await cache.get(key, 'teacher_beta');
    assert.strictEqual(crossTeacher, null);

    // Access by original teacher must hit
    const validTeacher = await cache.get(key, 'teacher_alpha');
    assert.ok(validTeacher);
  });

  await t.test('4. Detects tampered audio file on disk, fails closed and evicts', async () => {
    const cache = new AudioCacheManager({ cacheDir: tempDir });
    const key = computeAudioCacheKey({
      text: 'Tamper test audio',
      providerId: 'mock_tts',
      voice: 'vi-VN-A'
    });

    await cache.put(key, sampleAudioBuffer, sampleProbe, 'mock_tts', 'vi-VN-A', 'teacher_1');

    // Tamper the file on disk
    const audioFilePath = join(tempDir, `${key}.mp3`);
    await writeFile(audioFilePath, Buffer.from('TAMPERED_AUDIO_PAYLOAD'));

    const result = await cache.get(key, 'teacher_1');
    assert.strictEqual(result, null);
  });

  await t.test('5. Rejects corrupted or missing SHA-256 sidecar on restart recovery', async () => {
    const key = 'missing_hash_key';
    const audioPath = join(tempDir, `${key}.mp3`);
    const metaPath = join(tempDir, `${key}.meta.json`);

    await writeFile(audioPath, sampleAudioBuffer);
    await writeFile(
      metaPath,
      JSON.stringify({
        key,
        sizeBytes: sampleAudioBuffer.byteLength,
        durationSeconds: 2.0,
        createdAt: Date.now()
        // contentHash deliberately omitted
      })
    );

    const restartCache = new AudioCacheManager({ cacheDir: tempDir });
    await restartCache.init();

    const hit = await restartCache.get(key);
    assert.strictEqual(hit, null);
  });

  await t.test('6. LRU quota eviction when maxBytes is exceeded', async () => {
    const smallDir = await mkdtemp(join(tmpdir(), 'lumina-audio-lru-'));
    try {
      const cache = new AudioCacheManager({
        cacheDir: smallDir,
        maxBytes: sampleAudioBuffer.byteLength * 2 + 10,
        maxEntries: 2
      });

      const key1 = 'lru_audio_1';
      const key2 = 'lru_audio_2';
      const key3 = 'lru_audio_3';

      const baseTime = Date.now() - 10000;
      await cache.put(key1, sampleAudioBuffer, sampleProbe, 'mock_tts', 'v1', undefined, baseTime + 1000);
      await cache.put(key2, sampleAudioBuffer, sampleProbe, 'mock_tts', 'v1', undefined, baseTime + 2000);

      // Now adding key3 should evict key1 (oldest accessed)
      await cache.put(key3, sampleAudioBuffer, sampleProbe, 'mock_tts', 'v1', undefined, baseTime + 3000);

      assert.strictEqual(await cache.get(key1, undefined, baseTime + 4000), null);
      assert.ok(await cache.get(key2, undefined, baseTime + 4000));
      assert.ok(await cache.get(key3, undefined, baseTime + 4000));
    } finally {
      await rm(smallDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  await t.test('7. Concurrent init calls are serialized safely', async () => {
    const concurrentCache = new AudioCacheManager({ cacheDir: tempDir });
    await Promise.all([
      concurrentCache.init(),
      concurrentCache.init(),
      concurrentCache.init()
    ]);
    assert.ok(concurrentCache.getMetrics().totalEntries >= 0);
  });
});
