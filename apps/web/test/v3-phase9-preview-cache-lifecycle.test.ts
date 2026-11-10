import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PreviewCacheManager,
  validatePngSignature
} from '../src/server/preview-cache-manager';

// Valid 1x1 transparent PNG buffer
const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

describe('Preview Cache Lifecycle & Quota Management (Phase 9)', () => {
  let tempDir: string;
  let cache: PreviewCacheManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'lumina-preview-test-'));
    cache = new PreviewCacheManager({
      cacheDir: tempDir,
      maxBytes: 10 * 1024, // 10 KB
      maxEntries: 4,
      ttlMs: 500 // 500 ms for fast test
    });
    cache.resetForTests();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  });

  test('1. Validates PNG signatures and rejects corrupt or non-PNG buffers', () => {
    assert.doesNotThrow(() => validatePngSignature(VALID_PNG_BUFFER));

    const invalidHeader = Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]);
    assert.throws(() => validatePngSignature(invalidHeader), /preview_output_invalid/);

    const emptyBuffer = Buffer.alloc(0);
    assert.throws(() => validatePngSignature(emptyBuffer), /preview_output_invalid/);
  });

  test('2. Enforces owner isolation on cached previews', async () => {
    const key = 'cache_key_alpha';
    await cache.put(key, 'teacher_alpha', VALID_PNG_BUFFER);

    // Teacher Alpha can retrieve it (Cache hit)
    const hit = await cache.get(key, 'teacher_alpha');
    assert.ok(hit !== null);
    assert.deepEqual(hit, VALID_PNG_BUFFER);

    // Teacher Beta cannot retrieve Teacher Alpha's cached preview (Cache miss / isolation)
    const betaMiss = await cache.get(key, 'teacher_beta');
    assert.equal(betaMiss, null);

    const metrics = cache.getMetrics();
    assert.equal(metrics.hits, 1);
    assert.equal(metrics.misses, 1);
  });

  test('3. Evicts expired entries based on TTL', async () => {
    const key = 'cache_key_expiring';
    const t0 = 1000;
    await cache.put(key, 'teacher_alpha', VALID_PNG_BUFFER, t0);

    // Within TTL (300ms later)
    const valid = await cache.get(key, 'teacher_alpha', t0 + 300);
    assert.ok(valid !== null);

    // Expired (600ms later > 500ms TTL)
    const expired = await cache.get(key, 'teacher_alpha', t0 + 600);
    assert.equal(expired, null);

    const metrics = cache.getMetrics();
    assert.ok(metrics.evictions >= 1);
  });

  test('4. Deterministic LRU eviction when entry count or size exceeds maximum quota', async () => {
    // maxEntries is 4
    await cache.put('entry_1', 'teacher_alpha', VALID_PNG_BUFFER, 1000);
    await cache.put('entry_2', 'teacher_alpha', VALID_PNG_BUFFER, 1050);
    await cache.put('entry_3', 'teacher_alpha', VALID_PNG_BUFFER, 1100);
    await cache.put('entry_4', 'teacher_alpha', VALID_PNG_BUFFER, 1150);

    // Access entry_1 so it becomes more recently used than entry_2
    await cache.get('entry_1', 'teacher_alpha', 1200);

    // Adding entry_5 must evict the least recently used entry (entry_2)
    await cache.put('entry_5', 'teacher_alpha', VALID_PNG_BUFFER, 1250);

    // entry_2 should be evicted
    assert.equal(await cache.get('entry_2', 'teacher_alpha', 1300), null);
    // entry_1 should still exist because it was accessed at 1200 and not expired (1300 - 1000 < 500)
    assert.ok((await cache.get('entry_1', 'teacher_alpha', 1300)) !== null);
  });

  test('5. Cleans up stale .tmp files older than max age', async () => {
    await cache.init();
    const staleTmp = join(tempDir, 'stale_render.tmp');
    await writeFile(staleTmp, 'test temp data');

    // Clean files older than 0 ms (immediate)
    const cleaned = await cache.cleanStaleTempFiles(0);
    assert.equal(cleaned, 1);
  });

  test('6. Restores persistent cache entries and metadata across manager restarts', async () => {
    await cache.put('restart_key', 'teacher_alpha', VALID_PNG_BUFFER, 1000);

    // Simulate process restart with fresh cache manager instance pointing to same directory
    const restartedCache = new PreviewCacheManager({
      cacheDir: tempDir,
      maxBytes: 10 * 1024,
      maxEntries: 4,
      ttlMs: 500
    });
    restartedCache.resetForTests();

    // Must recover valid unexpired entry from disk with owner isolation intact
    const hit = await restartedCache.get('restart_key', 'teacher_alpha', 1200);
    assert.ok(hit !== null);
    assert.deepEqual(hit, VALID_PNG_BUFFER);

    // Another teacher cannot access it even after restart
    const crossOwner = await restartedCache.get('restart_key', 'teacher_beta', 1200);
    assert.equal(crossOwner, null);
  });

  test('7. Enforces quota and evicts over-capacity entries during restart recovery', async () => {
    // Put 4 entries
    await cache.put('item_1', 'teacher_alpha', VALID_PNG_BUFFER, 1000);
    await cache.put('item_2', 'teacher_alpha', VALID_PNG_BUFFER, 1050);
    await cache.put('item_3', 'teacher_alpha', VALID_PNG_BUFFER, 1100);
    await cache.put('item_4', 'teacher_alpha', VALID_PNG_BUFFER, 1150);

    // New instance has smaller maxEntries = 2
    const smallQuotaCache = new PreviewCacheManager({
      cacheDir: tempDir,
      maxBytes: 10 * 1024,
      maxEntries: 2,
      ttlMs: 10000
    });
    smallQuotaCache.resetForTests();

    await smallQuotaCache.init(1200);
    const metrics = smallQuotaCache.getMetrics();
    assert.equal(metrics.totalEntries, 2);
    // Oldest items (item_1, item_2) should have been evicted, newest (item_3, item_4) retained
    assert.equal(await smallQuotaCache.get('item_1', 'teacher_alpha', 1200), null);
    assert.equal(await smallQuotaCache.get('item_2', 'teacher_alpha', 1200), null);
    assert.ok((await smallQuotaCache.get('item_3', 'teacher_alpha', 1200)) !== null);
    assert.ok((await smallQuotaCache.get('item_4', 'teacher_alpha', 1200)) !== null);
  });

  test('8. Handles corrupted PNG and invalid metadata safely without crashing', async () => {
    await cache.init();
    // Write corrupt PNG directly to cache directory
    const corruptPng = join(tempDir, 'corrupt.png');
    const corruptMeta = join(tempDir, 'corrupt.meta.json');
    await writeFile(corruptPng, Buffer.from('NOT_A_PNG'));
    await writeFile(corruptMeta, JSON.stringify({ key: 'corrupt', ownerId: 'teacher_alpha', sizeBytes: 9, createdAt: 1000 }));

    const res = await cache.get('corrupt', 'teacher_alpha', 1100);
    assert.equal(res, null);
  });

  test('9. Concurrent writes execute atomically without corrupted files', async () => {
    await Promise.all([
      cache.put('concurrent_1', 'teacher_alpha', VALID_PNG_BUFFER, 1000),
      cache.put('concurrent_2', 'teacher_alpha', VALID_PNG_BUFFER, 1000),
      cache.put('concurrent_3', 'teacher_alpha', VALID_PNG_BUFFER, 1000)
    ]);

    assert.ok((await cache.get('concurrent_1', 'teacher_alpha', 1050)) !== null);
    assert.ok((await cache.get('concurrent_2', 'teacher_alpha', 1050)) !== null);
    assert.ok((await cache.get('concurrent_3', 'teacher_alpha', 1050)) !== null);
  });
});
