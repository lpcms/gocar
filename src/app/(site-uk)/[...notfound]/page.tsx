import { notFound } from 'next/navigation';
import { redirectIfMoved } from '@/lib/redirects';

/**
 * The last route in the tree: anything no other route claimed lands here and
 * is turned into a real 404, unless the redirects table has a row for it.
 *
 * It exists because Next refuses a root `not-found.tsx` when the app has no
 * root layout, and this app has none - both root layouts live in the locale
 * groups, because a layout has to own <html lang> and the two languages
 * differ. Falling into a group is what gives the 404 a layout to render in.
 *
 * One catch-all, not one per group: two of them would resolve the same paths
 * and Next rejects that. It sits in the group that owns the root - the
 * Ukrainian one since 22.08.2026 - and that group's `not-found.tsx` picks the
 * language from the path, so an unknown /en/... still answers in English.
 *
 * The retired /uk addresses used to be answered here as well. They moved to
 * middleware on 24.08.2026, because a rule at the end of the route tree runs
 * too late: the language mirror had already turned /uk into /en/uk, which no
 * route claims, and every indexed old link answered 404 for a visitor who had
 * chosen English. Redirecting before routing also keeps the query string.
 */
export const dynamic = 'force-dynamic';

export default async function NotFoundCatchAll(): Promise<never> {
  await redirectIfMoved();
  notFound();
}
