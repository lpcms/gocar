import { notFound } from 'next/navigation';
import { redirectIfMoved } from '@/lib/redirects';
import { CarDetailPage } from '@/components/site/car-detail-page';
import { getCarDetailData } from '@/lib/site-car-detail';
import type { Locale } from '@/lib/site-nav';
import { JsonLd } from '@/components/site/json-ld';
import { getPageMetadata } from '@/lib/site-meta';

/**
 * One car page, Ukrainian tree. Only a live car resolves; anything else
 * is a 404, so a draft or a mistyped slug cannot invent a page.
 */
export const dynamic = 'force-dynamic';

/** Locale of this tree. */
const LOCALE: Locale = 'ua';

/**
 * Title, description, canonical and hreflang for this car. The copy
 * comes from the admin templates, filled with this page's own data.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return getPageMetadata(`cars-detail/${slug}`, LOCALE);
}

export default async function CarDetailRouteUk({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (getCarDetailData(slug, LOCALE) === null) {
    /** A dead address may have a row in the redirects table; that answer wins over the 404. */
    await redirectIfMoved();
    notFound();
  }
  return (
    <>
      <CarDetailPage slug={slug} locale={LOCALE} />
      <JsonLd bare={`cars-detail/${slug}`} locale={LOCALE} />
    </>
  );
}
