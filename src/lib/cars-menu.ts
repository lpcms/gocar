import { getDb } from './db';
import { LOCALE_PREFIX } from './site-nav';

/**
 * Cars dropdown in the header menu (desktop above 1440px).
 *
 * Hovering the header's "Cars" / "Автомобілі" link opens a list of the live
 * cars; the link itself stays a normal link and still navigates to /cars on
 * click. The list is data only here: the payload below is read by
 * cars-menu.js, which mounts the panel on <body> - outside React's subtree,
 * like the language picker - so no runtime repaint can wipe it.
 *
 * The caret next to the link is drawn as a CSS ::after pseudo-element rather
 * than an injected node, for the same reason: the header is Framer markup
 * and inserting a child there would break hydration.
 */

/**
 * Viewport width from which the dropdown is active. Below it the header
 * collapses into the burger menu, which has its own category list. The value
 * is handed to the client script on the payload tag, so the breakpoint is
 * defined in one place.
 */
const CARS_MENU_MIN_WIDTH = 1441;

/**
 * One entry of the dropdown.
 */
export interface CarsMenuItem {
  /** Locale-prefixed path of the car page, e.g. "/uk/cars-detail/mazda-cx-5". */
  href: string;
  /** Localized car name. */
  title: string;
}

/**
 * Live cars in the admin's manual order (cars.sort_order, then id as a
 * stable tie-break), with the requested locale's title and the English one
 * as a fallback. Cars without any title are skipped - an unnamed entry would
 * render as an empty row.
 */
export function getCarsMenu(locale: 'en' | 'ua'): CarsMenuItem[] {
  const rows = getDb()
    .prepare(
      `SELECT c.slug,
              COALESCE(NULLIF(loc.title, ''), NULLIF(en.title, ''), '') AS title
       FROM cars c
       LEFT JOIN car_translations en ON en.car_id = c.id AND en.locale = 'en'
       LEFT JOIN car_translations loc ON loc.car_id = c.id AND loc.locale = ?
       WHERE c.status = 'live'
       ORDER BY c.sort_order, c.id`
    )
    .all(locale) as unknown as Array<{ slug: string; title: string }>;

  const prefix = LOCALE_PREFIX[locale];
  const items: CarsMenuItem[] = [];
  for (const row of rows) {
    const title = row.title.trim();
    if (title === '' || row.slug.trim() === '') continue;
    items.push({ href: `${prefix}/cars-detail/${row.slug}`, title });
  }
  return items;
}

/**
 * Escape a value for safe insertion into an HTML text node.
 */
function htmlEsc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Inject the dropdown: the caret style, the JSON payload and the behaviour
 * script. Also emits the list as real links in a <noscript> block, so the
 * car pages stay reachable for crawlers that do not run the script.
 *
 * No-op when the header's Cars link is absent from the snapshot or the
 * catalog is empty.
 */
export function injectCarsMenu(html: string, items: CarsMenuItem[]): string {
  if (items.length === 0) return html;
  if (!html.includes('framer-z9ywde-container')) return html;

  /**
   * The caret itself is styled in public/assets/tweaks/site-tweaks.css, which
   * every snapshot links directly. It used to be emitted from here as a runtime
   * string, but a rule assembled that way is invisible when it arrives damaged:
   * one production deploy delivered the block cut mid-rule
   * ("@media (min-width:1441background:url(...") and the caret silently
   * vanished, with nothing in the HTML to hint at it. As a plain file the rule
   * can be diffed, checksummed and re-uploaded without a rebuild.
   *
   * The breakpoint is duplicated there as a literal; CARS_MENU_MIN_WIDTH below
   * stays the source of truth for the behaviour and is handed to the script.
   */
  const payload = JSON.stringify(items).replace(/</g, '\\u003c');
  const links = items
    .map((item) => `<a href="${item.href}">${htmlEsc(item.title)}</a>`)
    .join('');
  const block =
    '<script type="application/json" id="gocar-cars-menu" ' +
    `data-min-width="${CARS_MENU_MIN_WIDTH}">${payload}</script>` +
    `<noscript><div hidden>${links}</div></noscript>` +
    '<script src="/assets/tweaks/cars-menu.js" defer></script>';

  return html.replace('</body>', `${block}</body>`);
}
