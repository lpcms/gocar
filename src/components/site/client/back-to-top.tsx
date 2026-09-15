'use client';

import { useEffect, useState } from 'react';

/**
 * Scroll offset at which the button appears, copied from the phase-1 tweak
 * (public/assets/tweaks/float-arrow.js) so the two renders behave alike.
 */
const THRESHOLD = 1000;

/**
 * Back-to-top button.
 *
 * The reference keeps a 36x37 accent disc pinned 24px from the bottom right
 * corner; it fades in past a thousand pixels of scrolling and takes the
 * visitor back to the top. In phase 1 a tweak script drove a Framer link;
 * here it is an island of its own, mounted by the layout so every page has it.
 *
 * The scroll itself is `behavior: 'smooth'`, which the browser turns into an
 * instant jump for a visitor who asked for reduced motion, so no check of our
 * own is needed.
 */
export function BackToTop({ label }: { label: string }) {
  const [shown, setShown] = useState(false);
  const [badge, setBadge] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /**
   * The pages that carry a form also carry Google's reCAPTCHA badge, which
   * pins itself to the same corner and lands under the button. The badge is
   * added by a third-party script well after hydration, so it is watched for
   * rather than looked up once; the button then moves above it.
   */
  useEffect(() => {
    const found = () => document.querySelector('.grecaptcha-badge') !== null;
    if (found()) {
      setBadge(true);
      return undefined;
    }
    const observer = new MutationObserver(() => {
      if (!found()) return;
      setBadge(true);
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <button
      className="site-to-top"
      type="button"
      aria-label={label}
      data-shown={shown ? '1' : '0'}
      data-badge={badge ? '1' : '0'}
      tabIndex={shown ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <svg width="36" height="37" viewBox="0 0 36 37" aria-hidden="true" focusable="false">
        <path
          d="M 18.53 11.329 C 18.237 11.037 17.763 11.037 17.47 11.329 L 12.697 16.102 C 12.404 16.395 12.404 16.87 12.697 17.163 C 12.99 17.456 13.464 17.456 13.757 17.163 L 18 12.921 L 22.243 17.163 C 22.535 17.456 23.01 17.456 23.303 17.163 C 23.596 16.87 23.596 16.395 23.303 16.102 Z M 18.75 25.86 L 18.75 11.86 L 17.25 11.86 L 17.25 25.86 Z"
          fill="#fff"
        />
      </svg>
    </button>
  );
}
