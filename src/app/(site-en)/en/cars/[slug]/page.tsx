import { notFound } from 'next/navigation';
import { redirectIfMoved } from '@/lib/redirects';
import { CarsPage } from '@/components/site/cars-page';
import { getCategoryBySlug } from '@/lib/site-cars';
import type { Locale } from '@/lib/site-nav';
import { JsonLd } from '@/components/site/json-ld';
import { getPageMetadata } from '@/lib/site-meta';

/**
 * The page of one fleet category. The slug is a category of the admin;
 * anything else is a 404, so the segment cannot invent pages.
 */
export const dynamic = 'force-dynamic';

/** Locale of this tree. */
const LOCALE: Locale = 'en';

/**
 * Title, description, canonical and hreflang for this category. The copy
 * comes from the admin templates, filled with this page's own data.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return getPageMetadata(`cars/${slug}`, LOCALE);
}

export default async function CategoryRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (getCategoryBySlug(slug, LOCALE) === null) {
    /** A dead address may have a row in the redirects table; that answer wins over the 404. */
    await redirectIfMoved();
    notFound();
  }
  return (
    <>
      <CarsPage locale={LOCALE} categorySlug={slug} />
      <JsonLd bare={`cars/${slug}`} locale={LOCALE} />
    </>
  );
}
