import { createHash } from 'node:crypto';

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;
const MAX_CONCURRENT = 1;
interface PreviewGuardState { active: number; requestsByOwner: Map<string, number[]> }
const globals = globalThis as typeof globalThis & { __luminaPreviewGuard?: PreviewGuardState };
const state = globals.__luminaPreviewGuard ?? { active: 0, requestsByOwner: new Map<string, number[]>() };
globals.__luminaPreviewGuard = state;

export class PreviewLimitError extends Error {
  constructor(public readonly code: 'preview_rate_limited' | 'preview_busy', public readonly status = 429) { super(code); }
}

export function acquirePreviewPermit(ownerId: string, now = Date.now()): () => void {
  const recent = (state.requestsByOwner.get(ownerId) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) throw new PreviewLimitError('preview_rate_limited');
  if (state.active >= MAX_CONCURRENT) throw new PreviewLimitError('preview_busy');
  recent.push(now);
  state.requestsByOwner.set(ownerId, recent);
  state.active += 1;
  let released = false;
  return () => { if (!released) { released = true; state.active = Math.max(0, state.active - 1); } };
}

export const PREVIEW_RENDERER_VERSION = 'v3-phase8-2';

export function previewCacheKey(input: { ownerId: string; draftId: string; version: number; sceneId: string; frame: number; subtitlesEnabled: boolean; scene: unknown }): string {
  return createHash('sha256').update(JSON.stringify({ rendererVersion: PREVIEW_RENDERER_VERSION, ...input }), 'utf8').digest('hex');
}

export function resetPreviewGuardForTests(): void { state.active = 0; state.requestsByOwner.clear(); }
