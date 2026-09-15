import { getDb } from './db';
import type { Locale } from './site-nav';

/**
 * Alternative text of the site's own imagery, kept in the media library so the
 * admin owns the wording in both locales (Медиатека).
 *
 * The files under public/images/site ship with the render rather than being
 * uploaded, and used to be marked up with an empty alt. They are registered by
 * scripts/migrate-site-media-alt.mjs; this reads what the admin has written.
 */

/**
 * The rule every image on the site follows: Ukrainian pages use the Ukrainian
 * text and fall back to the English one while it is empty, English pages use
 * the English text. Kept in one place because car photos and review avatars
 * store their alt on rows of their own and have to answer the same way.
 *
 * @returns the text, trimmed, or '' when neither locale has one.
 */
export function pickMediaAlt(
  altEn: string | null,
  altUa: string | null,
  locale: Locale
): string {
  const en = String(altEn ?? '').trim();
  const ua = String(altUa ?? '').trim();
  if (locale === 'ua') return ua !== '' ? ua : en;
  return en;
}

/**
 * One lookup per fingerprint is enough - the table is small and rarely
 * changes.
 */
let cache: Map<string, { en: string; ua: string }> | null = null;
/** The state of the media table the cached map was built from. */
let stamp = '';

/**
 * A cheap summary of the alt text the table holds. Any edit in the admin
 * changes it, which is what lets a long-running server pick up new wording
 * without a restart - the map is otherwise built once and would go on serving
 * what was true when the process started.
 */
function fingerprint(): string {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS rows,
              COALESCE(SUM(LENGTH(alt_en) + LENGTH(alt_ua) + LENGTH(original_path)), 0) AS size,
              COALESCE(MAX(id), 0) AS top
       FROM media`
    )
    .get() as unknown as { rows: number; size: number; top: number };
  return `${row.rows}:${row.size}:${row.top}`;
}

/**
 * Loads every registered path, rebuilding when the table has changed. A miss
 * stays a miss: an unregistered image gets an empty alt, which is the correct
 * markup for a picture nobody has described.
 */
function load(): Map<string, { en: string; ua: string }> {
  const current = fingerprint();
  if (cache !== null && current === stamp) return cache;
  const rows = getDb()
    .prepare('SELECT original_path, webp_path, alt_en, alt_ua FROM media')
    .all() as unknown as Array<{
    original_path: string;
    webp_path: string;
    alt_en: string | null;
    alt_ua: string | null;
  }>;
  const map = new Map<string, { en: string; ua: string }>();
  for (const row of rows) {
    const entry = { en: String(row.alt_en ?? '').trim(), ua: String(row.alt_ua ?? '').trim() };
    /**
     * Both names of the file answer, not only the original: an upload is
     * referenced by its WebP copy, and that is the path the page carries.
     */
    for (const path of [row.original_path, row.webp_path]) {
      if (String(path ?? '') !== '') map.set(String(path), entry);
    }
  }
  cache = map;
  stamp = current;
  return map;
}

/**
 * Alternative text for one image path, in the requested locale, falling back
 * to English when the Ukrainian text has not been filled in.
 *
 * @param src Public path of the image, e.g. "/images/site/about-hero.jpg".
 * @param locale Locale of the page being rendered.
 */
export function getMediaAlt(src: string, locale: Locale): string {
  const entry = load().get(src);
  if (entry === undefined) return '';
  return pickMediaAlt(entry.en, entry.ua, locale);
}
