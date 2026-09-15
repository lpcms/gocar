import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/settings';

/**
 * Sitemap: the static pages of the site plus every live car and category from
 * the database, each in both locales. Each locale gets its own <url> entry,
 * all of them carrying the same hreflang set (en / uk / x-default -> en). The
 * base URL comes from the site_domain setting, falling back to the request
 * origin.
 *
 * force-dynamic: reads settings and live cars from the DB and the request
 * origin, so it must run per request, not be cached at build.
 */
export const dynamic = 'force-dynamic';

/**
 * The pages that exist as routes rather than as database rows. Phase 1 derived
 * this list by walking the snapshot tree; that tree is gone, so the list is
 * stated here, next to the routes it mirrors. '' is the home page.
 */
const STATIC_PAGES = ['', 'cars', 'book', 'faq', 'about-us', 'contact'] as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  /**
   * Use the configured base domain (Settings) so sitemap URLs point at the
   * production site, not the request host. Falls back to the request origin.
   */
  const rawDomain = String(getSetting('site_domain', '') ?? '').trim();
  let origin: string;
  if (rawDomain !== '') {
    origin = (/^https?:\/\//i.test(rawDomain) ? rawDomain : `https://${rawDomain}`).replace(/\/+$/, '');
  } else {
    origin = new URL(req.url).origin;
  }
  const today = new Date().toISOString().slice(0, 10);
  /**
   * Group by "logical page" so hreflang alternates can be emitted:
   * "/cars" and "/en/cars" are the same page in two locales.
   */
  const groups = new Map<string, { en?: string; uk?: string; lastmod: string }>();
  for (const key of STATIC_PAGES) {
    groups.set(key, {
      en: `${origin}/en${key === '' ? '' : '/' + key}`,
      uk: `${origin}${key === '' ? '/' : '/' + key}`,
      lastmod: today
    });
  }

  /**
   * Add every live car detail page from the DB, in both locales, so newly
   * added vehicles (which have no snapshot file) still appear in the sitemap.
   */
  try {
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    const cars = db
      .prepare("SELECT slug, updated_at FROM cars WHERE status = 'live' ORDER BY slug")
      .all() as unknown as Array<{ slug: string; updated_at: string }>;
    for (const car of cars) {
      const key = `cars-detail/${car.slug}`;
      /**
       * Real lastmod: the car's own updated_at (admin edits), so the date is a
       * meaningful signal instead of "today" on every request.
       */
      const stamp = String(car.updated_at ?? '').slice(0, 10);
      const g = groups.get(key) ?? { lastmod: /^\d{4}-\d{2}-\d{2}$/.test(stamp) ? stamp : today };
      g.en = `${origin}/en/cars-detail/${car.slug}`;
      g.uk = `${origin}/cars-detail/${car.slug}`;
      groups.set(key, g);
    }
  } catch {
    /* if the DB is unavailable, ship the file-based sitemap only */
  }

  /**
   * Category pages, in both locales. They became real URLs in phase 2 - the
   * fleet filter used to be a hash on /cars, which is not a page a search
   * engine can index - and the SEO audit of 15.08.2026 called them the single
   * largest missed opportunity (T-7), so they belong in the sitemap.
   */
  try {
    const { getDb } = await import('@/lib/db');
    const rows = getDb()
      .prepare('SELECT slug FROM categories ORDER BY sort_order')
      .all() as unknown as Array<{ slug: string }>;
    for (const row of rows) {
      const key = `cars/${row.slug}`;
      const g = groups.get(key) ?? { lastmod: today };
      g.en = `${origin}/en/cars/${row.slug}`;
      g.uk = `${origin}/cars/${row.slug}`;
      groups.set(key, g);
    }
  } catch {
    /* categories are optional; the rest of the sitemap still ships */
  }

  /**
   * One <url> per locale (Google requires a separate entry for every language
   * version), each carrying the same full set of alternates. x-default points
   * at the English page, matching the HTML annotation emitted by seo-meta.
   */
  const urls: string[] = [];
  for (const [, g] of groups) {
    const alternates: string[] = [];
    if (g.en) alternates.push(`<xhtml:link rel="alternate" hreflang="en" href="${g.en}"/>`);
    if (g.uk) alternates.push(`<xhtml:link rel="alternate" hreflang="uk" href="${g.uk}"/>`);
    const xDefault = g.en ?? g.uk;
    if (xDefault !== undefined) {
      alternates.push(`<xhtml:link rel="alternate" hreflang="x-default" href="${xDefault}"/>`);
    }
    for (const loc of [g.en, g.uk]) {
      if (loc === undefined) continue;
      urls.push(
        `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${g.lastmod}</lastmod>\n    ` +
          alternates.join('\n    ') + `\n  </url>`
      );
    }
  }
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
  return new NextResponse(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
}
