import { NextResponse } from 'next/server';
import { getQueueStatus } from '@/server/job-store';
import { defaultPreviewCacheManager } from '@/server/preview-cache-manager';
import { resolveDeploymentMode } from '@/server/security';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const memory = process.memoryUsage();
  const queue = getQueueStatus();
  const previewCache = defaultPreviewCacheManager.getMetrics();
  const deploymentMode = resolveDeploymentMode();

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    deploymentMode,
    resources: {
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
      rssMb: Math.round(memory.rss / 1024 / 1024)
    },
    queue: {
      activeRenders: queue.active,
      queueLength: queue.queueLength,
      maxPendingCapacity: queue.maxPending,
      isFull: queue.isFull
    },
    previewCache: {
      totalEntries: previewCache.totalEntries,
      totalSizeMb: Math.round((previewCache.totalSizeBytes / 1024 / 1024) * 100) / 100,
      cacheHits: previewCache.hits,
      cacheMisses: previewCache.misses,
      evictions: previewCache.evictions
    }
  });
}

