import { getBreadcrumbs } from '@/lib/breadcrumbs';
import { getTranslation } from '@/lib/translations';
import type { Locale } from '@/lib/site-nav';

/**
 * Breadcrumb row of the page hero. Server component: the reference row is a
 * plain flex line of 20/24 w600 crumbs with a 10px gap, clipped by the hero
 * container. Two tones, both taken from the reference: on the light section
 * heroes links are red, hover and the current page are #222; on the dark car
 * detail hero every crumb is white and links turn red on hover.
 *
 * The markup is a nav/ol list instead of the reference's stack of <h4>
 * headings - the typography preset gives the identical pixels, while screen
 * readers get a trail instead of six headings that are not headings.
 *
 * The separator closes the crumb in front of it rather than opening the one
 * behind it (client 23.08.2026). The painted row is identical - the gap is
 * 10px on both sides either way - but the row wraps on a phone, and a slash
 * that belongs to the crumb behind it starts the new line instead of ending
 * the old one.
 *
 * Approved divergence (plan 7.3, 18.08.2026): the reference hard-codes the
 * English link crumbs in caps ("HOME", "CARS") while the last crumb and the
 * whole Ukrainian trail come from the database in normal case. Every crumb
 * here is the database string.
 */
export function Breadcrumbs({
  path,
  locale,
  currentLabel = '',
  align = 'center',
  tone = 'dark',
  basePath = ''
}: {
  path: string;
  locale: Locale;
  currentLabel?: string;
  align?: 'center' | 'start';
  tone?: 'dark' | 'light';
  basePath?: string;
}) {
  const crumbs = getBreadcrumbs(path, locale, currentLabel, basePath);
  if (crumbs.length === 0) {
    return null;
  }

  const navLabel = getTranslation(
    'menu.breadcrumb',
    locale,
    locale === 'ua' ? 'Навігація сторінками' : 'Breadcrumb'
  );

  return (
    <nav className="site-crumbs" data-align={align} data-tone={tone} aria-label={navLabel}>
      <ol>
        {crumbs.map((crumb, index) => (
          <li key={crumb.href}>
            {crumb.current ? (
              <span className="t-1564km0" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <a className="t-1564km0" href={crumb.href}>
                {crumb.label}
              </a>
            )}
            {index < crumbs.length - 1 ? (
              <span className="site-crumbs-sep t-1564km0" aria-hidden="true">
                /
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
