import { getSetting } from './settings';
import { getTranslation } from './translations';
import { getCarCardData, getCarSeo } from './car-card';
import { getFleetCars, getCategoryBySlug } from './site-cars';
import { parseGeo } from './geo';
import { parseWorkHours } from './work-hours';
import { LOCALE_PREFIX } from './site-nav';
import type { Locale } from './site-nav';

/**
 * Structured data for the phase-2 render.
 *
 * A port of the graph the phase-1 catch-all injected, returning objects rather
 * than rewriting a finished HTML string. The SEO audit of 15.08.2026 rejected
 * the original markup as "empty shells" - a declared type with no content
 * produces no rich result at all - so every node here carries real data from
 * the same rows the page renders (audit H-1, H-2, H-3, T-4, T-5).
 *
 * All URLs come from Настройки → `site_domain`, the same origin as canonical,
 * the sitemap and robots.txt (audit C-3).
 */

/** One JSON-LD node. */
export type JsonLdNode = Record<string, unknown>;

/** Highest FAQ index the admin can fill; matches the FAQ page itself. */
const FAQ_MAX = 19;

/**
 * Company facts from Настройки. Anything empty is left out of the graph
 * rather than emitted blank.
 */
function companyFacts(locale: Locale): {
  siteName: string;
  phone: string;
  email: string;
  address: string;
  coordinates: string;
  ogImage: string;
  favicon: string;
  workHours: string;
  sameAs: string[];
} {
  const s = (key: string): string => String(getSetting(key, '') ?? '').trim();
  const sameAs: string[] = [];
  /**
   * Only real URLs belong in sameAs; the contact fields may hold a handle or
   * a bare phone number, which would make the markup invalid.
   *
   * A bare platform root is rejected along with them. `sameAs` asserts "this
   * organisation is also that page", so `https://instagram.com` claims the
   * company is Instagram - which is what the staging database held, and what
   * an admin who has not got the profile link yet naturally types. A profile
   * always has a path (`t.me/gocar`, `wa.me/380…`), so a URL with nothing
   * after the host is dropped (25.08.2026).
   */
  for (const key of ['contact_telegram', 'contact_viber', 'contact_instagram', 'contact_whatsapp_url']) {
    const value = s(key);
    if (!/^https?:\/\//i.test(value)) continue;
    let path = '';
    try {
      path = new URL(value).pathname;
    } catch {
      continue;
    }
    if (path.replace(/\/+$/, '') === '') continue;
    sameAs.push(value);
  }
  return {
    siteName: s('site_name') !== '' ? s('site_name') : 'GoCar',
    phone: s('contact_phone'),
    email: s('contact_email'),
    /**
     * The address lives under `contact_whatsapp`: the key was repurposed long
     * ago and the real WhatsApp link moved to `contact_whatsapp_url`. Reading
     * the name that sounds right (`contact_address`) returns nothing, which is
     * how the business entity shipped without an address at all.
     */
    address: s('contact_whatsapp'),
    coordinates: s('contact_geo'),
    ogImage: s('og_image_default'),
    /** Настройки → «Favicon сайта»: the brand mark the Organization logo uses. */
    favicon: s('favicon_url'),
    workHours: s(locale === 'ua' ? 'work_hours_ua' : 'work_hours_en'),
    sameAs
  };
}

/**
 * The company as a place: the AutoRental entity with its address, coordinates
 * and contacts.
 *
 * AutoRental is the precise LocalBusiness subtype for a car-rental company,
 * and it carries the facts Google needs for the local pack instead of a bare
 * name (audit H-2). It is emitted on the home page and on the contact page -
 * the contact page is the one that is *about* the office, so the address and
 * the coordinates the admin fills in belong there too (client 22.08.2026).
 */
function businessNode(
  facts: ReturnType<typeof companyFacts>,
  origin: string,
  ogImage: string | null,
  logo: string,
  isUa: boolean
): JsonLdNode {
  const business: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'AutoRental',
    '@id': `${origin}#business`,
    name: facts.siteName,
    url: origin,
    parentOrganization: { '@id': `${origin}#org` },
    image: ogImage ?? logo,
    priceRange: '$$',
    currenciesAccepted: 'USD, UAH'
  };
  if (facts.phone !== '') business['telephone'] = facts.phone;
  if (facts.email !== '') business['email'] = facts.email;
  if (facts.address !== '') {
    const parts = facts.address.split(',').map((p) => p.trim()).filter((p) => p !== '');
    const street = parts.slice(0, 2).join(', ');
    const postal: JsonLdNode = {
      '@type': 'PostalAddress',
      streetAddress: street !== '' ? street : facts.address,
      addressCountry: 'UA'
    };
    if (/uzhhorod|ужгород/i.test(facts.address)) {
      postal['addressLocality'] = isUa ? 'Ужгород' : 'Uzhhorod';
      postal['addressRegion'] = isUa
        ? 'Закарпатська область'
        : 'Zakarpattia Oblast';
    }
    business['address'] = postal;
    business['areaServed'] = {
      '@type': 'City',
      name: isUa ? 'Ужгород' : 'Uzhhorod'
    };
  }
  /**
   * Coordinates put the entity on the map; an address alone leaves the
   * geocoding to a guess.
   */
  if (facts.coordinates !== '') {
    const point = parseGeo(facts.coordinates);
    if (point !== null) {
      business['geo'] = {
        '@type': 'GeoCoordinates',
        latitude: point.lat,
        longitude: point.lng
      };
    }
  }
  /**
   * Opening hours, only when the free-text line in Настройки actually parses:
   * an unreadable line leaves the property out rather than guessing, because a
   * wrong "open now" is worse than none.
   */
  const hours = parseWorkHours(facts.workHours);
  if (hours.length > 0) {
    business['openingHoursSpecification'] = hours.map((entry) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: entry.dayOfWeek,
      opens: entry.opens,
      closes: entry.closes
    }));
  }
  if (facts.sameAs.length > 0) business['sameAs'] = facts.sameAs;
  return business;
}

/**
 * The whole graph for one page.
 *
 * `bare` is the path without the locale prefix and without a leading slash:
 * '' for the home page, 'cars', 'cars/suv', 'cars-detail/toyota-camry'.
 */
export function getJsonLd(bare: string, locale: Locale, origin: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  const clean = bare.replace(/^\/+|\/+$/g, '');
  const isHome = clean === '';
  const prefix = LOCALE_PREFIX[locale];
  const isUa = locale === 'ua';

  /** Absolute URL of a page key in the current locale; '' is the locale home. */
  const pageUrl = (key: string): string =>
    key === '' ? `${origin}${prefix === '' ? '/' : prefix}` : `${origin}${prefix}/${key}`;

  /** Make a stored media path absolute; empty input yields null. */
  const absUrl = (value: string): string | null => {
    const v = value.trim();
    if (v === '') return null;
    if (/^https?:\/\//i.test(v)) return v;
    return `${origin}${v.startsWith('/') ? '' : '/'}${v}`;
  };

  const facts = companyFacts(locale);
  const ogImage = absUrl(facts.ogImage);
  /**
   * The brand mark, from Настройки → «Favicon сайта». `/icon.svg` - the icon
   * shipped with the code - is only the fallback for an install that has not
   * set one: reading it unconditionally, as this did, meant changing the icon
   * in the panel left the logo a search engine sees pointing at the old one.
   */
  const logo = absUrl(facts.favicon) ?? `${origin}/icon.svg`;

  /**
   * Organization is emitted site-wide so a search engine always has the brand
   * entity to attach the page to.
   */
  const organization: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${origin}#org`,
    name: facts.siteName,
    url: origin,
    logo
  };
  if (facts.sameAs.length > 0) organization['sameAs'] = facts.sameAs;
  nodes.push(organization);

  if (isHome) {
    /**
     * The name Google prints above the result instead of the bare domain.
     *
     * It is taken from a `WebSite` node on the home page and nowhere else -
     * without one the SERP shows "gocar.run", which is what it showed. The
     * name is Настройки → «Название сайта», the URL the configured domain, so
     * both follow the panel rather than being written here.
     */
    nodes.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${origin}#website`,
      name: facts.siteName,
      url: `${origin}/`,
      inLanguage: isUa ? 'uk-UA' : 'en',
      publisher: { '@id': `${origin}#org` }
    });
    nodes.push(businessNode(facts, origin, ogImage, logo, isUa));
  } else if (clean === 'cars' || clean.startsWith('cars/')) {
    /**
     * The fleet listing, and a category page as a narrower listing of the
     * same kind. The ItemList carries the live cars themselves, so the page
     * is more than an empty type marker (audit T-5).
     */
    const isCategory = clean.startsWith('cars/');
    const category = isCategory ? getCategoryBySlug(clean.slice('cars/'.length), locale) : null;
    const cars = getFleetCars(locale).filter(
      (car) => !isCategory || category === null || car.categorySlug === category.slug
    );
    const itemList = cars.map((car, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: car.title,
      url: `${origin}${prefix}/cars-detail/${car.slug}`
    }));
    const collection: JsonLdNode = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: category !== null ? category.label : isUa ? 'Автопарк' : 'Cars',
      url: pageUrl(clean),
      about: { '@type': 'Service', serviceType: 'Car rental', provider: { '@id': `${origin}#org` } }
    };
    if (itemList.length > 0) {
      collection['mainEntity'] = {
        '@type': 'ItemList',
        numberOfItems: itemList.length,
        itemListElement: itemList
      };
    }
    nodes.push(collection);
  } else if (clean === 'faq') {
    /**
     * FAQPage with the real questions and answers from the database - the
     * same rows the page renders. Without mainEntity the FAQ rich result can
     * never be produced (audit H-1).
     */
    const entries: JsonLdNode[] = [];
    for (let i = 1; i <= FAQ_MAX; i += 1) {
      const q = getTranslation(`faq.q${i}`, locale, '').trim();
      const a = getTranslation(`faq.a${i}`, locale, '').trim();
      if (q !== '' && a !== '') {
        entries.push({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a }
        });
      }
    }
    const faqPage: JsonLdNode = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      url: pageUrl('faq')
    };
    if (entries.length > 0) faqPage['mainEntity'] = entries;
    nodes.push(faqPage);
  } else if (clean === 'contact') {
    nodes.push({
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      url: pageUrl('contact'),
      about: { '@id': `${origin}#business` }
    });
    /**
     * The office itself, on the page that describes it: address, coordinates
     * and contacts all come from Настройки and are what a search engine needs
     * to place the business on the map (client 22.08.2026).
     */
    nodes.push(businessNode(facts, origin, ogImage, logo, isUa));
  } else if (clean === 'about-us') {
    nodes.push({
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      url: pageUrl('about-us')
    });
  } else if (clean === 'book') {
    nodes.push({
      '@context': 'https://schema.org',
      '@type': 'ReserveAction',
      name: isUa ? 'Забронювати авто' : 'Book a car',
      url: pageUrl('book'),
      target: pageUrl('book')
    });
  } else if (clean.startsWith('cars-detail/')) {
    /**
     * Car (a Vehicle subtype) with a real Offer: without price, currency and
     * availability the product rich result cannot be produced (audit H-3).
     */
    const slug = clean.slice('cars-detail/'.length);
    const carUrl = pageUrl(`cars-detail/${slug}`);
    const product: JsonLdNode = {
      '@context': 'https://schema.org',
      '@type': 'Car',
      url: carUrl
    };
    const data = getCarCardData(slug, locale);
    const seo = getCarSeo(slug, locale);
    const carName = ((seo?.name ?? data?.title ?? '').split('---')[0] ?? '')
      .replace(/\s+-\s+(en|ua)\b.*$/i, '')
      .trim();
    product['name'] = carName !== '' ? carName : slug;
    if (carName !== '') {
      const brand = carName.split(/\s+/)[0] ?? '';
      if (brand !== '') product['brand'] = { '@type': 'Brand', name: brand };
    }
    const carDesc = (seo?.description ?? '').trim();
    if (carDesc !== '') product['description'] = carDesc;
    if (data !== null) {
      const photo = data.photos.image !== null ? absUrl(data.photos.image) : null;
      if (photo !== null) product['image'] = photo;
      if (data.transmission !== '') product['vehicleTransmission'] = data.transmission;
      if (data.fuelType !== '') product['fuelType'] = data.fuelType;
      /**
       * `seatingCapacity` is a number, not a label. The admin field holds a
       * human string ("5 passengers", "5 пасажирів"), and passing it through
       * made Google report "could not convert this value to the expected
       * format" on every car page - so the count is emitted as a number,
       * wrapped in a QuantitativeValue.
       *
       * The unit comes out of the same field rather than from a table in the
       * code: it is already written in the right language for the locale, and
       * a car stored as a bare "5" simply has no unit to print. A field with
       * no digits at all is dropped rather than guessed.
       */
      const seats = parseSeats(data.seats);
      if (seats !== null) {
        const capacity: JsonLdNode = { '@type': 'QuantitativeValue', value: seats.value };
        if (seats.unit !== '') capacity['unitText'] = seats.unit;
        product['seatingCapacity'] = capacity;
      }
      if (data.pricePerDay > 0) {
        /**
         * priceValidUntil keeps the offer from being flagged as stale; a year
         * ahead matches how often the tariffs are revised.
         */
        const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        product['offers'] = {
          '@type': 'Offer',
          price: data.pricePerDay,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: carUrl,
          priceValidUntil: validUntil,
          /** The listed price is the daily rate of the rental. */
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: data.pricePerDay,
            priceCurrency: 'USD',
            unitCode: 'DAY'
          },
          seller: { '@id': `${origin}#org` }
        };
      }
    }
    nodes.push(product);
  }

  /**
   * BreadcrumbList for every page below the locale home: it mirrors the
   * visual breadcrumb and lets Google render the path instead of a raw URL
   * (audit T-4).
   */
  if (!isHome && clean !== '404') {
    const crumbs: JsonLdNode[] = [
      {
        '@type': 'ListItem',
        position: 1,
        name: getTranslation('menu.home', locale, isUa ? 'Головна' : 'Home'),
        item: pageUrl('')
      }
    ];
    const carsLabel = getTranslation('menu.cars', locale, isUa ? 'Автомобілі' : 'Cars');
    if (clean.startsWith('cars-detail/') || clean.startsWith('cars/')) {
      crumbs.push({ '@type': 'ListItem', position: 2, name: carsLabel, item: pageUrl('cars') });
      if (clean.startsWith('cars-detail/')) {
        const slug = clean.slice('cars-detail/'.length);
        const name = cleanCarName(slug, locale);
        if (name !== '') {
          crumbs.push({
            '@type': 'ListItem',
            position: 3,
            name,
            item: pageUrl(`cars-detail/${slug}`)
          });
        }
      } else {
        const category = getCategoryBySlug(clean.slice('cars/'.length), locale);
        if (category !== null) {
          crumbs.push({
            '@type': 'ListItem',
            position: 3,
            name: category.label,
            item: pageUrl(clean)
          });
        }
      }
    } else {
      const labels: Record<string, string> = {
        cars: 'menu.cars',
        book: 'menu.book',
        faq: 'menu.faq',
        'about-us': 'menu.about',
        contact: 'menu.contact'
      };
      const key = labels[clean];
      const label = key !== undefined ? getTranslation(key, locale, '') : '';
      crumbs.push({
        '@type': 'ListItem',
        position: 2,
        name: label !== '' ? label : clean,
        item: pageUrl(clean)
      });
    }
    if (crumbs.length > 1) {
      nodes.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs
      });
    }
  }

  return nodes;
}

/**
 * Split the admin's "Места" field into the seat count and whatever wording
 * follows it: "5 passengers" -> 5 + "passengers", "8 пасажирів" -> 8 +
 * "пасажирів", a bare "5" -> 5 with no unit. Returns null when the field
 * carries no number at all.
 */
function parseSeats(value: string): { value: number; unit: string } | null {
  const match = /(\d+)/.exec(value);
  if (match === null) return null;
  const count = Number(match[1] ?? '');
  if (!Number.isFinite(count) || count <= 0) return null;
  const unit = value.slice((match.index ?? 0) + (match[1] ?? '').length).trim();
  return { value: count, unit };
}

/**
 * Localized car name for the breadcrumb, without the locale tag a stored
 * title may carry.
 */
function cleanCarName(slug: string, locale: Locale): string {
  const seo = getCarSeo(slug, locale);
  return ((seo?.name ?? '').split('---')[0] ?? '')
    .replace(/\s+-\s+(en|ua)\b.*$/i, '')
    .trim();
}
