import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Reveal } from '@/components/site/client/reveal';
import { BackToTop } from '@/components/site/client/back-to-top';
import { AnalyticsHead, AnalyticsBody } from '@/components/site/analytics';
import { getTranslation } from '@/lib/translations';
import { siteIcons } from '@/lib/site-meta';
import { getSetting } from '@/lib/settings';
import type { Locale } from '@/lib/site-nav';
import '@/styles/fonts.css';
import '@/styles/tokens.css';
import '@/styles/type.css';
import '@/styles/site.css';

/**
 * Root layout of the English phase-2 render. It owns the document, so <html
 * lang> matches the reference ("en"), and carries the design system extracted
 * from the Framer capture: fonts, tokens, typography presets, chrome styles.
 *
 * The Ukrainian tree has its own root layout because a nested layout cannot
 * emit <html>, and the locale has to reach that attribute.
 */
/** Locale of this tree, so the chrome strings resolve without a page. */
const LOCALE: Locale = 'en';
/**
 * Head of whatever this tree answers without metadata of its own - in
 * practice the 404, which Next renders through the not-found boundary, where
 * a page's own generateMetadata never runs. Without this every unmatched URL
 * comes back with an empty <title>. The copy is the `seo.title.404` /
 * `seo.desc.404` pair the translations have carried since phase 1, with the
 * brand appended the way site-meta does it for an inner page.
 *
 * `template: '%s'` leaves every real page's title exactly as the page built
 * it; only `default` is added. Robots are deliberately not set here: a value
 * at layout level would become the default for every page in the tree.
 */
export function generateMetadata(): Metadata {
  const siteName = String(getSetting('site_name', '') ?? '').trim();
  const phrase = getTranslation('seo.title.404', LOCALE, 'Page not found').trim();
  const title = siteName !== '' && !phrase.includes(siteName) ? `${phrase} | ${siteName}` : phrase;
  const description = getTranslation('seo.desc.404', LOCALE, '').trim();
  const icons = siteIcons();
  return { title: { default: title, template: '%s' }, description, icons };
}

export default function SiteEnLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <AnalyticsHead />
      </head>
      <body>
        <AnalyticsBody />
        <div className="site2-root">{children}</div>
        <Reveal />
        <BackToTop label={getTranslation('menu.to_top', LOCALE, 'Back to top')} />
      </body>
    </html>
  );
}
