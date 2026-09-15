import { getTranslation } from './translations';
import type { Locale } from './site-nav';

/** One question of the FAQ. */
export type FaqItem = {
  index: number;
  question: string;
  answer: string;
};

/** One titled group of questions. */
export type FaqGroup = {
  key: string;
  title: string;
  items: FaqItem[];
};

/**
 * How the reference splits the nineteen questions into the four groups, in
 * the order faq.q1..faq.q19 are numbered.
 */
const GROUPS = [
  { key: 'faq.group1', count: 5, fallback: 'Booking and Reservations' },
  { key: 'faq.group2', count: 6, fallback: 'Car Pickup and Return' },
  { key: 'faq.group3', count: 3, fallback: 'Payment and Billing' },
  { key: 'faq.group4', count: 5, fallback: 'Additional Services' }
];

/** Total number of question keys the translations table holds. */
const QUESTION_COUNT = 19;

/**
 * The FAQ as the page renders it: four groups of questions, each question with
 * its answer, all from the translations table. A question whose text is empty
 * is dropped, so removing a row in the admin removes the item rather than
 * leaving a blank box.
 */
export function getFaqGroups(locale: Locale): FaqGroup[] {
  const items: FaqItem[] = [];
  for (let i = 1; i <= QUESTION_COUNT; i += 1) {
    const question = getTranslation(`faq.q${i}`, locale, '');
    const answer = getTranslation(`faq.a${i}`, locale, '');
    if (question.trim() !== '') items.push({ index: i, question, answer });
  }

  const groups: FaqGroup[] = [];
  let cursor = 0;
  for (const group of GROUPS) {
    const slice = items.slice(cursor, cursor + group.count);
    cursor += group.count;
    if (slice.length === 0) continue;
    groups.push({
      key: group.key,
      title: getTranslation(group.key, locale, group.fallback),
      items: slice
    });
  }
  return groups;
}
