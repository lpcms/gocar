import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';

/**
 * Update or delete an extra. Extras are never referenced by FK, so
 * deletion is always allowed; toggling is_active is preferred over
 * deleting a used option to preserve lead history.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = getDb();
  const cur = db.prepare('SELECT * FROM extras WHERE id = ?').get(id) as unknown as | { slug: string; price: number; price_type: string; is_active: number; sort_order: number }
    | undefined;
  if (!cur) return NextResponse.json({ ok: false }, { status: 404 });
  try {
    db.prepare(
      `UPDATE extras SET slug = ?, price = ?, price_type = ?, is_active = ?, sort_order = ?
       WHERE id = ?`
    ).run(
      body.slug !== undefined ? String(body.slug) : cur.slug,
      body.price !== undefined ? Number(body.price) : cur.price,
      body.price_type === 'per_order' || body.price_type === 'per_day'
        ? body.price_type
        : cur.price_type,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : cur.is_active,
      body.sort_order !== undefined ? Number(body.sort_order) : cur.sort_order,
      id
    );
    if (body.name_en !== undefined) {
      db.prepare(
        `INSERT INTO extra_translations (extra_id, locale, name) VALUES (?, 'en', ?)
         ON CONFLICT(extra_id, locale) DO UPDATE SET name = excluded.name`
      ).run(id, String(body.name_en));
    }
    if (body.name_ua !== undefined) {
      db.prepare(
        `INSERT INTO extra_translations (extra_id, locale, name) VALUES (?, 'ua', ?)
         ON CONFLICT(extra_id, locale) DO UPDATE SET name = excluded.name`
      ).run(id, String(body.name_ua));
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE/.test(msg)) {
      return NextResponse.json({ ok: false, error: 'slug_taken' }, { status: 409 });
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
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  const db = getDb();
  db.prepare('DELETE FROM extras WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
