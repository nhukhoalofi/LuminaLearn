import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';

export interface TeacherUser {
  ownerId: string;
  username: string;
  email: string;
  fullName: string;
  subjectDomain: 'mathematics' | 'artificial_intelligence';
}

interface CredentialUser extends TeacherUser { passwordHash: string }

export interface TeacherSession {
  sessionId: string;
  token: string;
  ownerId: string;
  username: string;
  fullName: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
}

interface LoginAttempt { failures: number; windowStartedAt: number; blockedUntil?: number }
interface PersistedAuthState { sessions: TeacherSession[]; attempts: Record<string, LoginAttempt> }

const CredentialUserSchema = z.object({
  ownerId: z.string().regex(/^[a-zA-Z0-9_-]{3,80}$/),
  username: z.string().trim().min(3).max(64),
  email: z.string().email().max(254),
  fullName: z.string().trim().min(2).max(120),
  subjectDomain: z.enum(['mathematics', 'artificial_intelligence']),
  passwordHash: z.string().startsWith('$argon2').max(512)
}).strict();

const PersistedAuthStateSchema = z.object({
  sessions: z.array(z.object({
    sessionId: z.string(), token: z.string(), ownerId: z.string(), username: z.string(), fullName: z.string(), email: z.string(),
    createdAt: z.string(), expiresAt: z.string(), revoked: z.boolean()
  }).strict()),
  attempts: z.record(z.object({ failures: z.number().int().nonnegative(), windowStartedAt: z.number(), blockedUntil: z.number().optional() }).strict())
}).strict();

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = 'lumina_session';
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_BLOCK_MS = 15 * 60 * 1000;
export const MAX_LOGIN_FAILURES = 5;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const defaultStorePath = resolve(repositoryRoot, 'outputs', '.auth', 'pilot-auth-state.json');
let testUsers: CredentialUser[] | undefined;
let operationQueue: Promise<void> = Promise.resolve();

function storePath(): string { return process.env.LUMINA_AUTH_STORE_PATH?.trim() || defaultStorePath; }

function loadUsers(): CredentialUser[] {
  if (testUsers) return testUsers;
  const raw = process.env.LUMINA_PILOT_USERS_JSON?.trim();
  if (!raw) return [];
  try { return z.array(CredentialUserSchema).min(1).max(100).parse(JSON.parse(raw)); }
  catch { throw new Error('invalid_pilot_auth_configuration'); }
}

function readState(): PersistedAuthState {
  try { return PersistedAuthStateSchema.parse(JSON.parse(readFileSync(storePath(), 'utf8'))); }
  catch (error) {
    try { statSync(storePath()); } catch { return { sessions: [], attempts: {} }; }
    throw new Error(`auth_store_unreadable: ${error instanceof Error ? error.message : 'invalid state'}`);
  }
}

function writeState(state: PersistedAuthState): void {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    writeFileSync(temp, JSON.stringify(PersistedAuthStateSchema.parse(state)), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    renameSync(temp, path);
  } finally { rmSync(temp, { force: true }); }
}

function locked<T>(action: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(action, action);
  operationQueue = result.then(() => undefined, () => undefined);
  return result;
}

export class LoginRateLimitError extends Error {
  readonly code = 'login_rate_limited';
  constructor(public readonly retryAfterSeconds: number) { super('login_rate_limited'); }
}

export class AuthStore {
  public static authenticate(username: string, password: string, now = Date.now()): Promise<TeacherSession | null> {
    return locked(async () => {
      const normalized = username.trim().toLowerCase();
      const state = readState();
      const attempt = state.attempts[normalized];
      if (attempt?.blockedUntil && attempt.blockedUntil > now) throw new LoginRateLimitError(Math.ceil((attempt.blockedUntil - now) / 1000));
      const currentAttempt: LoginAttempt = !attempt || now - attempt.windowStartedAt > LOGIN_WINDOW_MS
        ? { failures: 0, windowStartedAt: now } : attempt;
      const user = loadUsers().find((candidate) => candidate.username.toLowerCase() === normalized);
      const valid = user ? await verify(user.passwordHash, password) : false;
      if (!user || !valid) {
        currentAttempt.failures += 1;
        if (currentAttempt.failures >= MAX_LOGIN_FAILURES) currentAttempt.blockedUntil = now + LOGIN_BLOCK_MS;
        state.attempts[normalized] = currentAttempt;
        writeState(state);
        return null;
      }

      delete state.attempts[normalized];
      const session: TeacherSession = {
        sessionId: `sess_${randomBytes(16).toString('hex')}`,
        token: `tok_sess_${randomBytes(32).toString('hex')}`,
        ownerId: user.ownerId, username: user.username, fullName: user.fullName, email: user.email,
        createdAt: new Date(now).toISOString(), expiresAt: new Date(now + SESSION_TTL_MS).toISOString(), revoked: false
      };
      state.sessions.push(session);
      writeState(state);
      return { ...session };
    });
  }

  public static getSession(token: string, now = Date.now()): TeacherSession | null {
    if (!token) return null;
    const session = readState().sessions.find((candidate) => candidate.token === token);
    if (!session || session.revoked || now >= Date.parse(session.expiresAt)) return null;
    return { ...session };
  }

  public static revokeSession(token: string): boolean {
    const state = readState();
    const session = state.sessions.find((candidate) => candidate.token === token);
    if (!session) return false;
    session.revoked = true;
    writeState(state);
    return true;
  }

  public static getTeacherByOwnerId(ownerId: string): TeacherUser | undefined {
    const user = loadUsers().find((candidate) => candidate.ownerId === ownerId);
    if (!user) return undefined;
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  public static async configureUsersForTests(users: Array<TeacherUser & { password: string }>): Promise<void> {
    if (process.env.LUMINA_AUTH_TEST_MODE !== 'true') throw new Error('test_auth_configuration_disabled');
    testUsers = await Promise.all(users.map(async ({ password, ...user }) => ({
      ...user, passwordHash: await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 })
    })));
  }

  public static resetForTests(): void {
    if (process.env.LUMINA_AUTH_TEST_MODE !== 'true') throw new Error('test_auth_reset_disabled');
    rmSync(storePath(), { force: true });
  }

  public static clearTestUsers(): void { testUsers = undefined; }
}
