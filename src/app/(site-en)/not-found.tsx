import { NotFoundPage } from '@/components/site/not-found-page';

/**
 * The 404 of the English tree: it answers the `notFound()` calls raised inside
 * it, which is an unknown category or an unpublished car under /en.
 *
 * Paths that match no route at all never reach this file - the app's single
 * catch-all lives in the group that owns the root, and that group's
 * `not-found.tsx` carries the address and picks the language from it.
 *
 * It stays synchronous on purpose: reading `x-pathname` here to hand the
 * header a real address turns every 404 of the production build into a 500,
 * because this file is also what Next prerenders as its static /_not-found,
 * where there is no request to read (measured 25.08.2026). Without an address
 * the header falls back to the home of the locale.
 */
export default function NotFound() {
  return <NotFoundPage locale="en" />;
}
