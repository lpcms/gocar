import { getJsonLd } from '@/lib/site-jsonld';
import { siteOrigin, requestOrigin } from '@/lib/site-meta';
import type { Locale } from '@/lib/site-nav';

/**
 * The structured data of one page, as `application/ld+json` script tags.
 *
 * A server component so the graph is in the served HTML: a crawler that does
 * not run JavaScript still reads it. The content is escaped for `</script>`
 * rather than trusted - a car description or an FAQ answer is admin-entered
 * text and could otherwise close the tag early.
 *
 * `bare` is the path without the locale prefix and without a leading slash.
 */
export async function JsonLd({ bare, locale }: { bare: string; locale: Locale }) {
  const origin = siteOrigin(await requestOrigin());
  const nodes = getJsonLd(bare, locale, origin);
  if (nodes.length === 0) return null;
  return (
    <>
      {nodes.map((node, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(node).replace(/</g, '\u003c')
          }}
        />
      ))}
    </>
  );
}
