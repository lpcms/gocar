import { SiteHeader } from '@/components/site/header';
import { SiteFooter } from '@/components/site/footer';
import { NotFoundHero } from '@/components/site/not-found-hero';
import { CtaBanner } from '@/components/site/cta-banner';
import { localePath } from '@/lib/site-nav';
import type { Locale } from '@/lib/site-nav';

/**
 * Whole 404 page of the phase-2 render. Both trees' not-found boundaries
 * render it, so a missing address always looks the same in either language.
 *
 * The header is handed the address that was actually asked for, because it
 * builds the language switcher from it: switching language on a dead address
 * offers the same address in the other language, which answers in that
 * language. Two values it must never be handed, both of which shipped before
 * 24.08.2026: '/uk/404', an address of the retired scheme, which pointed the
 * switcher at /en/uk/404; and a synthetic '/404', which no production build
 * can answer with this page at all - Next always writes its own
 * .next/server/pages/404.html and serves that for the literal path, so the
 * switcher landed on an unstyled document.
 */
export function NotFoundPage({ locale, pathname = '' }: { locale: Locale; pathname?: string }) {
  /** The home of the locale is the fallback when there is no address to hand over. */
  const address = pathname === '' ? localePath('', locale) : pathname;
  return (
    <div className="site-shell site-shell--tall-nav">
      <SiteHeader locale={locale} pathname={address} />
      <NotFoundHero locale={locale} />
      <CtaBanner locale={locale} />
      <SiteFooter locale={locale} />
    </div>
  );
}
