import { getFooterMenuData } from '@/lib/footer-menu';
import { getTranslation } from '@/lib/translations';
import { isCurrent, withBase } from '@/lib/site-nav';
import type { Locale } from '@/lib/site-nav';
import { Icon08, Icon09, Icon10, Icon11, Icon12, Icon13, Icon14, IconClock } from './icons';

/** Messenger glyphs, in the order the reference renders them. */
const SOCIAL_ICONS = {
  telegram: Icon11,
  viber: Icon12,
  instagram: Icon13,
  whatsapp: Icon14
} as const;

/** Rendered sizes of the messenger icons, read off the reference frame. */
const SOCIAL_SIZES = {
  telegram: '33px',
  viber: '27px',
  instagram: '36px',
  whatsapp: '32px'
} as const;

/**
 * Site footer of the phase-2 render. The data contract of phase 1 is reused as
 * is - getFooterMenuData already resolves the three columns (menu items,
 * categories in admin order, contacts from Настройки) for a locale.
 *
 * Geometry follows the captured reference: three columns of 160/160/280px with
 * a 70px column gap, 20px/28px headings, 16px links indented by 12px, and the
 * copyright line at 14px/16px weight 500. The messengers are the last item of
 * the contacts list rather than a list of their own - that is what puts them
 * 12px below the address instead of a column gap away.
 *
 * Both link columns mark the page they are on, as the reference does: the
 * entry carries `aria-current="page"` and is set in weight 500 while the rest
 * stay at 400. `pathname` is what the page hands the header as well.
 *
 * A category is its own page in the new render, so only one entry is ever
 * marked (client's decision 21.08.2026): on /cars that is "Cars" in the quick
 * links, on /cars/economy it is "Economy" in the fleet column and "Cars" is
 * left alone - `isCurrent` compares whole paths, so /cars never matches
 * /cars/economy.
 */
export function SiteFooter({
  locale,
  pathname,
  basePath = ''
}: {
  locale: Locale;
  pathname?: string;
  basePath?: string;
}) {
  const data = getFooterMenuData(locale);
  /** True when this href is the page being rendered. */
  const current = (href: string): 'page' | undefined =>
    pathname !== undefined && isCurrent(href, pathname) ? 'page' : undefined;
  const copyright = getTranslation(
    'home.footer_copyright',
    locale,
    'Copyright © 2026 GoCar. All rights reserved.'
  );
  const telHref = data.phone !== '' ? `tel:+${data.phone.replace(/[^\d]/g, '')}` : '';

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-columns">
          <section className="site-footer-col">
            <h3 className="site-footer-heading t-1914n6i">{data.quickHeading}</h3>
            <ul className="site-footer-list">
              {data.quickLinks.map((link) => {
                const href = withBase(link.href, basePath);
                return (
                  <li key={href}>
                    <a href={href} aria-current={current(href)}>
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="site-footer-col">
            <h3 className="site-footer-heading t-1914n6i">{data.fleetHeading}</h3>
            <ul className="site-footer-list">
              {data.fleetLinks.map((link) => {
                /** The new render sends a category to its own page, not to a hash. */
                const href = withBase(link.href.replace('/cars#', '/cars/'), basePath);
                return (
                  <li key={href}>
                    <a href={href} aria-current={current(href)}>
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="site-footer-col site-footer-col-wide">
            <h3 className="site-footer-heading t-1914n6i">{data.contactsHeading}</h3>
            <ul className="site-footer-list">
              {data.phone !== '' ? (
                <li>
                  <a className="site-footer-phone" href={telHref}>
                    <Icon08 style={{ fontSize: '18px' }} />
                    <span>{data.phone}</span>
                  </a>
                </li>
              ) : null}
              {data.email !== '' ? (
                <li>
                  <a href={`mailto:${data.email}`}>
                    <Icon09 style={{ fontSize: '18px' }} />
                    <span>{data.email}</span>
                  </a>
                </li>
              ) : null}
              {data.address !== '' ? (
                <li>
                  <span className="site-footer-address">
                    <Icon10 style={{ fontSize: '18px' }} />
                    <span>{data.address}</span>
                  </span>
                </li>
              ) : null}
              {data.workHours !== '' ? (
                <li>
                  <span className="site-footer-address site-footer-hours">
                    <IconClock style={{ fontSize: '18px' }} />
                    <span>{data.workHours}</span>
                  </span>
                </li>
              ) : null}
              {data.socials.length > 0 ? (
                <li>
                  <ul className="site-footer-socials">
                    {data.socials.map((social) => {
                      const Glyph = SOCIAL_ICONS[social.icon];
                      return (
                        <li key={social.icon}>
                          <a href={social.href} aria-label={social.label}>
                            <Glyph style={{ fontSize: SOCIAL_SIZES[social.icon] }} />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ) : null}
            </ul>
          </section>
        </div>

        <p className="site-footer-copyright t-8j2zbf">{copyright}</p>
      </div>
    </footer>
  );
}
