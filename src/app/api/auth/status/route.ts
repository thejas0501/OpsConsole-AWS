import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const token = cookie
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('ops_session='))
    ?.split('=')[1];

  const ok = verifySession(token);
  return NextResponse.json({ ok });
}
