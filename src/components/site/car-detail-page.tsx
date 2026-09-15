import { SiteHeader } from './header';
import { SiteFooter } from './footer';
import { Breadcrumbs } from './breadcrumbs';
import { SiteButton } from './button';
import { CarGallery } from './car-gallery';
import { CtaBanner } from './cta-banner';
import {
  IconCategory,
  IconDrivetrain,
  IconEngine,
  IconFuel,
  IconSeats,
  IconTransmission
} from './icons/car-specs';
import { getCarDetailData } from '@/lib/site-car-detail';
import type { CarSpec } from '@/lib/site-car-detail';
import { getMediaAlt } from '@/lib/media-alt';
import { localePath, withBase } from '@/lib/site-nav';
import type { Locale } from '@/lib/site-nav';

/** Photograph behind the page head, moved out of the Framer asset tree. */
const HERO = '/images/site/car-detail-hero.jpg';

/** Glyph of each specification tile, in the order the grid draws them. */
const SPEC_ICONS: Record<CarSpec['key'], typeof IconFuel> = {
  category: IconCategory,
  engine: IconEngine,
  transmission: IconTransmission,
  seats: IconSeats,
  fuel: IconFuel,
  drivetrain: IconDrivetrain
};

/**
 * One car page.
 *
 * The reference is a dark full-bleed head with the breadcrumbs and "Car
 * Details" over a photograph, then two columns - the gallery on the left, the
 * name, prices, tariff table, button and specifications on the right - then
 * "You may also like" and the closing banner.
 *
 * Five changes to the reference, asked for by the client on 22.08.2026:
 *
 * 1. The tariff table sits directly under the price row, one standard step
 *    away instead of the reference's 60px of empty column.
 * 2. Its four headings come from the Cars-detail group of Переводы rather
 *    than being baked into the markup.
 * 3. The car's own description is printed under the button; the reference
 *    shows it nowhere, although the admin has always had the field.
 * 4. A sixth specification - the drivetrain - joins the five of the
 *    reference.
 * 5. Prices are set to read as prices: the per-day figure is the largest
 *    number on the page, the deposit answers it on the right, and the table
 *    is drawn on the soft surface tone instead of white-on-white boxes.
 */
export function CarDetailPage({
  slug,
  locale,
  basePath = ''
}: {
  slug: string;
  locale: Locale;
  basePath?: string;
}) {
  const data = getCarDetailData(slug, locale);
  if (data === null) return null;
  /** Bare path of this page, reused by the chrome and the breadcrumbs. */
  const bare = 'cars-detail/' + slug;
  const path = withBase(localePath(bare, locale), basePath);
  /**
   * "Book Now" carries the car to the form: the booking page reads `?car` and
   * opens with this car's category, name and photograph already chosen
   * (client 22.08.2026).
   */
  const bookHref = `${withBase(localePath('book', locale), basePath)}?car=${encodeURIComponent(slug)}`;

  return (
    <div className="site-shell site-shell--hero-nav">
      <SiteHeader locale={locale} pathname={path} basePath={basePath} />

      <header className="site-car-hero">
        <img className="site-car-hero-photo" src={HERO} alt={getMediaAlt(HERO, locale)} />
        <div className="site-car-hero-inner">
          <Breadcrumbs
            path={bare}
            locale={locale}
            currentLabel={data.title}
            align="start"
            tone="light"
            basePath={basePath}
          />
          <h1 className="site-car-hero-title t-8swvc5">{data.labels.pageTitle}</h1>
        </div>
      </header>

      <section className="site-car-main site-reveal">
        <div className="site-car-main-inner">
          <CarGallery photos={data.photos} />

          <div className="site-car-info">
            <h2 className="site-car-name t-8swvc5">{data.title}</h2>

            <div className="site-car-money">
              <span className="site-car-money-block">
                <span className="site-car-money-label">{data.labels.startingAt}</span>
                <span className="site-car-money-value">{data.price}</span>
              </span>
              <span className="site-car-money-block site-car-money-block--deposit">
                <span className="site-car-money-label">{data.labels.deposit}</span>
                <span className="site-car-money-value">{data.deposit}</span>
              </span>
            </div>

            <table className="site-car-tariffs">
              <thead>
                <tr>
                  {data.tariffs.map((tariff) => (
                    <th scope="col" key={tariff.key}>
                      {tariff.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {data.tariffs.map((tariff) => (
                    <td key={tariff.key}>{tariff.price}</td>
                  ))}
                </tr>
              </tbody>
            </table>

            <SiteButton className="site-car-book" href={bookHref}>
              {data.labels.bookNow}
            </SiteButton>

            {data.description === '' ? null : (
              <p className="site-car-description t-mvj9bv">{data.description}</p>
            )}

            {data.specs.length === 0 ? null : (
              <div className="site-car-specs">
                <h3 className="site-car-specs-title">{data.labels.specifications}</h3>
                <ul className="site-car-specs-list">
                  {data.specs.map((spec) => {
                    const Glyph = SPEC_ICONS[spec.key];
                    return (
                      <li key={spec.key}>
                        <span className="site-car-spec-head">
                          <span className="site-car-spec-icon">
                            <Glyph />
                          </span>
                          <span className="site-car-spec-label">{spec.label}</span>
                        </span>
                        <span className="site-car-spec-value">{spec.value}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {data.related.length === 0 ? null : (
        <section className="site-car-related site-reveal">
          <h2 className="site-car-related-title t-8swvc5">{data.labels.alsoLike}</h2>
          <div className="site-car-related-grid">
            {data.related.map((related) => (
              <a
                className="site-related-card"
                href={withBase(localePath('cars-detail/' + related.slug, locale), basePath)}
                key={related.slug}
              >
                <span className="site-related-photo">
                  {related.image === null ? null : (
                    <img
                      src={related.image}
                      alt={related.imageAlt}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </span>
                <span className="site-related-title">{related.title}</span>
                <span className="site-related-price">{related.price}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <CtaBanner
        locale={locale}
        heading={`${data.title} - ${data.labels.banner}`}
        headingLevel={2}
        basePath={basePath}
      />

      <SiteFooter locale={locale} pathname={path} basePath={basePath} />
    </div>
  );
}
