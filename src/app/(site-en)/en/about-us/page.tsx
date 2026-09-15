import { AboutPage } from '@/components/site/about-page';
import { JsonLd } from '@/components/site/json-ld';
import { getPageMetadata } from '@/lib/site-meta';
import type { Locale } from '@/lib/site-nav';

/**
 * The about-us page. The markup lives in AboutPage, so the route is a thin
 * shell around it.
 */
export const dynamic = 'force-dynamic';

/** Locale of this tree. */
const LOCALE: Locale = 'en';

/** Title, description, canonical and hreflang, all from the admin. */
export async function generateMetadata() {
  return getPageMetadata('about-us', LOCALE);
}

export default function AboutRoute() {
  return (
    <>
      <AboutPage locale={LOCALE} />
      <JsonLd bare="about-us" locale={LOCALE} />
    </>
  );
}
