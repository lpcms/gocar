import { getTranslation } from '@/lib/translations';
import { getMediaAlt } from '@/lib/media-alt';
import { localePath, withBase } from '@/lib/site-nav';
import type { Locale } from '@/lib/site-nav';
import { SiteButton } from './button';

/**
 * Booking call-to-action that closes every page: a 1340x400 rounded banner with
 * a background photo, a 44/60 heading and the primary button. Numbers from the
 * captured reference; the image is served from public/images/site so nothing
 * depends on the Framer asset tree.
 *
 * Two shapes, both from the reference. The 404 page centres a heading over the
 * photo; the inner pages (contact and the ones still to move) push the block to
 * the right edge, right-align the heading and put a 20/24 w600 kicker above it.
 * `align="end"` is that second shape.
 */
export function CtaBanner({
  locale,
  heading,
  button,
  kicker,
  align = 'center',
  headingLevel = 1,
  basePath = ''
}: {
  locale: Locale;
  heading?: string;
  button?: string;
  /** Line above the heading; only the right-aligned shape has one. */
  kicker?: string;
  align?: 'center' | 'end';
  /**
   * The banner heading is the <h1> of the page only where that page has no
   * other one - the 404. A page with a title of its own passes 2.
   */
  headingLevel?: 1 | 2;
  /** Staging prefix that keeps the button of a /v2 page inside /v2. */
  basePath?: string;
}) {
  const title =
    heading ??
    getTranslation(
      '404.cta_heading',
      locale,
      'Book Your Adventure Today and Feel the Power of the Open Road.'
    );
  const label = button ?? getTranslation('404.cta_button', locale, 'Book Now');
  const cardClasses =
    align === 'end' ? 'site-cta-card site-cta-card--end' : 'site-cta-card';

  return (
    <section className="site-cta">
      <div className={cardClasses}>
        <img src="/images/site/cta-banner.png" alt={getMediaAlt('/images/site/cta-banner.png', locale)} className="site-cta-image" />
        {kicker === undefined || kicker === '' ? null : (
          <p className="site-cta-kicker t-115u14f">{kicker}</p>
        )}
        {headingLevel === 1 ? (
          <h1 className="site-cta-heading t-8swvc5">{title}</h1>
        ) : (
          <h2 className="site-cta-heading t-8swvc5">{title}</h2>
        )}
        <SiteButton href={withBase(localePath('book', locale), basePath)}>{label}</SiteButton>
      </div>
    </section>
  );
}
