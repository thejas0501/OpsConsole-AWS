import { NextResponse } from 'next/server';
import { verifySession, signSession, buildSetCookieHeader } from '@/lib/session';

// Simple in-memory rate limiting (per server process)
const attempts: Map<string, { count: number; resetAt: number }> = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
  }
}

function clearAttempts(ip: string) {
  attempts.delete(ip);
}

export async function POST(req: Request) {
  const ip = getClientIP(req);

  // Rate limiting check
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ success: false, message: 'Invalid request.' }, { status: 400 });
    }

    const expectedPassword = process.env.AUTH_PASSWORD;
    if (!expectedPassword) {
      console.error('[auth] AUTH_PASSWORD env var is not set.');
      return NextResponse.json({ success: false, message: 'Server misconfiguration.' }, { status: 500 });
    }

    if (password !== expectedPassword) {
      recordAttempt(ip);
      return NextResponse.json({ success: false, message: 'Invalid password.' }, { status: 401 });
    }

    clearAttempts(ip);
    const token = signSession();
    const res = NextResponse.json({ success: true });
    res.headers.set('Set-Cookie', buildSetCookieHeader(token));
    return res;

  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request.' }, { status: 400 });
  }
}

// Allow checking current session validity from client
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
