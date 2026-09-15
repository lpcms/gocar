import type { Locale } from './locale-path';

/**
 * Which language a visitor should get, and who is allowed to be redirected.
 *
 * The order the client set on 22.08.2026:
 *
 *  1. an explicit earlier choice, remembered in the `gocar_locale` cookie -
 *     it wins over everything until the visitor changes it;
 *  2. otherwise the country the request comes from: a visitor from outside
 *     Ukraine gets English;
 *  3. otherwise Настройки → «Язык по умолчанию».
 *
 * A crawler is never redirected. That is the one guard that keeps this from
 * undoing the SEO audit of 15.08.2026, which recorded the *absence* of
 * IP-based redirects as a deliberate strength: "Googlebot видит обе локали.
 * Это именно та ошибка, на которой чаще всего теряют индексацию
 * мультиязычные сайты". Both languages therefore stay fully crawlable, and
 * only a human is sent to the version that matches where they are.
 *
 * The `Locale` type is taken from `locale-path`, not from `site-nav` which
 * re-exports it: the cookie half of this module is called from middleware, and
 * `site-nav` reaches the database. The import is erased at compile time, so
 * nothing was broken by it - but it named a dependency that must never exist
 * here, and the next person to add a value import would have found out the
 * hard way (25.08.2026).
 */

/** Name of the cookie that remembers an explicit choice. */
export const LOCALE_COOKIE = 'gocar_locale';

/** How long a remembered choice lasts, in seconds. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Country headers, in the order they are trusted. Which one exists depends on
 * what sits in front of the app - Cloudflare, Vercel, or an NGINX with the
 * GeoIP module - so all the common spellings are read and the first one that
 * answers wins. Behind a plain proxy none of them are present and the
 * decision falls through to `Accept-Language`.
 */
const COUNTRY_HEADERS = [
  'cf-ipcountry',
  'x-vercel-ip-country',
  'x-geo-country',
  'x-country-code',
  'x-appengine-country'
];

/** Country code that keeps a visitor on the Ukrainian version. */
const HOME_COUNTRY = 'UA';

/**
 * User agents that must always see the page they asked for. Kept broad on
 * purpose: a false positive only costs one un-redirected visitor, while a
 * false negative can cost a language its place in the index.
 */
const CRAWLER = /bot|crawler|spider|crawling|slurp|mediapartners|facebookexternalhit|embedly|quora link preview|showyoubot|outbrain|pinterest|preview|whatsapp|telegram|vkshare|lighthouse|headlesschrome|chrome-lighthouse|gtmetrix|pagespeed|ahrefs|semrush|screaming frog|yandex|baidu|duckduck|applebot|petalbot|bingpreview/i;

/**
 * Whether the request is a crawler, a preview fetcher or an auditing tool.
 */
export function isCrawler(userAgent: string): boolean {
  return userAgent !== '' && CRAWLER.test(userAgent);
}

/**
 * The remembered choice, or null when the visitor has never picked one.
 */
export function storedLocale(cookieValue: string | undefined): Locale | null {
  if (cookieValue === 'en') return 'en';
  if (cookieValue === 'ua') return 'ua';
  return null;
}

/**
 * The country the request comes from, uppercased, or '' when nothing in front
 * of the app reports one.
 */
export function requestCountry(get: (name: string) => string | null): string {
  for (const name of COUNTRY_HEADERS) {
    const value = (get(name) ?? '').trim().toUpperCase();
    /** Cloudflare answers "XX" for an address it cannot place. */
    if (value !== '' && value !== 'XX' && value !== 'T1') return value;
  }
  return '';
}

/**
 * Language guessed from `Accept-Language`: the fallback when no country
 * header is available. Ukrainian and Russian both read as "stay here" - the
 * site's Ukrainian version is the one those visitors expect - and any other
 * named language means English.
 *
 * Only a real language subtag counts. `Accept-Language: *` means "any
 * language will do", not English, and several HTTP clients send exactly that;
 * reading it as a preference sent every one of them to /en.
 */
function acceptLanguageLocale(header: string): Locale | null {
  const first = (header.trim().toLowerCase().split(',')[0] ?? '').split(';')[0] ?? '';
  const tag = first.trim();
  if (!/^[a-z]{2,3}(-[a-z0-9]+)*$/.test(tag)) return null;
  if (tag.startsWith('uk') || tag.startsWith('ru')) return 'ua';
  return 'en';
}

/**
 * The language a visitor with no remembered choice should get, from where the
 * request comes from. Returns null when nothing can be told, leaving the
 * decision to the admin's default.
 */
export function geoLocale(get: (name: string) => string | null): Locale | null {
  const country = requestCountry(get);
  if (country !== '') return country === HOME_COUNTRY ? 'ua' : 'en';
  return acceptLanguageLocale(get('accept-language') ?? '');
}
