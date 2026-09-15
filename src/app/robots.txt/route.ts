import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSetting } from '@/lib/settings';

/**
 * Dynamic robots.txt, edited in Настройки → «SEO по умолчанию» → robots.txt.
 *
 * The body is whatever the admin typed; the file used to be hard-coded here,
 * which made that field a box that changed nothing (25.08.2026). An empty
 * setting falls back to DEFAULT_BODY, so a wiped field never serves an empty
 * robots.txt - the one shape that tells a crawler nothing at all.
 *
 * The `Sitemap:` line is appended from Настройки → «Базовый домен сайта»
 * unless the admin wrote one themselves. Deriving it is what keeps the two
 * from drifting: a domain change would otherwise leave a sitemap URL pointing
 * at the old host, and the URL in this file is how a crawler finds it at all.
 *
 * The admin panel is deliberately NOT listed here. robots.txt is public, so a
 * `Disallow:` line is an index of the paths worth attacking, and it does not
 * keep a URL out of the results either - Google indexes a disallowed address
 * it finds linked, it just cannot read it. /admin is kept out of search by the
 * `X-Robots-Tag: noindex` header it answers with (next.config.mjs), which says
 * nothing to anyone who is not already asking for that address.
 *
 * force-dynamic: the body is a database row an admin can change at any time,
 * and this file must answer with the current value. Without it Next prerenders
 * the route at build time and freezes whatever the setting held then - which
 * on the first production build was still http://localhost:3000.
 */
export const dynamic = 'force-dynamic';

/**
 * Served when the setting is empty: crawl the site, leave the API alone.
 */
const DEFAULT_BODY = ['User-agent: *', 'Allow: /', 'Disallow: /api/'].join('\n');

export async function GET(req: NextRequest): Promise<NextResponse> {
  const raw = String(getSetting('site_domain', '') ?? '').trim();
  let origin: string;
  if (raw !== '') {
    origin = (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).replace(/\/+$/, '');
  } else {
    origin = new URL(req.url).origin;
  }

  const stored = String(getSetting('robots_txt', '') ?? '').trim();
  const body = stored === '' ? DEFAULT_BODY : stored.replace(/\r\n/g, '\n');
  const hasSitemap = /^\s*sitemap\s*:/im.test(body);
  const text = hasSitemap ? `${body}\n` : `${body}\n\nSitemap: ${origin}/sitemap.xml\n`;

  return new NextResponse(text, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      /**
       * A crawler may cache this for an hour; an admin edit must not take a
       * day to reach Google, and the route itself is a single settings read.
       */
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
