import { resolve, sep } from 'node:path';

export const JOB_ID_PATTERN = /^job-[a-z0-9-]{8,64}$/;

export function assertValidJobId(jobId: string): void {
  if (!JOB_ID_PATTERN.test(jobId)) throw new Error('Invalid job ID');
}

export function resolveInside(root: string, ...segments: string[]): string {
  const resolvedRoot = resolve(root);
  const candidate = resolve(resolvedRoot, ...segments);
  if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error('Path traversal is forbidden');
  }
  return candidate;
}

export function assertPathInside(root: string, candidatePath: string): string {
  const resolvedRoot = resolve(root);
  const candidate = resolve(candidatePath);
  if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error('Asset does not belong to the current job');
  }
  return candidate;
}

