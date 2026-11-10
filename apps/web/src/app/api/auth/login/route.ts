import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthStore, SESSION_COOKIE_NAME, SESSION_TTL_MS } from '@/server/auth-store';
import { readBoundedJson, SecurityError } from '@/server/security';

export const runtime = 'nodejs';

const LoginRequestSchema = z.object({
  username: z.string().min(2).max(64),
  password: z.string().min(6).max(128)
}).strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const raw = await readBoundedJson<unknown>(request, 4 * 1024);
    const body = LoginRequestSchema.parse(raw);

    const session = AuthStore.authenticate(body.username, body.password);
    if (!session) {
      return NextResponse.json(
        { error: 'invalid_credentials', message: 'Tên đăng nhập hoặc mật khẩu giáo viên không chính xác.' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      teacher: {
        ownerId: session.ownerId,
        username: session.username,
        fullName: session.fullName,
        email: session.email
      },
      token: session.token,
      expiresAt: session.expiresAt
    });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: session.token,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(SESSION_TTL_MS / 1000)
    });

    return response;
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_input', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'auth_failed', message: 'Đăng nhập thất bại.' }, { status: 500 });
  }
}

