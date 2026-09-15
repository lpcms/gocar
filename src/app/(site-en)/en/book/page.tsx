import { BookPage } from '@/components/site/book-page';
import { JsonLd } from '@/components/site/json-ld';
import { getPageMetadata } from '@/lib/site-meta';
import type { Locale } from '@/lib/site-nav';

/**
 * The booking page. The markup lives in BookPage, so the route is a thin
 * shell around it.
 */
export const dynamic = 'force-dynamic';

/** Locale of this tree. */
const LOCALE: Locale = 'en';

/** Title, description, canonical and hreflang, all from the admin. */
export async function generateMetadata() {
  return getPageMetadata('book', LOCALE);
}

/**
 * `?car=<slug>` preselects the vehicle a visitor came from, so the "Book Now"
 * button of a car page opens the form with that car already chosen.
 */
export default async function BookRoute({
  searchParams
}: {
  searchParams: Promise<{ car?: string }>;
}) {
  const { car } = await searchParams;
  return (
    <>
      <BookPage locale={LOCALE} carSlug={car ?? ''} />
      <JsonLd bare="book" locale={LOCALE} />
    </>
  );
}
