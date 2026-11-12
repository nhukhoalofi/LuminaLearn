/**
 * LuminaLearn V3.0 — Phase 11
 * Audio Cache Manager
 *
 * Implements content-addressed audio caching with SHA-256 integrity verification,
 * atomic filesystem writes, LRU quota eviction, and owner isolation.
 * Prevents redundant TTS synthesis and enforces cost control.
 */

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { probeAudio, type AudioMetadata } from './audio';

export interface AudioCacheKeyProps {
  text: string;
  providerId: string;
  voice: string;
  speakingRate?: number;
  pitch?: number;
  language?: string;
  model?: string;
}

export interface AudioCacheEntryMeta {
  key: string;
  ownerId?: string;
  contentHash: string; // SHA-256 of mp3/wav buffer
  sizeBytes: number;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  codec: string;
  providerId: string;
  voice: string;
  model?: string;
  language: string;
  speakingRate: number;
  pitch: number;
  createdAt: number;
  lastAccessedAt: number;
}

export interface AudioCacheMetrics {
  totalEntries: number;
  totalSizeBytes: number;
  hits: number;
  misses: number;
  evictions: number;
}

export interface AudioCacheOptions {
  cacheDir?: string;
  maxBytes?: number;
  maxEntries?: number;
  ttlMs?: number;
}

const DEFAULT_CACHE_DIR = resolve(process.cwd(), 'outputs', '.audio-cache-v3');
const DEFAULT_MAX_BYTES = 250 * 1024 * 1024; // 250 MB
const DEFAULT_MAX_ENTRIES = 2000;
const DEFAULT_TTL_MS = 14 * 24 * 3600 * 1000; // 14 days

export function computeAudioCacheKey(props: AudioCacheKeyProps): string {
  // Normalize parameters to produce deterministic hash
  const canonical = {
    t: props.text.trim(),
    p: props.providerId,
    v: props.voice,
    r: props.speakingRate ?? 1.0,
    pi: props.pitch ?? 0.0,
    l: props.language ?? 'vi-VN',
    m: props.model ?? 'default'
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function storageKeyFor(key: string, ownerId?: string): string {
  return createHash('sha256').update(`${ownerId ?? 'public'}\0${key}`, 'utf8').digest('hex');
}

function isValidMeta(meta: AudioCacheEntryMeta): boolean {
  return typeof meta.key === 'string' && meta.key.length > 0 &&
    typeof meta.contentHash === 'string' && /^[0-9a-f]{64}$/i.test(meta.contentHash) &&
    Number.isInteger(meta.sizeBytes) && meta.sizeBytes > 0 &&
    Number.isFinite(meta.durationSeconds) && meta.durationSeconds > 0 &&
    Number.isInteger(meta.sampleRate) && meta.sampleRate >= 8_000 && meta.sampleRate <= 96_000 &&
    Number.isInteger(meta.channels) && meta.channels >= 1 && meta.channels <= 2 &&
    typeof meta.codec === 'string' && typeof meta.providerId === 'string' && meta.providerId.length > 0 &&
    typeof meta.voice === 'string' && meta.voice.length > 0 && typeof meta.language === 'string' && meta.language.length > 0 &&
    Number.isFinite(meta.speakingRate) && meta.speakingRate > 0 && Number.isFinite(meta.pitch) &&
    Number.isFinite(meta.createdAt) && Number.isFinite(meta.lastAccessedAt);
}

export class AudioCacheManager {
  private readonly dir: string;
  private readonly maxBytes: number;
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  private entries = new Map<string, AudioCacheEntryMeta>();
  private initialized = false;
  private initPromise?: Promise<void>;
  private readonly keyLocks = new Map<string, Promise<void>>();
  private readonly writeLocks = new Map<string, Promise<void>>();
  private metrics: AudioCacheMetrics = {
    totalEntries: 0,
    totalSizeBytes: 0,
    hits: 0,
    misses: 0,
    evictions: 0
  };

  constructor(options: AudioCacheOptions = {}) {
    this.dir = options.cacheDir ?? DEFAULT_CACHE_DIR;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  public async withKeyLock<T>(key: string, ownerId: string | undefined, action: () => Promise<T>): Promise<T> {
    const storageKey = storageKeyFor(key, ownerId);
    const previous = this.keyLocks.get(storageKey) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolvePromise) => { release = resolvePromise; });
    const chain = previous.then(() => current);
    this.keyLocks.set(storageKey, chain);
    await previous;
    try {
      return await action();
    } finally {
      release();
      if (this.keyLocks.get(storageKey) === chain) this.keyLocks.delete(storageKey);
    }
  }

  public async init(now = Date.now()): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      await mkdir(this.dir, { recursive: true });
      await this.recoverFromDisk(now);
      this.initialized = true;
    })();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = undefined;
    }
  }

  private async recoverFromDisk(now: number): Promise<void> {
    try {
      const files = await readdir(this.dir);
      const metaFiles = files.filter((f) => f.endsWith('.meta.json'));

      for (const metaFile of metaFiles) {
        const storageKey = metaFile.replace(/\.meta\.json$/, '');
        const metaPath = resolve(this.dir, metaFile);
        const audioPath = resolve(this.dir, `${storageKey}.mp3`);

        try {
          const raw = await readFile(metaPath, 'utf8');
          const meta = JSON.parse(raw) as AudioCacheEntryMeta;

          // Validate metadata structure
          if (!isValidMeta(meta)) {
            await this.evictStorage(storageKey);
            continue;
          }
          if (storageKeyFor(meta.key, meta.ownerId) !== storageKey) {
            await this.evictStorage(storageKey);
            continue;
          }

          // Check TTL expiration
          if (now - meta.createdAt > this.ttlMs) {
            await this.evictStorage(storageKey);
            continue;
          }

          // Verify audio file exists and matches size and SHA-256
          const data = await readFile(audioPath);
          if (data.byteLength !== meta.sizeBytes) {
            await this.evictStorage(storageKey);
            continue;
          }

          const actualHash = createHash('sha256').update(data).digest('hex');
          if (actualHash !== meta.contentHash) {
            await this.evictStorage(storageKey);
            continue;
          }

          this.entries.set(storageKey, {
            ...meta,
            lastAccessedAt: meta.lastAccessedAt ?? meta.createdAt
          });
        } catch {
          await rm(metaPath, { force: true }).catch(() => undefined);
          await rm(audioPath, { force: true }).catch(() => undefined);
        }
      }

      this.recalculateTotals();
      await this.ensureCapacity(0);
    } catch {
      // directory read failure
    }
  }

  public async get(
    key: string,
    ownerId?: string,
    now = Date.now()
  ): Promise<{ data: Buffer; meta: AudioCacheEntryMeta } | null> {
    await this.init(now);
    const storageKey = storageKeyFor(key, ownerId);
    const meta = this.entries.get(storageKey);
    if (!meta) {
      // Check disk fallback
      return this.readFromDiskFallback(key, ownerId, now);
    }

    // Owner check if ownerId is configured in cached entry
    if (meta.ownerId && ownerId && meta.ownerId !== ownerId) {
      this.metrics.misses += 1;
      return null;
    }

    // TTL check
    if (now - meta.createdAt > this.ttlMs) {
      await this.evictStorage(storageKey);
      this.metrics.misses += 1;
      return null;
    }

    const audioPath = resolve(this.dir, `${storageKey}.mp3`);
    try {
      const data = await readFile(audioPath);
      if (data.byteLength !== meta.sizeBytes) {
        throw new Error('audio_size_mismatch');
      }
      if (!meta.contentHash || !/^[0-9a-f]{64}$/i.test(meta.contentHash)) {
        throw new Error('audio_hash_missing');
      }
      const actualHash = createHash('sha256').update(data).digest('hex');
      if (actualHash !== meta.contentHash) {
        throw new Error('audio_content_tampered');
      }

      meta.lastAccessedAt = now;
      this.metrics.hits += 1;
      return { data, meta };
    } catch {
      await this.evictStorage(storageKey);
      this.metrics.misses += 1;
      return null;
    }
  }

  private async readFromDiskFallback(
    key: string,
    ownerId: string | undefined,
    now: number
  ): Promise<{ data: Buffer; meta: AudioCacheEntryMeta } | null> {
    const storageKey = storageKeyFor(key, ownerId);
    const metaPath = resolve(this.dir, `${storageKey}.meta.json`);
    const audioPath = resolve(this.dir, `${storageKey}.mp3`);

    try {
      const raw = await readFile(metaPath, 'utf8');
      const diskMeta = JSON.parse(raw) as AudioCacheEntryMeta;

      if (!isValidMeta(diskMeta) || diskMeta.key !== key || diskMeta.ownerId !== ownerId || storageKeyFor(diskMeta.key, diskMeta.ownerId) !== storageKey) {
        this.metrics.misses += 1;
        return null;
      }

      if (now - diskMeta.createdAt > this.ttlMs) {
        await this.evictStorage(storageKey);
        this.metrics.misses += 1;
        return null;
      }

      const data = await readFile(audioPath);
      if (data.byteLength !== diskMeta.sizeBytes) {
        throw new Error('audio_size_mismatch');
      }
      if (!diskMeta.contentHash || !/^[0-9a-f]{64}$/i.test(diskMeta.contentHash)) {
        throw new Error('audio_hash_missing');
      }
      const actualHash = createHash('sha256').update(data).digest('hex');
      if (actualHash !== diskMeta.contentHash) {
        throw new Error('audio_content_tampered');
      }

      diskMeta.lastAccessedAt = now;
      this.entries.set(storageKey, diskMeta);
      this.recalculateTotals();
      this.metrics.hits += 1;
      return { data, meta: diskMeta };
    } catch {
      this.metrics.misses += 1;
      return null;
    }
  }

  public async put(
    key: string,
    buffer: Buffer,
    probe: AudioMetadata,
    providerId: string,
    voice: string,
    ownerId?: string,
    now = Date.now(),
    synthesisSettings?: { model?: string; language?: string; speakingRate?: number; pitch?: number }
  ): Promise<AudioCacheEntryMeta> {
    const storageKey = storageKeyFor(key, ownerId);
    const writeLockKey = '__global_write__';
    const previous = this.writeLocks.get(writeLockKey) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolvePromise) => { release = resolvePromise; });
    const chain = previous.then(() => current);
    this.writeLocks.set(writeLockKey, chain);
    await previous;
    try {
      await this.init(now);
      if (buffer.byteLength <= 0) {
        throw new Error('audio_empty_buffer');
      }

      await this.ensureCapacity(buffer.byteLength);

      const token = randomUUID();
      const targetAudio = resolve(this.dir, `${storageKey}.mp3`);
      const tempAudio = resolve(this.dir, `${storageKey}.${now}.${token}.mp3.tmp`);

      const targetMeta = resolve(this.dir, `${storageKey}.meta.json`);
      const tempMeta = resolve(this.dir, `${storageKey}.${now}.${token}.meta.tmp`);

      const contentHash = createHash('sha256').update(buffer).digest('hex');
      const meta: AudioCacheEntryMeta = {
        key, ownerId, contentHash, sizeBytes: buffer.byteLength,
        durationSeconds: probe.durationSeconds, sampleRate: probe.sampleRate,
        channels: probe.channels, codec: probe.codec, providerId, voice,
        model: synthesisSettings?.model,
        language: synthesisSettings?.language ?? 'vi-VN',
        speakingRate: synthesisSettings?.speakingRate ?? 1,
        pitch: synthesisSettings?.pitch ?? 0,
        createdAt: now, lastAccessedAt: now
      };

      // Atomic write pattern: write temp files then rename
      await writeFile(tempAudio, buffer);
      await writeFile(tempMeta, JSON.stringify(meta, null, 2), 'utf8');

      await rename(tempAudio, targetAudio);
      await rename(tempMeta, targetMeta);

      this.entries.set(storageKey, meta);
      this.recalculateTotals();

      return meta;
    } finally {
      release();
      if (this.writeLocks.get(writeLockKey) === chain) this.writeLocks.delete(writeLockKey);
    }
  }

  public async evict(key: string, ownerId?: string): Promise<boolean> {
    return this.evictStorage(storageKeyFor(key, ownerId));
  }

  private async evictStorage(storageKey: string): Promise<boolean> {
    const existed = this.entries.delete(storageKey);
    const audioPath = resolve(this.dir, `${storageKey}.mp3`);
    const metaPath = resolve(this.dir, `${storageKey}.meta.json`);

    await rm(audioPath, { force: true }).catch(() => undefined);
    await rm(metaPath, { force: true }).catch(() => undefined);

    if (existed) {
      this.recalculateTotals();
      this.metrics.evictions += 1;
    }
    return existed;
  }

  private async ensureCapacity(incomingBytes: number): Promise<void> {
    while (
      (this.entries.size >= this.maxEntries ||
        this.metrics.totalSizeBytes + incomingBytes > this.maxBytes) &&
      this.entries.size > 0
    ) {
      // Find least recently accessed entry
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, meta] of this.entries.entries()) {
        if (meta.lastAccessedAt < oldestTime) {
          oldestTime = meta.lastAccessedAt;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        await this.evictStorage(oldestKey);
      } else {
        break;
      }
    }
  }

  private recalculateTotals(): void {
    let size = 0;
    for (const meta of this.entries.values()) {
      size += meta.sizeBytes;
    }
    this.metrics.totalEntries = this.entries.size;
    this.metrics.totalSizeBytes = size;
  }

  public getMetrics(): AudioCacheMetrics {
    return { ...this.metrics };
  }

  public getCacheDir(): string {
    return this.dir;
  }

  public resetForTests(): void {
    this.entries.clear();
    this.metrics = {
      totalEntries: 0,
      totalSizeBytes: 0,
      hits: 0,
      misses: 0,
      evictions: 0
    };
    this.initialized = false;
    this.initPromise = undefined;
  }
}

export const defaultAudioCacheManager = new AudioCacheManager();

