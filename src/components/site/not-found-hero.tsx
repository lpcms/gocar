import { getNotFoundTexts } from '@/lib/not-found';
import { getMediaAlt } from '@/lib/media-alt';
import { responsiveImage } from '@/lib/site-images';
import { localePath } from '@/lib/site-nav';
import type { Locale } from '@/lib/site-nav';
import { SiteButton } from './button';

/**
 * Hero of the 404 page: the illustration with its floating "Booking Now!" badge
 * on the left, the 200px "404", the apology line and the primary button on the
 * right, over a red decorative disc.
 *
 * Texts come from getNotFoundTexts (translations table, phase-1 contract);
 * geometry follows the captured reference frame at 1440.
 */
export function NotFoundHero({ locale }: { locale: Locale }) {
  const texts = getNotFoundTexts(locale);

  return (
    <header className="site-404">
      <div className="site-404-disc-clip" aria-hidden="true">
        <div className="site-404-disc" />
      </div>
      <div className="site-404-inner">
        <div className="site-404-figure">
          <img
            {...responsiveImage('/images/site/404-hero.png')}
            alt={getMediaAlt('/images/site/404-hero.png', locale)}
            className="site-404-image"
            fetchPriority="high"
          />
          <a className="site-404-badge t-1564km0" href={localePath('cars', locale)}>
            <span className="site-404-badge-dot" aria-hidden="true" />
            <span>{texts.badge !== '' ? texts.badge : 'Booking Now!'}</span>
          </a>
        </div>

        <div className="site-404-text">
          <p className="site-404-code t-7vethl">{texts.title !== '' ? texts.title : '404'}</p>
          <h6 className="site-404-message">{texts.message}</h6>
          <SiteButton href={localePath('', locale)}>
            {texts.button !== '' ? texts.button : 'Go Back Home'}
          </SiteButton>
        </div>
      </div>
    </header>
  );
}
