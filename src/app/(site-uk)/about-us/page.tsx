import { AboutPage } from '@/components/site/about-page';
import { JsonLd } from '@/components/site/json-ld';
import { getPageMetadata } from '@/lib/site-meta';
import type { Locale } from '@/lib/site-nav';

/** The about-us page, Ukrainian tree. */
export const dynamic = 'force-dynamic';

/** Locale of this tree. */
const LOCALE: Locale = 'ua';

/** Title, description, canonical and hreflang, all from the admin. */
export async function generateMetadata() {
  return getPageMetadata('about-us', LOCALE);
}

export default function AboutRouteUk() {
  return (
    <>
      <AboutPage locale={LOCALE} />
      <JsonLd bare="about-us" locale={LOCALE} />
    </>
  );
}
