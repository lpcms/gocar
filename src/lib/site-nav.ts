import { getTranslation } from './translations';
import { localePath } from './locale-path';
import type { Locale as LocaleType } from './locale-path';
export { LOCALE_PREFIX, localePath, localeFromPath, stripLocale } from './locale-path';

/**
 * Re-exported so the whole app keeps importing its locale type from one
 * place; the definition lives in `locale-path.ts`, which middleware can load
 * without dragging in the database layer.
 */
export type Locale = LocaleType;

/** One entry of the main menu. */
export type NavItem = {
  key: string;
  label: string;
  href: string;
};

/**
 * Main menu of the public site, in the order the reference renders it. Labels
 * come from the translations table; the English row is the fallback.
 */
const MENU: { key: string; path: string; fallback: string }[] = [
  { key: 'menu.home', path: '', fallback: 'Home' },
  { key: 'menu.cars', path: 'cars', fallback: 'Cars' },
  { key: 'menu.book', path: 'book', fallback: 'Book' },
  { key: 'menu.faq', path: 'faq', fallback: 'FAQ' },
  { key: 'menu.about', path: 'about-us', fallback: 'About us' },
  { key: 'menu.contact', path: 'contact', fallback: 'Contact' }
];

/**
 * Prefix of the staging tree, prepended to a path the new render builds.
 *
 * A page that lives under /v2 has to keep its own links inside /v2, otherwise
 * following one lands on the phase-1 render - and for the category pages, on
 * a URL that does not exist yet. Passing '' (the default everywhere outside
 * the staged routes) leaves the path untouched, so acceptance is still just
 * moving the file.
 */
export function withBase(href: string, basePath = ''): string {
  return basePath === '' ? href : `${basePath}${href}`;
}

/**
 * Page of one fleet category: /cars/<slug>, or /en/cars/<slug>.
 *
 * The new render links categories to pages of their own instead of the hash
 * the Framer snapshot uses (client's decision 21.08.2026). Phase 1 keeps its
 * hash links, so the live site is not left pointing at URLs that only the
 * new render serves.
 */
export function categoryPath(slug: string, locale: Locale, basePath = ''): string {
  return withBase(`${localePath('cars', locale)}/${slug}`, basePath);
}

/**
 * Main menu with labels resolved for the locale.
 */
export function getNavItems(locale: Locale): NavItem[] {
  return MENU.map((item) => ({
    key: item.key,
    label: getTranslation(item.key, locale, item.fallback),
    href: localePath(item.path, locale)
  }));
}

/**
 * Marks the entry matching the current pathname, so the chrome can render the
 * current state without any client-side routing knowledge.
 */
export function isCurrent(href: string, pathname: string): boolean {
  const normalize = (value: string) => (value !== '/' ? value.replace(/\/+$/, '') : '/');
  return normalize(href) === normalize(pathname);
}

/**
 * First segments that belong to a menu entry although they are not its own
 * href, by menu key. Only the fleet has pages under it: a category is
 * /cars/<slug> and a car is /cars-detail/<slug>.
 */
const SECTION_ROOTS: Record<string, string[]> = {
  'menu.cars': ['cars', 'cars-detail']
};

/**
 * Whether the current page sits *inside* a menu entry's section, so the main
 * menu keeps "Cars" marked on a category page and on a car page (client
 * 22.08.2026). `isCurrent` alone compares whole paths and would only ever
 * light the entry on /cars itself.
 *
 * Deliberately separate from `isCurrent` rather than folded into it: the
 * footer marks exactly one link and must keep matching whole paths - on
 * /cars/economy it lights "Economy" and leaves "Cars" alone (client
 * 21.08.2026).
 *
 * `barePath` is the path with the locale and the staging prefix already
 * removed, which is what the header computes for the locale switcher.
 */
export function isInSection(key: string, barePath: string): boolean {
  const roots = SECTION_ROOTS[key];
  if (roots === undefined) return false;
  const first = barePath.replace(/^\/+/, '').split('/')[0] ?? '';
  return roots.includes(first);
}
