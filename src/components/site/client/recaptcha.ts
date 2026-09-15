import { useEffect } from 'react';

/**
 * reCAPTCHA v3 for the public forms, loaded on demand.
 *
 * Google's script is ~340 KiB and a second of main-thread work on a mid-range
 * phone; loaded with the page it held back the first paint of /book and
 * /contact (mobile Lighthouse 43 on /book, 15.09.2026). It is now requested on
 * the visitor's first interaction with the page - long before a form can be
 * sent, so v3 still sees the visit - and a submission always waits for it,
 * because the endpoint refuses a lead without a token.
 */

/** The reCAPTCHA v3 object Google's script puts on the window. */
interface Grecaptcha {
  ready: (cb: () => void) => void;
  execute: (key: string, options: { action: string }) => Promise<string>;
}

/** How long a submission waits for Google's script before giving up. */
const LOAD_TIMEOUT_MS = 10000;

/** Events that count as the visitor starting to use the page. */
const INTERACTIONS = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'focusin'] as const;

/** The one in-flight load, shared by every caller on the page. */
let pending: Promise<Grecaptcha | undefined> | null = null;

/** The ready reCAPTCHA object, if the script has already run. */
function current(): Grecaptcha | undefined {
  const found = (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha;
  return found !== undefined && typeof found.ready === 'function' ? found : undefined;
}

/**
 * Load Google's script once. Resolves to undefined when no key is configured
 * or the script cannot be reached, so a caller falls back the way it always
 * has.
 */
export function loadRecaptcha(siteKey: string): Promise<Grecaptcha | undefined> {
  if (siteKey === '') return Promise.resolve(undefined);
  const ready = current();
  if (ready !== undefined) return Promise.resolve(ready);
  if (pending !== null) return pending;
  pending = new Promise<Grecaptcha | undefined>((resolve) => {
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    const timer = window.setTimeout(() => resolve(current()), LOAD_TIMEOUT_MS);
    script.onload = () => {
      window.clearTimeout(timer);
      resolve(current());
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      pending = null;
      resolve(undefined);
    };
    document.head.appendChild(script);
  });
  return pending;
}

/**
 * A token for one submission, or an empty string when the keys are not
 * configured or Google's script is unavailable.
 *
 * `execute` can hang rather than reject - a key used on a domain it is not
 * registered for does exactly that - so the wait is capped: the visitor then
 * gets the form's error instead of a button that spins forever.
 */
export async function getRecaptchaToken(siteKey: string, action: string): Promise<string> {
  const grecaptcha = await loadRecaptcha(siteKey);
  if (grecaptcha === undefined) return '';
  return new Promise<string>((resolve) => {
    window.setTimeout(() => resolve(''), LOAD_TIMEOUT_MS);
    try {
      grecaptcha.ready(() => {
        grecaptcha
          .execute(siteKey, { action })
          .then(resolve)
          .catch(() => resolve(''));
      });
    } catch {
      resolve('');
    }
  });
}

/**
 * Start loading the script on the visitor's first interaction with the page.
 */
export function useRecaptchaOnInteraction(siteKey: string): void {
  useEffect(() => {
    if (siteKey === '') return undefined;
    const start = () => {
      for (const name of INTERACTIONS) window.removeEventListener(name, start);
      void loadRecaptcha(siteKey);
    };
    for (const name of INTERACTIONS) window.addEventListener(name, start, { passive: true });
    return () => {
      for (const name of INTERACTIONS) window.removeEventListener(name, start);
    };
  }, [siteKey]);
}
