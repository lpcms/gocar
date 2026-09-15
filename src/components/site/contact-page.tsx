import { SiteHeader } from './header';
import { SiteFooter } from './footer';
import { Breadcrumbs } from './breadcrumbs';
import { CtaBanner } from './cta-banner';
import { ContactForm } from './client/contact-form';
import { getContactData, HERO } from '@/lib/site-contact';
import { localePath } from '@/lib/site-nav';
import type { Locale } from '@/lib/site-nav';

/**
 * The contact page.
 *
 * Four blocks, measured off the reference (spec/dom/contact@*.json): the hero -
 * breadcrumbs, title and a full-bleed banner 400/350/300px tall, the same shape
 * the FAQ hero has; the two columns of the contact block, which stand side by
 * side from 1440 up and stack below it, as the reference does; the map block;
 * and the closing banner of the inner pages, whose text is right-aligned over
 * the photo and carries a kicker above the heading.
 *
 * Client-side there is one island, the form. Everything else is server markup,
 * and every string comes from the database (scripts/migrate-contact-copy.mjs).
 *
 * Divergences from the reference, agreed 21.08.2026:
 * - both column headings and the map heading are the standard 20/28 w700 block
 *   heading of the FAQ groups, instead of the reference's 18/27 w500;
 * - the opening hours from settings are a fourth card in the contact column,
 *   which is what makes the two columns roughly the same height, and the cards
 *   are the compact variant so that they fit;
 * - the map block gets the standard section rhythm (100/80/60) instead of
 *   sitting flush against the block above it;
 * - the map heading and its paragraph are the SEO rewrite.
 */
export function ContactPage({ locale }: { locale: Locale }) {
  const data = getContactData(locale);
  const t = data.texts;
  const path = localePath('contact', locale);

  return (
    <div className="site-shell">
      <SiteHeader locale={locale} pathname={path} />

      <header className="site-contact-hero">
        <div className="site-page-head">
          <Breadcrumbs path="contact" locale={locale} />
          <h1 className="site-page-title t-8swvc5">{t.title}</h1>
        </div>
        <div className="site-contact-banner">
          <img src={HERO} alt={data.heroAlt} />
        </div>
      </header>

      <section className="site-contact site-reveal">
        <div className="site-contact-inner">
          <div className="site-contact-col site-contact-col--form">
            <h2 className="site-block-title t-1914n6i">{t.formTitle}</h2>
            <p className="site-contact-text t-mvj9bv">{t.formText}</p>
            <ContactForm locale={locale} data={data} />
          </div>

          <aside className="site-contact-col site-contact-col--info">
            <h2 className="site-block-title t-1914n6i">{t.contactsTitle}</h2>
            <div className="site-contact-cards">
              {data.entries.map((entry) => {
                const body = (
                  <>
                    <span className="site-contact-label">{entry.label}</span>
                    <span className="site-contact-value">{entry.value}</span>
                  </>
                );
                return entry.href === '' ? (
                  <div className="site-contact-card" key={entry.kind}>
                    {body}
                  </div>
                ) : (
                  <a className="site-contact-card" href={entry.href} key={entry.kind}>
                    {body}
                  </a>
                );
              })}
            </div>
          </aside>
        </div>
      </section>

      <section className="site-contact-map site-reveal">
        <div className="site-contact-map-inner">
          <h2 className="site-block-title site-block-title--center t-1914n6i">{t.mapTitle}</h2>
          <p className="site-contact-text site-contact-text--justify t-mvj9bv">{t.mapText}</p>
          {data.mapSrc === '' ? null : (
            <div className="site-contact-map-frame">
              <iframe
                src={data.mapSrc}
                title={t.mapFrameTitle}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </section>

      <CtaBanner
        locale={locale}
        kicker={t.ctaKicker}
        heading={t.ctaHeading}
        button={t.ctaButton}
        align="end"
        headingLevel={2}
      />

      <SiteFooter locale={locale} pathname={path} />

      {data.recaptchaSiteKey === '' ? null : (
        <script
          async
          defer
          src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(data.recaptchaSiteKey)}`}
        />
      )}
    </div>
  );
}
