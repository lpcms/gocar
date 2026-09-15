import { getTranslation } from './translations';
import { getSetting } from './settings';
import { getMediaAlt } from './media-alt';
import type { Locale } from './site-nav';
import { getRecaptchaSiteKey, RECAPTCHA_FORMS } from './recaptcha';

/** One card of the "Our Contact" column. */
export type ContactEntry = {
  /** Which entry this is, so the markup can key and style it. */
  kind: 'phone' | 'email' | 'location' | 'hours';
  label: string;
  value: string;
  /** Empty for the opening hours, which are not a link. */
  href: string;
};

/** Everything the contact page renders, resolved for one locale. */
export type ContactData = {
  entries: ContactEntry[];
  /** Embed URL of the map in this locale, empty when nothing is configured. */
  mapSrc: string;
  texts: Record<string, string>;
  heroAlt: string;
  recaptchaSiteKey: string;
};

/** Picture of the page hero, shipped with the render. */
export const HERO = '/images/site/contact-hero.jpg';

/** Every visible string of the page, by the field the components read. */
const TEXT_KEYS: [string, string, string][] = [
  ['title', 'contact.title', 'Get in Touch with Us'],
  ['formTitle', 'contact.form_title', 'Book a car'],
  [
    'formText',
    'contact.form_text',
    "We'd love to hear from you! If you have any questions, comments, or feedback, please use the form below to send us a message."
  ],
  ['namePlaceholder', 'contact.name_placeholder', 'Enter your name'],
  ['emailPlaceholder', 'contact.email_placeholder', 'Enter your email'],
  ['messagePlaceholder', 'contact.message_placeholder', 'Write a message...'],
  ['submit', 'contact.submit', 'Submit'],
  ['stateRequired', 'contact.state_required', 'Fill in your name, email and message'],
  ['stateEmail', 'contact.state_email', 'Check the email address'],
  ['stateSending', 'contact.state_sending', 'Sending…'],
  ['stateSent', 'contact.state_sent', 'Sent ✓'],
  ['stateError', 'contact.state_error', 'Error, try again'],
  ['contactsTitle', 'contact.contacts_title', 'Our Contact'],
  ['mapTitle', 'contact.map_title', 'How to find our car rental office in Uzhhorod'],
  ['mapText', 'contact.map_text', ''],
  ['mapFrameTitle', 'contact.map_frame_title', 'GoCar office on Google Maps'],
  ['ctaKicker', 'contact.cta_kicker', 'Find Your Perfect Ride'],
  ['ctaHeading', 'contact.cta_heading', 'Explore Our Fleet and Book Your Dream Car Today!'],
  ['ctaButton', 'contact.cta_button', "Let's Drive with Us"],
  ['modalTitle', 'contact.modal_title', 'Thank you, your contact is confirmed!'],
  ['modalSub', 'contact.modal_sub', 'A manager will contact you within 24 hours.'],
  ['close', 'menu.close', 'Close']
];

/**
 * Decode the HTML entities that appear in a pasted iframe's src (chiefly
 * &amp;), so the raw URL Google expects is restored.
 */
function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Extract a usable embed URL from a map setting, which the admin may paste
 * either as a whole <iframe> tag or as the bare URL from "Share -> Embed a
 * map". Anything that is not an http(s) URL is dropped: the value ends up in
 * a src attribute, and only Google's embed is meant to land there.
 */
export function mapEmbedSrc(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  const tag = trimmed.match(/src\s*=\s*"([^"]+)"/i);
  const captured = tag !== null ? (tag[1] ?? '') : '';
  const url = decodeEntities(captured !== '' ? captured : trimmed);
  return /^https?:\/\//i.test(url) ? url : '';
}

/**
 * Everything the contact page needs, in one read: the contact details and the
 * opening hours from settings, the map embed of this locale, every visible
 * string and the reCAPTCHA site key. The form island receives this as plain
 * props and never touches the database itself (plan section 4.2).
 *
 * The map has one field per locale (google_maps_iframe for English,
 * google_maps_iframe_ua for Ukrainian); an empty Ukrainian field falls back to
 * the English embed rather than leaving a hole in the page.
 */
export function getContactData(locale: Locale): ContactData {
  const texts: Record<string, string> = {};
  for (const [field, key, fallback] of TEXT_KEYS) {
    texts[field] = getTranslation(key, locale, fallback);
  }

  const phone = (getSetting('contact_phone', '') ?? '').trim();
  const email = (getSetting('contact_email', '') ?? '').trim();
  /** The address has separate EN/UA values; UA falls back to EN when empty. */
  const locationEn = (getSetting('google_maps_key', '') ?? '').trim();
  const locationUa = (getSetting('contact_whatsapp', '') ?? '').trim();
  const location = locale === 'ua' && locationUa !== '' ? locationUa : locationEn;
  const hours = (
    getSetting(locale === 'ua' ? 'work_hours_ua' : 'work_hours_en', '') ?? ''
  ).trim();

  /** Label of an entry, so every card keeps its own translation key. */
  const label = (kind: ContactEntry['kind'], fallback: string): string =>
    getTranslation(`contact.label_${kind}`, locale, fallback);

  const entries: ContactEntry[] = [];
  if (phone !== '') {
    entries.push({
      kind: 'phone',
      label: label('phone', 'Phone'),
      value: phone,
      href: `tel:${phone.replace(/[^\d+]/g, '')}`
    });
  }
  if (email !== '') {
    entries.push({
      kind: 'email',
      label: label('email', 'Email'),
      value: email,
      href: `mailto:${email}`
    });
  }
  if (location !== '') {
    entries.push({
      kind: 'location',
      label: label('location', 'Location'),
      value: location,
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
    });
  }
  if (hours !== '') {
    entries.push({
      kind: 'hours',
      label: label('hours', 'Working hours'),
      value: hours,
      href: ''
    });
  }

  const rawEn = getSetting('google_maps_iframe', '') ?? '';
  const rawUa = getSetting('google_maps_iframe_ua', '') ?? '';
  const localised = locale === 'ua' ? mapEmbedSrc(rawUa) : '';

  return {
    entries,
    mapSrc: localised !== '' ? localised : mapEmbedSrc(rawEn),
    texts,
    heroAlt: getMediaAlt(HERO, locale),
    /**
     * Through the shared helper, not the raw setting: it applies the rule
     * that both keys must be present and honours the local off-switch.
     */
    recaptchaSiteKey: getRecaptchaSiteKey(RECAPTCHA_FORMS)
  };
}
