import { getTranslation } from './translations';
import type { Locale } from './site-nav';

/** One of the four info cards under the journey block. */
export type AboutCard = {
  key: string;
  title: string;
  text: string;
  icon: string;
};

/**
 * One of the four steps of the "how it works" diagram. The reference draws two
 * icons for every step: a dark one on the white disc and a white one for the
 * accent disc it swaps to under the pointer.
 */
export type AboutStep = {
  key: string;
  title: string;
  text: string;
  icon: string;
  iconHover: string;
};

/** Everything the about-us page prints, all of it from the translations table. */
export type AboutTexts = {
  title: string;
  journeyKicker: string;
  journeyTitle: string;
  journeyText: string;
  cards: AboutCard[];
  stepsKicker: string;
  stepsTitle: string;
  steps: AboutStep[];
  ctaHeading: string;
  ctaButton: string;
};

/**
 * Copy of the about-us page.
 *
 * Every string lived in the Framer snapshot before phase 2; the migration
 * scripts/migrate-about-copy.mjs moved it into the translations table, line
 * breaks and all - the two list cards rely on them. The steps keep the order
 * the reference gives them in the markup (select, drive, book, return); the
 * desktop diagram is what arranges them into its zigzag.
 */
export function getAboutTexts(locale: Locale): AboutTexts {
  const card = (index: number, titleFallback: string): AboutCard => ({
    key: `card${index}`,
    title: getTranslation(`about.card${index}_title`, locale, titleFallback),
    text: getTranslation(`about.card${index}_text`, locale, ''),
    icon: `/images/site/about-card-${index}.png`
  });
  const step = (index: number, titleFallback: string): AboutStep => ({
    key: `step${index}`,
    title: getTranslation(`about.step${index}_title`, locale, titleFallback),
    text: getTranslation(`about.step${index}_text`, locale, ''),
    icon: `/images/site/about-step-${index}.svg`,
    iconHover: `/images/site/about-step-${index}-hover.svg`
  });

  return {
    title: getTranslation('about.title', locale, 'Who we are'),
    journeyKicker: getTranslation('about.journey_kicker', locale, 'OUR JOURNEY'),
    journeyTitle: getTranslation('about.journey_title', locale, ''),
    journeyText: getTranslation('about.journey_text', locale, ''),
    cards: [
      card(1, 'Why Uzhhorod?'),
      card(2, 'Zakarpattia is a unique region'),
      card(3, 'Our Philosophy'),
      card(4, 'That’s why we focus on')
    ],
    stepsKicker: getTranslation('about.steps_kicker', locale, 'HOW IT WORKS'),
    stepsTitle: getTranslation('about.steps_title', locale, 'Simple Steps to Get the Car'),
    steps: [step(1, 'Select'), step(2, 'Drive'), step(3, 'Book'), step(4, 'Return')],
    ctaHeading: getTranslation('about.cta_heading', locale, ''),
    ctaButton: getTranslation('about.cta_button', locale, 'Book Now')
  };
}
