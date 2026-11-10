import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GET as healthRoute } from '../src/app/api/health/route';
import { GET as sessionRoute } from '../src/app/api/auth/session/route';
import { GET as listJobsRoute } from '../src/app/api/jobs/route';
import { GET as listDraftsRoute } from '../src/app/api/v3/lessons/draft/route';
import { AuthStore } from '../src/server/auth-store';

describe('Operational Visibility & Health Endpoints (Phase 9 — Checkpoint N)', () => {
  test('1. GET /api/health exposes uptime, memory, render queue, and cache metrics without leaking secrets', async () => {
    const res = await healthRoute();
    assert.equal(res.status, 200);

    const body = await res.json() as {
      status: string;
      timestamp: string;
      uptimeSeconds: number;
      deploymentMode: string;
      resources: { heapUsedMb: number; heapTotalMb: number; rssMb: number };
      queue: { activeRenders: number; queueLength: number; maxPendingCapacity: number; isFull: boolean };
      previewCache: { totalEntries: number; totalSizeMb: number; cacheHits: number; cacheMisses: number; evictions: number };
    };

    assert.equal(body.status, 'healthy');
    assert.ok(typeof body.uptimeSeconds === 'number' && body.uptimeSeconds >= 0);
    assert.ok(typeof body.resources.heapUsedMb === 'number');
    assert.ok(typeof body.queue.maxPendingCapacity === 'number');
    assert.ok(typeof body.previewCache.cacheHits === 'number');

    // Ensure no secret keys or internal tokens are leaked in health payload
    const jsonStr = JSON.stringify(body);
    assert.ok(!jsonStr.includes('API_KEY'));
    assert.ok(!jsonStr.includes('password'));
    assert.ok(!jsonStr.includes('token'));
  });

  test('2. GET /api/auth/session correctly identifies authenticated pilot teacher vs unauthenticated', async () => {
    // 1. Authenticate Teacher Alpha
    const session = AuthStore.authenticate('teacher_a', 'TeacherA#2026');
    assert.ok(session);

    const authReq = new Request('http://localhost:3000/api/auth/session', {
      headers: { Authorization: `Bearer ${session.token}` }
    });
    const authRes = await sessionRoute(authReq);
    assert.equal(authRes.status, 200);
    const authData = await authRes.json() as { authenticated: boolean; teacher: { ownerId: string; username: string } };
    assert.equal(authData.authenticated, true);
    assert.equal(authData.teacher.ownerId, 'teacher_alpha');
    assert.equal(authData.teacher.username, 'teacher_a');

    // 2. Unauthenticated request in local demo mode reports local_demo
    const unauthReq = new Request('http://localhost:3000/api/auth/session');
    const unauthRes = await sessionRoute(unauthReq);
    assert.equal(unauthRes.status, 200);
    const unauthData = await unauthRes.json() as { authenticated: boolean; mode: string };
    assert.equal(unauthData.authenticated, false);
    assert.equal(unauthData.mode, 'local_demo');
  });

  test('3. GET /api/jobs and GET /api/v3/lessons/draft return caller-isolated resource lists', async () => {
    const sessionA = AuthStore.authenticate('teacher_a', 'TeacherA#2026');
    assert.ok(sessionA);

    const jobsReq = new Request('http://localhost:3000/api/jobs', {
      headers: { Authorization: `Bearer ${sessionA.token}` }
    });
    const jobsRes = await listJobsRoute(jobsReq);
    assert.equal(jobsRes.status, 200);
    const jobsData = await jobsRes.json() as { jobs: Array<{ ownerId?: string }> };
    assert.ok(Array.isArray(jobsData.jobs));
    for (const job of jobsData.jobs) {
      assert.equal(job.ownerId, 'teacher_alpha');
    }

    const draftsReq = new Request('http://localhost:3000/api/v3/lessons/draft', {
      headers: { Authorization: `Bearer ${sessionA.token}` }
    });
    const draftsRes = await listDraftsRoute(draftsReq);
    assert.equal(draftsRes.status, 200);
    const draftsData = await draftsRes.json() as { drafts: Array<{ ownerId: string }> };
    assert.ok(Array.isArray(draftsData.drafts));
    for (const draft of draftsData.drafts) {
      assert.equal(draft.ownerId, 'teacher_alpha');
    }
  });
});

