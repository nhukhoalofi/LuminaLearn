import { NextResponse } from 'next/server';
import { AuthStore, SESSION_COOKIE_NAME } from '@/server/auth-store';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  const token = match ? decodeURIComponent(match.slice(SESSION_COOKIE_NAME.length + 1)) : request.headers.get('authorization')?.slice(7);

  if (token) {
    AuthStore.revokeSession(token.trim());
  }

  const response = NextResponse.json({ success: true, message: 'Đã đăng xuất phiên làm việc.' });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });

  return response;
}

