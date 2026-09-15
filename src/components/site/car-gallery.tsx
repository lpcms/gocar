import type { CarCardData } from '@/lib/car-card';

/**
 * Photo gallery of a car page: the main photo with three thumbnails under it.
 *
 * Reference (spec/dom/cars-detail__toyota-camry@<width>-en.json): the column
 * is 26px on the desktop and tablet breakpoints and 10px below them; the main
 * photo is 480px tall, 280 below 810; the thumbnails split the row into equal
 * thirds, 200px tall with a 30px gap, 100px with a 10px gap below 810. Every
 * photo is cropped to its box and nothing is rounded.
 *
 * The thumbnails are static in the reference - no cursor, no hover, and a
 * click does not swap the main photo - so they are plain images here as well.
 */
export function CarGallery({ photos }: { photos: CarCardData['photos'] }) {
  const thumbs = [
    { src: photos.preview1, alt: photos.preview1Alt },
    { src: photos.preview2, alt: photos.preview2Alt },
    { src: photos.preview3, alt: photos.preview3Alt }
  ].filter((item) => item.src !== null && item.src !== '');

  return (
    <div className="site-gallery">
      <div className="site-gallery-main">
        {photos.image === null || photos.image === '' ? null : (
          <img src={photos.image} alt={photos.imageAlt} fetchPriority="high" />
        )}
      </div>
      {thumbs.length === 0 ? null : (
        <div className="site-gallery-thumbs">
          {thumbs.map((thumb) => (
            <div className="site-gallery-thumb" key={thumb.src ?? ''}>
              <img src={thumb.src ?? ''} alt={thumb.alt} loading="lazy" decoding="async" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
