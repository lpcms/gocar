import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';

/**
 * Update / delete a category. Delete is blocked while cars reference it
 * (RESTRICT FK) — the API returns 409 with a helpful error code.
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
    slug?: string; name_en?: string; name_ua?: string; sort_order?: number;
    description_en?: string; description_ua?: string;
  };
  const db = getDb();
  /**
   * Name and description of one locale live in the same row, so they are
   * written together: a partial payload keeps the field it does not carry.
   */
  const writeTranslation = (locale: 'en' | 'ua', name?: string, description?: string): void => {
    if (name === undefined && description === undefined) return;
    const cur = db
      .prepare('SELECT name, description FROM category_translations WHERE category_id = ? AND locale = ?')
      .get(id, locale) as unknown as { name: string; description: string | null } | undefined;
    const nextName = name ?? cur?.name ?? '';
    const nextText = description ?? cur?.description ?? '';
    db.prepare(
      `INSERT INTO category_translations (category_id, locale, name, description)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(category_id, locale)
       DO UPDATE SET name = excluded.name, description = excluded.description`
    ).run(id, locale, String(nextName), String(nextText));
  };
  try {
    if (body.slug !== undefined || body.sort_order !== undefined) {
      const cur = db.prepare('SELECT slug, sort_order FROM categories WHERE id = ?').get(id) as unknown as | { slug: string; sort_order: number }
        | undefined;
      if (!cur) return NextResponse.json({ ok: false }, { status: 404 });
      db.prepare('UPDATE categories SET slug = ?, sort_order = ? WHERE id = ?').run(
        body.slug ?? cur.slug,
        Number(body.sort_order ?? cur.sort_order),
        id
      );
    }
    writeTranslation('en', body.name_en, body.description_en);
    writeTranslation('ua', body.name_ua, body.description_ua);
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
  const used = db.prepare('SELECT COUNT(*) AS n FROM cars WHERE category_id = ?').get(id) as unknown as {
    n: number;
  };
  if (used.n > 0) {
    return NextResponse.json(
      { ok: false, error: 'in_use', cars_count: used.n },
      { status: 409 }
    );
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
