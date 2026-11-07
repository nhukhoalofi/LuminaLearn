import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertValidJobId, resolveInside } from './paths';
import type { JobState } from './job-state';

export interface PersistableJob {
  jobId: string;
  status: JobState;
  progress: number;
  message: string;
  updatedAt: string;
  error?: string;
  failureType?: 'ai' | 'tts' | 'validation' | 'render' | 'interrupted';
}

const terminalStates = new Set<JobState>(['completed', 'failed', 'interrupted']);

export class LocalJobRepository<T extends PersistableJob> {
  constructor(private readonly directory: string) { mkdirSync(directory, { recursive: true }); }

  save(job: T): void {
    assertValidJobId(job.jobId);
    const target = resolveInside(this.directory, `${job.jobId}.json`);
    const temporary = resolveInside(this.directory, `${job.jobId}.${process.pid}.tmp`);
    writeFileSync(temporary, JSON.stringify(job, null, 2), 'utf8');
    renameSync(temporary, target);
  }

  loadAndRecover(): T[] {
    const jobs: T[] = [];
    for (const name of readdirSync(this.directory)) {
      if (!/^job-[a-z0-9-]{8,64}\.json$/.test(name)) continue;
      try {
        const job = JSON.parse(readFileSync(resolve(this.directory, name), 'utf8')) as T;
        assertValidJobId(job.jobId);
        if (!terminalStates.has(job.status)) {
          const recovered = {
            ...job, status: 'interrupted' as const, progress: 0,
            message: 'Job bị gián đoạn do tiến trình server dừng',
            error: 'interrupted_by_server_restart', failureType: 'interrupted' as const,
            updatedAt: new Date().toISOString()
          } as T;
          this.save(recovered);
          jobs.push(recovered);
        } else jobs.push(job);
      } catch { /* Corrupt records are isolated and do not hide other jobs. */ }
    }
    return jobs;
  }
}
