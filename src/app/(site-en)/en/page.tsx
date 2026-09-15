import { HomePage } from '@/components/site/home-page';
import { JsonLd } from '@/components/site/json-ld';
import { getPageMetadata } from '@/lib/site-meta';
import type { Locale } from '@/lib/site-nav';

/**
 * The home page. The markup lives in HomePage, so the route is a thin shell
 * around it.
 */
export const dynamic = 'force-dynamic';

/** Locale of this tree. */
const LOCALE: Locale = 'en';

/** Title, description, canonical and hreflang, all from the admin. */
export async function generateMetadata() {
  return getPageMetadata('', LOCALE);
}

export default function HomeRoute() {
  return (
    <>
      <HomePage locale={LOCALE} />
      <JsonLd bare="" locale={LOCALE} />
    </>
  );
}
