import { HomePage } from '@/components/site/home-page';
import { JsonLd } from '@/components/site/json-ld';
import { getPageMetadata } from '@/lib/site-meta';
import type { Locale } from '@/lib/site-nav';

/** The home page, Ukrainian tree. */
export const dynamic = 'force-dynamic';

/** Locale of this tree. */
const LOCALE: Locale = 'ua';

/** Title, description, canonical and hreflang, all from the admin. */
export async function generateMetadata() {
  return getPageMetadata('', LOCALE);
}

export default function HomeRouteUk() {
  return (
    <>
      <HomePage locale={LOCALE} />
      <JsonLd bare="" locale={LOCALE} />
    </>
  );
}
