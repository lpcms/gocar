import { FaqPage } from '@/components/site/faq-page';
import { JsonLd } from '@/components/site/json-ld';
import { getPageMetadata } from '@/lib/site-meta';
import type { Locale } from '@/lib/site-nav';

/**
 * The FAQ page. The markup lives in FaqPage, so the route is a thin shell
 * around it.
 */
export const dynamic = 'force-dynamic';

/** Locale of this tree. */
const LOCALE: Locale = 'en';

/** Title, description, canonical and hreflang, all from the admin. */
export async function generateMetadata() {
  return getPageMetadata('faq', LOCALE);
}

export default function FaqRoute() {
  return (
    <>
      <FaqPage locale={LOCALE} />
      <JsonLd bare="faq" locale={LOCALE} />
    </>
  );
}
