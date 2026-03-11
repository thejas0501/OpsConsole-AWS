import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');
  const url = req.nextUrl;

  // Bypass basic auth for API routes if needed, or keep everything protected
  // We'll protect everything since it's an internal dashboard

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    // Default credentials if not set in .env: admin / admin123
    const expectedUser = process.env.AUTH_USER || 'admin';
    const expectedPwd = process.env.AUTH_PASSWORD || 'admin123';

    if (user === expectedUser && pwd === expectedPwd) {
      return NextResponse.next();
    }
  }

  url.pathname = '/api/auth';
  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure OpsConsole Area"',
    },
  });
}

// Optionally, don't run middleware on static files and images
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
