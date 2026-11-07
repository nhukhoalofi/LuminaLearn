import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { LocalJobRepository, type PersistableJob } from '../src/job-repository';

test('local repository persists terminal jobs without changing them', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lumina-jobs-'));
  const repository = new LocalJobRepository<PersistableJob>(directory);
  const job: PersistableJob = { jobId: 'job-test-12345678', status: 'completed', progress: 100, message: 'done', updatedAt: new Date().toISOString() };
  repository.save(job);
  assert.equal(repository.loadAndRecover()[0].status, 'completed');
  assert.equal(JSON.parse(readFileSync(join(directory, `${job.jobId}.json`), 'utf8')).progress, 100);
});

test('local repository recovers non-terminal jobs as interrupted', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lumina-jobs-'));
  const repository = new LocalJobRepository<PersistableJob>(directory);
  repository.save({ jobId: 'job-test-abcdefgh', status: 'rendering_manim', progress: 45, message: 'running', updatedAt: new Date().toISOString() });
  const recovered = repository.loadAndRecover()[0];
  assert.equal(recovered.status, 'interrupted');
  assert.equal(recovered.failureType, 'interrupted');
});
