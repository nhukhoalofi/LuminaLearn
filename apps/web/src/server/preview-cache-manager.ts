import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const DEFAULT_MAX_CACHE_BYTES = 50 * 1024 * 1024; // 50 MB
export const DEFAULT_MAX_ENTRIES = 120;
export const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
export const MAX_PNG_BYTES = 3 * 1024 * 1024; // 3 MB

export interface CacheEntryMeta {
  key: string;
  ownerId: string;
  sizeBytes: number;
  createdAt: number;
  lastAccessedAt: number;
}

export interface PreviewCacheMetrics {
  totalEntries: number;
  totalSizeBytes: number;
  hits: number;
  misses: number;
  evictions: number;
}

interface CacheState {
  entries: Map<string, CacheEntryMeta>;
  metrics: PreviewCacheMetrics;
  initialized: boolean;
}

const globals = globalThis as typeof globalThis & { __luminaPreviewCacheManager?: CacheState };
const state: CacheState = globals.__luminaPreviewCacheManager ?? {
  entries: new Map(),
  metrics: { totalEntries: 0, totalSizeBytes: 0, hits: 0, misses: 0, evictions: 0 },
  initialized: false
};
globals.__luminaPreviewCacheManager = state;

export function validatePngSignature(buffer: Buffer): void {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (
    buffer.byteLength < signature.byteLength ||
    buffer.byteLength > MAX_PNG_BYTES ||
    !buffer.subarray(0, signature.byteLength).equals(signature)
  ) {
    throw new Error('preview_output_invalid: Buffer is not a valid PNG image');
  }
}

export class PreviewCacheManager {
  private readonly dir: string;
  private readonly maxBytes: number;
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(options?: {
    cacheDir?: string;
    maxBytes?: number;
    maxEntries?: number;
    ttlMs?: number;
  }) {
    const repositoryRoot = resolve(process.cwd(), '../..');
    this.dir = options?.cacheDir ?? resolve(repositoryRoot, 'outputs', '.preview-cache-v3');
    this.maxBytes = options?.maxBytes ?? DEFAULT_MAX_CACHE_BYTES;
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  }

  public async init(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    if (!state.initialized) {
      await this.cleanStaleTempFiles();
      state.initialized = true;
    }
  }

  public async get(key: string, ownerId: string, now = Date.now()): Promise<Buffer | null> {
    await this.init();
    const meta = state.entries.get(key);

    if (meta) {
      // 1. Owner isolation
      if (meta.ownerId !== ownerId) {
        state.metrics.misses += 1;
        return null;
      }

      // 2. TTL Expiry check
      if (now - meta.createdAt > this.ttlMs) {
        await this.evict(key);
        state.metrics.misses += 1;
        return null;
      }

      // 3. Read cached file and validate
      const filePath = resolve(this.dir, `${key}.png`);
      try {
        const data = await readFile(filePath);
        validatePngSignature(data);
        meta.lastAccessedAt = now;
        state.metrics.hits += 1;
        return data;
      } catch {
        // File corrupted or missing on disk
        await this.evict(key);
        state.metrics.misses += 1;
        return null;
      }
    }

    // Fallback: Check if file exists on disk (from previous process)
    const filePath = resolve(this.dir, `${key}.png`);
    try {
      const data = await readFile(filePath);
      validatePngSignature(data);
      const fileStat = await stat(filePath);
      const entry: CacheEntryMeta = {
        key,
        ownerId,
        sizeBytes: fileStat.size,
        createdAt: fileStat.mtimeMs,
        lastAccessedAt: now
      };
      state.entries.set(key, entry);
      this.recalculateTotals();
      state.metrics.hits += 1;
      return data;
    } catch {
      state.metrics.misses += 1;
      return null;
    }
  }

  public async put(key: string, ownerId: string, buffer: Buffer, now = Date.now()): Promise<void> {
    await this.init();
    validatePngSignature(buffer);

    // Evict if adding would exceed capacity
    await this.ensureCapacity(buffer.byteLength);

    const targetFile = resolve(this.dir, `${key}.png`);
    const tempFile = resolve(this.dir, `${key}.${now}.put.tmp`);

    await writeFile(tempFile, buffer, { flag: 'w' });
    await rename(tempFile, targetFile);

    const meta: CacheEntryMeta = {
      key,
      ownerId,
      sizeBytes: buffer.byteLength,
      createdAt: now,
      lastAccessedAt: now
    };

    state.entries.set(key, meta);
    this.recalculateTotals();
  }

  public async evict(key: string): Promise<void> {
    const filePath = resolve(this.dir, `${key}.png`);
    await rm(filePath, { force: true }).catch(() => undefined);
    if (state.entries.delete(key)) {
      state.metrics.evictions += 1;
      this.recalculateTotals();
    }
  }

  private async ensureCapacity(incomingBytes: number): Promise<void> {
    while (
      (state.metrics.totalSizeBytes + incomingBytes > this.maxBytes ||
        state.entries.size >= this.maxEntries) &&
      state.entries.size > 0
    ) {
      // Find oldest accessed entry (LRU)
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, meta] of state.entries.entries()) {
        if (meta.lastAccessedAt < oldestTime) {
          oldestTime = meta.lastAccessedAt;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        await this.evict(oldestKey);
      } else {
        break;
      }
    }
  }

  public async cleanStaleTempFiles(maxAgeMs = 180_000): Promise<number> {
    let cleaned = 0;
    try {
      const files = await readdir(this.dir);
      const now = Date.now();
      for (const file of files) {
        if (file.endsWith('.tmp')) {
          const filePath = resolve(this.dir, file);
          try {
            const st = await stat(filePath);
            if (now - st.mtimeMs > maxAgeMs) {
              await rm(filePath, { force: true });
              cleaned += 1;
            }
          } catch { /* ignore */ }
        }
      }
    } catch { /* directory not ready */ }
    return cleaned;
  }

  private recalculateTotals(): void {
    let size = 0;
    for (const meta of state.entries.values()) {
      size += meta.sizeBytes;
    }
    state.metrics.totalEntries = state.entries.size;
    state.metrics.totalSizeBytes = size;
  }

  public getMetrics(): PreviewCacheMetrics {
    return { ...state.metrics };
  }

  public resetForTests(): void {
    state.entries.clear();
    state.metrics = { totalEntries: 0, totalSizeBytes: 0, hits: 0, misses: 0, evictions: 0 };
    state.initialized = false;
  }
}

export const defaultPreviewCacheManager = new PreviewCacheManager();

