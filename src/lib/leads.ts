import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './db';
import { loadPricingFromDb } from './pricing';
import { placeLabel } from './book-places';
import type { Locale } from './locale-path';

/**
 * Lead intake API (TZ v5.2 §2.3 п.1): server-side price calculation,
 * Telegram notification (message format preserved 1:1 from the legacy
 * integration) and persistence. Client-provided prices are ignored.
 */

const ROOT = process.cwd();

/**
 * A car pricing row as loaded from the database.
 */
interface CarRow {
  title: string;
  /** Ukrainian title of the same car; equal to `title` while untranslated. */
  title_ua?: string | null;
  slug: string;
  form_aliases?: string | null;
  tariffs: number[];
  deposit: number;
  [key: string]: unknown;
}

/**
 * An extra (add-on) pricing row as loaded from the database.
 */
interface ExtraRow {
  slug: string;
  name_en: string;
  name_ua: string;
  price: number;
  price_type: string;
  [key: string]: unknown;
}

/**
 * The pricing snapshot: all active cars and extras.
 */
interface Pricing {
  cars: CarRow[];
  extras: ExtraRow[];
}

/**
 * A submitted form payload (booking or contact). All fields optional
 * because the same shape covers both form types and partial input.
 */
interface LeadPayload {
  vehicle?: string;
  pickup_date?: string;
  pickup_time?: string;
  pickup_place?: string;
  dropoff_date?: string;
  dropoff_time?: string;
  dropoff_place?: string;
  extras?: string[];
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
  comment?: string;
  locale?: string;
  page?: string;
  type?: string;
  [key: string]: unknown;
}

/**
 * A resolved single extra line in a booking calculation.
 */
interface ExtraLine {
  /** Identifier of the extra; empty when the label matched nothing we sell. */
  slug: string;
  label: string;
  price: number;
}

/**
 * The result of a server-side booking calculation.
 */
interface BookingCalc {
  car: CarRow;
  /** Car title in the language the booking was taken in. */
  carTitle: string;
  days: number;
  rental: number;
  extrasTotal: number;
  extras: ExtraLine[];
  deposit: number;
  total: number;
}

/**
 * A persisted lead row, assembled from the payload before insertion.
 * Fields are filled progressively depending on booking vs contact.
 */
interface LeadRecord {
  type?: string;
  locale: string;
  name: string;
  page?: string;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
  pickup_at?: string | null;
  pickup_place?: string | null;
  dropoff_at?: string | null;
  dropoff_place?: string | null;
  extras_json?: string | null;
  days?: number | null;
  rental_total?: number | null;
  extras_total?: number | null;
  deposit?: number | null;
  grand_total?: number | null;
  car_title?: string | null;
  comment?: string | null;
  /** reCAPTCHA v3 rating of the submission, null when it was not checked. */
  score?: number | null;
}

/**
 * Telegram credentials as stored in settings / config.local.json.
 */
interface TelegramConfig {
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  local?: boolean;
  [key: string]: unknown;
}

/**
 * Locale of a submission, as the two forms send it.
 *
 * The forms speak the URL's vocabulary - `uk` for Ukrainian, because that is
 * what the outside world (hreflang, the stored lead, GTM) calls it - while the
 * database and the rest of the code use `ua`. Everything a lead is worded in
 * goes through this, so an order taken in Ukrainian is stored and announced in
 * Ukrainian instead of arriving as "train station" and "Child seat"
 * (client 25.08.2026).
 */
function leadLocale(value: unknown): Locale {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  return raw === 'uk' || raw === 'ua' ? 'ua' : 'en';
}

/**
 * The labels of a Telegram notification.
 */
interface TelegramWording {
  bookingTitle: string;
  customer: string;
  vehicle: string;
  pickup: string;
  dropoff: string;
  extras: string;
  pricing: string;
  days: string;
  rental: string;
  extrasTotal: string;
  deposit: string;
  total: string;
  locale: string;
  contactTitle: string;
  name: string;
  email: string;
  message: string;
  page: string;
}

/**
 * Wording of the Telegram notification, in the language the lead came in.
 *
 * It lives here rather than in the `translations` table because the message is
 * not a page: its shape is the integration's contract, and an edit to a site
 * string must never be able to break a notification. Only the labels are here
 * - the places, the extras and the car name are read from the database in the
 * same locale.
 */
const TELEGRAM_TEXT: Record<Locale, TelegramWording> = {
  en: {
    bookingTitle: '🚗 New Car Rental Order',
    customer: 'Customer',
    vehicle: 'Vehicle',
    pickup: 'Pick-up',
    dropoff: 'Drop-off',
    extras: 'Extras',
    pricing: 'Pricing',
    days: 'Days',
    rental: 'Rental',
    extrasTotal: 'Extras',
    deposit: 'Deposit',
    total: 'Total',
    locale: 'Locale',
    contactTitle: '📩 New Contact Form Submission',
    name: 'Name',
    email: 'Email',
    message: 'Message',
    page: 'Page'
  },
  ua: {
    bookingTitle: '🚗 Нове замовлення авто',
    customer: 'Клієнт',
    vehicle: 'Автомобіль',
    pickup: 'Подача',
    dropoff: 'Повернення',
    extras: 'Додаткові опції',
    pricing: 'Вартість',
    days: 'Днів',
    rental: 'Оренда',
    extrasTotal: 'Опції',
    deposit: 'Депозит',
    total: 'Разом',
    locale: 'Локаль',
    contactTitle: '📩 Нове повідомлення з форми контактів',
    name: 'Імʼя',
    email: 'Email',
    message: 'Повідомлення',
    page: 'Сторінка'
  }
};

/**
 * Honeypot fields present in the Framer forms; any non-empty value
 * marks the submission as spam.
 */
const HONEYPOTS = [
  'website', 'company', 'message_hp', 'subject', 'title', 'description',
  'feedback', 'notes', 'details', 'remarks', 'comments'
];

/**
 * Load Telegram credentials from DB (Settings admin) with a fallback
 * to the legacy config.local.json for older installations.
 */
async function loadConfig() {
  try {
    const { getTelegramCreds } = await import('./settings');
    const creds = getTelegramCreds();
    if (creds) return { telegram_bot_token: creds.token, telegram_chat_id: creds.chat_id };
  } catch { /* DB may be unavailable on cold start */ }
  const file = path.join(ROOT, 'config.local.json');
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Pricing source: the SQLite database (live cars + active extras).
 */
function loadPricing(): Pricing {
  return loadPricingFromDb();
}

/**
 * Rental days — legacy rule ported from Framer form:
 * fractional part >= 0.17 rounds up, otherwise rounds down.
 * Minimum 1 day; 0 for invalid dates so the caller can reject.
 */
export function calcDays(pickupDate: string, dropoffDate: string, pickupTime: string, dropoffTime: string) {
  const a = new Date(pickupTime ? `${pickupDate}T${pickupTime}` : pickupDate);
  const b = new Date(dropoffTime ? `${dropoffDate}T${dropoffTime}` : dropoffDate);
  const ms = b.getTime() - a.getTime();
  if (!Number.isFinite(ms) || ms <= 0) {
    return 0;
  }
  const raw = ms / 86400000;
  const fractional = Number((raw % 1).toFixed(2));
  const days = fractional >= 0.17 ? Math.ceil(raw) : Math.floor(raw);
  return days > 0 ? days : 1;
}

/**
 * Daily rate from the tariff bracket for the given rental length.
 */
export function bracketRate(car: CarRow, days: number): number {
  const t = car.tariffs;
  if (days <= 3) return t[0] ?? 0;
  if (days <= 9) return t[1] ?? t[0] ?? 0;
  if (days <= 25) return t[2] ?? t[1] ?? t[0] ?? 0;
  return t[3] ?? t[2] ?? t[1] ?? t[0] ?? 0;
}

/**
 * Match an extra from the checkbox label text (locale-tolerant:
 * matches by known slugs/names in EN and UA).
 */
function matchExtra(extras: ExtraRow[], label: string) {
  const norm = label.trim().toLowerCase();
  return extras.find(
    (e) =>
      norm.includes(e.name_en.toLowerCase()) ||
      norm.includes(e.name_ua.toLowerCase()) ||
      norm.includes(e.slug.replace('-', ' '))
  );
}

/**
 * Name of an extra in the language the booking was taken in: that is what the
 * customer ticked, what «Заявки» shows and what Telegram announces.
 */
function extraLabel(extra: ExtraRow, locale: Locale): string {
  const label = locale === 'ua' ? extra.name_ua : extra.name_en;
  return label.trim() === '' ? extra.name_en : label;
}

/**
 * Server-side booking calculation. Returns null when the vehicle
 * cannot be resolved (calculation is then impossible).
 */
/**
 * Normalize any vehicle label to a comparison key: lowercase, no punctuation
 * or spaces. Cyrillic is kept, so a car whose Ukrainian title is translated
 * still matches itself. Brand aliases (e.g. VW -> Volkswagen) are NOT
 * hard-coded here; they live in cars.form_aliases and are matched below.
 */
function normalizeVehicle(label: string) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, '');
}

export function calcBooking(pricing: Pricing, payload: LeadPayload): BookingCalc | null {
  const locale = leadLocale(payload.locale);
  const wanted = normalizeVehicle(String(payload.vehicle ?? ""));
  if (wanted === '') {
    return null;
  }
  const car = pricing.cars.find((c) => {
    const title = normalizeVehicle(c.title);
    /**
     * The form submits the title of its own locale, so both are compared:
     * today the two are the same Latin name, and the day a car is renamed in
     * Ukrainian the order must still price.
     */
    const titleUa = normalizeVehicle(String(c.title_ua ?? ''));
    const slug = normalizeVehicle(c.slug);
    const aliases = String(c.form_aliases ?? '')
      .split(',')
      .map((a) => normalizeVehicle(a))
      .filter((a) => a !== '');
    if (title === wanted || titleUa === wanted || slug === wanted) return true;
    if (aliases.includes(wanted)) return true;
    if (title !== '' && (title.includes(wanted) || wanted.includes(title))) return true;
    return titleUa !== '' && (titleUa.includes(wanted) || wanted.includes(titleUa));
  });
  if (!car) {
    return null;
  }
  const days = calcDays(
    String(payload.pickup_date ?? ""),
    String(payload.dropoff_date ?? ""),
    String(payload.pickup_time ?? ""),
    String(payload.dropoff_time ?? "")
  );
  const rate = bracketRate(car, days);
  const rental = rate * days;
  let extrasTotal = 0;
  const extrasResolved: ExtraLine[] = [];
  /**
   * Full-coverage insurance is not a surcharge: it replaces the deposit.
   * Default deposit is the car's own; if the trip is 3+ days and the client
   * ticked insurance, the deposit instead becomes the insurance extra's
   * price. Below 3 days insurance is unavailable, so the full car deposit
   * always applies. Insurance never contributes to the extras total.
   */
  let deposit = car.deposit;
  const insurance = pricing.extras.find((e) => e.slug === 'full-coverage-insurance');
  for (const label of payload.extras || []) {
    const extra = matchExtra(pricing.extras, label);
    if (!extra) {
      extrasResolved.push({ slug: '', label, price: 0 });
      continue;
    }
    if (extra.slug === 'full-coverage-insurance') {
      /** Handled via the deposit below, not added to extras. */
      continue;
    }
    const price = extra.price_type === 'per_day' ? extra.price * days : extra.price;
    extrasTotal += price;
    extrasResolved.push({ slug: extra.slug, label: extraLabel(extra, locale), price });
  }
  const insuranceChosen = (payload.extras || []).some((label) => {
    const extra = matchExtra(pricing.extras, label);
    return extra !== undefined && extra.slug === 'full-coverage-insurance';
  });
  if (days >= 3 && insuranceChosen && insurance !== undefined) {
    deposit = insurance.price;
  }
  const titleUa = String(car.title_ua ?? '').trim();
  return {
    car,
    carTitle: locale === 'ua' && titleUa !== '' ? titleUa : car.title,
    days,
    rental,
    extrasTotal,
    extras: extrasResolved,
    deposit,
    total: rental + extrasTotal
  };
}

/**
 * Telegram message for a booking — the layout is the legacy one, worded in
 * the language the order was placed in.
 */
export function bookingMessage(payload: LeadPayload, calc: BookingCalc) {
  const locale = leadLocale(payload.locale);
  const t = TELEGRAM_TEXT[locale];
  const lines = [
    t.bookingTitle,
    '',
    t.customer,
    `👤 ${payload.name}`,
    `📞 ${payload.phone}`
  ];
  if (payload.comment) {
    lines.push(`💬 ${payload.comment}`);
  }
  lines.push(
    '',
    `${t.vehicle}: ${calc.carTitle}`,
    '',
    t.pickup,
    `📅 ${payload.pickup_date} ${payload.pickup_time}`,
    `📍 ${placeLabel(String(payload.pickup_place ?? ''), locale)}`,
    '',
    t.dropoff,
    `📅 ${payload.dropoff_date} ${payload.dropoff_time}`,
    `📍 ${placeLabel(String(payload.dropoff_place ?? ''), locale)}`
  );
  if (calc.extras.length > 0) {
    lines.push('', t.extras);
    for (const e of calc.extras) {
      lines.push(`• ${e.label}`);
    }
  }
  lines.push(
    '',
    t.pricing,
    `${t.days}: ${calc.days}`,
    `${t.rental}: $${calc.rental}`,
    `${t.extrasTotal}: $${calc.extrasTotal}`,
    `${t.deposit}: $${calc.deposit}`,
    `${t.total}: $${calc.total}`,
    '',
    `${t.locale}: ${payload.locale} | ${new Date().toISOString()}`
  );
  return lines.join('\n');
}

/**
 * Telegram message for a contact submission — the layout is the legacy one,
 * worded in the language the message was written in.
 */
export function contactMessage(payload: LeadPayload) {
  const t = TELEGRAM_TEXT[leadLocale(payload.locale)];
  return [
    t.contactTitle,
    '',
    `${t.name}: ${payload.name}`,
    `${t.email}: ${payload.email}`,
    t.message,
    payload.message,
    '',
    `${t.page}: ${payload.page} | ${new Date().toISOString()}`
  ].join('\n');
}

/**
 * Send a message via the Telegram Bot API.
 */
async function sendTelegram(config: TelegramConfig, text: string) {
  const url = `https://api.telegram.org/bot${config.telegram_bot_token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: config.telegram_chat_id, text })
  });
  if (!res.ok) {
    throw new Error(`Telegram HTTP ${res.status}`);
  }
}

/**
 * Persist a lead into SQLite through the shared connection.
 */
async function saveLead(record: LeadRecord) {
  getDb().prepare(
      `INSERT INTO leads (type, status, locale, name, phone, email, message,
        source_page, pickup_at, pickup_place, dropoff_at, dropoff_place,
        extras_json, days, rental_total, extras_total, deposit, grand_total,
        car_title, comment, score)
       VALUES (?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      record.type ?? null, record.locale, record.name, record.phone ?? null,
      record.email ?? null, record.message ?? null, record.page ?? null,
      record.pickup_at ?? null, record.pickup_place ?? null,
      record.dropoff_at ?? null, record.dropoff_place ?? null,
      record.extras_json ?? null, record.days ?? null,
      record.rental_total ?? null, record.extras_total ?? null,
      record.deposit ?? null, record.grand_total ?? null,
      record.car_title ?? null, record.comment ?? null, record.score ?? null
    );
  return 'sqlite';
}


/**
 * Process a lead payload end-to-end. Returns { status, body } for any
 * HTTP layer (serve.mjs or a Next route handler) to send as JSON.
 */
export async function processLead(payload: LeadPayload) {
  for (const hp of HONEYPOTS) {
    if (payload[hp]) {
      return { status: 200, body: { ok: true } };
    }
  }
  const config = await loadConfig();
  const locale = leadLocale(payload.locale);
  const record: LeadRecord = {
    type: payload.type,
    locale: payload.locale || 'en',
    name: String(payload.name || '').slice(0, 200),
    page: payload.page,
    /**
     * The caller (the Next route) puts the reCAPTCHA rating on the payload
     * after verifying the token; paths without verification leave it unset.
     */
    score: typeof payload.score === 'number' ? payload.score : null
  };
  let text;
  if (payload.type === 'booking') {
    /**
     * Required fields: name and phone. Missing/blank -> 422.
     */
    if (!String(payload.name || '').trim() || !String(payload.phone || '').trim()) {
      return { status: 422, body: { ok: false, error: 'required' } };
    }
    /**
     * Date sanity: drop-off must be strictly after pick-up.
     */
    const from = new Date(`${payload.pickup_date}T${payload.pickup_time || '00:00'}`);
    const to = new Date(`${payload.dropoff_date}T${payload.dropoff_time || '00:00'}`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return { status: 422, body: { ok: false, error: 'dates' } };
    }
    const calc = calcBooking(loadPricing(), payload);
    if (calc === null) {
      process.stdout.write(`LEAD 422 unknown vehicle: "${String(payload.vehicle ?? '')}"\n`);
      return { status: 422, body: { ok: false, error: 'unknown vehicle' } };
    }
    record.phone = String(payload.phone || '').slice(0, 50);
    record.message = payload.comment ? String(payload.comment).slice(0, 2000) : null;
    record.pickup_at = `${payload.pickup_date} ${payload.pickup_time}`;
    /**
     * The place is stored as the visitor read it, not as the canonical value
     * the form submits: «Заявки» and Telegram are both read by people, and a
     * Ukrainian order that says "train station" is the defect this fixes.
     */
    record.pickup_place = placeLabel(String(payload.pickup_place ?? ''), locale);
    record.dropoff_at = `${payload.dropoff_date} ${payload.dropoff_time}`;
    record.dropoff_place = placeLabel(String(payload.dropoff_place ?? ''), locale);
    record.extras_json = JSON.stringify(calc.extras);
    record.days = calc.days;
    record.rental_total = calc.rental;
    record.extras_total = calc.extrasTotal;
    record.deposit = calc.deposit;
    record.grand_total = calc.total;
    record.car_title = calc.carTitle;
    record.comment = payload.comment || '';
    text = bookingMessage(payload, calc);
  } else {
    record.email = String(payload.email || '').slice(0, 200);
    record.message = String(payload.message || '').slice(0, 5000);
    text = contactMessage(payload);
  }
  try {
    await sendTelegram(config, text);
  } catch (err) {
    process.stdout.write(`LEAD ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
    return { status: 502, body: { ok: false, error: 'telegram' } };
  }
  let stored = 'skipped';
  try {
    stored = await saveLead(record);
  } catch (saveErr) {
    process.stdout.write(
      `LEAD SAVE FAILED: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}\n`
    );
  }
  process.stdout.write(`LEAD ${payload.type} -> telegram + ${stored}\n`);
  if (payload.type === 'booking') {
    return {
      status: 200,
      body: {
        ok: true,
        details: {
          name: record.name,
          phone: record.phone,
          vehicle: record.car_title ?? payload.vehicle,
          pickup: `${payload.pickup_date} ${payload.pickup_time}, ${record.pickup_place}`,
          dropoff: `${payload.dropoff_date} ${payload.dropoff_time}, ${record.dropoff_place}`,
          extras: (JSON.parse(record.extras_json ?? '[]') as ExtraLine[]).map((e) => e.label),
          comment: payload.comment || '',
          days: record.days,
          rental: record.rental_total,
          extras_total: record.extras_total,
          deposit: record.deposit,
          total: record.grand_total
        }
      }
    };
  }
  return { status: 200, body: { ok: true } };
}
