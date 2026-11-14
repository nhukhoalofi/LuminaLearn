import { NextResponse } from 'next/server';
import { AuthStore, SESSION_COOKIE_NAME } from '@/server/auth-store';
import { resolveDeploymentMode } from '@/server/security';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  const token = match
    ? decodeURIComponent(match.slice(SESSION_COOKIE_NAME.length + 1))
    : request.headers.get('authorization')?.slice(7) ?? request.headers.get('x-lumina-session-token');

  const mode = resolveDeploymentMode();

  if (token) {
    const session = AuthStore.getSession(token.trim());
    if (session) {
      return NextResponse.json({
        authenticated: true,
        mode,
        teacher: {
          ownerId: session.ownerId,
          username: session.username,
          fullName: session.fullName,
          email: session.email
        },
        expiresAt: session.expiresAt
      });
    }
  }

  // If local demo without session
  if (mode === 'local_demo') {
    return NextResponse.json({
      authenticated: false,
      mode: 'local_demo',
      message: 'Đang chạy chế độ Local Demo (không yêu cầu phiên làm việc).'
    });
  }

  return NextResponse.json({ authenticated: false, mode }, { status: 401 });
}

