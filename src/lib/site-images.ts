/**
 * Responsive variants of the site's large imagery.
 *
 * scripts/build-site-images.mjs writes `<name>-640.webp`, `<name>-1024.webp`
 * and a top variant next to each original in public/images/site. The table
 * below holds the width of that top variant - the original width capped to
 * 1920 - and must match what the script prints.
 *
 * The originals stay in place: the media library and the EN/UA alt text are
 * keyed by their paths, so callers keep passing the original path to
 * getMediaAlt and only take `src` / `srcSet` from here.
 */

/** Top variant width of every original that has variants. */
const TOP_WIDTH: Record<string, number> = {
  '/images/site/faq-hero.png': 1920,
  '/images/site/faq-cta.png': 1899,
  '/images/site/cta-banner.png': 1920,
  '/images/site/about-cta.png': 1920,
  '/images/site/about-hero.jpg': 1920,
  '/images/site/contact-hero.jpg': 1920,
  '/images/site/404-hero.png': 1760,
  '/images/site/home-why-car.webp': 1748,
  '/images/site/home-cta-car.webp': 1795,
  '/images/site/car-detail-hero.jpg': 1920
};

/** The attributes an <img> needs to let the browser pick a variant. */
export interface ResponsiveImage {
  src: string;
  srcSet?: string;
  sizes?: string;
}

/**
 * `src`, `srcSet` and `sizes` for one original. An image without variants is
 * returned as it is, so a caller never has to know which files have them.
 *
 * @param original Public path of the original, e.g. "/images/site/faq-hero.png".
 * @param sizes The `sizes` attribute; the default fits a full-width picture.
 */
export function responsiveImage(original: string, sizes = '100vw'): ResponsiveImage {
  const top = TOP_WIDTH[original];
  if (top === undefined) return { src: original };
  const stem = original.replace(/\.[^.]+$/, '');
  const widths = [640, 1024].filter((w) => w < top).concat(top);
  return {
    src: `${stem}-${top}.webp`,
    srcSet: widths.map((w) => `${stem}-${w}.webp ${w}w`).join(', '),
    sizes
  };
}
