import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { AuthStore, MAX_LOGIN_FAILURES, SESSION_TTL_MS } from '../src/server/auth-store';
import { POST as loginRoute } from '../src/app/api/auth/login/route';
import { POST as logoutRoute } from '../src/app/api/auth/logout/route';
import { GET as sessionRoute } from '../src/app/api/auth/session/route';
import { GET as listDraftsRoute } from '../src/app/api/v3/lessons/draft/route';
import { assertRequestAuthorized, SecurityError } from '../src/server/security';

const ORIGIN = 'https://pilot.example.test';
const PASSWORD = 'test-only-secure-pilot-password';
const tokenFromCookie = (response: Response) => /lumina_session=([^;]+)/.exec(response.headers.get('set-cookie') ?? '')?.[1] ?? '';

before(async () => {
  process.env.LUMINA_PUBLIC_DEPLOYMENT = 'true';
  process.env.LUMINA_PUBLIC_ORIGIN = ORIGIN;
  process.env.LUMINA_AUTH_TEST_MODE = 'true';
  process.env.LUMINA_AUTH_STORE_PATH = join(tmpdir(), `lumina-phase10-auth-${process.pid}.json`);
  delete process.env.LUMINA_LOCAL_DEMO;
  AuthStore.resetForTests();
  await AuthStore.configureUsersForTests([
    { ownerId: 'teacher_alpha', username: 'teacher_alpha_test', email: 'alpha@example.test', fullName: 'Teacher Alpha', subjectDomain: 'mathematics', password: PASSWORD }
  ]);
});

after(() => {
  AuthStore.resetForTests();
  AuthStore.clearTestUsers();
  delete process.env.LUMINA_PUBLIC_DEPLOYMENT;
  delete process.env.LUMINA_PUBLIC_ORIGIN;
  process.env.LUMINA_LOCAL_DEMO = 'true';
});

function loginBody(username = 'teacher_alpha_test', password = PASSWORD, origin = ORIGIN) {
  return new Request(`${ORIGIN}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', Origin: origin }, body: JSON.stringify({ username, password })
  });
}

test('production source contains no Phase 9 embedded credential or fixed pilot salt', async () => {
  const files = [
    resolve(process.cwd(), 'src/server/auth-store.ts'),
    resolve(process.cwd(), 'src/components/V3TeacherStudio.tsx')
  ];
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  for (const compromised of ['TeacherA#2026', 'TeacherB#2026', 'lumina_salt_devfest2026']) assert.equal(source.includes(compromised), false);
});

test('missing and invalid credentials fail generically', async () => {
  const missing = await loginRoute(new Request(`${ORIGIN}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', Origin: ORIGIN }, body: '{}' }));
  assert.equal(missing.status, 400);
  const invalid = await loginRoute(loginBody('teacher_alpha_test', 'incorrect-password'));
  assert.equal(invalid.status, 401);
  assert.equal((await invalid.json() as { error: string }).error, 'invalid_credentials');
});

test('failed login attempts are durably rate limited', async () => {
  for (let index = 0; index < MAX_LOGIN_FAILURES; index += 1) {
    const response = await loginRoute(loginBody('rate-limited-user', 'incorrect-password'));
    assert.equal(response.status, 401);
  }
  const blocked = await loginRoute(loginBody('rate-limited-user', 'incorrect-password'));
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
});

test('pilot cookie is HttpOnly, SameSite, Secure and login JSON exposes no session token', async () => {
  const response = await loginRoute(loginBody());
  assert.equal(response.status, 200);
  const body = await response.json() as Record<string, unknown>;
  assert.equal('token' in body, false);
  const cookie = response.headers.get('set-cookie') ?? '';
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=lax/i);
  assert.match(cookie, /Secure/i);
  assert.ok(tokenFromCookie(response));
});

test('sessions survive store re-read, expire and remain revoked durably', async () => {
  const session = await AuthStore.authenticate('teacher_alpha_test', PASSWORD, 10_000);
  assert.ok(session);
  assert.equal(AuthStore.getSession(session.token, 10_001)?.ownerId, 'teacher_alpha');
  assert.equal(AuthStore.getSession(session.token, 10_000 + SESSION_TTL_MS), null);

  const active = await AuthStore.authenticate('teacher_alpha_test', PASSWORD);
  assert.ok(active);
  assert.equal(AuthStore.revokeSession(active.token), true);
  assert.equal(AuthStore.getSession(active.token), null);
});

test('cookie-authenticated mutation requires same origin and logout revokes session', async () => {
  const login = await loginRoute(loginBody());
  const token = tokenFromCookie(login);
  const withoutOrigin = await logoutRoute(new Request(`${ORIGIN}/api/auth/logout`, { method: 'POST', headers: { cookie: `lumina_session=${token}` } }));
  assert.equal(withoutOrigin.status, 403);
  const logout = await logoutRoute(new Request(`${ORIGIN}/api/auth/logout`, { method: 'POST', headers: { cookie: `lumina_session=${token}`, Origin: ORIGIN } }));
  assert.equal(logout.status, 200);
  const session = await sessionRoute(new Request(`${ORIGIN}/api/auth/session`, { headers: { cookie: `lumina_session=${token}` } }));
  assert.equal(session.status, 401);
});

test('pilot rejects anonymous data access and local demo rejects remote hosts', async () => {
  const anonymous = await listDraftsRoute(new Request(`${ORIGIN}/api/v3/lessons/draft`));
  assert.equal(anonymous.status, 401);

  delete process.env.LUMINA_PUBLIC_DEPLOYMENT;
  process.env.LUMINA_LOCAL_DEMO = 'true';
  assert.throws(
    () => assertRequestAuthorized(new Request('http://example.test/api/v3/lessons/draft', { headers: { host: 'example.test', 'x-forwarded-for': '203.0.113.7' } })),
    (error: unknown) => error instanceof SecurityError && error.code === 'local_demo_loopback_only'
  );
  process.env.LUMINA_PUBLIC_DEPLOYMENT = 'true';
  delete process.env.LUMINA_LOCAL_DEMO;
});
