import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getSetting, setSetting } from '@/lib/settings';

/**
 * Complete settings snapshot for the admin panel form. Keys are grouped
 * on the client into sections; the API is a flat key/value map.
 */
const KEYS: Array<[string, string]> = [
  ['default_locale', 'en'],
  ['ga_id', ''],
  ['gtm_id', ''],
  ['fb_pixel_id', ''],
  ['recaptcha_site_key', ''],
  ['recaptcha_secret_key', ''],
  /** Reject submissions scoring below this (0..1); empty falls back to 0.5. */
  ['recaptcha_score_threshold', '0.5'],
  ['telegram_bot_token', ''],
  ['telegram_chat_id', ''],
  ['lockout_attempts', '5'],
  ['lockout_minutes', '15'],
  /** Days of login_attempts history to keep; 0 keeps the journal for ever. */
  ['login_attempts_keep_days', '30'],
  ['image_max_width', '1600'],
  ['image_quality', '82'],
  ['car_image_max_width', '1200'],
  ['car_image_max_height', '900'],
  ['car_preview_max_width', '800'],
  ['car_preview_max_height', '600'],
  ['robots_txt', 'User-agent: *\nAllow: /\n'],
  ['site_domain', ''],
  ['site_name', 'GoCar'],
  ['favicon_url', ''],
  ['og_image_default', ''],
  ['contact_phone', ''],
  ['contact_email', ''],
  ['contact_telegram', ''],
  ['contact_whatsapp', ''],
  ['contact_viber', ''],
  /**
   * Messenger links shown in the footer. Whatsapp needs its own key because
   * contact_whatsapp holds the Ukrainian address ("Location UA").
   */
  ['contact_instagram', ''],
  ['contact_whatsapp_url', ''],
  ['google_maps_key', ''],
  /** Map embed of the contact page, one field per locale. */
  ['google_maps_iframe', ''],
  ['google_maps_iframe_ua', ''],
  /** Opening hours, shown in the footer under the address. */
  ['work_hours_en', ''],
  ['work_hours_ua', ''],
  /** "lat, lng" of the office; feeds the GeoCoordinates of the JSON-LD. */
  ['contact_geo', ''],
  ['seo_title_en', ''],
  ['seo_title_ua', ''],
  ['seo_description_en', ''],
  ['seo_description_ua', '']
];

/**
 * Fields that must not leak on GET (write-only). Presence flag is
 * returned so the UI can show "***** stored" instead of an empty box.
 */
const SECRETS = new Set(['telegram_bot_token', 'recaptcha_secret_key']);

export async function GET(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const values: Record<string, string> = {};
  const stored: Record<string, boolean> = {};
  for (const [key, fallback] of KEYS) {
    const raw = getSetting(key, fallback) ?? '';
    if (SECRETS.has(key)) {
      stored[key] = raw !== '';
      values[key] = '';
    } else {
      values[key] = raw;
    }
  }
  return NextResponse.json({ ok: true, values, stored });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  for (const [key] of KEYS) {
    if (body[key] === undefined) continue;
    const value = String(body[key]);
    /**
     * Secret fields keep their previous value when the payload is empty
     * so the UI (which always sends an empty box) doesn't wipe them out.
     */
    if (SECRETS.has(key) && value === '') continue;
    setSetting(key, value);
  }
  return NextResponse.json({ ok: true });
}
