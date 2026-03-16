import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  return NextResponse.next();
}

// Optionally, don't run middleware on static files and images
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
