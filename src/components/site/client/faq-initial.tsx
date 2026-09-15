'use client';

import { useEffect } from 'react';

/** Below this width the reference opens no question at all. */
const MOBILE = '(max-width: 809.98px)';

/**
 * Initial state of the FAQ accordion.
 *
 * The reference renders the first question of the first group open from 810 up
 * and closed below it, which no media query can express: `details` is opened by
 * an attribute, not by CSS. The server therefore always sends it open - so the
 * desktop is right with no script at all - marked with
 * `site-faq-item--initial`, and site.css paints that one marked item in its
 * closed skin on mobile.
 *
 * This closes it for real on mobile and then drops the marker, so from the
 * first interaction on every item behaves like any other at any width. The
 * component renders nothing.
 */
export function FaqInitial() {
  useEffect(() => {
    const item = document.querySelector('.site-faq-item--initial');
    if (item === null) return;
    if (window.matchMedia(MOBILE).matches) item.removeAttribute('open');
    item.classList.remove('site-faq-item--initial');
  }, []);

  return null;
}
