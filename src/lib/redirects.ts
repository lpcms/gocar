import { headers } from 'next/headers';
import { permanentRedirect, redirect } from 'next/navigation';
import { getDb } from './db';
import { localeFromPath, mirrorPath, stripLocale } from './locale-path';
import type { Locale } from './locale-path';

/**
 * Resolve a redirect for the given request path. Follows chains up to
 * a small hop limit; cycle detection is enforced on write, so a runtime
 * cycle should never occur, but the guard keeps us safe.
 */
export function resolveRedirect(fromPath: string) {
  const db = getDb();
  const stmt = db.prepare('SELECT to_path, type FROM redirects WHERE from_path = ?');
  const seen = new Set();
  let current = fromPath;
  let last: { to_path: string; type: number } | null = null;
  for (let hops = 0; hops < 10; hops += 1) {
    const row = stmt.get(current) as unknown as { to_path: string; type: number } | undefined;
    if (!row) break;
    if (seen.has(current)) break;
    seen.add(current);
    last = row;
    current = row.to_path;
  }
  return last === null ? null : { to: current, type: last.type };
}

/**
 * Detect a cycle that a new/updated row would create. Walks the target
 * graph and returns true if reaching from_path becomes possible.
 */
export function wouldCycle(fromPath: string, toPath: string) {
  if (fromPath === toPath) return true;
  const db = getDb();
  const stmt = db.prepare('SELECT to_path FROM redirects WHERE from_path = ?');
  const seen = new Set([fromPath]);
  let current = toPath;
  for (let hops = 0; hops < 20; hops += 1) {
    if (current === fromPath) return true;
    if (seen.has(current)) return false;
    seen.add(current);
    const row = stmt.get(current) as unknown as { to_path: string } | undefined;
    if (!row) return false;
    current = row.to_path;
  }
  return true;
}

/**
 * Answer the address of the current request the way the redirects table says
 * to, or return and let the caller raise its 404.
 *
 * It is called immediately before every `notFound()` rather than from the 404
 * itself, which is where it lived until 24.08.2026. A `redirect()` raised
 * inside `not-found.tsx` is swallowed: Next renders that file inside a
 * boundary whose 404 is already committed, so the visitor gets the 404 page
 * and no Location header - measured, not assumed, with the table holding a
 * live row. Every row was therefore ignored for the whole of phase 2.
 *
 * A row only matters for an address that no longer resolves to a page, which
 * is exactly what these call sites are about to answer, so a row still cannot
 * shadow a live URL.
 *
 * The address comes from the `x-pathname` header middleware sets - a component
 * is not told the URL it is answering.
 */
export async function redirectIfMoved(): Promise<void> {
  const pathname = (await headers()).get('x-pathname') ?? '';
  if (pathname === '') return;
  /**
   * A visitor who has chosen English reaches an unknown Ukrainian address as
   * /en/<path>, because middleware mirrors it before anything is routed. A row
   * is written once, for the address as it is indexed, so the bare path is
   * looked up as well - without it the table would answer for half the
   * visitors and 404 the other half.
   */
  const bare = stripLocale(pathname);
  const exact = resolveRedirect(pathname);
  const hit = exact ?? (bare === pathname ? null : resolveRedirect(bare));
  if (hit === null) return;
  const target = redirectTarget(hit.to, exact !== null, localeFromPath(pathname));
  /** «301 - постоянный» in the admin has to arrive as a permanent answer. */
  if (hit.type === 301) permanentRedirect(target);
  redirect(target);
}

/**
 * The address a row points at, in the locale of the path that matched it.
 *
 * A row found by the address as written is followed exactly as the admin wrote
 * it, including one that deliberately crosses languages, and an absolute URL
 * is never rewritten. Only the fallback above is mirrored, and that one only
 * ever fires for an address under /en.
 */
function redirectTarget(to: string, exact: boolean, locale: Locale): string {
  if (exact || !to.startsWith('/') || to.startsWith('//')) return to;
  return mirrorPath(to, locale);
}
