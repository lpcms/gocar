import { ContactPage } from '@/components/site/contact-page';
import { JsonLd } from '@/components/site/json-ld';
import { getPageMetadata } from '@/lib/site-meta';
import type { Locale } from '@/lib/site-nav';

/**
 * The contact page. The markup lives in ContactPage, so the route is a thin
 * shell around it.
 */
export const dynamic = 'force-dynamic';

/** Locale of this tree. */
const LOCALE: Locale = 'en';

/** Title, description, canonical and hreflang, all from the admin. */
export async function generateMetadata() {
  return getPageMetadata('contact', LOCALE);
}

export default function ContactRoute() {
  return (
    <>
      <ContactPage locale={LOCALE} />
      <JsonLd bare="contact" locale={LOCALE} />
    </>
  );
}
