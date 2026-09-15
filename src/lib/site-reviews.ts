import { getDb } from './db';
import { getTranslation } from './translations';
import { getMediaAlt, pickMediaAlt } from './media-alt';
import type { Locale } from './site-nav';

/** One testimonial as the slider renders it. */
export type SiteReview = {
  id: number;
  author: string;
  text: string;
  avatar: { src: string; alt: string } | null;
};

/** One arrow of the slider: the picture and the text that describes it. */
export type SiteReviewArrow = { src: string; alt: string };

/** Everything the slider needs besides the reviews themselves. */
export type SiteReviewLabels = {
  kicker: string;
  previous: string;
  next: string;
  /** The two arrows, with their alt text from the media library. */
  prevArrow: SiteReviewArrow;
  nextArrow: SiteReviewArrow;
};

/** The arrow artwork of the reference, shipped with the render. */
const PREV_ARROW = '/images/site/reviews-prev.svg';
const NEXT_ARROW = '/images/site/reviews-next.svg';

interface ReviewRow {
  id: number;
  author: string;
  authorUa: string | null;
  textEn: string;
  textUa: string | null;
  avatarUrl: string | null;
  altEn: string | null;
  altUa: string | null;
}

/**
 * Published testimonials in admin order, localized. The Ukrainian author name
 * and alt text fall back to the English ones while the admin leaves them
 * empty, which is what the phase-1 injector does as well.
 */
export function getReviews(locale: Locale): SiteReview[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, author, author_ua AS authorUa, text_en AS textEn, text_ua AS textUa,
              avatar_url AS avatarUrl, avatar_alt_en AS altEn, avatar_alt_ua AS altUa
       FROM reviews
       WHERE is_published = 1
       ORDER BY sort_order, id`
    )
    .all() as unknown as ReviewRow[];

  return rows.map((row) => {
    const localizedText = locale === 'ua' ? row.textUa : row.textEn;
    const localizedAuthor = locale === 'ua' ? row.authorUa : row.author;
    /** The avatar is described in Отзывы, by the site-wide locale rule. */
    const localizedAlt = pickMediaAlt(row.altEn, row.altUa, locale);
    const author = localizedAuthor !== null && localizedAuthor.trim() !== '' ? localizedAuthor : row.author;
    const src = row.avatarUrl !== null && row.avatarUrl.trim() !== '' ? row.avatarUrl : null;
    return {
      id: row.id,
      author,
      text: localizedText !== null && localizedText.trim() !== '' ? localizedText : row.textEn,
      avatar:
        src === null
          ? null
          : { src, alt: localizedAlt !== '' ? localizedAlt : author }
    };
  });
}

/**
 * The kicker above the testimonials, the accessible name of each arrow and the
 * arrow artwork itself. The reference has no accessible names on its arrows at
 * all, so those two keys are new (scripts/migrate-reviews-labels.mjs); the alt
 * of the two pictures comes from the media library, like every other image the
 * render ships (Медіатека), and falls back to the button's own name while the
 * admin leaves it empty.
 */
export function getReviewLabels(locale: Locale): SiteReviewLabels {
  const previous = getTranslation(
    'reviews.previous',
    locale,
    locale === 'ua' ? 'Попередній відгук' : 'Previous review'
  );
  const next = getTranslation(
    'reviews.next',
    locale,
    locale === 'ua' ? 'Наступний відгук' : 'Next review'
  );
  const alt = (src: string, fallback: string): string => {
    const value = getMediaAlt(src, locale);
    return value.trim() === '' ? fallback : value;
  };
  return {
    kicker: getTranslation(
      'home.reviews_kicker',
      locale,
      locale === 'ua' ? 'ЩО КАЖУТЬ НАШІ КЛІЄНТИ' : 'WHAT OUR CUSTOMERS SAY'
    ),
    previous,
    next,
    prevArrow: { src: PREV_ARROW, alt: alt(PREV_ARROW, previous) },
    nextArrow: { src: NEXT_ARROW, alt: alt(NEXT_ARROW, next) }
  };
}
