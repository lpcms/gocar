import { getDb } from './db';
import { pickMediaAlt } from './media-alt';

/**
 * Data needed to inject DB values into a car-detail snapshot, resolved
 * per locale. Phase 2: the snapshot markup/CSS/runtime is kept as-is and
 * only these value nodes are replaced on the fly by the route.
 */
export interface CarCardData {
  slug: string;
  status: string;
  title: string;
  category: string;
  pricePerDay: number;
  deposit: number;
  engine: string;
  transmission: string;
  fuelType: string;
  seats: string;
  /** Sixth specification, added for the new render (client 22.08.2026). */
  drivetrain: string;
  tariffs: [number, number, number, number];
  photos: {
    image: string | null;
    preview1: string | null;
    preview2: string | null;
    preview3: string | null;
    imageAlt: string;
    preview1Alt: string;
    preview2Alt: string;
    preview3Alt: string;
  };
}

/**
 * Raw car row joined with the requested locale's title and category name.
 */
interface CarQueryRow {
  slug: string;
  status: string;
  price_per_day: number;
  deposit: number;
  engine: string | null;
  transmission: string | null;
  fuel_type: string | null;
  seats: string | null;
  drivetrain: string | null;
  tariff_1_3: number;
  tariff_4_9: number;
  tariff_10_25: number;
  tariff_26: number;
  image_id: number | null;
  preview1_id: number | null;
  preview2_id: number | null;
  preview3_id: number | null;
  title: string | null;
  category: string | null;
}

/**
 * A related-car entry rendered in our own "You may also like" block:
 * everything comes from the DB for the requested locale.
 */
export interface RelatedCar {
  slug: string;
  title: string;
  price: string;
  /**
   * The bare daily rate behind `price`. The phase-2 page reprints the label
   * with the editable per-day wording; the phase-1 injector keeps `price`.
   */
  pricePerDay: number;
  image: string | null;
  imageAlt: string;
}

/**
 * Load the cars selected for a given car's "You may also like" block, in
 * the order the admin picked them. Only live cars are returned.
 *
 * Returns null when the car was never configured (related_slugs IS NULL):
 * the page then keeps the Framer snapshot slider. An empty array means the
 * admin deliberately cleared the selection, and the block is hidden.
 */
export function getRelatedCars(slug: string, locale: 'en' | 'ua'): RelatedCar[] | null {
  const db = getDb();
  const owner = db
    .prepare('SELECT related_slugs FROM cars WHERE slug = ?')
    .get(slug) as unknown as { related_slugs: string | null } | undefined;
  if (owner === undefined) return null;
  const wanted = (owner.related_slugs ?? '')
    .split(',')
    .map((s) => s.trim())
    /**
     * Match stored slugs exactly. Earlier code stripped anything from "---"
     * onward to tolerate tagged test entries (e.g. "renault-logan-35---EN"),
     * but that let a stale/mistyped CSV entry resolve to a real car and appear
     * in "You may also like" even though its checkbox is unticked in admin
     * (the admin list compares by exact slug). With no strip, only slugs that
     * exactly match a live car's slug are shown, so admin picks and output
     * stay in sync. A "---" tagged entry simply resolves to nothing.
     */
    .filter((s) => s !== '');
  /**
   * "You may also like" is driven solely by the admin's picks for this car.
   * An empty selection returns an empty list; the caller hides the whole
   * section (heading included) in that case.
   */
  if (wanted.length === 0) return [];

  const placeholders = wanted.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT c.slug,
              COALESCE(NULLIF(loc.title, ''), en.title) AS title,
              c.price_per_day,
              m.webp_path AS image,
              m.alt_en, m.alt_ua
       FROM cars c
       LEFT JOIN car_translations en ON en.car_id = c.id AND en.locale = 'en'
       LEFT JOIN car_translations loc ON loc.car_id = c.id AND loc.locale = ?
       LEFT JOIN media m ON m.id = c.image_id
       WHERE c.status = 'live' AND c.slug IN (${placeholders})`
    )
    .all(locale, ...wanted) as unknown as Array<{
    slug: string;
    title: string | null;
    price_per_day: number;
    image: string | null;
    alt_en: string | null;
    alt_ua: string | null;
  }>;

  /**
   * Preserve the admin's chosen order rather than the SQL result order.
   */
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const out: RelatedCar[] = [];
  for (const want of wanted) {
    const r = bySlug.get(want);
    if (r === undefined) continue;
    const alt = pickMediaAlt(r.alt_en, r.alt_ua, locale);
    out.push({
      slug: r.slug,
      title: r.title ?? '',
      /** Same per-day suffix the fleet and cars pages use for the locale. */
      price: `$${r.price_per_day}${locale === 'ua' ? '/день' : '/day'}`,
      pricePerDay: r.price_per_day,
      image: r.image,
      imageAlt: alt !== '' ? alt : (r.title ?? '')
    });
  }
  return out;
}

/**
 * Resolve one media id to its public webp path, or null.
 */
function mediaPath(id: number | null): string | null {
  if (id === null) return null;
  const row = getDb()
    .prepare('SELECT webp_path FROM media WHERE id = ?')
    .get(id) as unknown as { webp_path: string } | undefined;
  return row ? row.webp_path : null;
}

/**
 * Locale-specific alt text for a media id, or '' when absent. Used so the
 * car-detail gallery images carry their DB alt (set in the Cars section).
 */
function mediaAlt(id: number | null, locale: 'en' | 'ua'): string {
  if (id === null) return '';
  const row = getDb()
    .prepare('SELECT alt_en, alt_ua FROM media WHERE id = ?')
    .get(id) as unknown as { alt_en: string | null; alt_ua: string | null } | undefined;
  if (!row) return '';
  return pickMediaAlt(row.alt_en, row.alt_ua, locale);
}

/**
 * Load the data for a single car card in the given locale ('en' | 'ua').
 * Returns null when the slug is unknown. Missing spec fields fall back to
 * empty strings so the caller can decide whether to inject.
 */
/**
 * Localized car name and description for SEO (title/description of a
 * car-detail page). Falls back to the English title when the localized one is
 * empty, and returns null when the slug has no car. The description comes from
 * the car's own translation (admin "Описание EN/UA").
 */
export function getCarSeo(
  slug: string,
  locale: 'en' | 'ua'
): { name: string; description: string; price: number } | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(NULLIF(loc.title, ''), en.title) AS name,
              COALESCE(NULLIF(loc.description, ''), en.description) AS description,
              c.price_per_day AS price
       FROM cars c
       LEFT JOIN car_translations en ON en.car_id = c.id AND en.locale = 'en'
       LEFT JOIN car_translations loc ON loc.car_id = c.id AND loc.locale = ?
       WHERE c.slug = ?`
    )
    .get(locale, slug) as unknown as
    | { name: string | null; description: string | null; price: number | null }
    | undefined;
  if (!row) return null;
  return { name: row.name ?? '', description: row.description ?? '', price: row.price ?? 0 };
}

export function getCarCardData(slug: string, locale: 'en' | 'ua'): CarCardData | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT c.slug, c.status, c.price_per_day, c.deposit,
              COALESCE(NULLIF(t.engine, ''), c.engine) AS engine,
              COALESCE(NULLIF(t.transmission, ''), c.transmission) AS transmission,
              COALESCE(NULLIF(t.fuel_type, ''), c.fuel_type) AS fuel_type,
              COALESCE(NULLIF(t.seats, ''), c.seats) AS seats,
              COALESCE(NULLIF(t.drivetrain, ''), c.drivetrain) AS drivetrain,
              c.tariff_1_3, c.tariff_4_9, c.tariff_10_25, c.tariff_26,
              c.image_id, c.preview1_id, c.preview2_id, c.preview3_id,
              t.title AS title, cat.name AS category
       FROM cars c
       LEFT JOIN car_translations t ON t.car_id = c.id AND t.locale = ?
       LEFT JOIN categories cc ON cc.id = c.category_id
       LEFT JOIN category_translations cat ON cat.category_id = cc.id AND cat.locale = ?
       WHERE c.slug = ?`
    )
    .get(locale, locale, slug) as unknown as CarQueryRow | undefined;
  if (!row) return null;

  /**
   * A photo nobody has described in Автомобили yet is named after the car, so
   * no picture on the detail page is left without an alt. An empty slot has no
   * picture and needs no text.
   */
  const describe = (id: number | null): string => {
    if (id === null) return '';
    const written = mediaAlt(id, locale);
    return written !== '' ? written : (row.title ?? '');
  };
  return {
    slug: row.slug,
    status: row.status,
    title: row.title ?? '',
    category: row.category ?? '',
    pricePerDay: row.price_per_day,
    deposit: row.deposit,
    engine: row.engine ?? '',
    transmission: row.transmission ?? '',
    fuelType: row.fuel_type ?? '',
    seats: row.seats ?? '',
    drivetrain: row.drivetrain ?? '',
    tariffs: [row.tariff_1_3, row.tariff_4_9, row.tariff_10_25, row.tariff_26],
    photos: {
      image: mediaPath(row.image_id),
      preview1: mediaPath(row.preview1_id),
      preview2: mediaPath(row.preview2_id),
      preview3: mediaPath(row.preview3_id),
      imageAlt: describe(row.image_id),
      preview1Alt: describe(row.preview1_id),
      preview2Alt: describe(row.preview2_id),
      preview3Alt: describe(row.preview3_id)
    }
  };
}
