/**
 * The address a request actually came from, as far as the proxy in front of
 * the app can vouch for it.
 *
 * This is a security boundary, not a convenience: `x-forwarded-for` is the
 * lockout's identity, and the naive reading of it - the first entry - is
 * written by the client. NGINX is configured with
 * `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`, which
 * *appends* the real peer to whatever the request already carried, so a header
 * the visitor sends survives in front of it:
 *
 *   client sends:  X-Forwarded-For: 10.0.0.1
 *   app receives:  X-Forwarded-For: 10.0.0.1, 203.0.113.7
 *                                   ^ attacker    ^ real
 *
 * Reading `[0]` therefore let anyone brute-force the admin password with a
 * fresh made-up identity on every attempt - the lockout counted attempts
 * against addresses that never existed - and let them lock a chosen third
 * party out by spending five failures under that address (25.08.2026).
 *
 * The order below is "closest thing the infrastructure signed for":
 *
 *  1. `cf-connecting-ip` - set by Cloudflare, overwritten on every request;
 *  2. `x-real-ip` - our NGINX sets it from `$remote_addr`, and unlike the
 *     forwarded list it is replaced rather than appended to;
 *  3. the LAST entry of `x-forwarded-for` - the hop our own proxy added,
 *     which is the one part of that header a client cannot control;
 *  4. 'local' - no proxy headers at all, which is the dev server.
 *
 * Behind two trusted proxies the last entry becomes the first proxy rather
 * than the visitor; that is a deliberate trade. An address that is too coarse
 * throttles a little too widely, an address the attacker chooses throttles
 * nothing at all.
 */

/** Strip an IPv6-mapped IPv4 prefix and a port, and normalise the case. */
function normalize(value: string): string {
  const clean = value.trim().replace(/^::ffff:/i, '');
  return clean.toLowerCase();
}

/**
 * Resolve the client address from the request headers.
 */
export function clientIp(headers: Headers): string {
  const cloudflare = headers.get('cf-connecting-ip') ?? '';
  if (cloudflare.trim() !== '') return normalize(cloudflare);

  const real = headers.get('x-real-ip') ?? '';
  if (real.trim() !== '') return normalize(real);

  const forwarded = headers.get('x-forwarded-for') ?? '';
  const hops = forwarded
    .split(',')
    .map((hop) => hop.trim())
    .filter((hop) => hop !== '');
  const last = hops[hops.length - 1];
  if (last !== undefined) return normalize(last);

  return 'local';
}
