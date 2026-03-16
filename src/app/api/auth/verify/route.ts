import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    const expectedPassword = process.env.AUTH_PASSWORD || 'admin123';

    if (password === expectedPassword) {
      // In a real app, we'd set a secure cookie here.
      // For this simplified dashboard, we'll return success.
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'Invalid password' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 });
  }
}
