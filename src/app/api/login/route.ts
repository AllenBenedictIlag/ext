// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/database';

export async function POST(req: Request) {
  const { email, password } = await req.json() as { email: string; password: string };

  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT id, password_hash, role FROM users WHERE email = ?',
    [email]
  );

  // 1) no such email
  if ((rows as any).length === 0) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const user = (rows as any)[0];

  // 2) bcryptjs compare (promise style)
  let ok = false;
  try {
    ok = await bcrypt.compare(password, user.password_hash);
  } catch (e) {
    console.error('bcrypt error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!ok) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // 3) success — minimal payload for now
  return NextResponse.json({ user: { id: user.id, role: user.role } });
}