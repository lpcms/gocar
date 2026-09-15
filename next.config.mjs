/**
 * Next.js configuration.
 *
 * The production host (CityHost) has limited RAM, and Next's default page-data
 * collection spawns one worker per CPU (31 on this box), which exhausts memory
 * and the build is OOM-killed ("Collecting page data ... Killed"). Capping the
 * worker count and disabling extra worker threads keeps the build within the
 * available memory. Values are intentionally conservative; raise them only if
 * the host has more headroom.
 */
import fs from 'node:fs';

const nextConfig = {
  /**
   * Limit CPU-bound build parallelism (page-data collection, static
   * generation) so peak memory stays low on small plans.
   */
  experimental: {
    cpus: 1,
    workerThreads: false
  },
  /**
   * The dev-mode indicator is a fixed overlay in the corner of every page, and
   * the phase-2 capture is a full-page screenshot: left on, it lands in every
   * candidate frame and reads as a mismatch against the reference. It has no
   * effect on production builds.
   */
  devIndicators: false,
  /**
   * The database template is opened with a runtime path, which file tracing
   * cannot see; without this a serverless deployment (Vercel) ships functions
   * that have no database to start from.
   *
   * Only when the file is there: an installation that has its own live
   * database and no template (the production host) must not name a missing
   * file here - `next build` then hangs before compiling, indefinitely
   * (measured 15.09.2026: 54 s with the file, killed after 8 min without).
   */
  ...(fs.existsSync(new URL('./db/gocar.template.db', import.meta.url))
    ? { outputFileTracingIncludes: { '/**': ['./db/gocar.template.db'] } }
    : {}),
  /**
   * Metadata in <head> for every client.
   *
   * Since 15.2 Next streams the metadata of a dynamic page for any user agent
   * outside a short list of "HTML-limited" bots, and the streamed tags land in
   * <body>. Browsers, Googlebot, Lighthouse / PageSpeed Insights and the SEO
   * crawlers (Ahrefs, Semrush, Screaming Frog) therefore got the description,
   * canonical and hreflang outside <head>, and Lighthouse scored every page 92
   * for "Document does not have a meta description" (15.09.2026). Matching
   * every user agent turns streaming off; generateMetadata here is a few
   * synchronous reads, so the head costs nothing noticeable to wait for.
   */
  htmlLimitedBots: /.*/,
  /**
   * SWC minification runs via WASM on this host (no native bindings due to an
   * old GLIBC); that is expected and handled by Next automatically.
   */
  /**
   * HSTS on every answer.
   *
   * The site is reachable over plain http as well (the panel in front of the
   * app terminates TLS and does not redirect), and without this header a
   * visitor who types the bare domain is one interception away from being
   * kept on http forever. A year, subdomains included; `preload` is left off
   * on purpose - that is a submission to a browser-vendor list and is hard to
   * undo, so it stays a deliberate decision rather than a side effect of this
   * change.
   *
   * A user agent ignores the header when it arrives over http (RFC 6797), so
   * sending it unconditionally is safe.
   */
  /**
   * Keeping the panel out of search.
   *
   * `Disallow: /admin` in robots.txt was doing this job, and did it badly on
   * both counts: robots.txt is public, so the line advertised the address, and
   * a disallowed URL can still be indexed - a crawler that finds it linked
   * lists it without being able to read it. `noindex` is the header that
   * actually removes a page from the results, and it is only ever seen by
   * something that already requested that exact path, so it tells an attacker
   * nothing (25.08.2026).
   *
   * It covers `/admin/login` too, which is the one page of the panel a crawler
   * can reach without a session, and the API, whose JSON has no business in an
   * index either.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          }
        ]
      },
      {
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
      },
      {
        source: '/admin',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
      }
    ];
  },
  eslint: {
    /**
     * Linting already runs in the prebuild step (check-imports + check-strict);
     * skip Next's own lint pass during build to save memory and time.
     */
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
