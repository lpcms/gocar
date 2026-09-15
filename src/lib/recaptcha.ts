import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './db';

/**
 * Invisible reCAPTCHA v3.
 *
 * The admin has stored a site key and a secret for a long time, but nothing
 * ever used them: no page loaded Google's script and no endpoint verified a
 * token, so the setting was inert. This module wires both ends - the loader
 * that every page gets, and the server-side check the lead endpoint runs.
 *
 * The whole feature turns on only when BOTH keys are filled in Настройки.
 * A half-configured install is treated as "off" on purpose: a site key
 * without a secret loads Google's script and stamps every visitor without
 * anything ever checking the result, and a secret without a site key would
 * reject every submission, because no page can produce a token.
 *
 * On top of that, `config.local.json` (gitignored, never on production) can
 * switch either half off:
 *
 *   { "recaptcha": { "admin": false, "forms": false } }
 *
 * Google rejects an automated browser outright - `browser-error` - so with
 * reCAPTCHA on, nothing can be driven through the admin login or the booking
 * form in a test run. The flags exist for exactly that, and default to `true`
 * when absent, so a production install that has no such file is unchanged.
 */

/** The two places a token is demanded. */
export type RecaptchaArea = 'admin' | 'forms';

/** The areas as typed constants, so callers never pass a bare string. */
export const RECAPTCHA_ADMIN: RecaptchaArea = 'admin';
export const RECAPTCHA_FORMS: RecaptchaArea = 'forms';

/**
 * Local overrides, read fresh each time: the file is edited by hand while the
 * server runs, and caching it would mean a restart to flip a flag.
 */
function localFlags(): Record<string, unknown> {
  try {
    const file = path.join(process.cwd(), 'config.local.json');
    if (!fs.existsSync(file)) return {};
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed === null || typeof parsed !== 'object') return {};
    const block = (parsed as Record<string, unknown>)['recaptcha'];
    if (block === null || typeof block !== 'object') return {};
    return block as Record<string, unknown>;
  } catch {
    /** A malformed file must never lock anyone out; treat it as absent. */
    return {};
  }
}

/**
 * Whether reCAPTCHA is switched on for one area. Only an explicit `false`
 * turns it off.
 */
export function isRecaptchaEnabled(area: RecaptchaArea): boolean {
  return localFlags()[area] !== false;
}

/**
 * Action name reported to Google for the public forms. Google groups the
 * score statistics by action, which is why it is sent explicitly.
 */
export const RECAPTCHA_ACTION = 'lead';

/**
 * Fallback threshold when Настройки holds nothing usable. Google's own
 * guidance is 0.5 as a starting point.
 */
const DEFAULT_THRESHOLD = 0.5;

/**
 * Read one settings value, or '' when unset.
 */
function getSetting(key: string): string {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as unknown as
    { value: string | null } | undefined;
  return row && row.value !== null ? row.value.trim() : '';
}

/**
 * Both keys as stored, so callers can gate on the pair.
 */
function getKeys(): { siteKey: string; secret: string } {
  return {
    siteKey: getSetting('recaptcha_site_key'),
    secret: getSetting('recaptcha_secret_key')
  };
}

/**
 * Score below which a submission is rejected, from Настройки. Values
 * outside Google's 0..1 range are ignored, so a typo cannot lock the forms.
 */
function getThreshold(): number {
  const raw = getSetting('recaptcha_score_threshold');
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    return DEFAULT_THRESHOLD;
  }
  return value;
}

/**
 * The public site key, or '' unless both keys are configured.
 */
export function getRecaptchaSiteKey(area: RecaptchaArea = 'forms'): string {
  if (!isRecaptchaEnabled(area)) return '';
  const { siteKey, secret } = getKeys();
  return siteKey !== '' && secret !== '' ? siteKey : '';
}

/**
 * Escape a value for safe insertion into an HTML attribute.
 */
function attrEsc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Add the reCAPTCHA loader to a page, plus the site key for the client
 * helper in site-tweaks.js. No-op without a key.
 *
 * The badge is hidden - Google allows this as long as the required notice is
 * shown instead, which the footer carries.
 */
export function injectRecaptcha(html: string, siteKey: string): string {
  if (siteKey === '') return html;
  const key = attrEsc(siteKey);
  const block =
    `<script id="gocar-recaptcha" type="application/json" data-site-key="${key}"></script>` +
    `<script src="https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}"` +
    ' async defer></script>' +
    '<style id="gocar-recaptcha-css">.grecaptcha-badge{visibility:hidden;}</style>';
  return html.replace('</body>', `${block}</body>`);
}

/**
 * Google's verification response, narrowed to what is used here.
 */
interface SiteVerifyResponse {
  success?: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

/**
 * Verify a token with Google.
 *
 * `ok` answers one question only: did this request carry a token Google
 * recognises. A missing token, an expired or reused one, a token minted for
 * another site - those are failures, and the caller refuses them.
 *
 * The score is a different thing and is never a verdict here. Google's own
 * guidance is to "use the score to take variable action in the context of your
 * site", not to gate on it, and the score of a new key is unreliable until the
 * site has fed reCAPTCHA enough real traffic to calibrate: on gocar.run
 * (22.08.2026) an ordinary visitor scored 0.3 against the default threshold of
 * 0.5 and could neither book nor sign in. So a low score comes back as `ok`
 * with `suspicious` raised, and each caller decides - the booking endpoint
 * stores it with the lead for the admin to judge, the admin door lets the
 * password and the lockout do the work.
 *
 * A network failure to Google is treated as a pass for the same reason: the
 * booking form is the site's revenue path, and losing real leads because a
 * third party is unreachable is worse than letting a bot through.
 */
export async function verifyRecaptcha(
  token: string,
  remoteIp: string,
  area: RecaptchaArea = 'forms'
): Promise<{ ok: boolean; suspicious: boolean; score: number | null; reason: string }> {
  if (!isRecaptchaEnabled(area)) {
    return { ok: true, suspicious: false, score: null, reason: 'disabled_locally' };
  }
  const { siteKey, secret } = getKeys();
  if (siteKey === '' || secret === '') {
    return { ok: true, suspicious: false, score: null, reason: 'not_configured' };
  }
  if (token.trim() === '') {
    return { ok: false, suspicious: false, score: null, reason: 'missing_token' };
  }
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp !== '') {
    body.set('remoteip', remoteIp);
  }
  let data: SiteVerifyResponse;
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    data = (await res.json()) as SiteVerifyResponse;
  } catch {
    return { ok: true, suspicious: false, score: null, reason: 'verify_unreachable' };
  }
  if (data.success !== true) {
    const codes = data['error-codes'];
    return {
      ok: false,
      suspicious: false,
      score: null,
      reason: codes ? codes.join(',') : 'rejected'
    };
  }
  const score = typeof data.score === 'number' ? data.score : null;
  if (score !== null && score < getThreshold()) {
    return { ok: true, suspicious: true, score, reason: 'low_score' };
  }
  return { ok: true, suspicious: false, score, reason: 'ok' };
}
