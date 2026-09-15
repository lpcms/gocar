import type { SiteCarCard } from '@/lib/site-cars';

/**
 * Compact car row of the "Popular cars" rail on the fleet pages.
 *
 * A different shape from the fleet card, not a smaller copy of it (reference
 * cars@1440-en, sidebar nodes 343-353): no panel, no border and no "Starting
 * at" caption - an 83px row of a 104x83 cover-cropped thumbnail with a 10px
 * radius, 16px away from a two-line column of the title and the price, both
 * 16/22 w600 with an 8px gap. The only hover the reference has here is the
 * title turning accent.
 */
export function PopularCarCard({ car }: { car: SiteCarCard }) {
  return (
    <a className="site-popular-card" href={car.href}>
      <span className="site-popular-thumb">
        {car.image === null ? null : (
          <img src={car.image.src} alt={car.image.alt} loading="lazy" decoding="async" />
        )}
      </span>
      {/* Whitespace between the flex items, as in the fleet card: no layout
          effect, but the title and the price stop reading as one word. */}
      <span className="site-popular-text">
        <span className="site-popular-title">{car.title}</span>{' '}
        <span className="site-popular-price">{car.price}</span>
      </span>
    </a>
  );
}
