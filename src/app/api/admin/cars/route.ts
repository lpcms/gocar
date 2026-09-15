import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';

/**
 * Cars list + create. Rich fields (features 1-6, tariff bracket) are
 * edited on the per-car page; POST creates a shell that opens for edit.
 */
export async function GET(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const db = getDb();
  const rows = db.prepare(
    `SELECT c.id, c.slug, c.status, c.price_per_day, c.deposit, c.is_popular, c.sort_order,
            cat.slug AS category_slug,
            en.title AS title_en, ua.title AS title_ua,
            m.webp_path AS image_path
     FROM cars c
     JOIN categories cat ON cat.id = c.category_id
     LEFT JOIN car_translations en ON en.car_id = c.id AND en.locale = 'en'
     LEFT JOIN car_translations ua ON ua.car_id = c.id AND ua.locale = 'ua'
     LEFT JOIN media m ON m.id = c.image_id
     ORDER BY c.sort_order, c.id`
  ).all();
  return NextResponse.json({ ok: true, items: rows });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const body = (await req.json().catch(() => ({}))) as {
    slug?: string; title_en?: string; title_ua?: string; category_id?: number;
  };
  const slug = String(body.slug ?? '').trim();
  const titleEn = String(body.title_en ?? '').trim();
  const titleUa = String(body.title_ua ?? '').trim();
  const categoryId = Number(body.category_id ?? 0);
  if (!slug || !titleEn || !titleUa || categoryId <= 0) {
    return NextResponse.json({ ok: false, error: 'required' }, { status: 422 });
  }
  const db = getDb();
  try {
    /**
     * A new car goes to the end of the manual order, one step (10) past the
     * current last one, so the admin can renumber without touching the rest.
     */
    const last = db
      .prepare('SELECT MAX(sort_order) AS max_order FROM cars')
      .get() as unknown as { max_order: number | null } | undefined;
    const sortOrder = ((last?.max_order ?? 0) as number) + 10;
    const res = db.prepare(
      `INSERT INTO cars (slug, status, category_id, price_per_day, deposit,
                         tariff_1_3, tariff_4_9, tariff_10_25, tariff_26, sort_order)
       VALUES (?, 'draft', ?, 0, 0, 0, 0, 0, 0, ?)`
    ).run(slug, categoryId, sortOrder);
    const id = Number(res.lastInsertRowid);
    const tr = db.prepare('INSERT INTO car_translations (car_id, locale, title, description) VALUES (?, ?, ?, NULL)');
    tr.run(id, 'en', titleEn);
    tr.run(id, 'ua', titleUa);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE/.test(msg)) return NextResponse.json({ ok: false, error: 'slug_taken' }, { status: 409 });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
