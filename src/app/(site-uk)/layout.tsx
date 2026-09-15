import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { localeFromPath } from '@/lib/site-nav';
import { mirrorPath } from '@/lib/locale-path';
import { siteIcons } from '@/lib/site-meta';
import { getSetting } from '@/lib/settings';
import { LOCALE_COOKIE, geoLocale, isCrawler, storedLocale } from '@/lib/locale-policy';
import { cookies } from 'next/headers';
import { Reveal } from '@/components/site/client/reveal';
import { BackToTop } from '@/components/site/client/back-to-top';
import { AnalyticsHead, AnalyticsBody } from '@/components/site/analytics';
import { getTranslation } from '@/lib/translations';
import type { Locale } from '@/lib/site-nav';
import '@/styles/fonts.css';
import '@/styles/tokens.css';
import '@/styles/type.css';
import '@/styles/site.css';

/**
 * Root layout of the Ukrainian phase-2 render. It owns the document, so <html
 * lang> matches the reference ("uk"), and carries the design system extracted
 * from the Framer capture: fonts, tokens, typography presets, chrome styles.
 *
 * The English tree has its own root layout because a nested layout cannot
 * emit <html>, and the locale has to reach that attribute.
 *
 * `lang` is read from the path rather than fixed to "uk" for one reason: this
 * group owns the root and therefore `[...notfound]`, the catch-all that
 * answers every unmatched path in the app, including the English ones. Every
 * real page of this tree has a Ukrainian path, so they are unaffected.
 *
 * It also decides the language of a first visit. That has to happen here
 * rather than in middleware because it needs Настройки → «Язык по умолчанию»,
 * and middleware runs on the edge runtime with no database. Owning the root is
 * exactly what makes this the right place: a visitor with no remembered choice
 * always lands on a Ukrainian URL, so this layout sees every first visit.
 */
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
export async function generateMetadata(): Promise<Metadata> {
  const pathname = (await headers()).get('x-pathname') ?? '';
  const locale = localeFromPath(pathname);
  const siteName = String(getSetting('site_name', '') ?? '').trim();
  const fallback = locale === 'ua' ? 'Сторінку не знайдено' : 'Page not found';
  const phrase = getTranslation('seo.title.404', locale, fallback).trim();
  const title = siteName !== '' && !phrase.includes(siteName) ? `${phrase} | ${siteName}` : phrase;
  const description = getTranslation('seo.desc.404', locale, '').trim();
  const icons = siteIcons();
  return { title: { default: title, template: '%s' }, description, icons };
}

/** Locale of this tree, so the chrome strings resolve without a page. */
const LOCALE: Locale = 'ua';

/** The other locale, as a typed constant the strict audit accepts. */
const EN: Locale = 'en';

/**
 * Where to send a visitor who has never chosen a language, or null to leave
 * them on the Ukrainian version they already asked for.
 *
 * A remembered choice is handled in middleware and never reaches this. A
 * crawler is never moved: both languages must stay reachable without a
 * redirect, which is what the SEO audit of 15.08.2026 protected.
 */
async function firstVisitRedirect(pathname: string): Promise<string | null> {
  const head = await headers();
  if (isCrawler(head.get('user-agent') ?? '')) return null;
  if (storedLocale((await cookies()).get(LOCALE_COOKIE)?.value) !== null) return null;

  const guess = geoLocale((name) => head.get(name));
  const fallback = String(getSetting('default_locale', 'uk') ?? 'uk')
    .trim()
    .toLowerCase();
  const wanted = guess ?? (fallback === 'en' ? 'en' : 'ua');
  if (wanted !== 'en') return null;

  const dest = mirrorPath(pathname, EN);
  return dest === pathname ? null : dest;
}

export default async function SiteUkLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get('x-pathname') ?? '';
  if (pathname !== '' && localeFromPath(pathname) === 'ua') {
    const dest = await firstVisitRedirect(pathname);
    if (dest !== null) redirect(dest);
  }
  return (
    <html lang={localeFromPath(pathname) === 'en' ? 'en' : 'uk'}>
      <head>
        <AnalyticsHead />
      </head>
      <body>
        <AnalyticsBody />
        <div className="site2-root">{children}</div>
        <Reveal />
        <BackToTop label={getTranslation('menu.to_top', LOCALE, 'Догори')} />
      </body>
    </html>
  );
}
