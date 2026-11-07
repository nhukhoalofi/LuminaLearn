import type { z } from 'zod';
import type {
  HybridTimelineSceneSchema,
  HybridVideoManifestSchema,
  MathClipAssetSchema
} from './hybrid.schema';

export type HybridVideoManifest = z.infer<typeof HybridVideoManifestSchema>;
export type HybridTimelineScene = z.infer<typeof HybridTimelineSceneSchema>;
export type MathClipAsset = z.infer<typeof MathClipAssetSchema>;

