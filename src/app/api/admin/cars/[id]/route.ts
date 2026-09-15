import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';

interface CarRow {
  id: number;
  slug: string;
  status: string;
  category_id: number;
  price_per_day: number;
  deposit: number;
  is_popular: number;
  sort_order: number;
  engine: string | null;
  transmission: string | null;
  fuel_type: string | null;
  seats: string | null;
  tariff_1_3: number;
  tariff_4_9: number;
  tariff_10_25: number;
  tariff_26: number;
  form_aliases: string | null;
  related_slugs: string | null;
  image_id: number | null;
  preview1_id: number | null;
  preview2_id: number | null;
  preview3_id: number | null;
}

/**
 * A media row resolved for one photo slot (main or preview).
 */
interface PhotoRow {
  id: number;
  webp_path: string;
  original_path: string;
  alt_en: string;
  alt_ua: string;
}

interface FeatureRow {
  position: number;
  locale: 'en' | 'ua';
  title: string;
  text: string | null;
}

interface TranslationRow {
  locale: 'en' | 'ua';
  title: string;
  description: string | null;
  engine: string;
  transmission: string;
  fuel_type: string;
  seats: string;
  drivetrain: string;
}

/**
 * Read a single car with translations and features.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { id } = await ctx.params;
  const db = getDb();
  const car = db.prepare('SELECT * FROM cars WHERE id = ?').get(Number(id)) as unknown as CarRow | undefined;
  if (!car) return NextResponse.json({ ok: false }, { status: 404 });
  const tr = db.prepare(
    'SELECT locale, title, description, engine, transmission, fuel_type, seats, drivetrain FROM car_translations WHERE car_id = ?'
  ).all(car.id) as unknown as TranslationRow[];
  const feats = db.prepare('SELECT position, locale, title, text FROM car_features WHERE car_id = ? ORDER BY position').all(car.id) as unknown as FeatureRow[];

  /**
   * Resolve each photo slot to its media row (or null) so the editor can
   * show the current image and its alt text.
   */
  const photoStmt = db.prepare(
    'SELECT id, webp_path, original_path, alt_en, alt_ua FROM media WHERE id = ?'
  );
  const resolvePhoto = (mediaId: number | null): PhotoRow | null =>
    mediaId === null ? null : ((photoStmt.get(mediaId) as unknown as PhotoRow | undefined) ?? null);
  const photos = {
    image: resolvePhoto(car.image_id),
    preview1: resolvePhoto(car.preview1_id),
    preview2: resolvePhoto(car.preview2_id),
    preview3: resolvePhoto(car.preview3_id)
  };
  return NextResponse.json({ ok: true, car, translations: tr, features: feats, photos });
}

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
  const cur = db.prepare('SELECT * FROM cars WHERE id = ?').get(id) as unknown as CarRow | undefined;
  if (!cur) return NextResponse.json({ ok: false }, { status: 404 });
  const pick = <T,>(key: string, cast: (v: unknown) => T, fallback: T): T =>
    body[key] === undefined ? fallback : cast(body[key]);
  /**
   * String cast that treats null/undefined as an empty value. Without the
   * guard, String(null) would persist the literal text "null" into the
   * column (visible in the editor as a bogus "null" value).
   */
  const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
  const n = (v: unknown): number => Number(v);
  try {
    db.prepare(
      `UPDATE cars SET slug=?, status=?, category_id=?, price_per_day=?, deposit=?, is_popular=?,
        sort_order=?,
        engine=?, transmission=?, fuel_type=?, seats=?,
        tariff_1_3=?, tariff_4_9=?, tariff_10_25=?, tariff_26=?, form_aliases=?,
        related_slugs=?
       WHERE id=?`
    ).run(
      pick('slug', s, cur.slug),
      pick('status', s, cur.status),
      pick('category_id', n, cur.category_id),
      pick('price_per_day', n, cur.price_per_day),
      pick('deposit', n, cur.deposit),
      pick('is_popular', n, cur.is_popular ?? 0),
      pick('sort_order', n, cur.sort_order ?? 0),
      pick('engine', s, cur.engine ?? ''),
      pick('transmission', s, cur.transmission ?? ''),
      pick('fuel_type', s, cur.fuel_type ?? ''),
      pick('seats', s, cur.seats ?? ''),
      pick('tariff_1_3', n, cur.tariff_1_3),
      pick('tariff_4_9', n, cur.tariff_4_9),
      pick('tariff_10_25', n, cur.tariff_10_25),
      pick('tariff_26', n, cur.tariff_26),
      pick('form_aliases', s, cur.form_aliases ?? ''),
      pick('related_slugs', s, cur.related_slugs ?? ''),
      id
    );
    const trUp = db.prepare(
      `INSERT INTO car_translations (car_id, locale, title, description, engine, transmission, fuel_type, seats, drivetrain)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(car_id, locale) DO UPDATE SET title=excluded.title, description=excluded.description,
         engine=excluded.engine, transmission=excluded.transmission,
         fuel_type=excluded.fuel_type, seats=excluded.seats,
         drivetrain=excluded.drivetrain`
    );
    if (body.translations && Array.isArray(body.translations)) {
      for (const t of body.translations as TranslationRow[]) {
        trUp.run(
          id, t.locale, String(t.title ?? ''), t.description ? String(t.description) : null,
          s(t.engine), s(t.transmission), s(t.fuel_type), s(t.seats), s(t.drivetrain)
        );
      }
    }
    /**
     * Features are stored positionally 1-6; empty ones are removed.
     */
    if (body.features && Array.isArray(body.features)) {
      db.prepare('DELETE FROM car_features WHERE car_id = ?').run(id);
      const ins = db.prepare(
        'INSERT INTO car_features (car_id, position, locale, title, text) VALUES (?, ?, ?, ?, ?)'
      );
      for (const f of body.features as FeatureRow[]) {
        const title = String(f.title ?? '').trim();
        if (title === '') continue;
        ins.run(id, Number(f.position), f.locale, title, f.text ? String(f.text) : null);
      }
    }
    db.prepare("UPDATE cars SET updated_at = datetime('now') WHERE id = ?").run(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE/.test(msg)) return NextResponse.json({ ok: false, error: 'slug_taken' }, { status: 409 });
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
  getDb().prepare('DELETE FROM cars WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
