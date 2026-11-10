import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export interface TeacherUser {
  ownerId: string;
  username: string;
  email: string;
  fullName: string;
  subjectDomain: 'mathematics' | 'artificial_intelligence';
  passwordHash: string; // scrypt hash: salt:hexKey
}

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

// Fixed pilot password hashing with scrypt
function hashPassword(password: string, salt: string): string {
  const key = scryptSync(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}

function verifyPassword(provided: string, storedHash: string): boolean {
  const [salt, expectedKeyHex] = storedHash.split(':');
  if (!salt || !expectedKeyHex) return false;
  const computedKey = scryptSync(provided, salt, 64);
  const expectedKey = Buffer.from(expectedKeyHex, 'hex');
  if (computedKey.length !== expectedKey.length) return false;
  return timingSafeEqual(computedKey, expectedKey);
}

// Pre-seeded pilot teachers for controlled school deployment
const PILOT_SALT = 'lumina_salt_devfest2026';
const PILOT_TEACHERS: TeacherUser[] = [
  {
    ownerId: 'teacher_alpha',
    username: 'teacher_a',
    email: 'teacher_a@lumina.local',
    fullName: 'Cô Nguyễn Mai',
    subjectDomain: 'mathematics',
    passwordHash: hashPassword('TeacherA#2026', PILOT_SALT)
  },
  {
    ownerId: 'teacher_beta',
    username: 'teacher_b',
    email: 'teacher_b@lumina.local',
    fullName: 'Thầy Trần Nam',
    subjectDomain: 'artificial_intelligence',
    passwordHash: hashPassword('TeacherB#2026', PILOT_SALT)
  }
];

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const SESSION_COOKIE_NAME = 'lumina_session';

interface AuthState {
  usersByUsername: Map<string, TeacherUser>;
  sessionsByToken: Map<string, TeacherSession>;
}

const globalAuth = globalThis as typeof globalThis & { __luminaAuthState?: AuthState };
const state: AuthState = globalAuth.__luminaAuthState ?? {
  usersByUsername: new Map(PILOT_TEACHERS.map((u) => [u.username.toLowerCase(), u])),
  sessionsByToken: new Map<string, TeacherSession>()
};
globalAuth.__luminaAuthState = state;

export class AuthStore {
  public static authenticate(username: string, password: string): TeacherSession | null {
    const user = state.usersByUsername.get(username.trim().toLowerCase());
    if (!user) return null;

    if (!verifyPassword(password, user.passwordHash)) {
      return null;
    }

    const token = `tok_sess_${randomBytes(32).toString('hex')}`;
    const sessionId = `sess_${randomBytes(16).toString('hex')}`;
    const now = Date.now();

    const session: TeacherSession = {
      sessionId,
      token,
      ownerId: user.ownerId,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
      revoked: false
    };

    state.sessionsByToken.set(token, session);
    return { ...session };
  }

  public static getSession(token: string): TeacherSession | null {
    if (!token) return null;
    const session = state.sessionsByToken.get(token);
    if (!session) return null;

    if (session.revoked) return null;

    if (Date.now() > new Date(session.expiresAt).getTime()) {
      session.revoked = true;
      return null;
    }

    return { ...session };
  }

  public static revokeSession(token: string): boolean {
    const session = state.sessionsByToken.get(token);
    if (!session) return false;
    session.revoked = true;
    return true;
  }

  public static resetForTests(): void {
    state.sessionsByToken.clear();
  }

  public static getTeacherByOwnerId(ownerId: string): TeacherUser | undefined {
    return PILOT_TEACHERS.find((t) => t.ownerId === ownerId);
  }
}

