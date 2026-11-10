import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { POST as loginRoute } from '../src/app/api/auth/login/route';
import { POST as logoutRoute } from '../src/app/api/auth/logout/route';
import { GET as sessionRoute } from '../src/app/api/auth/session/route';
import { POST as createDraftRoute, GET as listDraftsRoute } from '../src/app/api/v3/lessons/draft/route';
import { GET as getDraftRoute, PATCH as patchDraftRoute } from '../src/app/api/v3/lessons/[lessonId]/draft/route';
import { POST as approveRoute } from '../src/app/api/v3/lessons/[lessonId]/approve/route';
import { POST as previewRoute } from '../src/app/api/v3/preview/route';
import { GET as getJobRoute } from '../src/app/api/jobs/[jobId]/route';
import { GET as getVideoRoute } from '../src/app/api/jobs/[jobId]/video/route';
import { GET as getSubtitlesRoute } from '../src/app/api/jobs/[jobId]/subtitles/route';
import { POST as resumeJobRoute } from '../src/app/api/jobs/[jobId]/resume/route';
import { createV3JobFromArtifact } from '../src/server/job-store';
import { AuthStore } from '../src/server/auth-store';
import { draftManagerV3 } from '../src/server/v3-services';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEACHER_A_PASSWORD = 'test-only-alpha-password';
const TEACHER_B_PASSWORD = 'test-only-beta-password';
const tokenFromCookie = (response: Response) => /lumina_session=([^;]+)/.exec(response.headers.get('set-cookie') ?? '')?.[1] ?? '';

describe('Two-Teacher Security & Multi-Tenant Isolation (Phase 9 — Checkpoint L)', () => {
  let teacherAToken: string;
  let teacherBToken: string;
  let teacherADraftId: string;
  let teacherBDraftId: string;

  before(async () => {
    // Enable private deployment mode requiring authenticated identity
    process.env.LUMINA_PUBLIC_DEPLOYMENT = 'true';
    delete process.env.LUMINA_LOCAL_DEMO;
    process.env.LUMINA_PUBLIC_ORIGIN = 'http://localhost:3000';
    process.env.LUMINA_AUTH_TEST_MODE = 'true';
    process.env.LUMINA_AUTH_STORE_PATH = join(tmpdir(), `lumina-auth-security-${process.pid}.json`);
    AuthStore.resetForTests();
    await AuthStore.configureUsersForTests([
      { ownerId: 'teacher_alpha', username: 'teacher_a', email: 'alpha@example.test', fullName: 'Teacher Alpha', subjectDomain: 'mathematics', password: TEACHER_A_PASSWORD },
      { ownerId: 'teacher_beta', username: 'teacher_b', email: 'beta@example.test', fullName: 'Teacher Beta', subjectDomain: 'artificial_intelligence', password: TEACHER_B_PASSWORD }
    ]);

    // 1. Authenticate Teacher A
    const loginReqA = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
      body: JSON.stringify({ username: 'teacher_a', password: TEACHER_A_PASSWORD })
    });
    const loginResA = await loginRoute(loginReqA);
    assert.equal(loginResA.status, 200);
    const dataA = await loginResA.json() as { teacher: { ownerId: string } };
    assert.equal(dataA.teacher.ownerId, 'teacher_alpha');
    assert.equal('token' in dataA, false);
    teacherAToken = tokenFromCookie(loginResA);
    assert.ok(teacherAToken);

    // 2. Authenticate Teacher B
    const loginReqB = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
      body: JSON.stringify({ username: 'teacher_b', password: TEACHER_B_PASSWORD })
    });
    const loginResB = await loginRoute(loginReqB);
    assert.equal(loginResB.status, 200);
    const dataB = await loginResB.json() as { teacher: { ownerId: string } };
    assert.equal(dataB.teacher.ownerId, 'teacher_beta');
    assert.equal('token' in dataB, false);
    teacherBToken = tokenFromCookie(loginResB);
    assert.ok(teacherBToken);
  });

  after(() => {
    delete process.env.LUMINA_PUBLIC_DEPLOYMENT;
    process.env.LUMINA_LOCAL_DEMO = 'true';
    AuthStore.resetForTests();
    AuthStore.clearTestUsers();
  });

  test('1. Teacher A creates an independent mathematics draft', async () => {
    const req = new Request('http://localhost:3000/api/v3/lessons/draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherAToken}`
      },
      body: JSON.stringify({
        requestId: `req_a_${Date.now()}`,
        topic: 'Bảy hằng đẳng thức đáng nhớ trong đại số',
        domain: 'mathematics',
        generationMode: 'mock',
        targetDurationSeconds: 60,
        narrationMode: 'none',
        subtitlesEnabled: true
      })
    });
    const res = await createDraftRoute(req);
    assert.equal(res.status, 201);
    const draft = await res.json() as { draftId: string; ownerId: string };
    assert.equal(draft.ownerId, 'teacher_alpha');
    teacherADraftId = draft.draftId;
  });

  test('2. Teacher B creates an independent AI draft', async () => {
    const req = new Request('http://localhost:3000/api/v3/lessons/draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherBToken}`
      },
      body: JSON.stringify({
        requestId: `req_b_${Date.now()}`,
        topic: 'Gradient Descent và hàm mất mát trong học máy',
        domain: 'artificial_intelligence',
        generationMode: 'mock',
        targetDurationSeconds: 60,
        narrationMode: 'none',
        subtitlesEnabled: true
      })
    });
    const res = await createDraftRoute(req);
    assert.equal(res.status, 201);
    const draft = await res.json() as { draftId: string; ownerId: string };
    assert.equal(draft.ownerId, 'teacher_beta');
    teacherBDraftId = draft.draftId;
  });

  test("3. Teacher A cannot read Teacher B's draft (owner isolation)", async () => {
    const req = new Request(`http://localhost:3000/api/v3/lessons/${teacherBDraftId}/draft`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${teacherAToken}` }
    });
    const res = await getDraftRoute(req, { params: Promise.resolve({ lessonId: teacherBDraftId }) });
    assert.equal(res.status, 403);
    const body = await res.json() as { error: string };
    assert.equal(body.error, 'forbidden_owner_mismatch');
  });

  test("4. Teacher B cannot edit Teacher A's draft", async () => {
    const req = new Request(`http://localhost:3000/api/v3/lessons/${teacherADraftId}/draft`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherBToken}`
      },
      body: JSON.stringify({
        expectedVersion: 1,
        title: 'Bị can thiệp bất hợp pháp bởi Teacher B'
      })
    });
    const res = await patchDraftRoute(req, { params: Promise.resolve({ lessonId: teacherADraftId }) });
    assert.equal(res.status, 403);
  });

  test("5. Teacher A cannot approve Teacher B's draft", async () => {
    const req = new Request(`http://localhost:3000/api/v3/lessons/${teacherBDraftId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherAToken}`
      },
      body: JSON.stringify({ expectedVersion: 1 })
    });
    const res = await approveRoute(req, { params: Promise.resolve({ lessonId: teacherBDraftId }) });
    assert.equal(res.status, 403);
  });

  test("6. Teacher B cannot request preview of Teacher A's scene", async () => {
    const req = new Request('http://localhost:3000/api/v3/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherBToken}`
      },
      body: JSON.stringify({
        draftId: teacherADraftId,
        draftVersion: 1,
        sceneId: 'scene_algebra_1',
        frame: 24,
        subtitlesEnabled: true
      })
    });
    const res = await previewRoute(req);
    assert.equal(res.status, 403);
    const body = await res.json() as { error: string };
    assert.equal(body.error, 'forbidden_owner_mismatch');
  });

  test("7. Job and Output Isolation: Teacher B cannot view, download MP4, or download SRT of Teacher A's job", async () => {
    // Approve Teacher A's draft to create a job
    const draftA = await draftManagerV3.load(teacherADraftId);
    assert.ok(draftA);
    const reviewed = await draftManagerV3.confirmSemanticReview(teacherADraftId, 'teacher_alpha', draftA.version);
    const approved = await draftManagerV3.approve(teacherADraftId, 'teacher_alpha', reviewed.version);
    assert.ok(approved.approvedArtifact);

    const jobA = await createV3JobFromArtifact(
      approved.approvedArtifact,
      (art) => draftManagerV3.isArtifactAuthorized(art),
      'teacher_alpha'
    );
    assert.equal(jobA.ownerId, 'teacher_alpha');

    // Teacher B tries to query job details
    const getJobReq = new Request(`http://localhost:3000/api/jobs/${jobA.jobId}`, {
      headers: { Authorization: `Bearer ${teacherBToken}` }
    });
    const getJobRes = await getJobRoute(getJobReq, { params: Promise.resolve({ jobId: jobA.jobId }) });
    assert.equal(getJobRes.status, 403);

    // Teacher B tries to download MP4
    const getVideoReq = new Request(`http://localhost:3000/api/jobs/${jobA.jobId}/video`, {
      headers: { Authorization: `Bearer ${teacherBToken}` }
    });
    const getVideoRes = await getVideoRoute(getVideoReq, { params: Promise.resolve({ jobId: jobA.jobId }) });
    assert.equal(getVideoRes.status, 403);

    // Teacher B tries to download SRT
    const getSrtReq = new Request(`http://localhost:3000/api/jobs/${jobA.jobId}/subtitles`, {
      headers: { Authorization: `Bearer ${teacherBToken}` }
    });
    const getSrtRes = await getSubtitlesRoute(getSrtReq, { params: Promise.resolve({ jobId: jobA.jobId }) });
    assert.equal(getSrtRes.status, 403);

    // Teacher B tries to resume Teacher A's job
    const resumeReq = new Request(`http://localhost:3000/api/jobs/${jobA.jobId}/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherBToken}`
      },
      body: JSON.stringify({
        artifactId: approved.approvedArtifact.artifactId,
        contentHash: approved.approvedArtifact.contentHash
      })
    });
    const resumeRes = await resumeJobRoute(resumeReq, { params: Promise.resolve({ jobId: jobA.jobId }) });
    assert.equal(resumeRes.status, 403);
  });

  test('8. User-supplied owner headers or query params cannot spoof identity', async () => {
    // Teacher B tries to send forged header pretending to be teacher_alpha
    const forgedReq = new Request(`http://localhost:3000/api/v3/lessons/${teacherADraftId}/draft`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${teacherBToken}`,
        'x-lumina-owner-id': 'teacher_alpha',
        'x-owner-id': 'teacher_alpha'
      }
    });
    const res = await getDraftRoute(forgedReq, { params: Promise.resolve({ lessonId: teacherADraftId }) });
    // Must strictly fail because server resolves identity from validated session token, not client header
    assert.equal(res.status, 403);
  });

  test('9. Teacher logout revokes session and rejects subsequent calls with 401', async () => {
    // Logout Teacher A
    const logoutReq = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherAToken}` }
    });
    const logoutRes = await logoutRoute(logoutReq);
    assert.equal(logoutRes.status, 200);

    // Subsequent call with revoked token must fail with 401
    const req = new Request('http://localhost:3000/api/v3/lessons/draft', {
      method: 'GET',
      headers: { Authorization: `Bearer ${teacherAToken}` }
    });
    const res = await listDraftsRoute(req);
    assert.equal(res.status, 401);
  });
});

