import { getDb } from './db';
import { getTranslation } from './translations';
import { LOCALE_PREFIX } from './site-nav';

/**
 * Footer link columns, rendered from the database.
 *
 * The snapshot ships three fixed columns (Quick Link with four hand-picked
 * pages, "Our Fleet" with a single Cars link, and a "Message us" column whose
 * links still point at the template author's social accounts). All three are
 * replaced here by columns built from admin data:
 *
 *   - Quick Link  - the same six menu.* items as the header;
 *   - Our Fleet   - the categories, in their admin order, linking to the
 *                   /cars filter anchors;
 *   - Contacts    - phone, e-mail and address from Настройки.
 *
 * The original block is hidden with CSS rather than removed, and our own
 * block is inserted next to it: the footer is Framer markup that the runtime
 * repaints after hydration, so replacing nodes inside it would either break
 * hydration or be undone. Our block is unknown to the runtime and therefore
 * left alone - the same approach the fleet and cars grids use.
 */

/**
 * One link of a footer column.
 */
interface FooterLink {
  href: string;
  label: string;
}

/**
 * Everything the footer needs, already localized.
 */
export interface FooterMenuData {
  quickHeading: string;
  quickLinks: FooterLink[];
  fleetHeading: string;
  fleetLinks: FooterLink[];
  contactsHeading: string;
  phone: string;
  email: string;
  address: string;
  workHours: string;
  socials: SocialLink[];
}

/**
 * One messenger/social icon of the contacts column.
 */
interface SocialLink {
  /** Sprite symbol id suffix, also used as the accessible name. */
  icon: 'telegram' | 'viber' | 'instagram' | 'whatsapp';
  label: string;
  href: string;
}

/**
 * The messenger links, in the order they are shown, with the settings key
 * each one reads.
 *
 * The Whatsapp link needs its own key: `contact_whatsapp` was repurposed long
 * ago as the Ukrainian address ("Location UA" in Настройки) and the contact
 * page still reads it as such, so taking it back would break that page.
 */
const SOCIALS: Array<{ icon: SocialLink['icon']; label: string; key: string }> = [
  { icon: 'telegram', label: 'Telegram', key: 'contact_telegram' },
  { icon: 'viber', label: 'Viber', key: 'contact_viber' },
  { icon: 'instagram', label: 'Instagram', key: 'contact_instagram' },
  { icon: 'whatsapp', label: 'WhatsApp', key: 'contact_whatsapp_url' }
];

/**
 * Menu keys in the order they appear in the header, with the path each one
 * points at. The locale prefix is added when rendering.
 */
const MENU_ITEMS: Array<{ key: string; path: string; fallback: string }> = [
  { key: 'menu.home', path: '', fallback: 'Home' },
  { key: 'menu.cars', path: 'cars', fallback: 'Cars' },
  { key: 'menu.book', path: 'book', fallback: 'Book' },
  { key: 'menu.faq', path: 'faq', fallback: 'FAQ' },
  { key: 'menu.about', path: 'about-us', fallback: 'About us' },
  { key: 'menu.contact', path: 'contact', fallback: 'Contact' }
];

/**
 * Read one settings value, or '' when unset.
 */
function getSetting(key: string): string {
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as unknown as { value: string | null } | undefined;
  return row && row.value !== null ? row.value.trim() : '';
}

/**
 * Collect the footer content for a locale. Categories keep the admin order
 * (categories.sort_order), matching the rest of the site.
 */
export function getFooterMenuData(locale: 'en' | 'ua'): FooterMenuData {
  const prefix = LOCALE_PREFIX[locale];
  const quickLinks = MENU_ITEMS.map((item) => ({
    href: item.path === '' ? `${prefix}/` : `${prefix}/${item.path}`,
    label: getTranslation(item.key, locale, item.fallback)
  }));

  const rows = getDb()
    .prepare(
      `SELECT c.slug AS slug, COALESCE(NULLIF(t.name, ''), c.slug) AS label
       FROM categories c
       LEFT JOIN category_translations t ON t.category_id = c.id AND t.locale = ?
       ORDER BY c.sort_order, c.id`
    )
    .all(locale) as unknown as Array<{ slug: string; label: string }>;
  const fleetLinks = rows.map((row) => ({
    href: `${prefix}/cars#${row.slug}`,
    label: row.label
  }));

  /**
   * The address has separate EN/UA values in Настройки (Location EN /
   * Location UA), the same pair the contact page uses.
   */
  const addressEn = getSetting('google_maps_key');
  const addressUa = getSetting('contact_whatsapp');
  const address = locale === 'ua' && addressUa !== '' ? addressUa : addressEn;

  /**
   * Opening hours, kept per locale in Настройки the same way the address is.
   * Empty in either locale simply hides the row.
   */
  const hoursEn = getSetting('work_hours_en');
  const hoursUa = getSetting('work_hours_ua');
  const workHours = locale === 'ua' && hoursUa !== '' ? hoursUa : hoursEn;

  return {
    quickHeading: getTranslation(
      'footer.quick_links',
      locale,
      locale === 'ua' ? 'Швидкі посилання' : 'Quick Link'
    ),
    quickLinks,
    fleetHeading: getTranslation(
      'footer.our_fleet',
      locale,
      locale === 'ua' ? 'Наш автопарк' : 'Our Fleet'
    ),
    fleetLinks,
    contactsHeading: getTranslation(
      'footer.contacts',
      locale,
      locale === 'ua' ? 'Контакти' : 'Contacts'
    ),
    phone: getSetting('contact_phone'),
    email: getSetting('contact_email'),
    address,
    workHours,
    /** Only the messengers that actually have a link configured. */
    socials: SOCIALS.map((entry) => ({
      icon: entry.icon,
      label: entry.label,
      href: getSetting(entry.key)
    })).filter((entry) => entry.href !== '')
  };
}

/**
 * Escape a value for safe insertion into an HTML text node or attribute.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Phone href: a leading '+' plus digits, as the header link builds it.
 */
function telHref(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return digits === '' ? '' : `tel:+${digits}`;
}

/**
 * Line icons for the contacts column, drawn in the current text colour so
 * they follow the link's hover state. Sized to the 16px label.
 */
const ICONS: Record<'phone' | 'mail' | 'pin', string> = {
  phone:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.2-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.7 2Z"/></svg>',
  mail:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>',
  pin:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'
};

/**
 * Messenger icons, defined once per page as a hidden sprite and referenced
 * with <use> from every copy of the footer block.
 *
 * Telegram, WhatsApp and Instagram carry the exact geometry of the icons the
 * snapshot ships in its hidden "LogoString" block - that block only exists on
 * the home page, so the shapes are lifted here to be available site-wide.
 * Viber is drawn to match: same 24x24 grid, same outline weight. All four
 * keep the original's CSS variables, so a single colour on the link drives
 * the whole set.
 */
const SOCIAL_SPRITE =
  '<svg id="gocar-social-sprite" aria-hidden="true" style="position:absolute;width:0;height:0;' +
  'overflow:hidden">' +
  '<symbol id="gocar-icon-telegram" viewBox="0 0 24 24">' +
  '<path d="M 5.999 9.643 L 19.444 0.007 C 19.421 -0.002 19.394 -0.002 19.371 0.007 L 0.374 7.441 C 0.132 7.534 -0.02 7.776 0.002 8.035 C 0.024 8.293 0.214 8.507 0.468 8.558 L 5.999 9.643" fill-opacity="var(--1m6trwb, 0)" fill="var(--21h8s6, currentColor)" transform="translate(1.501 3.001)"/>' +
  '<path d="M 5.999 9.644 L 14.461 17.062 C 14.659 17.237 14.935 17.295 15.187 17.214 C 15.439 17.133 15.629 16.925 15.688 16.668 L 19.499 0.114 C 19.507 0.08 19.495 0.045 19.469 0.023 C 19.443 0 19.406 -0.006 19.374 0.006 L 0.374 7.442 C 0.132 7.535 -0.02 7.777 0.002 8.036 C 0.024 8.294 0.214 8.508 0.468 8.559 Z" fill="transparent" stroke-linecap="round" stroke-linejoin="round" stroke-width="var(--pgex8v, 1.5)" stroke="var(--21h8s6, currentColor)" transform="translate(1.501 3)"/>' +
  '<path d="M 0 9.636 L 13.445 0" fill="transparent" stroke-linecap="round" stroke-linejoin="round" stroke-width="var(--pgex8v, 1.5)" stroke="var(--21h8s6, currentColor)" transform="translate(7.5 3.008)"/>' +
  '<path d="M 4.16 3.648 L 1.29 6.625 C 1.078 6.845 0.753 6.915 0.47 6.801 C 0.186 6.686 0 6.412 0 6.106 L 0 0" fill="transparent" stroke-linecap="round" stroke-linejoin="round" stroke-width="var(--pgex8v, 1.5)" stroke="var(--21h8s6, currentColor)" transform="translate(7.5 12.644)"/>' +
  '</symbol>' +
  /**
   * WhatsApp and Viber use the artwork supplied by the client (Streamline
   * "Whatsapp Line" and the official Viber mark), kept at their own viewBox
   * and recoloured to currentColor so they follow the link like the rest.
   */
  '<symbol id="gocar-icon-whatsapp" viewBox="0 0 16 16">' +
  '<path fill="currentColor" d="m4.8357399999999995 12.3296 0.4831533333333333 0.2817333333333333C6.12606 13.082 7.043399999999999 13.333333333333332 8.000666666666666 13.333333333333332c2.9455333333333336 0 5.333333333333333 -2.3878 5.333333333333333 -5.333333333333333 0 -2.94552 -2.3878 -5.333333333333333 -5.333333333333333 -5.333333333333333s-5.333346666666666 2.387813333333333 -5.333346666666666 5.333333333333333c0 0.9575333333333332 0.25148666666666664 1.8752 0.7224533333333333 2.6825333333333328l0.28158666666666665 0.48266666666666663 -0.43566 1.6010666666666666 1.60004 -0.43666666666666665ZM1.3367733333333334 14.666666666666666l0.9013066666666667 -3.312333333333333C1.6632933333333333 10.369066666666665 1.3339866666666667 9.222999999999999 1.3339866666666667 8c0 -3.6818999999999997 2.9847666666666663 -6.666666666666666 6.6666799999999995 -6.666666666666666 3.6818666666666666 0 6.666666666666666 2.9847666666666663 6.666666666666666 6.666666666666666 0 3.6818666666666666 -2.9848 6.666666666666666 -6.666666666666666 6.666666666666666 -1.2226 0 -2.3683266666666665 -0.3290666666666666 -3.3534266666666666 -0.9035333333333333L1.3367733333333334 14.666666666666666ZM5.59488 4.8722199999999996c0.08925333333333332 -0.006273333333333333 0.17880666666666667 -0.007233333333333333 0.26818 -0.0028733333333333328 0.03610666666666666 0.002373333333333333 0.07203999999999999 0.006546666666666667 0.108 0.010699999999999998 0.10617333333333334 0.01226 0.22292666666666666 0.07691999999999999 0.26217999999999997 0.16591333333333333 0.19887999999999997 0.45094666666666666 0.3918533333333333 0.9044733333333334 0.5788933333333333 1.36046 0.04126666666666666 0.10066 0.016399999999999998 0.23113333333333333 -0.06213333333333333 0.35738000000000003 -0.03986666666666666 0.06473333333333334 -0.10247999999999999 0.15553333333333333 -0.1750133333333333 0.24839999999999998 -0.07539333333333333 0.09646666666666666 -0.23765999999999998 0.27386666666666665 -0.23765999999999998 0.27386666666666665s-0.06573999999999999 0.0788 -0.040959999999999996 0.17686666666666664c0.009653333333333333 0.037066666666666664 0.04044 0.09106666666666666 0.06835333333333332 0.13646666666666665 0.015459999999999998 0.02513333333333333 0.029813333333333334 0.0476 0.039126666666666664 0.06313333333333333 0.1706133333333333 0.28486666666666666 0.39995333333333327 0.5736666666666667 0.6800866666666666 0.8452 0.08026666666666665 0.0778 0.15813333333333332 0.1572 0.24186666666666667 0.23093333333333332 0.3122 0.27526666666666666 0.6654 0.5002 1.0468666666666666 0.6668l0.0034000000000000002 0.0015333333333333332c0.05633333333333333 0.024266666666666666 0.08526666666666667 0.037533333333333335 0.16773333333333332 0.07253333333333332 0.0416 0.017599999999999998 0.08413333333333334 0.032799999999999996 0.1278 0.044333333333333336 0.015799999999999998 0.004133333333333333 0.032 0.006466666666666667 0.048266666666666666 0.0076 0.1078 0.006466666666666667 0.1701333333333333 -0.06266666666666666 0.19673333333333332 -0.09446666666666666 0.48233333333333334 -0.5843333333333333 0.5264666666666666 -0.6224666666666666 0.5297999999999999 -0.6222v0.0010666666666666667c0.0634 -0.0668 0.16306666666666667 -0.09 0.252 -0.08453333333333332 0.0406 0.0024666666666666665 0.08099999999999999 0.010266666666666667 0.11793333333333333 0.027133333333333332 0.35453333333333337 0.16173333333333334 0.9341999999999999 0.414 0.9341999999999999 0.414l0.38766666666666666 0.17426666666666668c0.06493333333333333 0.03133333333333333 0.12419999999999999 0.10513333333333333 0.12706666666666666 0.17686666666666664 0.0017333333333333333 0.0446 0.006533333333333333 0.1166 -0.009399999999999999 0.24833333333333332 -0.020866666666666665 0.17246666666666666 -0.07333333333333333 0.3801333333333333 -0.12546666666666667 0.48893333333333333 -0.03666666666666667 0.07633333333333334 -0.08413333333333334 0.14406666666666665 -0.1393333333333333 0.20139999999999997 -0.07486666666666666 0.07773333333333332 -0.13046666666666668 0.12493333333333334 -0.22046666666666664 0.19199999999999998 -0.054799999999999995 0.040799999999999996 -0.0832 0.06 -0.0832 0.06 -0.09259999999999999 0.058399999999999994 -0.14479999999999998 0.08759999999999998 -0.2551333333333333 0.14633333333333332 -0.1716 0.0914 -0.36119999999999997 0.14393333333333333 -0.5553999999999999 0.1539333333333333 -0.1238 0.006333333333333333 -0.24726666666666666 0.015266666666666666 -0.37093333333333334 0.0086 -0.0054666666666666665 -0.0003333333333333333 -0.3788 -0.05766666666666666 -0.3788 -0.05766666666666666 -0.9479333333333333 -0.24933333333333332 -1.8245999999999998 -0.7163999999999999 -2.56024 -1.3641333333333332 -0.15040666666666666 -0.1324 -0.28989333333333334 -0.2756666666666666 -0.43226666666666663 -0.4174 -0.5927066666666666 -0.5900666666666666 -1.0414133333333333 -1.2263333333333333 -1.3135 -1.8282 -0.1341733333333333 -0.29679999999999995 -0.21913333333333332 -0.6146666666666667 -0.22047333333333333 -0.9417466666666666 -0.00246 -0.40462 0.13000666666666666 -0.79852 0.3764733333333333 -1.1194133333333331 0.04858666666666667 -0.06326 0.0947 -0.12887333333333334 0.17426666666666668 -0.204 0.08426 -0.07956666666666666 0.13788666666666666 -0.12228 0.19565333333333335 -0.15183333333333332 0.077 -0.03939333333333333 0.16157333333333332 -0.06046 0.24783333333333335 -0.06652Z"/>' +
  '</symbol>' +
  '<symbol id="gocar-icon-instagram" viewBox="0 0 24 24">' +
  '<path d="M 4.5 18 C 2.015 18 0 15.985 0 13.5 L 0 4.5 C 0 2.015 2.015 0 4.5 0 L 13.5 0 C 15.985 0 18 2.015 18 4.5 L 18 13.5 C 18 15.985 15.985 18 13.5 18 Z" fill="transparent" stroke-linecap="round" stroke-linejoin="round" stroke-width="var(--pgex8v, 1.5)" stroke="var(--21h8s6, currentColor)" transform="translate(3 3)"/>' +
  '<path d="M 0 3.75 C 0 1.679 1.679 0 3.75 0 C 5.821 0 7.5 1.679 7.5 3.75 C 7.5 5.821 5.821 7.5 3.75 7.5 C 1.679 7.5 0 5.821 0 3.75 Z" fill="transparent" stroke-width="var(--pgex8v, 1.5)" stroke="var(--21h8s6, currentColor)" transform="translate(8.25 8.25)"/>' +
  '<path d="M 0 1.125 C 0 0.504 0.504 0 1.125 0 C 1.746 0 2.25 0.504 2.25 1.125 C 2.25 1.746 1.746 2.25 1.125 2.25 C 0.504 2.25 0 1.746 0 1.125 Z" fill="var(--21h8s6, currentColor)" transform="translate(15.75 6)"/>' +
  '</symbol>' +
  /**
   * The source file offsets its artwork with a group transform; the same
   * shift is expressed here by starting the viewBox at that origin, which
   * keeps the geometry untouched and the markup free of a transform.
   */
  '<symbol id="gocar-icon-viber" viewBox="429.26705 345.04681 72.214497 76.209872">' +
  '<g fill="currentColor" stroke="currentColor">' +
  '<path d="m 493.4,352.5 c -1.9,-1.7 -9.5,-7.3 -26.6,-7.4 0,0 -20.1,-1.2 -29.9,7.8 -5.5,5.5 -7.4,13.4 -7.6,23.3 -0.2,9.9 -0.5,28.4 17.4,33.5 v 7.7 c 0,0 -0.1,3.1 1.9,3.7 2.5,0.8 3.9,-1.6 6.3,-4.1 1.3,-1.4 3.1,-3.4 4.4,-5 12.2,1 21.6,-1.3 22.7,-1.7 2.5,-0.8 16.4,-2.6 18.7,-21.1 2.4,-19.2 -1,-31.3 -7.3,-36.7 z m 2.1,35.2 c -1.9,15.5 -13.2,16.5 -15.3,17.1 -0.9,0.3 -9.1,2.3 -19.5,1.7 0,0 -7.7,9.3 -10.2,11.8 -0.4,0.4 -0.8,0.5 -1.1,0.5 -0.4,-0.1 -0.5,-0.6 -0.5,-1.3 0,-1 0.1,-12.8 0.1,-12.8 -15.1,-4.2 -14.2,-20 -14.1,-28.3 0.2,-8.3 1.7,-15 6.3,-19.6 8.3,-7.5 25.4,-6.4 25.4,-6.4 14.4,0.1 21.3,4.4 22.9,5.9 5.2,4.6 7.9,15.5 6,31.4 z" stroke="none"/>' +
  '<path d="m 473.8,375.8 c -0.2,-3.8 -2.1,-5.8 -5.8,-6" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.927"/>' +
  '<path d="m 478.8,377.4 c 0.1,-3.5 -1,-6.5 -3.1,-8.8 -2.2,-2.4 -5.2,-3.7 -9,-4" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.927"/>' +
  '<path d="m 483.8,379.4 c 0,-6.1 -1.9,-10.9 -5.5,-14.4 -3.6,-3.5 -8.1,-5.3 -13.5,-5.3" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.927"/>' +
  '<path d="m 468.2,388.7 c 0,0 1.4,0.1 2.1,-0.8 l 1.4,-1.8 c 0.7,-0.9 2.3,-1.5 4,-0.6 0.9,0.5 2.5,1.5 3.5,2.3 1.1,0.8 3.3,2.6 3.3,2.6 1.1,0.9 1.3,2.2 0.6,3.6 -0.7,1.3 -1.7,2.5 -3,3.6 -1,0.9 -2,1.3 -3,1.5 h -0.4 c -0.4,0 -0.9,-0.1 -1.3,-0.2 -1.5,-0.4 -4,-1.5 -8.3,-3.8 -2.7,-1.5 -5,-3.1 -6.9,-4.6 -1,-0.8 -2.1,-1.7 -3.1,-2.8 l -0.4,-0.4 c -1.1,-1.1 -2,-2.1 -2.8,-3.1 -1.5,-1.9 -3.1,-4.2 -4.6,-6.9 -2.3,-4.2 -3.4,-6.7 -3.8,-8.3 -0.1,-0.4 -0.2,-0.8 -0.2,-1.3 v -0.4 c 0.1,-1 0.6,-2 1.5,-3 1.1,-1.2 2.3,-2.2 3.6,-3 1.4,-0.7 2.7,-0.5 3.6,0.6 0,0 1.8,2.2 2.6,3.3 0.7,1 1.7,2.6 2.3,3.5 0.9,1.6 0.3,3.3 -0.5,4 l -1.8,1.4 c -0.9,0.7 -0.8,2.1 -0.8,2.1 0,0 2.5,9.9 12.4,12.5 z" stroke="none"/>' +
  '</g></symbol>' +
  '</svg>';

/**
 * Text presets taken from the snapshot's own footer, so the new columns
 * inherit the site's typography instead of restating it: the column heading
 * is the 20/28 bold preset, the links the 16/22 medium one.
 */
const HEADING_CLASS = 'framer-text framer-styles-preset-1914n6i';
const LABEL_CLASS = 'framer-text framer-styles-preset-6b67tz';

/**
 * Render one link column.
 */
function renderColumn(heading: string, links: FooterLink[]): string {
  const items = links
    .map(
      (link) =>
        `<li><a class="gocar-footer-link ${LABEL_CLASS}" href="${esc(link.href)}">` +
        `${esc(link.label)}</a></li>`
    )
    .join('');
  return (
    '<div class="gocar-footer-col">' +
    `<h3 class="${HEADING_CLASS}">${esc(heading)}</h3>` +
    `<ul class="gocar-footer-list">${items}</ul>` +
    '</div>'
  );
}

/**
 * Render the contacts column: phone and e-mail as actionable links, the
 * address as plain text. Empty settings are skipped rather than rendered as
 * blank rows.
 */
function renderContacts(data: FooterMenuData): string {
  const rows: string[] = [];
  const tel = telHref(data.phone);
  if (data.phone !== '' && tel !== '') {
    rows.push(
      `<li><a class="gocar-footer-link ${LABEL_CLASS}" href="${esc(tel)}">` +
        `${ICONS.phone}<span>${esc(data.phone)}</span></a></li>`
    );
  }
  if (data.email !== '') {
    rows.push(
      `<li><a class="gocar-footer-link ${LABEL_CLASS}" href="mailto:${esc(data.email)}">` +
        `${ICONS.mail}<span>${esc(data.email)}</span></a></li>`
    );
  }
  if (data.address !== '') {
    rows.push(
      `<li><span class="gocar-footer-line ${LABEL_CLASS}">` +
        `${ICONS.pin}<span>${esc(data.address)}</span></span></li>`
    );
  }
  /**
   * Messenger icons sit under the address, on one line. Each is a link with
   * its own accessible name, since the glyph alone says nothing to a screen
   * reader.
   */
  if (data.socials.length > 0) {
    const icons = data.socials
      .map(
        (social) =>
          `<a class="gocar-footer-social" data-icon="${social.icon}" href="${esc(social.href)}" ` +
          `aria-label="${esc(social.label)}" target="_blank" rel="noopener">` +
          `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">` +
          `<use href="#gocar-icon-${social.icon}"/></svg></a>`
      )
      .join('');
    rows.push(`<li><span class="gocar-footer-socials">${icons}</span></li>`);
  }
  if (rows.length === 0) return '';
  return (
    '<div class="gocar-footer-col">' +
    `<h3 class="${HEADING_CLASS}">${esc(data.contactsHeading)}</h3>` +
    `<ul class="gocar-footer-list">${rows.join('')}</ul>` +
    '</div>'
  );
}

/**
 * Styles for the new block. The layout mirrors the snapshot's own footer
 * (70px between columns, 19px under the heading, 12px between links) and
 * collapses to a single column on phones.
 */
const FOOTER_CSS =
  '<style id="gocar-footer-css">' +
  '.framer-1el4j4z{display:none !important;}' +
  /**
   * The snapshot gives the footer and its containers a fixed height, sized
   * for four links in the first column. Six links plus the contacts column
   * are taller, and the copyright line was pushed outside the footer's box.
   * Letting the chain size to its content keeps the layout intact at every
   * width; the background layer is stretched between its own top/bottom
   * offsets instead of its baked-in height.
   */
  'footer{height:auto !important;}' +
  'footer .framer-1n37sy1,footer .framer-1qey7qh,footer .framer-6kxhmt' +
  '{height:auto !important;}' +
  /**
   * The background panel is anchored to the footer's bottom and its height
   * is baked in (footer height plus the 181px it reaches above the footer,
   * behind the CTA). Expressing it relative to the footer keeps that overlap
   * while following the new height.
   */
  'footer .framer-18e1jbx{top:auto !important;bottom:0 !important;' +
  'height:calc(100% + 181px) !important;}' +
  /**
   * The column group is centred in the footer, matching the copyright line
   * below it; the columns themselves stay left-aligned inside the group.
   */
  '.gocar-footer{display:flex;flex-wrap:wrap;gap:40px 70px;align-items:flex-start;' +
  'justify-content:center;width:100%;align-self:stretch;}' +
  '.gocar-footer-col{display:flex;flex-direction:column;gap:19px;min-width:160px;}' +
  '.gocar-footer-col h3{margin:0;}' +
  '.gocar-footer-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px;}' +
  '.gocar-footer-link,.gocar-footer-line{display:flex;align-items:flex-start;gap:8px;' +
  'color:var(--token-932a71f5-0629-44d7-81bf-ee4e6b1506fb,#222);text-decoration:none;}' +
  /**
   * The lane belongs to every row of every column - links, the address line
   * and the messenger row alike. Giving it only to the links left the
   * address icon and the icons under it standing 12px to the left of the
   * phone and e-mail above them.
   */
  '.gocar-footer-list > li > *{padding-left:12px;position:relative;}' +
  /**
   * Framer ships link presets keyed on `a.framer-text` (specificity 0-2-1)
   * and its `:hover` twin resets both `padding` and `color` to the preset
   * defaults. Our links carry `framer-text` to inherit the site typography,
   * so on hover the 12px lane collapsed and the label jumped 12px left.
   * Every declaration that has to survive a hover is therefore written at
   * `.gocar-footer .gocar-footer-list > li > a.gocar-footer-link` (0-3-1),
   * which outranks the preset in both states without !important.
   */
  '.gocar-footer .gocar-footer-list > li > a.gocar-footer-link,' +
  '.gocar-footer .gocar-footer-list > li > a.gocar-footer-link:hover' +
  '{padding-left:12px;color:var(--token-932a71f5-0629-44d7-81bf-ee4e6b1506fb,#222);}' +
  /**
   * Hover and current page are marked the way the header marks its own
   * items: a red dot in front of the label, the label itself untouched
   * (heavier only on the current page). The dot lives in the lane every row
   * reserves and only fades in, so neither hovering nor changing page ever
   * shifts the column sideways.
   */
  '.gocar-footer-list > li > a.gocar-footer-link::before{content:"";position:absolute;' +
  'left:0;top:50%;width:4px;height:4px;margin-top:-2px;border-radius:50%;' +
  'background:var(--token-b959d9dc-4bb0-456b-b29a-7ea9bf2057bd,#fd3b3b);' +
  'opacity:0;transition:opacity 0.2s ease;}' +
  '.gocar-footer-list > li > a.gocar-footer-link:hover::before,' +
  '.gocar-footer-list > li > a.gocar-footer-link[aria-current="page"]::before{opacity:1;}' +
  '.gocar-footer .gocar-footer-list > li > a.gocar-footer-link[aria-current="page"]' +
  '{font-weight:500;}' +
  '.gocar-footer-link svg,.gocar-footer-line svg{flex:0 0 auto;margin-top:2px;}' +
  /**
   * Messenger icons: one row that never wraps, drawn in the brand colour the
   * snapshot uses for them.
   */
  '.gocar-footer-socials{display:flex;flex-wrap:nowrap;align-items:center;gap:14px;' +
  'margin-top:4px;}' +
  '.gocar-footer-social{display:inline-flex;flex:0 0 auto;' +
  'color:var(--token-b959d9dc-4bb0-456b-b29a-7ea9bf2057bd,#fd3b3b);' +
  '--21h8s6:currentColor;--1m6trwb:0;--pgex8v:1.5;transition:opacity 0.2s ease;}' +
  '.gocar-footer-social:hover{opacity:0.7;}' +
  /**
   * The four marks come from different sources and carry different amounts
   * of padding inside their viewBox, so an equal box draws unequal glyphs:
   * at 34px the artwork measured 27.6 / 34.0 / 25.5 / 28.3px. Each box is
   * therefore sized to land on the same ~26.9px glyph - the average of the
   * Instagram and WhatsApp marks, which are the reference here.
   */
  '.gocar-footer-social svg{display:block;width:34px;height:34px;}' +
  '.gocar-footer-social[data-icon="telegram"] svg{width:33px;height:33px;}' +
  '.gocar-footer-social[data-icon="viber"] svg{width:27px;height:27px;}' +
  '.gocar-footer-social[data-icon="instagram"] svg{width:36px;height:36px;}' +
  '.gocar-footer-social[data-icon="whatsapp"] svg{width:32px;height:32px;}' +
  '.gocar-footer-col:last-child{max-width:280px;}' +
  '@media (max-width:809px){.gocar-footer{gap:32px;flex-direction:column;}' +
  '.gocar-footer-col,.gocar-footer-col:last-child{width:100%;max-width:none;}}' +
  '</style>';

/**
 * Insert the rebuilt footer columns.
 *
 * The block is rendered twice on purpose. The copy placed before each of the
 * snapshot's own column rows (one per breakpoint variant) is what crawlers
 * and no-script visitors read. React drops that copy while hydrating the
 * Framer footer, so the same markup also travels in a <template> at the end
 * of the document, from which footer-menu.js mounts it back and holds it
 * against later repaints.
 *
 * Returns the HTML unchanged when the footer is absent.
 */
export function injectFooterMenu(html: string, data: FooterMenuData): string {
  const anchor = '<div class="framer-1el4j4z"';
  if (!html.includes(anchor)) return html;

  const block =
    '<div class="gocar-footer" data-gocar-footer="1">' +
    renderColumn(data.quickHeading, data.quickLinks) +
    (data.fleetLinks.length > 0 ? renderColumn(data.fleetHeading, data.fleetLinks) : '') +
    renderContacts(data) +
    '</div>';

  /**
   * The icon sprite is emitted once per page; every copy of the block - the
   * server-rendered ones and the mounted clone - references it with <use>.
   */
  const mount =
    (data.socials.length > 0 ? SOCIAL_SPRITE : '') +
    `<template id="gocar-footer-tpl">${block}</template>` +
    '<script src="/assets/tweaks/footer-menu.js" defer></script>';

  return html
    .split(anchor)
    .join(`${block}${anchor}`)
    .replace('</head>', `${FOOTER_CSS}</head>`)
    .replace('</body>', `${mount}</body>`);
}
