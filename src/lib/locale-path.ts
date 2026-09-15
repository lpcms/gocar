/**
 * The URL scheme of the two languages, and nothing else.
 *
 * Deliberately free of imports: middleware runs on the edge runtime, where
 * node:sqlite and node:path do not exist, so anything it needs has to be
 * reachable without touching the database layer. `site-nav.ts` pulls in
 * translations for the menu labels, which drags in `db.ts` - importing it
 * from middleware fails the build with "Reading from node:path is not
 * handled".
 */

/** Locale of the public site. */
export type Locale = 'en' | 'ua';

/**
 * URL prefix of each locale, and the single place the scheme is defined.
 *
 * Ukrainian is the site's default language and therefore owns the root, with
 * English under /en (client 22.08.2026). It used to be the other way round,
 * which contradicted Настройки → «Язык по умолчанию» and made the switcher
 * read as if English were the main version.
 */
export const LOCALE_PREFIX: Record<Locale, string> = { ua: '', en: '/en' };

/**
 * Builds an absolute path for a locale.
 */
export function localePath(path: string, locale: Locale): string {
  const clean = path.replace(/^\/+/, '');
  const prefix = LOCALE_PREFIX[locale];
  if (clean === '') return prefix === '' ? '/' : prefix;
  return `${prefix}/${clean}`;
}

/**
 * The locale a path belongs to, decided by its prefix alone.
 */
export function localeFromPath(pathname: string): Locale {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'ua';
}

/**
 * A path with its locale prefix removed: '/en/cars' and '/cars' both give
 * '/cars', and either locale's home gives '/'.
 */
export function stripLocale(pathname: string): string {
  const bare = pathname.replace(/^\/en(?=\/|$)/, '');
  return bare === '' ? '/' : bare;
}

/**
 * The counterpart path in the other locale.
 */
export function mirrorPath(pathname: string, target: Locale): string {
  const bare = stripLocale(pathname);
  const prefix = LOCALE_PREFIX[target];
  if (bare === '/') return prefix === '' ? '/' : prefix;
  return `${prefix}${bare}`;
}

/**
 * The prefix the Ukrainian version answered on until 22.08.2026, when it took
 * over the root instead. Those addresses are indexed - the search result for
 * the site still points at /uk - so they are moved, never 404'd.
 */
const RETIRED_UA_PREFIX = '/uk';

/**
 * Where an address that still carries the retired prefix lives now, in its own
 * locale, or null when it carries none: '/uk/cars' gives '/cars', '/en/uk/cars'
 * gives '/en/cars', and '/ukraine' is left alone.
 */
export function legacyTarget(pathname: string): string | null {
  const bare = stripLocale(pathname);
  if (bare !== RETIRED_UA_PREFIX && !bare.startsWith(`${RETIRED_UA_PREFIX}/`)) return null;
  return localePath(bare.slice(RETIRED_UA_PREFIX.length), localeFromPath(pathname));
}
