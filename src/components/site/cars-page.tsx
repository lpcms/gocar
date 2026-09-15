import { SiteHeader } from './header';
import { SiteFooter } from './footer';
import { Breadcrumbs } from './breadcrumbs';
import { CarCard } from './car-card';
import { PopularCarCard } from './popular-car-card';
import { CategoryLinks } from './category-links';
import { CtaBanner } from './cta-banner';
import {
  getBenefits,
  getCardLabels,
  getCarsByCategory,
  getCategoriesTitle,
  getCategoryBySlug,
  getCategoryLinks,
  getFleetCars,
  getPopularCars,
  getPopularTitle
} from '@/lib/site-cars';
import { getTranslation } from '@/lib/translations';
import { categoryPath, localePath, withBase } from '@/lib/site-nav';
import type { Locale } from '@/lib/site-nav';

/**
 * The fleet page - /cars and, with a category, /cars/<slug>.
 *
 * One component serves both because the reference draws them identically: a
 * page head with the breadcrumbs and the title, then a two-column section
 * with the card grid on the left and a 320px rail on the right carrying the
 * popular cars and the category list, and the closing banner.
 *
 * Three changes to the reference, asked for by the client on 21.08.2026:
 *
 * 1. The category list links to pages instead of hashes. /cars shows every
 *    live car in admin order, /cars/<slug> only that category's, and the
 *    active entry is decided on the server - the hash-driven client filter of
 *    phase 1 is gone.
 * 2. An SEO block sits between the fleet and the banner: a heading and a
 *    paragraph. On /cars both come from the Cars group of Переводы; on a
 *    category page the heading is the {name} template filled with the
 *    category and the paragraph is that category's "Описание" from Категории.
 * 3. The <h1> of a category page is the category, not the shared "Our Fleet",
 *    so the six pages do not share one title.
 *
 * `basePath` is the staging prefix: it keeps every link this page builds
 * inside /v2 until the page is accepted, and is empty on the live route.
 */
export function CarsPage({
  locale,
  categorySlug = '',
  basePath = ''
}: {
  locale: Locale;
  categorySlug?: string;
  basePath?: string;
}) {
  const category = categorySlug === '' ? null : getCategoryBySlug(categorySlug, locale);
  const path =
    category === null
      ? withBase(localePath('cars', locale), basePath)
      : categoryPath(category.slug, locale, basePath);
  const crumbPath = category === null ? 'cars' : `cars/${category.slug}`;
  const title =
    category === null
      ? getTranslation('cars.fleet_title', locale, locale === 'ua' ? 'Наш автопарк' : 'Our Fleet')
      : getTranslation(
          'cars.category_title',
          locale,
          locale === 'ua' ? 'Автомобілі класу {name}' : '{name} Class Cars'
        )
          .split('{name}')
          .join(category.label);

  const cars = category === null ? getFleetCars(locale) : getCarsByCategory(category.slug, locale);
  const labels = getCardLabels(locale);
  const popular = getPopularCars(locale);
  const benefits = getBenefits(locale, category);

  return (
    <div className="site-shell">
      <SiteHeader locale={locale} pathname={path} basePath={basePath} />

      <div className="site-page-head">
        <Breadcrumbs
          path={crumbPath}
          locale={locale}
          currentLabel={category === null ? '' : category.label}
          basePath={basePath}
        />
        <h1 className="site-page-title t-8swvc5">{title}</h1>
      </div>

      {/*
        No scroll appearance here: the grid is the first screen, and a block
        hidden until the script runs holds back the page's largest paint.
      */}
      <section className="site-fleet">
        <div className="site-fleet-inner">
          {cars.length === 0 ? (
            <p className="site-fleet-empty t-mvj9bv">
              {getTranslation(
                'cars.no_cars',
                locale,
                locale === 'ua' ? 'Автомобілі не знайдено.' : 'No cars found.'
              )}
            </p>
          ) : (
            <div className="site-fleet-grid">
              {cars.map((car, index) => (
                <CarCard
                  car={car}
                  labels={labels}
                  key={car.slug}
                  priority={index === 0 ? 'high' : index < 3 ? 'eager' : 'lazy'}
                />
              ))}
            </div>
          )}

          <aside className="site-fleet-side">
            {popular.length === 0 ? null : (
              <div className="site-fleet-group">
                <h2 className="site-cat-filter-title">{getPopularTitle(locale)}</h2>
                <div className="site-popular-list">
                  {popular.map((car) => (
                    <PopularCarCard car={car} key={car.slug} />
                  ))}
                </div>
              </div>
            )}
            <div className="site-fleet-group">
              <h2 className="site-cat-filter-title">{getCategoriesTitle(locale)}</h2>
              <CategoryLinks
                items={getCategoryLinks(locale, basePath)}
                active={category === null ? 'all' : category.slug}
              />
            </div>
          </aside>
        </div>
      </section>

      {benefits === null ? null : (
        <section className="site-benefits site-reveal">
          <h2 className="site-benefits-title t-8swvc5">{benefits.title}</h2>
          <p className="site-benefits-text t-mvj9bv">{benefits.text}</p>
        </section>
      )}

      <CtaBanner
        locale={locale}
        kicker={getTranslation(
          'cars.cta_kicker',
          locale,
          locale === 'ua' ? 'Знайдіть свій ідеальний транспорт' : 'Find Your Perfect Ride'
        )}
        heading={getTranslation(
          'cars.cta_heading',
          locale,
          locale === 'ua'
            ? 'Досліджуйте наш автопарк і забронюйте автомобіль своєї мрії вже сьогодні!'
            : 'Explore Our Fleet and Book Your Dream Car Today!'
        )}
        button={getTranslation(
          'cars.cta_button',
          locale,
          locale === 'ua' ? 'Давайте їхати з нами' : "Let's Drive with Us"
        )}
        align="end"
        headingLevel={2}
        basePath={basePath}
      />

      <SiteFooter locale={locale} pathname={path} basePath={basePath} />
    </div>
  );
}
