'use client';

import { Fragment, useEffect, useId, useState } from 'react';
import { LocaleSelect } from './locale-select';
import type { LocaleOption } from './locale-select';
import { Icon01 } from '../icons';

/** One entry of the mobile menu. */
export type MobileMenuItem = {
  key: string;
  label: string;
  href: string;
  current?: boolean;
  children?: { label: string; href: string; current?: boolean }[];
};

/**
 * Mobile navigation island.
 *
 * Built to the reference overlay measured on 19.08.2026 at 390px: a full-screen
 * #222 panel padded 32/30/40, the red wordmark and the close control on one
 * row, then the language picker as its own white pill and the entries - 18/27
 * w500 white, the Cars categories nested at 20/28. The entry of the current
 * page carries the same red dot the header and the footer use.
 *
 * One deliberate departure from that capture: the phone button is the first
 * thing under the wordmark rather than the last thing on the panel. Calling is
 * what the menu is opened for on a phone, and the reference left the only
 * action on the screen below every link, where it needed a scroll to reach
 * (client 25.08.2026).
 *
 * The earlier build here predated that capture: the live overlay was believed
 * to be dead markup, so the design was guessed from the styles it resolved to
 * (uppercase entries, category chips). It is not a guess any more.
 */
export function MobileMenu({
  items,
  phone,
  siteName,
  closeLabel,
  menuLabel,
  localeLabel,
  selectLabel,
  locale,
  localeOptions
}: {
  items: MobileMenuItem[];
  phone: string;
  siteName: string;
  closeLabel: string;
  menuLabel: string;
  localeLabel: string;
  selectLabel: string;
  locale: string;
  localeOptions: LocaleOption[];
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        className="site-burger"
        type="button"
        aria-label={menuLabel}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 36 37" width="1em" height="1em" aria-hidden="true" focusable="false">
          <rect x="6" y="11" width="24" height="2.4" rx="1.2" fill="currentColor" />
          <rect x="6" y="17.3" width="24" height="2.4" rx="1.2" fill="currentColor" />
          <rect x="6" y="23.6" width="24" height="2.4" rx="1.2" fill="currentColor" />
        </svg>
      </button>

      <div
        className="site-mobile-menu"
        id={panelId}
        data-open={open ? 'true' : 'false'}
        hidden={!open}
      >
        <div className="site-mobile-menu-top">
          <span className="site-mobile-menu-logo">{siteName}</span>{' '}
          <button
            className="site-mobile-menu-close"
            type="button"
            aria-label={closeLabel}
            onClick={() => setOpen(false)}
          >
            <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
              <path
                d="M5 5 L19 19 M19 5 L5 19"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {phone !== '' ? (
          <a
            className="site-phone site-mobile-menu-phone"
            href={`tel:${phone.replace(/[^\d+]/g, '')}`}
          >
            <span className="site-phone-icon">
              <Icon01 />
            </span>
            <span>{phone}</span>
          </a>
        ) : null}{' '}
        <div className="site-mobile-menu-locale">
          <LocaleSelect
            locale={locale}
            label={localeLabel}
            selectLabel={selectLabel}
            options={localeOptions}
          />
        </div>
        <nav className="site-mobile-menu-nav">
          <ul className="site-mobile-menu-list">
            {items.map((item) => (
              <li key={item.key}>
                <a
                  href={item.href}
                  aria-current={item.current === true ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>{' '}
                {item.children && item.children.length > 0 ? (
                  <ul className="site-mobile-menu-sublist">
                    {item.children.map((child) => (
                      <Fragment key={child.href}>
                        <li>
                          <a
                            href={child.href}
                            aria-current={child.current === true ? 'page' : undefined}
                            onClick={() => setOpen(false)}
                          >
                            {child.label}
                          </a>
                        </li>{' '}
                      </Fragment>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
