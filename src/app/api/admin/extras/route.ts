import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';

/**
 * Extras CRUD (list / create). Each extra carries a price and a type
 * (per_day / per_order), plus EN/UA labels and an active flag.
 */
export async function GET(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT e.id, e.slug, e.price, e.price_type, e.is_active, e.sort_order,
              en.name AS name_en, ua.name AS name_ua
       FROM extras e
       LEFT JOIN extra_translations en ON en.extra_id = e.id AND en.locale = 'en'
       LEFT JOIN extra_translations ua ON ua.extra_id = e.id AND ua.locale = 'ua'
       ORDER BY e.sort_order, e.id`
    )
    .all();
  return NextResponse.json({ ok: true, items: rows });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const body = (await req.json().catch(() => ({}))) as {
    slug?: string; price?: number; price_type?: string;
    name_en?: string; name_ua?: string; sort_order?: number; is_active?: number;
  };
  const slug = String(body.slug ?? '').trim();
  const nameEn = String(body.name_en ?? '').trim();
  const nameUa = String(body.name_ua ?? '').trim();
  const priceType = body.price_type === 'per_order' ? 'per_order' : 'per_day';
  const price = Number(body.price ?? 0);
  if (!slug || !nameEn || !nameUa || Number.isNaN(price) || price < 0) {
    return NextResponse.json({ ok: false, error: 'required' }, { status: 422 });
  }
  const db = getDb();
  try {
    const res = db
      .prepare(
        'INSERT INTO extras (slug, price, price_type, is_active, sort_order) VALUES (?, ?, ?, ?, ?)'
      )
      .run(slug, price, priceType, body.is_active === 0 ? 0 : 1, Number(body.sort_order ?? 0));
    const id = Number(res.lastInsertRowid);
    const ins = db.prepare('INSERT INTO extra_translations VALUES (?, ?, ?)');
    ins.run(id, 'en', nameEn);
    ins.run(id, 'ua', nameUa);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE/.test(msg)) {
      return NextResponse.json({ ok: false, error: 'slug_taken' }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
