import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';

/**
 * Login attempts journal API: paginated list, optional result filter,
 * and bulk delete (?before=<datetime>) to clean up old records.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const url = new URL(req.url);
  const result = url.searchParams.get('result');
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const perPage = 30;
  const offset = (page - 1) * perPage;
  const db = getDb();
  const where = result ? 'WHERE result = ?' : '';
  const args: string[] = result ? [result] : [];
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM login_attempts ${where}`).get(...args) as unknown as {
    n: number;
  }).n;
  const rows = db
    .prepare(
      `SELECT id, ip, login, result, created_at FROM login_attempts ${where}
       ORDER BY id DESC LIMIT ? OFFSET ?`
    )
    .all(...args, perPage, offset);
  return NextResponse.json({ ok: true, items: rows, total, page, perPage });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const url = new URL(req.url);
  const before = url.searchParams.get('before');
  const db = getDb();
  if (before === 'all') {
    db.prepare('DELETE FROM login_attempts').run();
    return NextResponse.json({ ok: true, cleared: 'all' });
  }
  if (before) {
    db.prepare('DELETE FROM login_attempts WHERE created_at < ?').run(before);
    return NextResponse.json({ ok: true, cleared: before });
  }
  return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
}
