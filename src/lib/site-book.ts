import { getDb } from './db';
import { getTranslation } from './translations';
import { getMediaAlt } from './media-alt';
import type { Locale } from './site-nav';
import { getRecaptchaSiteKey, RECAPTCHA_FORMS } from './recaptcha';
import { getPlaces } from './book-places';

/** One bookable car, with everything the form needs to price it. */
export type BookCar = {
  /** Slug of the car page, so a "Book Now" link can name the car it came from. */
  slug: string;
  name: string;
  category: string;
  tariffs: [number, number, number, number];
  deposit: number;
  image: string | null;
};

/** One paid option of the booking form. */
export type BookExtra = {
  slug: string;
  name: string;
  /** Value sent to /api/lead; the server matches extras by their English name. */
  value: string;
  price: number;
  priceType: 'per_day' | 'per_order';
};

/** One entry of the pick-up / drop-off place list. */
export type BookPlace = { value: string; label: string };

/** Everything the booking page renders, resolved for one locale. */
export type BookData = {
  cars: BookCar[];
  categories: string[];
  extras: BookExtra[];
  places: BookPlace[];
  times: string[];
  texts: Record<string, string>;
  /** Alt of the picture shown before a car is picked, from the media library. */
  placeholderAlt: string;
  recaptchaSiteKey: string;
};

/**
 * Strip an accidental "---suffix" or " - suffix" test tag from a stored label,
 * the same way the phase-1 injector does: the form matches a car by its name,
 * and the lead endpoint compares against the cleaned value.
 */
function cleanLabel(value: string): string {
  const noTriple = value.split('---')[0] ?? value;
  return noTriple.replace(/\s+-\s+(en|ua)\b.*$/i, '').trim();
}

/**
 * Web path of a media row, used for the vehicle picture.
 */
function mediaPath(id: number | null): string | null {
  if (id === null) return null;
  const row = getDb()
    .prepare('SELECT webp_path FROM media WHERE id = ?')
    .get(id) as unknown as { webp_path: string } | undefined;
  return row === undefined ? null : row.webp_path;
}

/**
 * Live cars with their tariff brackets, deposit, picture and category name.
 */
function collectCars(locale: Locale): BookCar[] {
  const rows = getDb()
    .prepare(
      `SELECT c.slug, c.image_id, c.deposit,
              c.tariff_1_3, c.tariff_4_9, c.tariff_10_25, c.tariff_26,
              en.title AS title_en, ua.title AS title_ua,
              cen.name AS cat_en, cua.name AS cat_ua
       FROM cars c
       LEFT JOIN car_translations en ON en.car_id = c.id AND en.locale = 'en'
       LEFT JOIN car_translations ua ON ua.car_id = c.id AND ua.locale = 'ua'
       LEFT JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN category_translations cen ON cen.category_id = cat.id AND cen.locale = 'en'
       LEFT JOIN category_translations cua ON cua.category_id = cat.id AND cua.locale = 'ua'
       WHERE c.status = 'live'
       ORDER BY c.sort_order, c.id`
    )
    .all() as unknown as Array<{
    slug: string;
    image_id: number | null;
    deposit: number;
    tariff_1_3: number;
    tariff_4_9: number;
    tariff_10_25: number;
    tariff_26: number;
    title_en: string | null;
    title_ua: string | null;
    cat_en: string | null;
    cat_ua: string | null;
  }>;

  return rows.map((row) => ({
    slug: row.slug,
    name: cleanLabel((locale === 'ua' ? row.title_ua : row.title_en) ?? ''),
    category: cleanLabel((locale === 'ua' ? row.cat_ua : row.cat_en) ?? ''),
    tariffs: [row.tariff_1_3, row.tariff_4_9, row.tariff_10_25, row.tariff_26],
    deposit: row.deposit,
    image: mediaPath(row.image_id)
  }));
}

/**
 * Category names in the admin's order, for the pill row above the vehicle list.
 */
function collectCategories(locale: Locale): string[] {
  const rows = getDb()
    .prepare(
      `SELECT en.name AS name_en, ua.name AS name_ua
       FROM categories c
       LEFT JOIN category_translations en ON en.category_id = c.id AND en.locale = 'en'
       LEFT JOIN category_translations ua ON ua.category_id = c.id AND ua.locale = 'ua'
       ORDER BY c.sort_order`
    )
    .all() as unknown as Array<{ name_en: string | null; name_ua: string | null }>;
  return rows
    .map((row) => cleanLabel((locale === 'ua' ? row.name_ua : row.name_en) ?? ''))
    .filter((name) => name !== '');
}

/**
 * Active extras. `value` carries the English name because leads.ts matches an
 * extra by the label the client sends, in either locale.
 */
function collectExtras(locale: Locale): BookExtra[] {
  const rows = getDb()
    .prepare(
      `SELECT e.slug, e.price, e.price_type,
              en.name AS name_en, ua.name AS name_ua
       FROM extras e
       LEFT JOIN extra_translations en ON en.extra_id = e.id AND en.locale = 'en'
       LEFT JOIN extra_translations ua ON ua.extra_id = e.id AND ua.locale = 'ua'
       WHERE e.is_active = 1
       ORDER BY e.sort_order`
    )
    .all() as unknown as Array<{
    slug: string;
    price: number;
    price_type: string;
    name_en: string | null;
    name_ua: string | null;
  }>;
  return rows.map((row) => {
    const label = cleanLabel((locale === 'ua' ? row.name_ua : row.name_en) ?? '');
    return {
      slug: row.slug,
      name: label,
      value: cleanLabel(row.name_en ?? label),
      price: row.price,
      priceType: row.price_type === 'per_order' ? 'per_order' : 'per_day'
    };
  });
}

/** Keys of the form's copy, resolved in one place so the island stays dumb. */
const TEXT_KEYS: [string, string, string][] = [
  ['categoriesTitle', 'book.categories_title', 'Select Categories'],
  ['vehicleTitle', 'book.vehicle_title', 'Select Vehicle'],
  ['pickupTitle', 'book.pickup_title', 'Pick-up'],
  ['dropoffTitle', 'book.dropoff_title', 'Drop-off'],
  ['extrasTitle', 'book.extras_title', 'Extras'],
  ['allCategories', 'book.all_categories', 'All Categories'],
  ['vehiclePlaceholder', 'book.vehicle_placeholder', 'Vehicle'],
  ['datePlaceholder', 'book.date_placeholder', 'Date'],
  ['timePlaceholder', 'book.time_placeholder', 'Time'],
  ['locationPlaceholder', 'book.location_placeholder', 'Location'],
  ['namePlaceholder', 'book.name_placeholder', 'Name'],
  ['phonePlaceholder', 'book.phone_placeholder', 'Phone'],
  ['commentPlaceholder', 'book.comment_placeholder', 'Comment on the order'],
  ['submit', 'book.submit', 'Book'],
  ['insuranceNote', 'book.insurance_note', '(available from 3 days)'],
  ['perDay', 'book.per_day', 'day'],
  ['perOrder', 'book.per_order', 'order'],
  ['totalDays', 'book.total_days', 'Total days rental'],
  ['totalRental', 'book.total_rental', 'Total cost rental'],
  ['totalExtras', 'book.total_extras', 'Total cost extras'],
  ['totalDeposit', 'book.deposit', 'Deposit'],
  ['stateSending', 'book.state_sending', 'Sending…'],
  ['stateSent', 'book.state_sent', 'Sent ✓'],
  ['stateError', 'book.state_error', 'Error, try again'],
  ['stateVehicle', 'book.state_vehicle', 'Select a vehicle'],
  ['stateDates', 'book.state_dates', 'Check the dates'],
  ['stateRequired', 'book.state_required', 'Fill in name and phone'],
  ['stateIncomplete', 'book.state_incomplete', 'Fill in the required fields'],
  ['stateOrder', 'book.state_order', 'The drop-off must be later than the pick-up'],
  ['statePlace', 'book.state_place', 'Choose the time and place of pick-up and drop-off'],
  ['modalTitle', 'book.modal_title', 'Thank you, your order is confirmed!'],
  ['modalSub', 'book.modal_sub', 'A manager will contact you within 24 hours.'],
  ['modalDetails', 'book.modal_details_title', 'Order details'],
  ['modalName', 'book.modal_row_name', 'Name'],
  ['modalPhone', 'book.modal_row_phone', 'Phone'],
  ['modalVehicle', 'book.modal_row_vehicle', 'Vehicle'],
  ['modalPickup', 'book.modal_row_pickup', 'Pick-up'],
  ['modalDropoff', 'book.modal_row_dropoff', 'Drop-off'],
  ['modalExtras', 'book.modal_row_extras', 'Extras'],
  ['modalComment', 'book.modal_row_comment', 'Comment'],
  ['priceDays', 'book.modal_price_days', 'Days'],
  ['priceRental', 'book.modal_price_rental', 'Rental'],
  ['priceExtras', 'book.modal_price_extras', 'Extras'],
  ['priceDeposit', 'book.modal_price_deposit', 'Deposit'],
  ['priceTotal', 'book.modal_price_total', 'Total'],
  ['close', 'menu.close', 'Close']
];

/**
 * Everything the booking page needs, in one read: the fleet with its prices,
 * the categories, the extras, the place and time lists, every visible string
 * and the reCAPTCHA site key. The island receives this as plain props and
 * never touches the database itself (plan section 4.2).
 */
export function getBookData(locale: Locale): BookData {
  const texts: Record<string, string> = {};
  for (const [field, key, fallback] of TEXT_KEYS) {
    texts[field] = getTranslation(key, locale, fallback);
  }
  const places = getPlaces(locale);
  const times: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    times.push(`${String(hour).padStart(2, '0')}:00`);
  }
  return {
    cars: collectCars(locale),
    categories: collectCategories(locale),
    extras: collectExtras(locale),
    places,
    times,
    texts,
    placeholderAlt: getMediaAlt('/images/site/book-placeholder.png', locale),
    /**
     * Through the shared helper, not the raw setting: it applies the rule
     * that both keys must be present and honours the local off-switch.
     */
    recaptchaSiteKey: getRecaptchaSiteKey(RECAPTCHA_FORMS)
  };
}
