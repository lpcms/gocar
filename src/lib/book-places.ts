import { getTranslation } from './translations';
import type { Locale } from './locale-path';

/**
 * The pick-up / drop-off place list, shared by the booking form and the lead
 * endpoint.
 *
 * The form sends the canonical `value` - it is language-independent, so a
 * booking made in Ukrainian and one made in English arrive as the same place -
 * and the endpoint turns it back into the label of the locale the booking came
 * in, because that is what the manager and the customer both read afterwards
 * (client 25.08.2026: a Ukrainian order was landing in Telegram and «Заявки»
 * as "train station").
 */

/** One entry of the list: the stored value, its translation key and fallback. */
export type PlaceEntry = { value: string; key: string; fallback: string };

/** The four places offered by the booking form, in the order it shows them. */
export const PLACES: PlaceEntry[] = [
  { value: 'hotel uzhhorod', key: 'book.place_hotel', fallback: 'Hotel Uzhhorod' },
  { value: 'train station', key: 'book.place_station', fallback: 'Train Station' },
  {
    value: 'other location in uzhhorod',
    key: 'book.place_other',
    fallback: 'Other location in Uzhhorod (tbc)'
  },
  {
    value: 'outside uzhhorod',
    key: 'book.place_outside',
    fallback: 'Outside Uzhhorod (extra charges may apply)'
  }
];

/**
 * The list as the form renders it: the value it submits and the label the
 * visitor reads, in one locale.
 */
export function getPlaces(locale: Locale): Array<{ value: string; label: string }> {
  return PLACES.map((place) => ({
    value: place.value,
    label: getTranslation(place.key, locale, place.fallback)
  }));
}

/**
 * Label of a submitted place value. A value that is not on the list - a form
 * from an older cache, or a hand-made request - is returned unchanged rather
 * than dropped, so nothing a customer picked is ever lost.
 */
export function placeLabel(value: string, locale: Locale): string {
  const entry = PLACES.find((place) => place.value === value.trim().toLowerCase());
  return entry === undefined ? value : getTranslation(entry.key, locale, entry.fallback);
}
