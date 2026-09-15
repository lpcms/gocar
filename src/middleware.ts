import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { legacyTarget, localeFromPath, mirrorPath } from '@/lib/locale-path';
import { LOCALE_COOKIE, isCrawler, storedLocale } from '@/lib/locale-policy';

/**
 * Lives in src/ deliberately: with the app router under src/app, Next looks
 * for the middleware at src/middleware.ts and silently ignores one at the
 * project root.
 *
 * Three jobs, all of which have to happen before routing:
 *
 * 1. Expose the request to server components as `x-pathname`. The 404 needs it
 *    to pick its language and to look the path up in the redirects table, and
 *    the root layout needs it for <html lang> - a component is not told the
 *    URL it is answering.
 * 2. Retire the addresses of the old scheme. Until 22.08.2026 the Ukrainian
 *    version lived under /uk, and those addresses are indexed - the search
 *    result for the site still points at /uk - so each one is permanently
 *    moved to its new home instead of answering 404.
 *
 *    It belongs here rather than at the end of the route tree, where it used
 *    to sit: the rule below reads /uk as a Ukrainian path and mirrors it to
 *    /en/uk, an address no route claims, so every indexed old link answered
 *    404 for a visitor who had ever chosen English - which is every visitor
 *    arriving from the search result in an English browser (24.08.2026).
 *    Running before routing also keeps the query string, which the old
 *    placement dropped: a component is given the path and nothing else.
 *
 * 3. Honour an explicit language choice. When the `gocar_locale` cookie
 *    disagrees with the language of the path, the visitor is sent to the
 *    mirror path, because a remembered choice outranks everything else until
 *    it is changed (client 22.08.2026).
 *
 * What is deliberately *not* here: the guess for a visitor who has never
 * chosen. That one also needs Настройки → «Язык по умолчанию», which lives in
 * the database, and middleware runs on the edge runtime where node:sqlite is
 * unavailable. It is made one level down, in the root layout - see
 * `src/app/(site-uk)/layout.tsx`.
 *
 * `mirrorPath` is pure string arithmetic, which is what lets this run in
 * middleware at all: nothing here may touch the database.
 */
/**
 * The one host and scheme the site answers on.
 *
 * The audit of 15.08.2026 found gocar.run served identically on three
 * addresses - http, https and www - with no redirect between them, and the
 * state was unchanged on 22.08.2026. Canonical tags hide the duplication from
 * search engines but do not remove it: links, analytics and cookies still
 * split three ways.
 *
 * No domain is written here. `www.` is stripped from whatever host the request
 * carries, so the rule holds on any domain the site is ever served from,
 * including a staging one.
 *
 * The scheme half fires only when the proxy in front states plainly that the
 * request arrived over http. When it says nothing - the header is absent - the
 * request is left alone, because guessing there is how a redirect loop starts.
 * If the hosting panel offers a forced-HTTPS switch, that is the better place
 * for this half and makes the rule below dead code that costs nothing.
 */
function canonicalTarget(req: NextRequest): string | null {
  const host = (req.headers.get('host') ?? '').trim();
  if (host === '') return null;
  /**
   * A development host is never upgraded: there is no certificate on
   * localhost, and redirecting it to https would take the site down for
   * whoever is running it.
   */
  const bare = host.replace(/^www\./i, '');
  const isLocal = /^localhost(:|$)|^127\.0\.0\.1(:|$)/i.test(bare);
  const proto = ((req.headers.get('x-forwarded-proto') ?? '').split(',')[0] ?? '').trim();
  const wrongHost = bare !== host;
  const wrongScheme = proto === 'http' && !isLocal;
  if (!wrongHost && !wrongScheme) return null;
  const scheme = isLocal ? 'http' : 'https';
  return `${scheme}://${bare}${req.nextUrl.pathname}${req.nextUrl.search}`;
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const canonical = canonicalTarget(req);
  if (canonical !== null) {
    return NextResponse.redirect(canonical, 301);
  }

  /**
   * An address of the retired scheme, moved for good. Permanent and the same
   * for everyone on purpose: a browser caches a 308 for a long time, so a
   * personal answer here would outlive the choice that produced it. The
   * language of the visitor is applied afterwards, by the temporary redirect
   * below, on the address this one lands on.
   */
  const moved = legacyTarget(pathname);
  if (moved !== null) {
    const legacy = req.nextUrl.clone();
    legacy.pathname = moved;
    return NextResponse.redirect(legacy, 308);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);

  /**
   * A request for a file is never a page, and sending /sw.js to /en/sw.js
   * would break the service worker. The test lives here rather than in the
   * matcher on purpose: an escaped dot inside a matcher string is read by
   * JavaScript as a plain dot before the regex ever sees it, which silently
   * turned "path containing a dot" into "path of two or more characters" and
   * excluded the whole site from the middleware.
   */
  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
  const isPage = !last.includes('.') && !pathname.startsWith('/admin');

  const chosen = storedLocale(req.cookies.get(LOCALE_COOKIE)?.value);
  if (isPage && chosen !== null && !isCrawler(req.headers.get('user-agent') ?? '')) {
    if (chosen !== localeFromPath(pathname)) {
      const dest = mirrorPath(pathname, chosen);
      if (dest !== pathname) {
        const url = req.nextUrl.clone();
        url.pathname = dest;
        return NextResponse.redirect(url, 302);
      }
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

/**
 * Everything except the API, Next's own assets and the file prefixes that have
 * routes of their own.
 */
export const config = {
  matcher: ['/((?!api|_next|assets|uploads|images|favicon).*)']
};
