import { SiteHeader } from './header';
import { SiteFooter } from './footer';
import { Breadcrumbs } from './breadcrumbs';
import { BookForm } from './client/book-form';
import { getBookData } from '@/lib/site-book';
import { getTranslation } from '@/lib/translations';
import { localePath } from '@/lib/site-nav';
import type { Locale } from '@/lib/site-nav';

/**
 * The booking page.
 *
 * Everything above the form is static server markup - the chrome, the
 * breadcrumbs and the title - and the form itself is one island, because every
 * control in it changes the price or the picture on the spot. The data it works
 * on (fleet, categories, extras, places, every string, the reCAPTCHA key) is
 * read here and handed over as plain props, so the island never touches the
 * database (plan section 4.2).
 *
 * The lead still goes to /api/lead: the server recomputes the price from the
 * database, verifies the reCAPTCHA token and sends Telegram exactly as before.
 * None of that logic moves.
 *
 * `carSlug` is the car a visitor arrived with from a car page ("Book Now"
 * links to `/book?car=<slug>`): the form then opens with that car, its
 * category and its photograph already chosen, server-rendered, so nothing
 * flashes into place after hydration.
 */
export function BookPage({ locale, carSlug = '' }: { locale: Locale; carSlug?: string }) {
  const data = getBookData(locale);
  const title = getTranslation(
    'book.title',
    locale,
    locale === 'ua' ? 'Забронювати авто' : 'Book a car'
  );

  return (
    <div className="site-shell">
      <SiteHeader locale={locale} pathname={localePath('book', locale)} />

      <div className="site-page-head">
        <Breadcrumbs path="book" locale={locale} />
        <h1 className="site-page-title t-8swvc5">{title}</h1>
      </div>

      <section className="site-book">
        <BookForm locale={locale} data={data} carSlug={carSlug} />
      </section>

      <SiteFooter locale={locale} pathname={localePath('book', locale)} />
    </div>
  );
}
