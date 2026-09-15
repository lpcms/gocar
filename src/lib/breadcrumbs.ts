import { getTranslation } from './translations';
import { localePath, withBase } from './site-nav';
import type { Locale } from './site-nav';

/** One crumb of the breadcrumb trail; the last one has no link. */
export type Crumb = {
  label: string;
  href: string;
  current: boolean;
};

/**
 * Menu translation key of every page that owns a breadcrumb, by its bare path
 * (no locale prefix). Home and 404 have no trail in the reference.
 */
const CRUMB_KEYS: Record<string, { key: string; fallback: string }> = {
  cars: { key: 'menu.cars', fallback: 'Cars' },
  book: { key: 'menu.book', fallback: 'Book' },
  faq: { key: 'menu.faq', fallback: 'FAQ' },
  'about-us': { key: 'menu.about', fallback: 'About us' },
  contact: { key: 'menu.contact', fallback: 'Contact' }
};

/**
 * Breadcrumb trail of a page, mirroring the BreadcrumbList that the phase-1
 * route builds for JSON-LD: Home / <page> for the top-level pages and
 * Home / Cars / <car> on a car detail page.
 *
 * `path` is the bare path without the /uk prefix ('' for home). `currentLabel`
 * carries the name that is not in the translations table - the car title on
 * /cars-detail/<slug> and the category name on /cars/<slug>. `basePath`
 * prefixes every href, so a staged page keeps its trail inside /v2. An empty
 * array means the page shows no breadcrumb.
 */
export function getBreadcrumbs(
  path: string,
  locale: Locale,
  currentLabel = '',
  basePath = ''
): Crumb[] {
  const bare = path.replace(/^\/+/, '').replace(/\/+$/, '');
  if (bare === '' || bare === '404') {
    return [];
  }

  const home: Crumb = {
    label: getTranslation('menu.home', locale, 'Home'),
    href: withBase(localePath('', locale), basePath),
    current: false
  };

  /**
   * A car detail page and a fleet category page share the same trail shape:
   * Home / Cars / <name from the database>.
   */
  if (bare.startsWith('cars-detail/') || (bare.startsWith('cars/') && bare !== 'cars/')) {
    const cars: Crumb = {
      label: getTranslation('menu.cars', locale, 'Cars'),
      href: withBase(localePath('cars', locale), basePath),
      current: false
    };
    if (currentLabel === '') {
      return [home, cars];
    }
    return [
      home,
      cars,
      { label: currentLabel, href: withBase(localePath(bare, locale), basePath), current: true }
    ];
  }

  const entry = CRUMB_KEYS[bare];
  if (entry === undefined) {
    return [];
  }
  return [
    home,
    {
      label: getTranslation(entry.key, locale, entry.fallback),
      href: withBase(localePath(bare, locale), basePath),
      current: true
    }
  ];
}
