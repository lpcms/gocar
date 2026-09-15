import { CarsPage } from '@/components/site/cars-page';
import { JsonLd } from '@/components/site/json-ld';
import { getPageMetadata } from '@/lib/site-meta';
import type { Locale } from '@/lib/site-nav';

/**
 * The fleet page. The markup lives in CarsPage; the staging prefix is gone,
 * so every link it builds is an ordinary absolute path again.
 */
export const dynamic = 'force-dynamic';

/** Locale of this tree. */
const LOCALE: Locale = 'en';

/** Title, description, canonical and hreflang, all from the admin. */
export async function generateMetadata() {
  return getPageMetadata('cars', LOCALE);
}

export default function CarsRoute() {
  return (
    <>
      <CarsPage locale={LOCALE} />
      <JsonLd bare="cars" locale={LOCALE} />
    </>
  );
}
