import { getDb } from './db';

/**
 * Raw car row as returned by the pricing SELECT.
 */
interface CarQueryRow {
  slug: string;
  price_per_day: number;
  deposit: number;
  engine: string;
  transmission: string;
  fuel_type: string;
  seats: number;
  tariff_1_3: number;
  tariff_4_9: number;
  tariff_10_25: number;
  tariff_26: number;
  form_aliases: string | null;
  category: string;
  title: string | null;
  title_ua: string | null;
}

/**
 * Raw extra row as returned by the extras SELECT.
 */
interface ExtraQueryRow {
  slug: string;
  price: number;
  price_type: string;
  is_active: number;
  sort_order: number;
  name_en: string | null;
  name_ua: string | null;
}


/**
 * Live pricing snapshot from the database: every live car with its tariff
 * grid, and every active extra.
 */
export function loadPricingFromDb() {
  const db = getDb();
  const carsRows = db
    .prepare(
      `SELECT c.slug, c.price_per_day, c.deposit, c.engine, c.transmission,
              c.fuel_type, c.seats, c.tariff_1_3, c.tariff_4_9, c.tariff_10_25,
              c.tariff_26, c.form_aliases, cat.slug AS category,
              t.title, tua.title AS title_ua
       FROM cars c
       JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN car_translations t ON t.car_id = c.id AND t.locale = 'en'
       LEFT JOIN car_translations tua ON tua.car_id = c.id AND tua.locale = 'ua'
       WHERE c.status = 'live'`
    )
    .all() as unknown as CarQueryRow[];

  const extraRows = db
    .prepare(
      `SELECT e.slug, e.price, e.price_type, e.is_active, e.sort_order,
              en.name AS name_en, ua.name AS name_ua
       FROM extras e
       LEFT JOIN extra_translations en ON en.extra_id = e.id AND en.locale = 'en'
       LEFT JOIN extra_translations ua ON ua.extra_id = e.id AND ua.locale = 'ua'
       WHERE e.is_active = 1
       ORDER BY e.sort_order`
    )
    .all() as unknown as ExtraQueryRow[];

  return {
    cars: carsRows.map((r) => ({
      title: r.title ?? r.slug,
      /**
       * The Ukrainian title travels with the row so a Ukrainian booking is
       * stored and announced under the name the visitor actually picked.
       */
      title_ua: r.title_ua ?? r.title,
      slug: r.slug,
      category: r.category,
      price_per_day: r.price_per_day,
      deposit: r.deposit,
      engine: r.engine,
      transmission: r.transmission,
      fuel_type: r.fuel_type,
      seats: r.seats,
      tariffs: [r.tariff_1_3, r.tariff_4_9, r.tariff_10_25, r.tariff_26],
      form_aliases: r.form_aliases ?? ''
    })),
    extras: extraRows.map((r) => ({
      slug: r.slug,
      price: r.price,
      price_type: r.price_type,
      name_en: r.name_en ?? r.slug,
      name_ua: r.name_ua ?? r.slug
    }))
  };
}
