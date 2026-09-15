import { SiteHeader } from './header';
import { SiteFooter } from './footer';
import { Breadcrumbs } from './breadcrumbs';
import { SiteButton } from './button';
import { getAboutTexts } from '@/lib/site-about';
import { getMediaAlt } from '@/lib/media-alt';
import { responsiveImage } from '@/lib/site-images';
import { localePath } from '@/lib/site-nav';
import type { Locale } from '@/lib/site-nav';

/**
 * The about-us page.
 *
 * Four sections, all measured off the reference (spec/dom/about-us@*.json):
 * the journey hero - photo beside a white text card, stacked below 1440; the
 * four info cards in a two-column grid whose 350px cards overhang their 318px
 * rows; the "how it works" diagram; and the dark booking banner.
 *
 * Every string comes from the translations table (scripts/migrate-about-copy.mjs).
 */
export function AboutPage({ locale }: { locale: Locale }) {
  const texts = getAboutTexts(locale);

  return (
    <div className="site-shell">
      <SiteHeader locale={locale} pathname={localePath('about-us', locale)} />

      <div className="site-page-head">
        <Breadcrumbs path="about-us" locale={locale} />
        <h1 className="site-page-title t-8swvc5">{texts.title}</h1>
      </div>

      {/*
        No scroll appearance here: this block is the first screen, and a block
        hidden until the script runs holds back the page's largest paint.
      */}
      <section className="site-about-journey">
        <div className="site-about-journey-inner">
          <div className="site-about-photo">
            <img
              {...responsiveImage('/images/site/about-hero.jpg')}
              alt={getMediaAlt('/images/site/about-hero.jpg', locale)}
              fetchPriority="high"
            />
          </div>
          <div className="site-about-journey-card">
            <div className="site-about-journey-head">
              <h2 className="site-about-kicker">{texts.journeyKicker}</h2>
              <p className="site-about-journey-title">{texts.journeyTitle}</p>
            </div>
            <p className="site-about-journey-text">{texts.journeyText}</p>
          </div>
        </div>
      </section>

      <section className="site-about-cards site-reveal">
        {texts.cards.map((card) => (
          <div className="site-about-card-cell" key={card.key}>
            <div className="site-about-card">
              <div className="site-about-card-head">
                <img
                  className="site-about-card-icon"
                  src={card.icon}
                  alt={getMediaAlt(card.icon, locale)}
                />
                <h2 className="site-about-card-title">{card.title}</h2>
              </div>
              <p className="site-about-card-text">{card.text}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="site-about-steps site-reveal site-reveal--cascade">
        <div className="site-about-steps-head">
          <h2 className="site-about-kicker">{texts.stepsKicker}</h2>
          <p className="site-about-steps-title">{texts.stepsTitle}</p>
        </div>
        <div className="site-about-diagram">
          <span className="site-about-glow" aria-hidden="true" />
          <span className="site-about-watermark" aria-hidden="true">
            GoCar
          </span>
          <div className="site-about-rail" aria-hidden="true" />
          {texts.steps.map((step, index) => (
            <div className={`site-about-step site-about-step--${index + 1}`} key={step.key}>
              <span className="site-about-step-disc">
                <img
                  className="site-about-step-icon"
                  src={step.icon}
                  alt={getMediaAlt(step.icon, locale)}
                />
                <img
                  className="site-about-step-icon-hover"
                  src={step.iconHover}
                  alt={getMediaAlt(step.iconHover, locale)}
                />
              </span>
              <div className="site-about-step-body">
                <h2 className="site-about-step-title">{step.title}</h2>
                <p className="site-about-step-text">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="site-about-cta site-reveal">
        <div className="site-about-cta-card">
          <img
            className="site-about-cta-image"
            {...responsiveImage('/images/site/about-cta.png')}
            alt={getMediaAlt('/images/site/about-cta.png', locale)}
            loading="lazy"
            decoding="async"
          />
          <p className="site-about-cta-heading">{texts.ctaHeading}</p>
          <SiteButton href={localePath('book', locale)} className="site-about-cta-button">
            {texts.ctaButton}
          </SiteButton>
        </div>
      </section>

      <SiteFooter locale={locale} pathname={localePath('about-us', locale)} />
    </div>
  );
}
