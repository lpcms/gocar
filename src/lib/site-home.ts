import { getTranslation } from './translations';
import { getMediaAlt } from './media-alt';
import { getCarCategories, getFleetCars, getCardLabels } from './site-cars';
import { getReviews, getReviewLabels } from './site-reviews';
import { categoryPath, localePath } from './site-nav';
import type { SiteCarCard, SiteCardLabels } from './site-cars';
import type { SiteReview, SiteReviewLabels } from './site-reviews';
import type { Locale } from './site-nav';

/** One category chip of the hero. */
export type HomeCategory = { slug: string; label: string; href: string };

/** One glass badge floating over the "why choose us" picture. */
export type HomeBadge = { key: string; title: string; text: string; href: string };

/** One step of the "how it works" diagram. */
export type HomeStep = {
  key: string;
  title: string;
  text: string;
  icon: string;
  /** White twin of the icon, shown while the step is under the pointer. */
  iconHover: string;
  alt: string;
};

/** Everything the home page renders, resolved for one locale. */
export type HomeData = {
  texts: Record<string, string>;
  categories: HomeCategory[];
  cars: SiteCarCard[];
  cardLabels: SiteCardLabels;
  reviews: SiteReview[];
  reviewLabels: SiteReviewLabels;
  badges: HomeBadge[];
  steps: HomeStep[];
  alts: { hero: string; why: string; cta: string; reviewsBg: string };
};

/** Pictures of the page, prepared by scripts/build-home-images.mjs. */
export const HERO_CAR = '/images/site/home-hero-car.webp';
export const WHY_CAR = '/images/site/home-why-car.webp';
export const CTA_CAR = '/images/site/home-cta-car.webp';
export const REVIEWS_BG = '/images/site/home-reviews-bg.webp';

/** Every visible string of the page, by the field the component reads. */
const TEXT_KEYS: [string, string, string][] = [
  ['heroHeading', 'home.hero_heading', 'Rent a car\nin Uzhhorod\nfrom 25 usd/day'],
  [
    'heroText',
    'home.hero_text',
    'Over 15 vehicles\nOnly passport and driving license needed\nFlexible pick-up and drop-off locations'
  ],
  ['heroCta', 'home.hero_cta', 'Book now'],
  ['categoriesLabel', 'home.categories_label', 'Car categories'],
  ['fleetHeading', 'home.fleet_heading', 'Our Fleet'],
  ['whyHeading', 'home.why_heading', 'Why Choose US?'],
  ['whyText', 'home.why_text', ''],
  ['stepsKicker', 'home.steps_kicker', 'HOW IT WORKS'],
  ['stepsHeading', 'home.steps_heading', 'Simple Steps to Get the Car'],
  ['ctaHeading', 'home.cta_heading', 'Ready to Go?'],
  ['ctaButton', 'home.cta_button', 'Book Now']
];

/**
 * The three badges of the "why choose us" block. Over the picture the
 * reference prints only their titles; below 810 it turns them into full-width
 * cards under the picture and adds the sentence that goes with each, which is
 * why both strings are read here.
 */
const BADGES: Array<{ key: string; titleKey: string; title: string; textKey: string }> = [
  {
    key: 'booking',
    titleKey: 'home.why_easy_booking',
    title: 'Easy Booking',
    textKey: 'home.why_easy_booking_text'
  },
  {
    key: 'quality',
    titleKey: 'home.why_quality',
    title: 'Quality & Variety',
    textKey: 'home.why_quality_text'
  },
  {
    key: 'rates',
    titleKey: 'home.why_affordable',
    title: 'Affordable Rates',
    textKey: 'home.why_affordable_text'
  }
];

/**
 * The four steps, with the icon file each one uses. The files are the ones the
 * about-us diagram already ships - the same four drawings in the same roles -
 * so the alt text has one home in the media library.
 */
const STEPS: Array<{
  key: string;
  titleKey: string;
  title: string;
  textKey: string;
  icon: number;
}> = [
  { key: 'select', titleKey: 'home.step_select', title: 'Select', textKey: 'home.step_select_text', icon: 1 },
  { key: 'book', titleKey: 'home.step_book', title: 'Book', textKey: 'home.step_book_text', icon: 3 },
  { key: 'drive', titleKey: 'home.step_drive', title: 'Drive', textKey: 'home.step_drive_text', icon: 2 },
  { key: 'return', titleKey: 'home.step_return', title: 'Return', textKey: 'home.step_return_text', icon: 4 }
];

/**
 * Everything the home page needs, in one read: the copy, the category chips of
 * the hero, the fleet, the testimonials and the alt text of the four pictures.
 * The only island of the page is the testimonials slider, and it receives its
 * reviews as plain props (plan section 4.2).
 */
export function getHomeData(locale: Locale): HomeData {
  const texts: Record<string, string> = {};
  for (const [field, key, fallback] of TEXT_KEYS) {
    texts[field] = getTranslation(key, locale, fallback);
  }

  const carsHref = localePath('cars', locale);
  const categories = getCarCategories(locale).map((category) => ({
    slug: category.slug,
    label: category.label,
    href: categoryPath(category.slug, locale)
  }));

  const badges = BADGES.map((badge) => ({
    key: badge.key,
    title: getTranslation(badge.titleKey, locale, badge.title),
    text: getTranslation(badge.textKey, locale, ''),
    href: carsHref
  }));

  const steps = STEPS.map((step) => {
    const icon = `/images/site/about-step-${step.icon}.svg`;
    return {
      key: step.key,
      title: getTranslation(step.titleKey, locale, step.title),
      text: getTranslation(step.textKey, locale, ''),
      icon,
      iconHover: `/images/site/about-step-${step.icon}-hover.svg`,
      alt: getMediaAlt(icon, locale)
    };
  });

  return {
    texts,
    categories,
    cars: getFleetCars(locale),
    cardLabels: getCardLabels(locale),
    reviews: getReviews(locale),
    reviewLabels: getReviewLabels(locale),
    badges,
    steps,
    alts: {
      hero: getMediaAlt(HERO_CAR, locale),
      why: getMediaAlt(WHY_CAR, locale),
      cta: getMediaAlt(CTA_CAR, locale),
      reviewsBg: getMediaAlt(REVIEWS_BG, locale)
    }
  };
}
