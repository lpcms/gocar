import { getDb } from './db';
import { getTranslation } from './translations';
import { getPerDaySuffix } from './per-day';
import { pickMediaAlt } from './media-alt';
import { categoryPath, localePath, withBase } from './site-nav';
import type { Locale } from './site-nav';

/** One car as the phase-2 card renders it. */
export type SiteCarCard = {
  slug: string;
  title: string;
  href: string;
  price: string;
  categorySlug: string;
  image: { src: string; alt: string } | null;
};

/** One category of the fleet, as the admin orders them. */
export type SiteCategory = {
  slug: string;
  label: string;
};

/** A category together with the SEO paragraph edited in Категории. */
export type SiteCategoryPage = {
  slug: string;
  label: string;
  description: string;
};

/** Heading and copy of the SEO block that closes the fleet pages. */
export type SiteBenefits = {
  title: string;
  text: string;
};

/** One entry of the category filter: a category plus its hash link. */
export type SiteCategoryLink = {
  slug: string;
  label: string;
  href: string;
};

/** Labels the card itself renders, both from the translations table. */
export type SiteCardLabels = {
  startingAt: string;
  view: string;
};

interface CarRow {
  slug: string;
  title: string;
  price: number;
  categorySlug: string;
  webpPath: string | null;
  altEn: string | null;
  altUa: string | null;
}

interface CategoryRow {
  slug: string;
  label: string;
}

interface CategoryPageRow {
  slug: string;
  label: string;
  description: string | null;
}

/**
 * Price as the reference prints it on the card: the amount with the per-day
 * suffix, whose wording is the editable `book.per_day` translation.
 */
function priceLabel(price: number, locale: Locale): string {
  return `$${price}${getPerDaySuffix(locale)}`;
}

/**
 * Turns a database row into the shape the card component consumes, resolving
 * the photo and its alt text for the locale.
 */
function toCard(row: CarRow, locale: Locale): SiteCarCard {
  const src = row.webpPath !== null && row.webpPath.trim() !== '' ? row.webpPath : null;
  /**
   * The car photo is described in Автомобили, by the same locale rule the rest
   * of the site follows; a photo nobody has described yet is named after the
   * car itself rather than left with an empty alt.
   */
  const described = pickMediaAlt(row.altEn, row.altUa, locale);
  const alt = described !== '' ? described : row.title;
  return {
    slug: row.slug,
    title: row.title,
    href: localePath(`cars-detail/${row.slug}`, locale),
    price: priceLabel(row.price, locale),
    categorySlug: row.categorySlug,
    image: src === null ? null : { src, alt }
  };
}

/**
 * Every live car in admin order. Same query and ordering as the phase-1
 * injector, so the two renders list the fleet identically.
 */
export function getFleetCars(locale: Locale): SiteCarCard[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.slug AS slug,
              COALESCE(NULLIF(t.title, ''), c.slug) AS title,
              c.price_per_day AS price,
              cat.slug AS categorySlug,
              m.webp_path AS webpPath,
              m.alt_en AS altEn, m.alt_ua AS altUa
       FROM cars c
       JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN car_translations t ON t.car_id = c.id AND t.locale = ?
       LEFT JOIN media m ON m.id = c.image_id
       WHERE c.status = 'live'
       ORDER BY c.sort_order, c.id`
    )
    .all(locale) as unknown as CarRow[];
  return rows.map((row) => toCard(row, locale));
}

/**
 * Live cars flagged popular, for the second grid of the page.
 */
export function getPopularCars(locale: Locale): SiteCarCard[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.slug AS slug,
              COALESCE(NULLIF(t.title, ''), c.slug) AS title,
              c.price_per_day AS price,
              cat.slug AS categorySlug,
              m.webp_path AS webpPath,
              m.alt_en AS altEn, m.alt_ua AS altUa
       FROM cars c
       JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN car_translations t ON t.car_id = c.id AND t.locale = ?
       LEFT JOIN media m ON m.id = c.image_id
       WHERE c.status = 'live' AND c.is_popular = 1
       ORDER BY c.sort_order, c.id`
    )
    .all(locale) as unknown as CarRow[];
  return rows.map((row) => toCard(row, locale));
}

/**
 * Categories of the fleet filter, in admin order.
 */
export function getCarCategories(locale: Locale): SiteCategory[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.slug AS slug, COALESCE(NULLIF(t.name, ''), c.slug) AS label
       FROM categories c
       LEFT JOIN category_translations t ON t.category_id = c.id AND t.locale = ?
       ORDER BY c.sort_order, c.id`
    )
    .all(locale) as unknown as CategoryRow[];
  return rows.map((row) => ({ slug: row.slug, label: row.label }));
}

/**
 * Entries of the category filter: the fixed "all" entry the reference puts
 * first, then the admin categories.
 *
 * Every entry links to a page of its own - /cars for "all", /cars/<slug> for
 * a category (client's decision 21.08.2026) - instead of the hash the Framer
 * snapshot uses. Which entry is active is therefore known on the server, and
 * the filter needs no client code at all.
 */
export function getCategoryLinks(locale: Locale, basePath = ''): SiteCategoryLink[] {
  const all: SiteCategoryLink = {
    slug: 'all',
    label: getTranslation(
      'cars.all_categories',
      locale,
      locale === 'ua' ? 'Всі категорії' : 'All Categories'
    ),
    href: withBase(localePath('cars', locale), basePath)
  };
  const items = getCarCategories(locale).map((item) => ({
    slug: item.slug,
    label: item.label,
    href: categoryPath(item.slug, locale, basePath)
  }));
  return [all, ...items];
}

/**
 * One category by its slug, with the paragraph the category page prints.
 * Returns null for an unknown slug, which is what turns /cars/<slug> into a
 * 404.
 */
export function getCategoryBySlug(slug: string, locale: Locale): SiteCategoryPage | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT c.slug AS slug,
              COALESCE(NULLIF(t.name, ''), c.slug) AS label,
              t.description AS description
       FROM categories c
       LEFT JOIN category_translations t ON t.category_id = c.id AND t.locale = ?
       WHERE c.slug = ?`
    )
    .get(locale, slug) as unknown as CategoryPageRow | undefined;
  if (row === undefined) return null;
  return { slug: row.slug, label: row.label, description: (row.description ?? '').trim() };
}

/**
 * Live cars of one category, in the same admin order the full fleet uses.
 */
export function getCarsByCategory(slug: string, locale: Locale): SiteCarCard[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.slug AS slug,
              COALESCE(NULLIF(t.title, ''), c.slug) AS title,
              c.price_per_day AS price,
              cat.slug AS categorySlug,
              m.webp_path AS webpPath,
              m.alt_en AS altEn, m.alt_ua AS altUa
       FROM cars c
       JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN car_translations t ON t.car_id = c.id AND t.locale = ?
       LEFT JOIN media m ON m.id = c.image_id
       WHERE c.status = 'live' AND cat.slug = ?
       ORDER BY c.sort_order, c.id`
    )
    .all(locale, slug) as unknown as CarRow[];
  return rows.map((row) => toCard(row, locale));
}

/**
 * Heading above the popular list in the sidebar, uppercase as the reference
 * prints it.
 */
export function getPopularTitle(locale: Locale): string {
  return getTranslation(
    'cars.popular_title',
    locale,
    locale === 'ua' ? 'ПОПУЛЯРНІ АВТО' : 'POPULAR CARS'
  );
}

/**
 * The SEO block that closes the fleet pages, added on the client's request
 * 21.08.2026 and printed above the closing banner.
 *
 * On /cars both the heading and the copy are translation keys of the Cars
 * group. On a category page the heading is the {name} template filled with
 * the category, and the copy is that category's own "Описание" - so the block
 * is skipped entirely while the field is empty.
 */
export function getBenefits(locale: Locale, category: SiteCategoryPage | null = null): SiteBenefits | null {
  if (category === null) {
    const text = getTranslation('cars.benefits_text', locale, '').trim();
    if (text === '') return null;
    return {
      title: getTranslation(
        'cars.benefits_title',
        locale,
        locale === 'ua' ? 'Переваги наших авто' : 'Advantages of Our Cars'
      ),
      text
    };
  }
  if (category.description === '') return null;
  const template = getTranslation(
    'cars.benefits_title_category',
    locale,
    locale === 'ua' ? 'Переваги наших авто {name}' : 'Advantages of Our {name} Cars'
  );
  return { title: template.split('{name}').join(category.label), text: category.description };
}

/**
 * Heading above the filter, uppercase as the reference prints it.
 */
export function getCategoriesTitle(locale: Locale): string {
  return getTranslation('cars.categories_title', locale, locale === 'ua' ? 'КАТЕГОРІЇ' : 'CATEGORIES');
}

/**
 * The two labels printed on every card, from the same translation keys the
 * phase-1 fleet block uses.
 */
export function getCardLabels(locale: Locale): SiteCardLabels {
  return {
    startingAt: getTranslation('home.fleet_starting_at', locale, locale === 'ua' ? 'від' : 'Starting at'),
    view: getTranslation('home.fleet_view', locale, locale === 'ua' ? 'Перегляд' : 'View')
  };
}

/**
 * What the fleet actually holds right now: how many cars are published and the
 * cheapest daily rate among them.
 *
 * The head of the fleet page states both numbers, and a number written by hand
 * goes stale the moment a car is added, removed or repriced - the SERP line
 * claimed "15+ cars from $25" over a fleet of 13 from $22. Only `live` cars
 * count; a draft is not on the site, so it must not be counted in a promise
 * made to a visitor.
 */
export function getFleetFacts(): { count: number; minPrice: number | null } {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count, MIN(price_per_day) AS minPrice
       FROM cars WHERE status = 'live'`
    )
    .get() as unknown as { count: number; minPrice: number | null };
  return { count: Number(row.count), minPrice: row.minPrice === null ? null : Number(row.minPrice) };
}
