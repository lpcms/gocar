import { SiteHeader } from './header';
import { SiteFooter } from './footer';
import { SiteButton } from './button';
import { CarCard } from './car-card';
import { ReviewsSlider } from './client/reviews-slider';
import { getHomeData, HERO_CAR, WHY_CAR, CTA_CAR, REVIEWS_BG } from '@/lib/site-home';
import { responsiveImage } from '@/lib/site-images';
import { localePath } from '@/lib/site-nav';
import type { Locale } from '@/lib/site-nav';

/**
 * The home page.
 *
 * Six blocks: the hero, the fleet grid, the "why choose us" picture with its
 * glass badges, the four-step diagram, the testimonials slider and the closing
 * banner. Every string and every car comes from the database; the only client
 * island is the slider.
 *
 * Three changes to the hero, asked for by the client on 21.08.2026 and applied
 * here rather than copied from the reference:
 *
 * 1. The car is aligned with the top of the heading and the category chips and
 *    is drawn larger. In the reference the image is a canvas with 18% empty
 *    space above the car, so the box lines up while the car itself sits 74px
 *    lower and reads small; scripts/build-home-images.mjs trims that padding
 *    away, which makes the image box the car.
 * 2. Below 1440 the reference drops the car under the text even where there is
 *    room for it. The hero now steps down the way the footer does: three
 *    columns, then text and car side by side with the chips underneath, then
 *    a single column.
 * 3. The chips are centred on their row and wrap as a group, instead of the
 *    ragged left-leaning block of the reference.
 */
export function HomePage({ locale }: { locale: Locale }) {
  const data = getHomeData(locale);
  const t = data.texts;
  const path = localePath('', locale);

  return (
    <div className="site-shell">
      <SiteHeader locale={locale} pathname={path} />

      <header className="site-home-hero">
        <div className="site-home-hero-inner">
          <div className="site-home-hero-text">
            <h1 className="site-home-hero-title t-8swvc5">{t.heroHeading}</h1>
            <p className="site-home-hero-lead t-mvj9bv">{t.heroText}</p>
            <SiteButton href={localePath('book', locale)}>{t.heroCta}</SiteButton>
          </div>

          <div className="site-home-hero-car">
            <img src={HERO_CAR} alt={data.alts.hero} fetchPriority="high" />
          </div>

          <nav className="site-home-hero-cats" aria-label={t.categoriesLabel}>
            <ul>
              {data.categories.map((category) => (
                <li key={category.slug}>
                  <a className="site-home-chip t-f0mgg6" href={category.href}>
                    {category.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <section className="site-home-fleet site-reveal">
        <h2 className="site-home-heading t-8swvc5">{t.fleetHeading}</h2>
        <div className="site-home-fleet-grid">
          {data.cars.map((car) => (
            <CarCard car={car} labels={data.cardLabels} key={car.slug} />
          ))}
        </div>
      </section>

      <section className="site-home-why site-reveal">
        <div className="site-home-why-inner">
          <div className="site-home-why-text">
            <h2 className="site-home-heading site-home-heading--left t-8swvc5">{t.whyHeading}</h2>
            <p className="site-home-why-list t-mvj9bv">{t.whyText}</p>
          </div>
          <div className="site-home-why-figure">
            <img
              {...responsiveImage(WHY_CAR)}
              alt={data.alts.why}
              loading="lazy"
              decoding="async"
            />
            {data.badges.map((badge) => (
              <a
                className={`site-home-badge site-home-badge--${badge.key}`}
                href={badge.href}
                key={badge.key}
              >
                <span className="site-home-badge-title">{badge.title}</span>
                {/* Printed only below 810, where the badge becomes a card. */}
                <span className="site-home-badge-text">{badge.text}</span>
                <span className="site-home-badge-dot" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="site-home-steps site-reveal">
        <div className="site-home-steps-head">
          <p className="site-home-steps-kicker t-1564km0">{t.stepsKicker}</p>
          <h2 className="site-home-heading t-8swvc5">{t.stepsHeading}</h2>
        </div>
        <ol className="site-home-steps-list">
          {data.steps.map((step, index) => (
            <li
              className={
                index % 2 === 0
                  ? 'site-home-step site-reveal'
                  : 'site-home-step site-home-step--right site-reveal'
              }
              key={step.key}
            >
              <span className="site-home-step-body">
                <span className="site-home-step-text">
                  <span className="site-home-step-title">{step.title}</span>
                  {/* Revealed under the pointer, as in the reference. */}
                  <span className="site-home-step-note">{step.text}</span>
                </span>
                <span className="site-home-step-disc">
                  <img className="site-home-step-icon" src={step.icon} alt={step.alt} />
                  <img
                    className="site-home-step-icon-hover"
                    src={step.iconHover}
                    alt=""
                    aria-hidden="true"
                  />
                </span>
              </span>
              <span className="site-home-step-rail" aria-hidden="true" />
            </li>
          ))}
        </ol>
      </section>

      <section className="site-home-reviews site-reveal">
        {/*
          A faint silhouette behind the quotes. Decoration by default - but the
          admin decides: a description written in Медиатека is a statement that
          the picture carries meaning, so it is announced; an empty field keeps
          it hidden from assistive technology, which is the right markup for a
          picture nobody has anything to say about.
        */}
        <img
          className="site-home-reviews-bg"
          src={REVIEWS_BG}
          alt={data.alts.reviewsBg}
          aria-hidden={data.alts.reviewsBg === '' ? 'true' : undefined}
        />
        <ReviewsSlider reviews={data.reviews} labels={data.reviewLabels} />
      </section>

      <section className="site-home-cta site-reveal">
        <div className="site-home-cta-text">
          <SiteButton href={localePath('book', locale)}>{t.ctaButton}</SiteButton>
          <h2 className="site-home-cta-heading t-8swvc5">{t.ctaHeading}</h2>
        </div>
        <img
          className="site-home-cta-car"
          {...responsiveImage(CTA_CAR)}
          alt={data.alts.cta}
          loading="lazy"
          decoding="async"
        />
      </section>

      <SiteFooter locale={locale} pathname={path} />
    </div>
  );
}
