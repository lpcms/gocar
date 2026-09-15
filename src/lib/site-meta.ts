import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getSetting } from './settings';
import { getTranslation } from './translations';
import { getCarSeo } from './car-card';
import { getCategoryBySlug, getFleetFacts } from './site-cars';
import { localePath } from './site-nav';
import type { Locale } from './site-nav';

/**
 * Page metadata for the phase-2 render.
 *
 * The phase-1 equivalent (`injectPageSeo` in seo-meta.ts) rewrites tags inside
 * a finished HTML string, which a React render cannot use. This module reads
 * the same admin sources and returns Next's `Metadata` instead, so the two
 * produce the same head. Everything the SEO audit of 15.08.2026 settled is
 * kept deliberately:
 *
 *  - titles follow "keyword + city | brand", not "brand - page" (H-4);
 *  - descriptions are clamped to ~160 characters on a word boundary, so the
 *    call to action is never cut off in the SERP (H-5);
 *  - canonical, hreflang and og:url all come from Настройки → `site_domain`,
 *    the same source robots.txt and the sitemap use, never from the request
 *    host - two hosts would otherwise self-canonicalise into separate
 *    clusters (C-3);
 *  - `x-default` points at the English URL, matching the sitemap (C-2).
 *
 * Where the copy lives: the home page takes title and description from
 * Настройки (`seo_title_*`, `seo_description_*`) verbatim; inner pages from
 * Переводы (`seo.title.<page>` / `seo.desc.<page>`) with the brand appended;
 * car pages from the `seo.title.car` / `seo.desc.car` templates, which take
 * `{name}` and `{price}`.
 */

/** The two locales, as typed constants the strict audit accepts. */
const EN: Locale = 'en';
const UA: Locale = 'ua';

/** Metadata shape this module returns, a subset of Next's `Metadata`. */
export interface PageMetadata {
  title: string;
  description?: string;
  robots: { index: boolean; follow: boolean; 'max-image-preview': 'large' };
  alternates: { canonical: string; languages: Record<string, string> };
  openGraph: Record<string, unknown>;
  twitter: Record<string, unknown>;
}

/**
 * Maps a public path to the key its `seo.*` translation rows use. Returns null
 * for a page with no admin-managed row of its own.
 */
function pageKeyForSlug(slug: string): string | null {
  const clean = slug.replace(/^\/+|\/+$/g, '');
  if (clean === '') return 'home';
  if (clean === 'cars') return 'cars';
  if (clean === 'book') return 'book';
  if (clean === 'faq') return 'faq';
  if (clean === 'about-us') return 'about';
  if (clean === 'contact') return 'contact';
  if (clean === '404') return '404';
  return null;
}

/**
 * The site icon, in the set of declarations a search engine and a browser each
 * look for.
 *
 * Google picks one favicon per host and wants an unambiguous, crawlable
 * declaration on the home page; it reads the classic `/favicon.ico` whether or
 * not the markup mentions it, so that file is always declared with the sizes it
 * really holds (built by scripts/build-favicon.mjs). The icon the admin chose
 * in Настройки comes with its media type, because an `icon` link without one
 * leaves the client to sniff the format. `apple-touch-icon` is the square iOS
 * and several link-preview fetchers ask for, and it is a PNG for the clients
 * that cannot rasterise SVG.
 *
 * Both root layouts share this so the two languages can never drift apart -
 * the favicon belongs to the host, not to a locale.
 */
export function siteIcons(): NonNullable<Metadata['icons']> {
  const favicon = String(getSetting('favicon_url', '') ?? '').trim();
  const ext = favicon.toLowerCase().split('?')[0]?.replace(/^.*\./, '') ?? '';
  const types: Record<string, string> = {
    svg: 'image/svg+xml',
    png: 'image/png',
    ico: 'image/x-icon',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif'
  };
  const classic = { url: '/favicon.ico', sizes: '16x16 32x32 48x48' };
  const configured = favicon === '' ? [] : [{ url: favicon, type: types[ext] }];
  /**
   * iOS wants a raster square. When Настройки already holds one - the admin
   * pointed the field at a PNG - that file is the icon, and nothing is
   * invented here. An SVG cannot be used directly by every phone, so the
   * fallback is the PNG scripts/build-favicon.mjs renders from that very same
   * setting: still the admin's icon, only in a format the client can open.
   */
  const raster = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
  const apple = raster
    ? { url: favicon, type: types[ext] }
    : { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' };
  return { icon: [...configured, classic], apple: [apple] };
}

/**
 * Absolute origin of the site: Настройки first, the request origin as a
 * fallback. The setting is the single source of truth shared with the sitemap
 * and robots.txt (audit C-3).
 */
export function siteOrigin(fallbackOrigin: string): string {
  const raw = String(getSetting('site_domain', '') ?? '').trim();
  if (raw === '') return fallbackOrigin.replace(/\/+$/, '');
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, '');
}

/**
 * The origin of the request being answered, used only when Настройки holds no
 * base domain. A component is not told its own URL, so it comes from the
 * proxy headers.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * Shorten a description to the ~160 characters Google renders, cutting on a
 * word boundary and never mid-word. Shorter text is returned untouched.
 */
function clampDescription(text: string, limit = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;
  const cut = flat.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  const base = (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(
    /[\s.,;:!\-–—]+$/,
    ''
  );
  return `${base}…`;
}

/**
 * Fill the `{name}` / `{price}` placeholders of a title or description
 * template. A car with no price on record loses the whole price clause rather
 * than printing an empty "$/day".
 */
function fillTemplate(template: string, name: string, price: number | null): string {
  const tpl =
    price === null
      ? template.replace(/\s*[—–-]\s*[^—–]*\{price\}[^—–]*/g, '').replace(/\s*\$?\{price\}\S*/g, '')
      : template;
  return tpl
    .replace(/\{name\}/g, name)
    .replace(/\{price\}/g, price === null ? '' : String(price))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip a locale tag a stored title may carry ("Toyota Camry---en"): it must
 * never reach the SERP.
 */
function cleanName(value: string): string {
  return (value.split('---')[0] ?? value).replace(/\s+-\s+(en|ua)\b.*$/i, '').trim();
}

/**
 * Title and description of one page, before the brand suffix is applied.
 */
function copyFor(bare: string, locale: Locale): { title: string; description: string } {
  if (bare.startsWith('cars-detail/')) {
    const slug = bare.slice('cars-detail/'.length);
    const seo = getCarSeo(slug, locale);
    const name = cleanName(seo?.name ?? '');
    const price = seo !== null && seo.price > 0 ? seo.price : null;
    const titleTpl = getTranslation(
      'seo.title.car',
      locale,
      locale === 'ua' ? 'Оренда {name} в Ужгороді — ${price}/добу' : 'Rent {name} in Uzhhorod — ${price}/day'
    );
    const descTpl = getTranslation(
      'seo.desc.car',
      locale,
      locale === 'ua'
        ? 'Оренда {name} в Ужгороді від ${price}/добу. Потрібні лише паспорт і права, гнучка подача авто. Бронюйте онлайн у GoCar.'
        : 'Rent a {name} in Uzhhorod from ${price}/day. Passport and licence only, flexible pick-up. Book online at GoCar.'
    );
    const built = fillTemplate(titleTpl, name, price);
    const builtDesc = fillTemplate(descTpl, name, price);
    return {
      title: built !== '' ? built : name,
      description: clampDescription(builtDesc !== '' ? builtDesc : (seo?.description ?? ''))
    };
  }

  /**
   * A category page. The audit asked for these as real URLs with their own
   * title and copy (T-7); the heading template and the category's own
   * "Описание" are what the page already prints, so the head reuses them
   * instead of inventing a second wording.
   */
  if (bare.startsWith('cars/')) {
    const category = getCategoryBySlug(bare.slice('cars/'.length), locale);
    if (category === null) return { title: '', description: '' };
    const titleTpl = getTranslation(
      'seo.title.category',
      locale,
      locale === 'ua'
        ? 'Оренда {name} в Ужгороді — авто напрокат'
        : 'Rent a {name} car in Uzhhorod — GoCar fleet'
    );
    const descTpl = getTranslation('seo.desc.category', locale, '');
    const title = fillTemplate(titleTpl, category.label, null);
    const built = descTpl !== '' ? fillTemplate(descTpl, category.label, null) : '';
    return {
      title,
      description: clampDescription(built !== '' ? built : category.description)
    };
  }

  const pageKey = pageKeyForSlug(bare);
  if (pageKey === 'home') {
    const tKey = locale === 'ua' ? 'seo_title_ua' : 'seo_title_en';
    const dKey = locale === 'ua' ? 'seo_description_ua' : 'seo_description_en';
    return {
      title: String(getSetting(tKey, '') ?? '').trim(),
      description: clampDescription(String(getSetting(dKey, '') ?? '').trim())
    };
  }
  if (pageKey === 'cars') {
    /**
     * The fleet page counts itself. `{count}` is how many cars are published
     * and `{price}` the cheapest of them, both read at render time, so the SERP
     * line can never promise a fleet the site does not have - a number typed
     * into Переводы goes stale the moment a car is added or repriced.
     *
     * A template that uses neither placeholder is printed exactly as written,
     * and so is one read while nothing is published: with no cars there is no
     * honest number to substitute.
     */
    const facts = getFleetFacts();
    const title = getTranslation('seo.title.cars', locale, '').trim();
    const desc = getTranslation('seo.desc.cars', locale, '').trim();
    if (facts.count === 0 || facts.minPrice === null) {
      return { title, description: clampDescription(desc) };
    }
    const fill = (text: string): string =>
      text
        .replace(/\{count\}/g, String(facts.count))
        .replace(/\{price\}/g, String(facts.minPrice))
        .replace(/\s+/g, ' ')
        .trim();
    return { title: fill(title), description: clampDescription(fill(desc)) };
  }
  if (pageKey === null) return { title: '', description: '' };
  return {
    title: getTranslation(`seo.title.${pageKey}`, locale, '').trim(),
    description: clampDescription(getTranslation(`seo.desc.${pageKey}`, locale, '').trim())
  };
}

/**
 * Everything the head of one page needs.
 *
 * `bare` is the path without the locale prefix and without a leading slash:
 * '' for the home page, 'cars', 'cars/suv', 'cars-detail/toyota-camry'.
 */
export async function getPageMetadata(bare: string, locale: Locale): Promise<PageMetadata> {
  const origin = siteOrigin(await requestOrigin());
  const siteName = String(getSetting('site_name', '') ?? '').trim();
  const clean = bare.replace(/^\/+|\/+$/g, '');
  const isHome = clean === '';

  const copy = copyFor(clean, locale);
  let title = copy.title;
  /**
   * Brand suffix: an inner page reads "<keyword phrase> | GoCar", so the
   * keyword opens the SERP line and the brand closes it. The home title is
   * taken from Настройки verbatim, and a title that already carries the site
   * name is left alone - the admin may have written the full string.
   */
  if (!isHome && title !== '' && siteName !== '' && !title.includes(siteName)) {
    title = `${title} | ${siteName}`;
  }
  if (title === '') title = siteName !== '' ? siteName : 'GoCar';

  const enPath = localePath(clean, EN);
  const ukPath = localePath(clean, UA);
  const enUrl = `${origin}${enPath}`;
  const ukUrl = `${origin}${ukPath}`;
  const canonical = locale === 'ua' ? ukUrl : enUrl;

  const openGraph: Record<string, unknown> = {
    type: 'website',
    title,
    url: canonical,
    locale: locale === 'ua' ? 'uk_UA' : 'en_US',
    alternateLocale: locale === 'ua' ? 'en_US' : 'uk_UA'
  };
  if (siteName !== '') openGraph['siteName'] = siteName;
  const twitter: Record<string, unknown> = { card: 'summary_large_image', title };
  if (copy.description !== '') {
    openGraph['description'] = copy.description;
    twitter['description'] = copy.description;
  }

  /**
   * Social crawlers require an absolute image URL, so the stored path is
   * resolved against the base domain. Emitted only when one is configured.
   */
  const ogRaw = String(getSetting('og_image_default', '') ?? '').trim();
  if (ogRaw !== '') {
    const ogImage = /^https?:\/\//i.test(ogRaw)
      ? ogRaw
      : `${origin}${ogRaw.startsWith('/') ? '' : '/'}${ogRaw}`;
    openGraph['images'] = [ogImage];
    twitter['images'] = [ogImage];
  }

  return {
    title,
    ...(copy.description !== '' ? { description: copy.description } : {}),
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    alternates: {
      canonical,
      /** x-default is the English URL, the value the sitemap also emits (C-2). */
      languages: { en: enUrl, uk: ukUrl, 'x-default': enUrl }
    },
    openGraph,
    twitter
  };
}
