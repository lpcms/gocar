import {
  getNavItems,
  isCurrent,
  isInSection,
  localePath,
  stripLocale,
  withBase
} from '@/lib/site-nav';
import type { Locale } from '@/lib/site-nav';
import { getSetting } from '@/lib/settings';
import { getFooterMenuData } from '@/lib/footer-menu';
import { getTranslation } from '@/lib/translations';
import { getCarsMenu } from '@/lib/cars-menu';
import { MobileMenu } from './client/mobile-menu';
import { LocaleSelect } from './client/locale-select';
import { CarsMenu } from './client/cars-menu';
import { Fragment } from 'react';
import { Icon01 } from './icons';

/**
 * Site header of the phase-2 render. Server component: the only interactive
 * parts (burger, locale switch) are separate islands, so nothing here reaches
 * the client bundle.
 *
 * Geometry follows the captured reference: below 1440 a 96px bar with the logo
 * and a burger, from 1440 up a 121px bar with the full menu, the phone button
 * and the locale switcher.
 */
const en: Locale = 'en';
const ua: Locale = 'ua';

export function SiteHeader({
  locale,
  pathname,
  basePath = ''
}: {
  locale: Locale;
  pathname: string;
  basePath?: string;
}) {
  const items = getNavItems(locale).map((item) => ({ ...item, href: withBase(item.href, basePath) }));
  const siteName = getSetting('site_name', 'GoCar') ?? 'GoCar';
  const phone = getSetting('contact_phone', '') ?? '';
  const phoneHref = `tel:${phone.replace(/[^\d+]/g, '')}`;
  const localeLabel = locale === 'ua' ? 'Українська' : 'English';
  /** An optional base prefix is dropped before the locale one, so a prefixed /en/cars still resolves to 'cars'. */
  const unstaged =
    basePath !== '' && pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname;
  const bare = stripLocale(unstaged);
  const selectLabel = getTranslation('menu.select_language', locale, 'Select Language');
  const closeLabel = getTranslation('menu.close', locale, locale === 'ua' ? 'Закрити' : 'Close');

  /** Both locales of the switcher, in the order the reference lists them. */
  const localeOptions: { value: Locale; label: string; href: string }[] = [
    { value: en, label: 'English', href: withBase(localePath(bare, en), basePath) },
    { value: ua, label: 'Українська', href: withBase(localePath(bare, ua), basePath) }
  ];
  const menuLabel = getTranslation('menu.title', locale, locale === 'ua' ? 'Меню' : 'Menu');

  /**
   * The mobile list mirrors the main menu and nests the categories under Cars,
   * as the saved overlay markup does.
   */
  /**
   * The dropdown's own data layer builds bare paths, so they are prefixed here,
   * in the only consumer that has a `basePath`. Without it a car link would
   * leave the prefix on click, and the panel would never mark the car being
   * read, because it compares its hrefs against the address bar.
   */
  const cars = getCarsMenu(locale).map((item) => ({
    ...item,
    href: withBase(item.href, basePath)
  }));
  /**
   * A category is a page of its own in the new render, not a hash on /cars,
   * so the nested list marks the one being read - by whole path, the way the
   * footer and the desktop dropdown mark theirs.
   */
  const categories = getFooterMenuData(locale).fleetLinks.map((link) => {
    const href = withBase(link.href.replace('/cars#', '/cars/'), basePath);
    return { ...link, href, current: isCurrent(href, pathname) };
  });
  /**
   * An entry is marked on its own page and on the pages under it, so "Cars"
   * stays lit on a category and on a car page (client 22.08.2026).
   */
  const marked = (item: { key: string; href: string }): boolean =>
    isCurrent(item.href, pathname) || isInSection(item.key, bare);

  const mobileItems = items.map((item) => {
    const base = {
      key: item.key,
      label: item.label,
      href: item.href,
      current: marked(item)
    };
    return item.key === 'menu.cars' ? { ...base, children: categories } : base;
  });

  return (
    <header className="site-header">
      <nav className="site-nav">
        <h6 className="site-logo">
          <a href={withBase(localePath('', locale), basePath)}>{siteName}</a>
        </h6>

        {/*
          The white space between the logo, the menu and the actions - and
          between the menu items themselves - separates the words for anything
          that reads the text rather than the boxes: a search snippet, a screen
          reader, a copied selection. All three containers are flex, which drops
          a whitespace-only item, so not a pixel moves; the width rules keyed on
          `li:nth-child` are unaffected too, because nth-child counts elements
          and never text (27.08.2026).
        */}{' '}
        <ul className="site-menu" data-locale={locale}>
          {items.map((item) => (
            <Fragment key={item.key}>
              <li>
                {item.key === 'menu.cars' && cars.length > 0 ? (
                  <CarsMenu
                    href={item.href}
                    label={item.label}
                    current={marked(item)}
                    items={cars}
                  />
                ) : (
                  <a href={item.href} aria-current={marked(item) ? 'page' : undefined}>
                    <span>{item.label}</span>
                  </a>
                )}
              </li>{' '}
            </Fragment>
          ))}
        </ul>{' '}
        <div className="site-actions">
          {phone !== '' ? (
            <a className="site-phone" href={phoneHref}>
              <span className="site-phone-icon">
                <Icon01 />
              </span>
              <span>{phone}</span>
            </a>
          ) : null}{' '}
          <span className="site-phone-divider" aria-hidden="true" />{' '}
          <LocaleSelect
            locale={locale}
            label={localeLabel}
            selectLabel={selectLabel}
            options={localeOptions}
          />
        </div>

        <MobileMenu
          items={mobileItems}
          phone={phone}
          siteName={siteName}
          closeLabel={closeLabel}
          menuLabel={menuLabel}
          localeLabel={localeLabel}
          selectLabel={selectLabel}
          locale={locale}
          localeOptions={localeOptions}
        />
      </nav>
    </header>
  );
}
