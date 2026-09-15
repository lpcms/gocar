import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';
import { wouldCycle } from '@/lib/redirects';

/**
 * Redirects CRUD (list + create). Guarded against cycles and duplicate
 * from_path values.
 */
export async function GET(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const rows = getDb().prepare(
    'SELECT id, from_path, to_path, type, created_at FROM redirects ORDER BY id DESC'
  ).all();
  return NextResponse.json({ ok: true, items: rows });
}

function normalize(path: string): string {
  const trimmed = path.trim();
  if (trimmed === '') return '';
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const body = (await req.json().catch(() => ({}))) as {
    from_path?: string; to_path?: string; type?: number;
  };
  const from = normalize(String(body.from_path ?? ''));
  const to = normalize(String(body.to_path ?? ''));
  const type = Number(body.type) === 302 ? 302 : 301;
  if (!from || !to) {
    return NextResponse.json({ ok: false, error: 'required' }, { status: 422 });
  }
  if (wouldCycle(from, to)) {
    return NextResponse.json({ ok: false, error: 'cycle' }, { status: 409 });
  }
  const db = getDb();
  try {
    const res = db.prepare(
      'INSERT INTO redirects (from_path, to_path, type) VALUES (?, ?, ?)'
    ).run(from, to, type);
    return NextResponse.json({ ok: true, id: Number(res.lastInsertRowid) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE/.test(msg)) {
      return NextResponse.json({ ok: false, error: 'from_taken' }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
