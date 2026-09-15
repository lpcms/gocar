import { getTranslation } from './translations';
import type { Locale } from './site-nav';

/**
 * The per-day suffix printed after a price on every car card and on the car
 * page ("$45/day", "$45/день").
 *
 * The wording is the same `book.per_day` string the booking form uses, so the
 * unit is edited once in Переводы and changes everywhere (client 22.08.2026);
 * the slash itself is punctuation of the price and stays in the code.
 */
export function getPerDaySuffix(locale: Locale): string {
  return `/${getTranslation('book.per_day', locale, locale === 'ua' ? 'день' : 'day')}`;
}
