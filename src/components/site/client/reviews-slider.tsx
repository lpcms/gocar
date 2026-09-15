'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SiteReview, SiteReviewLabels } from '@/lib/site-reviews';

/** How long a slide stays before the reference advances to the next one. */
const AUTOPLAY_MS = 6000;

/**
 * Testimonials slider.
 *
 * Reference: one slide per view, the whole track shifted by its own width; a
 * slide is a centred column with a 40px gap - the accent 20/28 w700 kicker, the
 * 18/27 w500 quote capped at 800px, then a 30px column of a round 72px avatar
 * above the 20/28 w700 name. The track is as tall as the tallest slide, and
 * 32px below it sit two 50px accent discs 20px apart, which step one slide and
 * wrap around. The reference advances on its own every six seconds.
 *
 * Two things the reference does not do (plan section 7.3): the arrows get an
 * accessible name, and the autoplay stops while the pointer or the keyboard is
 * inside the slider and never starts when the visitor asked for reduced
 * motion. Neither changes a pixel of any frame.
 */
export function ReviewsSlider({
  reviews,
  labels
}: {
  reviews: SiteReview[];
  labels: SiteReviewLabels;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = reviews.length;
  const root = useRef<HTMLDivElement>(null);

  const step = useCallback(
    (delta: number) => {
      if (count === 0) return;
      setIndex((current) => (current + delta + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (paused || count < 2) return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return undefined;
    const timer = window.setInterval(() => step(1), AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [paused, count, step]);

  if (count === 0) return null;

  return (
    <div
      className="site-reviews"
      ref={root}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (root.current !== null && next instanceof Node && root.current.contains(next)) return;
        setPaused(false);
      }}
    >
      <div className="site-reviews-viewport">
        <div
          className="site-reviews-track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {reviews.map((review, position) => (
            <div
              className="site-reviews-slide"
              key={review.id}
              aria-hidden={position === index ? undefined : 'true'}
            >
              <h3 className="site-reviews-kicker">{labels.kicker}</h3>
              <p className="site-reviews-quote">{review.text}</p>
              <div className="site-reviews-author">
                {review.avatar === null ? null : (
                  <img
                    className="site-reviews-avatar"
                    src={review.avatar.src}
                    alt={review.avatar.alt}
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <span className="site-reviews-name">{review.author}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="site-reviews-arrows">
        <button className="site-reviews-arrow" type="button" onClick={() => step(-1)} aria-label={labels.previous}>
          <img src={labels.prevArrow.src} alt={labels.prevArrow.alt} />
        </button>
        <button className="site-reviews-arrow" type="button" onClick={() => step(1)} aria-label={labels.next}>
          <img src={labels.nextArrow.src} alt={labels.nextArrow.alt} />
        </button>
      </div>
    </div>
  );
}
