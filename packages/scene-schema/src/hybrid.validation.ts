import { HybridVideoManifestSchema } from './hybrid.schema';
import type { HybridVideoManifest } from './hybrid.types';

export function parseHybridVideoManifest(input: unknown): HybridVideoManifest {
  return HybridVideoManifestSchema.parse(input);
}

export function validateHybridVideoManifest(input: unknown):
  | { success: true; data: HybridVideoManifest }
  | { success: false; errors: string[] } {
  const result = HybridVideoManifestSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.map((issue) => `${issue.path.length ? `[${issue.path.join('.')}] ` : ''}${issue.message}`)
  };
}

