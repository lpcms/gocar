import { getCarCardData, getCarSeo, getRelatedCars } from './car-card';
import type { CarCardData, RelatedCar } from './car-card';
import { getTranslation } from './translations';
import { getPerDaySuffix } from './per-day';
import type { Locale } from './site-nav';

/** One tile of the specifications grid: an icon key, its caption and value. */
export type CarSpec = {
  key: 'category' | 'engine' | 'transmission' | 'seats' | 'fuel' | 'drivetrain';
  label: string;
  value: string;
};

/** One column of the tariff table: its heading and the price under it. */
export type CarTariff = {
  key: string;
  label: string;
  price: string;
};

/** Everything the car-detail page renders, already resolved for the locale. */
export type CarDetailData = {
  slug: string;
  title: string;
  photos: CarCardData['photos'];
  price: string;
  deposit: string;
  description: string;
  tariffs: CarTariff[];
  specs: CarSpec[];
  related: RelatedCar[];
  labels: {
    pageTitle: string;
    startingAt: string;
    deposit: string;
    bookNow: string;
    specifications: string;
    alsoLike: string;
    banner: string;
  };
};

/**
 * Headings of the tariff table, in the order the reference prints them.
 *
 * The reference bakes these four strings into the snapshot; phase 2 keeps
 * them in the Cars-detail group of Переводы so the brackets can be reworded
 * without a deploy (client 22.08.2026).
 */
const TARIFF_KEYS: Array<{ key: string; fallbackEn: string; fallbackUa: string }> = [
  { key: 'cars-detail.tariff_1_3', fallbackEn: '1-3 days', fallbackUa: '1-3 доби' },
  { key: 'cars-detail.tariff_4_9', fallbackEn: '4-9 days', fallbackUa: '4-9 діб' },
  { key: 'cars-detail.tariff_10_25', fallbackEn: '10-25 days', fallbackUa: '10-25 діб' },
  { key: 'cars-detail.tariff_26', fallbackEn: '26+ days', fallbackUa: '26+ діб' }
];

/**
 * Caption of one specification, seeded by scripts/migrate-spec-labels.mjs.
 *
 * The values alone ("2.0T", "Передній") do not say which field they are, and
 * an icon at 24px names nothing on its own, so every tile carries a caption
 * (client 23.08.2026). The fallbacks keep the grid readable on an install
 * whose Переводы have not been seeded yet.
 */
const SPEC_LABELS: Record<CarSpec['key'], { en: string; ua: string }> = {
  category: { en: 'Category', ua: 'Категорія' },
  engine: { en: 'Engine', ua: 'Двигун' },
  transmission: { en: 'Transmission', ua: 'Коробка' },
  seats: { en: 'Capacity', ua: 'Місткість' },
  fuel: { en: 'Fuel', ua: 'Пальне' },
  drivetrain: { en: 'Drivetrain', ua: 'Привід' }
};

/**
 * One caption, resolved for the locale.
 */
function specLabel(key: CarSpec['key'], locale: Locale): string {
  const fallback = SPEC_LABELS[key];
  return getTranslation(
    `cars-detail.spec_${key}`,
    locale,
    locale === 'ua' ? fallback.ua : fallback.en
  );
}

/**
 * Everything one car page needs. Returns null for an unknown or unpublished
 * slug, which is what turns the route into a 404.
 */
export function getCarDetailData(slug: string, locale: Locale): CarDetailData | null {
  const car = getCarCardData(slug, locale);
  if (car === null || car.status !== 'live') return null;

  const seo = getCarSeo(slug, locale);
  const perDay = getPerDaySuffix(locale);

  /**
   * Only the specs the admin filled in are printed: an empty field would
   * otherwise leave a bare icon on the row.
   */
  const specs: CarSpec[] = (
    [
      { key: 'category', value: car.category },
      { key: 'engine', value: car.engine },
      { key: 'transmission', value: car.transmission },
      { key: 'seats', value: car.seats },
      { key: 'fuel', value: car.fuelType },
      { key: 'drivetrain', value: car.drivetrain }
    ] as Array<{ key: CarSpec['key']; value: string }>
  )
    .filter((spec) => spec.value.trim() !== '')
    .map((spec) => ({
      key: spec.key,
      label: specLabel(spec.key, locale),
      value: spec.value
    }));

  const tariffs: CarTariff[] = TARIFF_KEYS.map((entry, index) => ({
    key: entry.key,
    label: getTranslation(
      entry.key,
      locale,
      locale === 'ua' ? entry.fallbackUa : entry.fallbackEn
    ),
    price: `$${car.tariffs[index] ?? car.pricePerDay}`
  }));

  return {
    slug: car.slug,
    title: car.title,
    photos: car.photos,
    price: `$${car.pricePerDay}${perDay}`,
    deposit: `$${car.deposit}`,
    /** The paragraph under the button is the car's own "Описание EN/UA". */
    description: (seo?.description ?? '').trim(),
    tariffs,
    specs,
    /** The "also like" cards print the same editable per-day wording. */
    related: (getRelatedCars(slug, locale) ?? []).map((item) => ({
      ...item,
      price: `$${item.pricePerDay}${perDay}`
    })),
    labels: {
      pageTitle: getTranslation(
        'cars-detail.title',
        locale,
        locale === 'ua' ? 'Деталі автомобіля' : 'Car Details'
      ),
      startingAt: getTranslation(
        'home.fleet_starting_at',
        locale,
        locale === 'ua' ? 'від' : 'Starting at'
      ),
      deposit: getTranslation('book.deposit', locale, locale === 'ua' ? 'Застава' : 'Deposit'),
      bookNow: getTranslation(
        'cars-detail.book_now',
        locale,
        locale === 'ua' ? 'Забронювати зараз' : 'Book Now'
      ),
      specifications: getTranslation(
        'cars-detail.specifications',
        locale,
        locale === 'ua' ? 'Характеристики' : 'Specifications'
      ),
      alsoLike: getTranslation(
        'cars-detail.you_may_also_like',
        locale,
        locale === 'ua' ? 'Вам також може сподобатися' : 'You may also like'
      ),
      banner: getTranslation(
        'cars-detail.banner',
        locale,
        'Book Your Adventure Today and Feel the Power of the Open Road.'
      )
    }
  };
}
