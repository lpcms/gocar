import { CarsPage } from '@/components/site/cars-page';
import { JsonLd } from '@/components/site/json-ld';
import { getPageMetadata } from '@/lib/site-meta';
import type { Locale } from '@/lib/site-nav';

/** The fleet page, Ukrainian tree. */
export const dynamic = 'force-dynamic';

/** Locale of this tree. */
const LOCALE: Locale = 'ua';

/** Title, description, canonical and hreflang, all from the admin. */
export async function generateMetadata() {
  return getPageMetadata('cars', LOCALE);
}

export default function CarsRouteUk() {
  return (
    <>
      <CarsPage locale={LOCALE} />
      <JsonLd bare="cars" locale={LOCALE} />
    </>
  );
}
