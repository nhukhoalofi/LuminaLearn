import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

export const DEFAULT_MAX_CACHE_BYTES = 50 * 1024 * 1024; // 50 MB
export const DEFAULT_MAX_ENTRIES = 120;
export const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
export const MAX_PNG_BYTES = 3 * 1024 * 1024; // 3 MB

export interface CacheEntryMeta {
  key: string;
  ownerId: string;
  sizeBytes: number;
  contentHash: string;
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

const globals = globalThis as typeof globalThis & {
  __luminaPreviewCacheStates?: Map<string, CacheState>;
};
const statesByDir: Map<string, CacheState> = globals.__luminaPreviewCacheStates ?? new Map();
globals.__luminaPreviewCacheStates = statesByDir;

function getOrCreateState(normalizedDir: string): CacheState {
  let s = statesByDir.get(normalizedDir);
  if (!s) {
    s = {
      entries: new Map(),
      metrics: { totalEntries: 0, totalSizeBytes: 0, hits: 0, misses: 0, evictions: 0 },
      initialized: false
    };
    statesByDir.set(normalizedDir, s);
  }
  return s;
}

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

  private get state(): CacheState {
    return getOrCreateState(resolve(this.dir));
  }

  public async init(now = Date.now()): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    if (!this.state.initialized) {
      await this.cleanStaleTempFiles();
      await this.recoverFromDisk(now);
      this.state.initialized = true;
    }
  }

  /**
   * Reconstruct cache state from disk across restarts:
   * 1. Reads .meta.json sidecars
   * 2. Validates corresponding PNG existence & signatures
   * 3. Validates content hash and size integrity
   * 4. Discards expired entries (now - createdAt > ttlMs)
   * 5. Enforces capacity bounds (maxBytes, maxEntries) using LRU eviction
   */
  private async recoverFromDisk(now: number): Promise<void> {
    try {
      const files = await readdir(this.dir);
      const metaFiles = files.filter((f) => f.endsWith('.meta.json'));

      for (const metaFile of metaFiles) {
        const metaPath = resolve(this.dir, metaFile);
        const key = metaFile.replace(/\.meta\.json$/, '');
        const pngPath = resolve(this.dir, `${key}.png`);

        try {
          const rawMeta = await readFile(metaPath, 'utf8');
          const meta = JSON.parse(rawMeta) as CacheEntryMeta;

          if (!meta.key || !meta.ownerId || typeof meta.sizeBytes !== 'number' || typeof meta.createdAt !== 'number') {
            await this.evict(key);
            continue;
          }

          // Check TTL expiration
          if (now - meta.createdAt > this.ttlMs) {
            await this.evict(key);
            continue;
          }

          // Verify PNG on disk exists and has valid signature
          const pngData = await readFile(pngPath);
          validatePngSignature(pngData);

          // Verify size and SHA-256 content hash
          if (pngData.byteLength !== meta.sizeBytes) {
            await this.evict(key);
            continue;
          }
          if (meta.contentHash) {
            const actualHash = createHash('sha256').update(pngData).digest('hex');
            if (actualHash !== meta.contentHash) {
              await this.evict(key);
              continue;
            }
          }

          this.state.entries.set(key, {
            ...meta,
            lastAccessedAt: meta.lastAccessedAt ?? meta.createdAt
          });
        } catch {
          // Metadata corrupted or PNG invalid/missing - clean up both
          await rm(metaPath, { force: true }).catch(() => undefined);
          await rm(pngPath, { force: true }).catch(() => undefined);
        }
      }

      this.recalculateTotals();

      // Enforce bounds if accumulated files exceed capacity on startup
      await this.ensureCapacity(0);
    } catch {
      // directory read failure
    }
  }

  public async get(key: string, ownerId: string, now = Date.now()): Promise<Buffer | null> {
    await this.init(now);
    const meta = this.state.entries.get(key);

    if (meta) {
      // 1. Owner isolation
      if (meta.ownerId !== ownerId) {
        this.state.metrics.misses += 1;
        return null;
      }

      // 2. TTL Expiry check
      if (now - meta.createdAt > this.ttlMs) {
        await this.evict(key);
        this.state.metrics.misses += 1;
        return null;
      }

      // 3. Read cached file and validate
      const filePath = resolve(this.dir, `${key}.png`);
      try {
        const data = await readFile(filePath);
        validatePngSignature(data);
        if (data.byteLength !== meta.sizeBytes) {
          throw new Error('preview_size_mismatch');
        }
        if (meta.contentHash) {
          const actualHash = createHash('sha256').update(data).digest('hex');
          if (actualHash !== meta.contentHash) {
            throw new Error('preview_content_tampered');
          }
        }
        meta.lastAccessedAt = now;
        this.state.metrics.hits += 1;
        return data;
      } catch {
        // File corrupted, tampered, or missing on disk
        await this.evict(key);
        this.state.metrics.misses += 1;
        return null;
      }
    }

    // Disk fallback: Check if valid file and metadata exist on disk (unindexed from previous session)
    const filePath = resolve(this.dir, `${key}.png`);
    const metaPath = resolve(this.dir, `${key}.meta.json`);
    try {
      const rawMeta = await readFile(metaPath, 'utf8');
      const diskMeta = JSON.parse(rawMeta) as CacheEntryMeta;

      // Validate owner identity from authoritative disk metadata
      if (diskMeta.ownerId !== ownerId) {
        this.state.metrics.misses += 1;
        return null;
      }

      // Validate TTL from authoritative disk metadata
      if (now - diskMeta.createdAt > this.ttlMs) {
        await this.evict(key);
        this.state.metrics.misses += 1;
        return null;
      }

      const data = await readFile(filePath);
      validatePngSignature(data);
      if (data.byteLength !== diskMeta.sizeBytes) {
        throw new Error('preview_size_mismatch');
      }
      if (diskMeta.contentHash) {
        const actualHash = createHash('sha256').update(data).digest('hex');
        if (actualHash !== diskMeta.contentHash) {
          throw new Error('preview_content_tampered');
        }
      }

      diskMeta.lastAccessedAt = now;
      this.state.entries.set(key, diskMeta);
      this.recalculateTotals();
      this.state.metrics.hits += 1;
      return data;
    } catch {
      this.state.metrics.misses += 1;
      return null;
    }
  }

  public async put(key: string, ownerId: string, buffer: Buffer, now = Date.now()): Promise<void> {
    await this.init(now);
    validatePngSignature(buffer);

    // Evict if adding would exceed capacity
    await this.ensureCapacity(buffer.byteLength);

    const token = randomUUID();
    const targetPng = resolve(this.dir, `${key}.png`);
    const tempPng = resolve(this.dir, `${key}.${now}.${token}.png.tmp`);

    const targetMeta = resolve(this.dir, `${key}.meta.json`);
    const tempMeta = resolve(this.dir, `${key}.${now}.${token}.meta.tmp`);

    const contentHash = createHash('sha256').update(buffer).digest('hex');
    const meta: CacheEntryMeta = {
      key,
      ownerId,
      sizeBytes: buffer.byteLength,
      contentHash,
      createdAt: now,
      lastAccessedAt: now
    };

    try {
      await writeFile(tempPng, buffer, { flag: 'w' });
      await writeFile(tempMeta, JSON.stringify(meta), { flag: 'w', encoding: 'utf8' });

      await rename(tempPng, targetPng);
      await rename(tempMeta, targetMeta);

      this.state.entries.set(key, meta);
      this.recalculateTotals();
    } catch (err) {
      // Clean up temp files if write/rename fails (e.g. disk full)
      await rm(tempPng, { force: true }).catch(() => undefined);
      await rm(tempMeta, { force: true }).catch(() => undefined);
      throw err;
    }
  }

  public async evict(key: string): Promise<void> {
    const pngPath = resolve(this.dir, `${key}.png`);
    const metaPath = resolve(this.dir, `${key}.meta.json`);
    await rm(pngPath, { force: true }).catch(() => undefined);
    await rm(metaPath, { force: true }).catch(() => undefined);
    if (this.state.entries.delete(key)) {
      this.state.metrics.evictions += 1;
      this.recalculateTotals();
    }
  }

  private async ensureCapacity(incomingBytes: number): Promise<void> {
    const maxAllowedEntries = incomingBytes > 0 ? this.maxEntries - 1 : this.maxEntries;
    while (
      (this.state.metrics.totalSizeBytes + incomingBytes > this.maxBytes ||
        this.state.entries.size > maxAllowedEntries) &&
      this.state.entries.size > 0
    ) {
      // Find oldest accessed entry (LRU)
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, meta] of this.state.entries.entries()) {
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
            if (maxAgeMs <= 0 || now - st.mtimeMs >= maxAgeMs) {
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
    for (const meta of this.state.entries.values()) {
      size += meta.sizeBytes;
    }
    this.state.metrics.totalEntries = this.state.entries.size;
    this.state.metrics.totalSizeBytes = size;
  }

  public getMetrics(): PreviewCacheMetrics {
    return { ...this.state.metrics };
  }

  public resetForTests(): void {
    const s = this.state;
    s.entries.clear();
    s.metrics = { totalEntries: 0, totalSizeBytes: 0, hits: 0, misses: 0, evictions: 0 };
    s.initialized = false;
  }
}

export const defaultPreviewCacheManager = new PreviewCacheManager();
