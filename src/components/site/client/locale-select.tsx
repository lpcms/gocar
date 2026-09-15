'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon06, Icon07 } from '../icons';

/** One selectable locale of the switcher. */
export type LocaleOption = { value: string; label: string; href: string };

/**
 * Locale switcher of the header.
 *
 * The reference wraps a native <select> in a decorative row. That structure was
 * reproduced first, but it cannot drive the chevron: while a native list is
 * open the browser routes every key and click to the popup, so the page never
 * learns that Escape, a click elsewhere or a pick closed it, and the chevron
 * stayed up over a closed list. The control is therefore a listbox of our own -
 * the same pattern the Cars dropdown already uses - which keeps the open state
 * honest and still behaves for the keyboard: Enter, Space and the arrows open
 * it, the arrows move through the options, Enter picks, Escape closes and
 * returns focus to the button.
 */
export function LocaleSelect({
  locale,
  label,
  selectLabel,
  options
}: {
  locale: string;
  label: string;
  selectLabel: string;
  options: LocaleOption[];
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => {
    const found = options.findIndex((option) => option.value === locale);
    return found === -1 ? 0 : found;
  });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  /** A press anywhere outside the control closes the list. */
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: MouseEvent) => {
      const wrap = wrapRef.current;
      if (wrap !== null && event.target instanceof Node && !wrap.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [open]);

  /**
   * Picking a language is an explicit choice and has to be remembered: the
   * cookie is what outranks the country guess and the admin default on every
   * later visit (client 22.08.2026). Without it the navigation below would be
   * undone on arrival, because nothing would tell the server the visitor had
   * chosen anything.
   */
  const choose = (option: LocaleOption) => {
    setOpen(false);
    try {
      document.cookie = `gocar_locale=${option.value}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /** A blocked cookie costs the memory, not the navigation. */
    }
    window.location.assign(option.href);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (!open && (event.key === 'Enter' || event.key === ' ' || event.key.startsWith('Arrow'))) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((was) => (was + step + options.length) % options.length);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[active];
      if (option) choose(option);
    }
  };

  return (
    <div
      className="site-locale"
      data-open={open ? 'true' : 'false'}
      ref={wrapRef}
      onKeyDown={onKeyDown}
    >
      <span className="site-locale-label" id={`${id}-label`}>
        {selectLabel}
      </span>
      <button
        ref={buttonRef}
        type="button"
        className="site-locale-face"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => setOpen((was) => !was)}
      >
        <Icon06 style={{ fontSize: '18px' }} aria-hidden="true" />
        <span className="site-locale-name" id={`${id}-value`}>
          {label}
        </span>
        <span className="site-locale-caret" aria-hidden="true">
          <Icon07 style={{ fontSize: '12px' }} />
        </span>
      </button>
      {open ? (
        <ul className="site-locale-list" role="listbox" aria-labelledby={`${id}-label`}>
          {options.map((option, index) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === locale}
                data-active={index === active ? 'true' : undefined}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
