import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const session = req.cookies.get('session');
  const { pathname } = req.nextUrl;

  // Rute publice
  if (pathname.startsWith('/login') || pathname.startsWith('/api/login')) {
    return NextResponse.next();
  }

  // Redirect radacina la /chat
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/chat', req.url));
  }

  // Protectie rute private
  const secret = process.env.SESSION_SECRET;
  if (!session || session.value !== secret) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
