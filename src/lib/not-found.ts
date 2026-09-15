import { getDb } from './db';

/**
 * Injectable text nodes on the 404 page and the translation key that feeds
 * each one. These texts live only in the DOM — the 404 page has no Framer
 * CMS payload — so a plain text swap is safe and complete.
 */
interface NotFoundTexts {
  title: string;
  badge: string;
  message: string;
  button: string;
  ctaHeading: string;
  ctaButton: string;
}

/**
 * Read the 404 translations for a locale from the translations table.
 * Missing values fall back to an empty string so the caller keeps the
 * snapshot's original English text.
 */
export function getNotFoundTexts(locale: 'en' | 'ua'): NotFoundTexts {
  const db = getDb();
  const read = (key: string): string => {
    const row = db
      .prepare('SELECT value FROM translations WHERE key = ? AND locale = ?')
      .get(key, locale) as unknown as { value: string | null } | undefined;
    return row && row.value !== null ? row.value : '';
  };
  return {
    title: read('404.title'),
    badge: read('404.badge'),
    message: read('404.message'),
    button: read('404.button'),
    ctaHeading: read('404.cta_heading'),
    ctaButton: read('404.cta_button')
  };
}

/**
 * Escape a string for safe insertion into HTML text content.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * The original English strings baked into the 404 snapshot. They are used
 * as anchors: each is unique in the document, so an exact text swap hits
 * the right node without relying on (shared) class names. Some strings
 * appear twice (responsive SSR variants); replacing every occurrence is
 * correct because both variants render the same text.
 */
const ORIGINAL = {
  title: '404',
  badge: 'Booking Now!',
  message:
    "We're sorry, the page you're looking for doesn't exist. Discover exceptional car rental services with Drivoxe. Please go back to the homepage and continue your journey.",
  button: 'Go Back Home',
  ctaHeading: 'Book Your Adventure Today and Feel the Power of the Open Road.',
  ctaButton: 'Book Now'
};

/**
 * Inject localized 404 texts into the snapshot. Only non-empty values are
 * applied, so an unconfigured locale keeps the original English wording.
 *
 * Two layers work together:
 *  1. Server-side DOM swap — the served HTML already carries the
 *     translations, so search engines and the first paint are correct.
 *  2. A post-hydration guard script — the Framer runtime rehydrates from
 *     its own chunks after load and repaints the original English text
 *     ("flash of old content"). The guard re-applies our text once React
 *     has settled and keeps it in place via a MutationObserver, so the
 *     runtime can no longer overwrite it. Only text nodes are touched;
 *     styles, animations and classes are left untouched.
 */
export function injectNotFound(html: string, texts: NotFoundTexts): string {
  let out = html;

  /**
   * Ordered list of [original, translated] pairs actually applied, so the
   * guard script can re-assert exactly these swaps client-side.
   */
  const applied: Array<[string, string]> = [];
  const add = (original: string, value: string): void => {
    if (value.trim() === '' || value === original) return;
    out = out.split(`>${original}<`).join(`>${esc(value)}<`);
    applied.push([original, value]);
  };
  add(ORIGINAL.title, texts.title);
  add(ORIGINAL.badge, texts.badge);
  add(ORIGINAL.message, texts.message);
  add(ORIGINAL.button, texts.button);
  add(ORIGINAL.ctaHeading, texts.ctaHeading);
  add(ORIGINAL.ctaButton, texts.ctaButton);

  if (applied.length === 0) return out;

  const payload = JSON.stringify(applied).replace(/</g, '\\u003c');
  const guard =
    `<script data-gocar-i18n-guard="1">(function(){` +
    `var pairs=${payload};` +
    `function apply(){` +
    `for(var i=0;i<pairs.length;i++){` +
    `var from=pairs[i][0],to=pairs[i][1];` +
    `var els=document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,span,div');` +
    `for(var j=0;j<els.length;j++){` +
    `var el=els[j];` +
    `if(el.childElementCount===0&&el.textContent===from){el.textContent=to;}` +
    `}` +
    `}` +
    `}` +
    `apply();` +
    `var obs=new MutationObserver(function(){apply();});` +
    `obs.observe(document.body,{childList:true,subtree:true,characterData:true});` +
    `setTimeout(function(){apply();},1000);` +
    `setTimeout(function(){obs.disconnect();apply();},4000);` +
    `})();</script>`;

  return out.replace('</body>', `${guard}</body>`);
}
