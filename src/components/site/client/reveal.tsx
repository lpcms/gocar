'use client';

import { useEffect } from 'react';

/**
 * Distance from the bottom of the viewport at which a block starts appearing,
 * so the movement finishes while the block is being scrolled to rather than
 * after it has already been read.
 */
const ROOT_MARGIN = '0px 0px -10% 0px';

/**
 * Scroll appearance of page blocks - the single standard agreed on
 * 18.08.2026 (plan-phaze-2.md §4.2.2), softened on 19.08.2026: opacity 0 to 1
 * plus a 16px lift, 0.4s ease-out, one observer for the whole page.
 *
 * The controller renders nothing. Blocks opt in with the `site-reveal`
 * class; the resting state is theirs, and this only flips `data-revealed`
 * once, so a block never animates twice and nothing re-hides on scroll back.
 *
 * The hidden start lives behind `@media (scripting: enabled)` in site.css,
 * so a page whose script never runs shows every block instead of a blank
 * column, and `prefers-reduced-motion` skips the movement entirely - which
 * is also why this effect does nothing in that case.
 */
export function Reveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const blocks = Array.from(document.querySelectorAll('.site-reveal'));
    if (blocks.length === 0) return;

    /**
     * A block already in view when the page opens is revealed straight away:
     * the standard animates blocks scrolled to, not the first screen.
     */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-revealed', '1');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: ROOT_MARGIN }
    );
    for (const block of blocks) observer.observe(block);
    return () => observer.disconnect();
  }, []);

  return null;
}
