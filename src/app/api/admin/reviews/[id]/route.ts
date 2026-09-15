import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';

interface ReviewRow {
  author: string;
  author_ua: string;
  text_en: string;
  text_ua: string | null;
  avatar_url: string | null;
  avatar_alt_en: string;
  avatar_alt_ua: string;
  is_published: number;
  sort_order: number;
}

/**
 * Update / delete a single review.
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
  const cur = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id) as unknown as ReviewRow | undefined;
  if (!cur) return NextResponse.json({ ok: false }, { status: 404 });
  db.prepare(
    `UPDATE reviews SET author=?, author_ua=?, text_en=?, text_ua=?, avatar_url=?,
     avatar_alt_en=?, avatar_alt_ua=?, is_published=?, sort_order=? WHERE id=?`
  ).run(
    body.author !== undefined ? String(body.author) : cur.author,
    body.author_ua !== undefined ? String(body.author_ua) : cur.author_ua,
    body.text_en !== undefined ? String(body.text_en) : cur.text_en,
    body.text_ua !== undefined ? (body.text_ua ? String(body.text_ua) : null) : cur.text_ua,
    body.avatar_url !== undefined ? (body.avatar_url ? String(body.avatar_url) : null) : cur.avatar_url,
    body.avatar_alt_en !== undefined ? String(body.avatar_alt_en) : cur.avatar_alt_en,
    body.avatar_alt_ua !== undefined ? String(body.avatar_alt_ua) : cur.avatar_alt_ua,
    body.is_published !== undefined ? (body.is_published ? 1 : 0) : cur.is_published,
    body.sort_order !== undefined ? Number(body.sort_order) : cur.sort_order,
    id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { id } = await ctx.params;
  getDb().prepare('DELETE FROM reviews WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
