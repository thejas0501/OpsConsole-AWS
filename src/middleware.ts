import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ─── Edge-compatible session check ───────────────────────────────────────
// NOTE: Next.js middleware runs in the Edge runtime which does NOT support
// Node.js built-in modules (crypto, etc.). We use the Web Crypto API here.
// The actual session signing still uses Node crypto in the API route handlers.

const COOKIE_NAME = 'ops_session';
const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

/**
 * Quick structural and expiry validation of the session token.
 * Format: `<timestamp>.<hmac-hex>`
 * Full HMAC signature verification is done in the API route handlers
 * via Node crypto (they run in the Node runtime, not Edge).
 * The middleware only needs to gate access quickly — the API routes
 * themselves also call verifySession() as a second factor.
 */
function quickValidateToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [ts, sig] = parts;
  const timestamp = parseInt(ts, 10);
  if (isNaN(timestamp)) return false;

  // Check the signature is a 64-char hex string (SHA-256 HMAC)
  if (!/^[0-9a-f]{64}$/i.test(sig)) return false;

  // Check the token is not expired (8 hours)
  const age = Date.now() - timestamp;
  return age > 0 && age < COOKIE_MAX_AGE_MS;
}

// Routes that do NOT require authentication
const PUBLIC_PATHS = [
  '/api/auth/verify',
  '/api/auth/status',
  '/api/auth/logout',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow Next.js internals, static files, and auth endpoints
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    PUBLIC_PATHS.some(p => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // All API routes (except public ones above) require a valid session cookie
  if (pathname.startsWith('/api/')) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!quickValidateToken(token)) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }
  }

  // For page routes, let the client-side auth overlay handle it
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
