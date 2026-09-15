import { getSetting } from '@/lib/settings';

/**
 * Google Tag Manager, Google Analytics and the Facebook (Meta) Pixel for the
 * new render.
 *
 * All three IDs live in Настройки (`gtm_id`, `ga_id`, `fb_pixel_id`) and are
 * validated against their known shapes before anything is emitted: a typo
 * would otherwise put broken markup on every page. Empty IDs render nothing
 * at all.
 *
 * The phase-1 injector put the same snippets into the snapshot HTML; when the
 * pages moved to their own routes nothing carried it over, so the booking and
 * contact forms were pushing `send_form` into a `dataLayer` no container was
 * listening to (22.08.2026).
 *
 * Each tag is split in two. The queue - `dataLayer`, `gtag`, `fbq` - is set up
 * inline at once, so a form can push an event at any moment and nothing is
 * lost. The vendor script that drains the queue is requested only after the
 * page's `load` event: the three weigh ~300 KiB and ran for up to 0.7s on a
 * mid-range phone while the first screen was still waiting to be painted
 * (mobile Lighthouse, 15.09.2026). A visit that ends before `load` is the only
 * one no longer counted.
 */

/** Container IDs look like GTM-XXXXXX. */
const GTM_PATTERN = /^GTM-[A-Z0-9]+$/i;

/** Measurement IDs look like G-XXXXXXXXXX. */
const GA_PATTERN = /^G-[A-Z0-9]+$/i;

/** Meta Pixel IDs are a plain numeric string, 15 or 16 digits today. */
const FB_PIXEL_PATTERN = /^[0-9]{10,20}$/;

/**
 * The Facebook Pixel ID as it should be emitted, or an empty string when the
 * setting is blank or malformed. Both halves of the tag need it, so the
 * reading and the validation live in one place.
 */
function facebookPixelId() {
  const raw = String(getSetting('fb_pixel_id', '') ?? '').trim();
  return FB_PIXEL_PATTERN.test(raw) ? raw : '';
}

/**
 * Script text that requests `src` once the page has finished loading - at
 * once if that has already happened.
 */
function afterLoad(src: string): string {
  return (
    `(function(w,d){function go(){var s=d.createElement('script');s.async=true;` +
    `s.src=${JSON.stringify(src)};d.head.appendChild(s);}` +
    `if(d.readyState==='complete'){setTimeout(go,0);}` +
    `else{w.addEventListener('load',function(){setTimeout(go,0);});}})(window,document);`
  );
}

/**
 * The head half: the GTM queue, the GA4 tag and the Facebook Pixel, each one
 * only if its ID is configured, with their vendor scripts deferred to `load`.
 */
export function AnalyticsHead() {
  const gtmId = String(getSetting('gtm_id', '') ?? '').trim();
  const gaId = String(getSetting('ga_id', '') ?? '').trim();
  /**
   * Google writes both IDs in upper case and matches them that way, so a
   * lower-cased one typed into Настройки would emit a tag that quietly counts
   * nothing. The shape is validated case-insensitively and then normalised,
   * which turns that typo into a working counter instead of a silent one.
   */
  const gtm = GTM_PATTERN.test(gtmId) ? gtmId.toUpperCase() : '';
  const ga = GA_PATTERN.test(gaId) ? gaId.toUpperCase() : '';
  const fb = facebookPixelId();
  if (gtm === '' && ga === '' && fb === '') return null;

  return (
    <>
      {gtm === '' ? null : (
        <script
          data-gocar-gtm="1"
          dangerouslySetInnerHTML={{
            __html:
              `window.dataLayer=window.dataLayer||[];` +
              `window.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});` +
              afterLoad(`https://www.googletagmanager.com/gtm.js?id=${gtm}`)
          }}
        />
      )}
      {ga === '' ? null : (
        <script
          data-gocar-ga="1"
          dangerouslySetInnerHTML={{
            __html:
              `window.dataLayer=window.dataLayer||[];` +
              `function gtag(){dataLayer.push(arguments);}gtag('js',new Date());` +
              `gtag('config','${ga}');` +
              afterLoad(`https://www.googletagmanager.com/gtag/js?id=${ga}`)
          }}
        />
      )}
      {fb === '' ? null : (
        <script
          data-gocar-fbq="1"
          dangerouslySetInnerHTML={{
            __html:
              `!function(f){if(f.fbq)return;var n=f.fbq=function(){` +
              `n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};` +
              `if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];}(window);` +
              `fbq('init','${fb}');fbq('track','PageView');` +
              afterLoad('https://connect.facebook.net/en_US/fbevents.js')
          }}
        />
      )}
    </>
  );
}

/**
 * The body half: GTM's fallback iframe and the Pixel's fallback image for a
 * visitor with JavaScript off. GTM's has to be the first thing inside <body>,
 * which is why this is a component of its own rather than part of the head
 * block.
 */
export function AnalyticsBody() {
  const gtmId = String(getSetting('gtm_id', '') ?? '').trim();
  const gtm = GTM_PATTERN.test(gtmId) ? gtmId.toUpperCase() : '';
  const fb = facebookPixelId();
  if (gtm === '' && fb === '') return null;
  return (
    <>
      {gtm === '' ? null : (
        <noscript data-gocar-gtm="1">
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${gtm}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
      )}
      {fb === '' ? null : (
        <noscript data-gocar-fbq="1">
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            alt=""
            src={`https://www.facebook.com/tr?id=${fb}&ev=PageView&noscript=1`}
          />
        </noscript>
      )}
    </>
  );
}
