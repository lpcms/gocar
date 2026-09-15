import { SiteHeader } from './header';
import { SiteFooter } from './footer';
import { Breadcrumbs } from './breadcrumbs';
import { SiteButton } from './button';
import { FaqAccordion } from './faq-accordion';
import { FaqInitial } from './client/faq-initial';
import { getFaqGroups } from '@/lib/site-faq';
import { getTranslation } from '@/lib/translations';
import { getMediaAlt } from '@/lib/media-alt';
import { responsiveImage } from '@/lib/site-images';
import { localePath } from '@/lib/site-nav';
import type { Locale } from '@/lib/site-nav';

/**
 * The FAQ page.
 *
 * Three blocks, all measured off the reference (spec/dom/faq@*.json): the hero
 * - breadcrumbs, title and a full-bleed banner 400/350/300px tall; the
 * questions, four groups laid out as two rows of two columns above 810 and a
 * single column below it; and the closing banner, which unlike the booking one
 * of the other pages is left-aligned, keeps its ink-coloured heading and adds a
 * subtitle above the button.
 *
 * The accordion itself is the component built in stage 3; only its breakpoint
 * behaviour is added here (scripts/migrate-faq-copy.mjs seeds the banner copy).
 */
export function FaqPage({ locale }: { locale: Locale }) {
  const groups = getFaqGroups(locale);
  const rows = [groups.slice(0, 2), groups.slice(2)].filter((row) => row.length > 0);
  const title = getTranslation('faq.title', locale, 'Frequently Asked Questions');
  const ctaHeading = getTranslation('faq.cta_heading', locale, 'Still Have Questions?');
  const ctaSub = getTranslation('faq.cta_sub', locale, 'Contact Us for Assistance');
  const ctaButton = getTranslation('faq.cta_button', locale, 'Contact Us');

  return (
    <div className="site-shell">
      <SiteHeader locale={locale} pathname={localePath('faq', locale)} />

      <header className="site-faq-hero">
        <div className="site-page-head site-page-head--faq">
          <Breadcrumbs path="faq" locale={locale} />
          <h1 className="site-page-title t-8swvc5">{title}</h1>
        </div>
        <div className="site-faq-banner">
          <img
            {...responsiveImage('/images/site/faq-hero.png')}
            alt={getMediaAlt('/images/site/faq-hero.png', locale)}
            fetchPriority="high"
          />
        </div>
      </header>

      <section className="site-faq site-reveal">
        <div className="site-faq-inner">
          {rows.map((row, rowIndex) => (
            <div className="site-faq-row" key={row[0]?.key ?? rowIndex}>
              {row.map((group, index) => (
                <FaqAccordion
                  group={group}
                  openFirst={rowIndex === 0 && index === 0}
                  key={group.key}
                />
              ))}
            </div>
          ))}
        </div>
        <FaqInitial />
      </section>

      <section className="site-faq-cta site-reveal">
        <div className="site-faq-cta-card">
          <img
            className="site-faq-cta-image"
            {...responsiveImage('/images/site/faq-cta.png')}
            alt={getMediaAlt('/images/site/faq-cta.png', locale)}
            loading="lazy"
            decoding="async"
          />
          <div className="site-faq-cta-text">
            <h2 className="site-faq-cta-heading t-8swvc5">{ctaHeading}</h2>
            <p className="site-faq-cta-sub t-1564km0">{ctaSub}</p>
          </div>
          <SiteButton href={localePath('contact', locale)} className="site-faq-cta-button">
            {ctaButton}
          </SiteButton>
        </div>
      </section>

      <SiteFooter locale={locale} pathname={localePath('faq', locale)} />
    </div>
  );
}
