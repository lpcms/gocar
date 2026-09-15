import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';
import { wouldCycle } from '@/lib/redirects';

interface RedirectRow { from_path: string; to_path: string; type: number; }

function normalize(path: string): string {
  const trimmed = path.trim();
  if (trimmed === '') return '';
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Update or delete a redirect. Updates reject cycles and duplicate
 * from_path values with 409 error codes.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  const body = (await req.json().catch(() => ({}))) as {
    from_path?: string; to_path?: string; type?: number;
  };
  const db = getDb();
  const cur = db.prepare('SELECT * FROM redirects WHERE id = ?').get(id) as unknown as RedirectRow | undefined;
  if (!cur) return NextResponse.json({ ok: false }, { status: 404 });
  const from = body.from_path !== undefined ? normalize(String(body.from_path)) : cur.from_path;
  const to = body.to_path !== undefined ? normalize(String(body.to_path)) : cur.to_path;
  const type = body.type !== undefined ? (Number(body.type) === 302 ? 302 : 301) : cur.type;
  if (!from || !to) {
    return NextResponse.json({ ok: false, error: 'required' }, { status: 422 });
  }
  /**
   * Temporarily remove the current row so cycle detection ignores it.
   */
  db.prepare('DELETE FROM redirects WHERE id = ?').run(id);
  if (wouldCycle(from, to)) {
    db.prepare('INSERT INTO redirects (id, from_path, to_path, type) VALUES (?, ?, ?, ?)')
      .run(id, cur.from_path, cur.to_path, cur.type);
    return NextResponse.json({ ok: false, error: 'cycle' }, { status: 409 });
  }
  try {
    db.prepare('INSERT INTO redirects (id, from_path, to_path, type) VALUES (?, ?, ?, ?)')
      .run(id, from, to, type);
    return NextResponse.json({ ok: true });
  } catch (err) {
    db.prepare('INSERT INTO redirects (id, from_path, to_path, type) VALUES (?, ?, ?, ?)')
      .run(id, cur.from_path, cur.to_path, cur.type);
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE/.test(msg)) {
      return NextResponse.json({ ok: false, error: 'from_taken' }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { id } = await ctx.params;
  getDb().prepare('DELETE FROM redirects WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
