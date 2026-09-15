import type { SiteCarCard, SiteCardLabels } from '@/lib/site-cars';

/**
 * Car card of the fleet, popular and related grids.
 *
 * Reference (scripts/spec-states.mjs, frames cars@<w>-<locale>-card-rest):
 * a 10px surface-alt panel with 12/12/24 padding and a 32px gap between the
 * photo and the text block; the photo is a 4:3 box with the image contained
 * inside it; the text block is 134px tall and pushes the title to its top and
 * the price row to its bottom; the title is 20/28 w700, the caption 16/22 w600
 * and the price 20/28 w700; the pill is 42px tall with 10/26 padding and a
 * 32px radius.
 *
 * On hover the card inverts: the panel turns accent, every text turns white
 * and the pill swaps to a white panel with accent text.
 */
export function CarCard({ car, labels }: { car: SiteCarCard; labels: SiteCardLabels }) {
  return (
    <a className="site-car-card" href={car.href}>
      <span className="site-car-card-photo">
        {car.image === null ? null : (
          <img src={car.image.src} alt={car.image.alt} loading="lazy" decoding="async" />
        )}
      </span>
      {/*
        The spaces between these spans are deliberate. Every box here is a flex
        item, and a flex container drops an anonymous item that holds nothing
        but white space - so they change no pixel of the layout - but they are
        what separates the words for anything reading the text rather than the
        boxes. Without them the card reads as one run, "Mercedes Vito
        Tourerвід$70/деньПерегляд", and that is the form Google built its
        search snippet from (27.08.2026).
      */}
      <span className="site-car-card-body">
        <h3 className="site-car-card-title">{car.title}</h3>{' '}
        <span className="site-car-card-row">
          <span className="site-car-card-price">
            <span className="site-car-card-caption">{labels.startingAt}</span>{' '}
            <span className="site-car-card-amount">{car.price}</span>
          </span>{' '}
          <span className="site-car-card-pill">{labels.view}</span>
        </span>
      </span>
    </a>
  );
}
