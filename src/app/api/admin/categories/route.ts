import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';

/**
 * Categories CRUD (list / create). Individual records: /categories/[id].
 */
export async function GET(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.id, c.slug, c.sort_order,
              en.name AS name_en, ua.name AS name_ua,
              COALESCE(en.description, '') AS description_en,
              COALESCE(ua.description, '') AS description_ua,
              (SELECT COUNT(*) FROM cars WHERE category_id = c.id) AS cars_count
       FROM categories c
       LEFT JOIN category_translations en ON en.category_id = c.id AND en.locale = 'en'
       LEFT JOIN category_translations ua ON ua.category_id = c.id AND ua.locale = 'ua'
       ORDER BY c.sort_order, c.id`
    )
    .all();
  return NextResponse.json({ ok: true, items: rows });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const body = (await req.json().catch(() => ({}))) as {
    slug?: string; name_en?: string; name_ua?: string; sort_order?: number;
    description_en?: string; description_ua?: string;
  };
  const slug = String(body.slug ?? '').trim();
  const nameEn = String(body.name_en ?? '').trim();
  const nameUa = String(body.name_ua ?? '').trim();
  const textEn = String(body.description_en ?? '');
  const textUa = String(body.description_ua ?? '');
  if (!slug || !nameEn || !nameUa) {
    return NextResponse.json({ ok: false, error: 'required' }, { status: 422 });
  }
  const db = getDb();
  try {
    const res = db
      .prepare('INSERT INTO categories (slug, sort_order) VALUES (?, ?)')
      .run(slug, Number(body.sort_order ?? 0));
    const id = Number(res.lastInsertRowid);
    /** Columns are listed explicitly, so a later column cannot shift them. */
    const ins = db.prepare(
      'INSERT INTO category_translations (category_id, locale, name, description) VALUES (?, ?, ?, ?)'
    );
    ins.run(id, 'en', nameEn, textEn);
    ins.run(id, 'ua', nameUa, textUa);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE/.test(msg)) {
      return NextResponse.json({ ok: false, error: 'slug_taken' }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
