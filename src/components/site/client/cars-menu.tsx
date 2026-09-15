'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** One car of the header dropdown. */
export type CarsMenuItem = { href: string; title: string };

/**
 * Viewport width from which the dropdown is active - the same width at which
 * the full menu replaces the burger. The reference opens the dropdown one
 * pixel later than it shows the menu, so at exactly 1440 the entry is there
 * but has neither caret nor list; phase 2 keeps the two in step.
 */
const MIN_WIDTH = 1440;

/** Grace period before the panel closes after the pointer leaves it. */
const CLOSE_DELAY_MS = 200;

/**
 * Name the panel is sized for, with the headroom the reference leaves around
 * it, so the list does not look cramped and a longer name wraps instead.
 */
const WIDTH_SAMPLE = 'Mercedes Vito Tourer';
const WIDTH_HEADROOM = 1.15;

/** Distance between the trigger and the panel. */
const GAP = 10;

/**
 * Whether an entry points at the page currently open. Compared on the path
 * alone, so a trailing slash, a query or a hash never matters. Only called
 * from the panel, which exists on the client alone.
 */
function isSamePath(href: string): boolean {
  const strip = (value: string) => value.split('?')[0]?.split('#')[0]?.replace(/\/+$/, '') ?? '';
  return strip(href) === strip(window.location.pathname);
}

/**
 * The "Cars" entry of the header menu with its dropdown of live cars.
 *
 * The link itself stays an ordinary link and still navigates to /cars on
 * click; the panel only opens on hover, and leaving both the link and the
 * panel closes it after a grace period, which is what makes the diagonal
 * move from the word down to the list possible. The panel is portalled to
 * <body> so no ancestor's overflow or stacking context can clip it.
 */
export function CarsMenu({
  href,
  label,
  current,
  items
}: {
  href: string;
  label: string;
  current: boolean;
  items: CarsMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  const triggerRef = useRef<HTMLAnchorElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [cancelClose]);

  /**
   * Place the panel under the trigger and keep it inside the viewport. The
   * label overflows its own box in this menu, so the anchor is the union of
   * the link and everything it paints - otherwise the panel sits off the word.
   */
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (trigger === null) return;
    const rect = trigger.getBoundingClientRect();
    let left = rect.left;
    let bottom = rect.bottom;
    for (const kid of Array.from(trigger.querySelectorAll('*'))) {
      const box = kid.getBoundingClientRect();
      if (box.width === 0) continue;
      left = Math.min(left, box.left);
      bottom = Math.max(bottom, box.bottom);
    }
    const panelWidth = width ?? panelRef.current?.offsetWidth ?? 0;
    if (left + panelWidth > window.innerWidth - GAP) {
      left = Math.max(GAP, window.innerWidth - GAP - panelWidth);
    }
    setPos({ left: Math.round(left), top: Math.round(bottom + GAP) });
  }, [width]);

  const openMenu = useCallback(() => {
    cancelClose();
    if (!window.matchMedia(`(min-width: ${MIN_WIDTH}px)`).matches) return;
    setOpen(true);
  }, [cancelClose]);

  /**
   * Fix the panel width to the sample name in the panel's own font, so it
   * follows the loaded webfont rather than a guess. Measured once, on the
   * first open, when the panel is laid out and can be measured at all.
   */
  useEffect(() => {
    if (!open || width !== null) return;
    const item = panelRef.current?.querySelector('a');
    if (!item) return;
    const probe = document.createElement('span');
    probe.textContent = WIDTH_SAMPLE;
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.whiteSpace = 'nowrap';
    item.appendChild(probe);
    const textWidth = probe.getBoundingClientRect().width;
    item.removeChild(probe);
    if (textWidth <= 0) return;
    const style = window.getComputedStyle(item);
    const inner =
      item.getBoundingClientRect().width -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);
    const chrome = (panelRef.current?.offsetWidth ?? 0) - inner;
    setWidth(Math.ceil(textWidth * WIDTH_HEADROOM + chrome));
  }, [open, width]);

  /** Keep the open panel under its link while the page scrolls or resizes. */
  useEffect(() => {
    if (!open) return;
    place();
    let frame: number | null = null;
    const follow = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        place();
      });
    };
    const close = () => setOpen(false);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', close);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', close);
    };
  }, [open, place]);

  useEffect(() => cancelClose, [cancelClose]);

  /** Measured width, in the form the style object wants it. */
  const panelWidth = width === null ? undefined : String(width) + 'px';

  return (
    <>
      <a
        ref={triggerRef}
        className="site-menu-cars"
        href={href}
        aria-current={current ? 'page' : undefined}
        aria-expanded={open}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
        onFocus={() => setOpen(false)}
      >
        <span>{label}</span>
        <span className="site-menu-caret" aria-hidden="true" />
      </a>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              className="site-cars-menu"
              style={{
                left: `${pos?.left ?? 0}px`,
                top: `${pos?.top ?? 0}px`,
                width: panelWidth,
                visibility: pos === null ? 'hidden' : undefined
              }}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              {items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={isSamePath(item.href) ? 'page' : undefined}
                >
                  {item.title}
                </a>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
