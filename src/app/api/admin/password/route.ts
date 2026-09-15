import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { currentAdminId } from '@/lib/admin-guard';

/**
 * Change the current admin's password: requires the current password
 * and a matching new password (min 8 chars).
 *
 * Through the same resolver as every other guarded route, so a session that
 * has been logged out cannot still change the password it was signed in with.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const uid = await currentAdminId();
  if (uid === null) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    current?: string; next?: string; confirm?: string;
  };
  const current = String(body.current ?? '');
  const next = String(body.next ?? '');
  const confirm = String(body.confirm ?? '');
  if (next.length < 8) {
    return NextResponse.json({ ok: false, error: 'too_short' }, { status: 422 });
  }
  if (next !== confirm) {
    return NextResponse.json({ ok: false, error: 'mismatch' }, { status: 422 });
  }
  const db = getDb();
  const user = db.prepare('SELECT password_hash FROM admin_users WHERE id = ?').get(uid) as unknown as | { password_hash: string } | undefined;
  if (!user || !verifyPassword(current, user.password_hash)) {
    return NextResponse.json({ ok: false, error: 'wrong_current' }, { status: 401 });
  }
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hashPassword(next), uid);
  return NextResponse.json({ ok: true });
}
