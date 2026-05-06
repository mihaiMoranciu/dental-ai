import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (
    username === process.env.APP_USER &&
    password === process.env.APP_PASSWORD
  ) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set('session', process.env.SESSION_SECRET!, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 ore
    });
    return res;
  }

  return NextResponse.json({ error: 'User sau parola incorecte.' }, { status: 401 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('session');
  return res;
}
