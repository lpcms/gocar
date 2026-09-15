import { headers } from 'next/headers';
import { NotFoundPage } from '@/components/site/not-found-page';
import { localeFromPath } from '@/lib/site-nav';

/**
 * The 404 of the Ukrainian tree, and the last stop for every unmatched path in
 * the whole app - `[...notfound]/page.tsx` funnels them here.
 *
 * Because it answers for both languages it picks the locale from the path
 * itself rather than from the tree it lives in, so an unknown /en/... comes
 * back in English. The English tree keeps its own not-found for the
 * `notFound()` calls raised inside it (an unknown category or car).
 *
 * It used to carry the redirects table as well. That moved to `redirectIfMoved`
 * on 24.08.2026, called by everything that is about to raise a 404: a
 * `redirect()` raised in this file is swallowed - Next renders it inside a
 * boundary whose 404 is already committed - so every row in the table was
 * ignored for the whole of phase 2.
 *
 * The pathname comes from the `x-pathname` header middleware sets - a
 * component is not told the URL it is answering.
 */
export default async function NotFound() {
  const pathname = (await headers()).get('x-pathname') ?? '';
  return <NotFoundPage locale={localeFromPath(pathname)} pathname={pathname} />;
}
