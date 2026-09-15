/**
 * The head audit the phase criterion §2.3 asks for: "qa-seo shows no
 * regression against phase 1".
 *
 * Walks every public page in both locales against a running server and
 * asserts what the SEO audit of 15.08.2026 settled:
 *
 *  - a title exists, is under 60 characters and is not the bare brand;
 *  - a description exists and is clamped to 160 characters;
 *  - canonical is self-referencing and built on the configured base domain;
 *  - hreflang carries en / uk / x-default, and x-default is the English URL;
 *  - Open Graph and Twitter cards are complete, including og:site_name;
 *  - the structured data of the page is present and carries real content,
 *    not an empty type shell;
 *  - the analytics container is on the page;
 *  - exactly one <h1>.
 *
 * Titles and descriptions must also differ between the two locales and
 * between pages: duplicates are the failure this catches earliest.
 *
 *   node scripts/qa-seo.mjs [baseUrl]
 *
 * Prints one line per page and exits non-zero on any failure.
 */

import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/+$/, '');

const db = new DatabaseSync(join(process.cwd(), 'db', 'gocar.db'));
const setting = (key) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row && row.value !== null ? String(row.value).trim() : '';
};
const siteName = setting('site_name') || 'GoCar';
const rawDomain = setting('site_domain');
const origin =
  rawDomain === ''
    ? base
    : (/^https?:\/\//i.test(rawDomain) ? rawDomain : `https://${rawDomain}`).replace(/\/+$/, '');

const cars = db
  .prepare("SELECT slug FROM cars WHERE status = 'live' ORDER BY sort_order, id")
  .all()
  .map((r) => r.slug);
const categories = db.prepare('SELECT slug FROM categories ORDER BY sort_order').all().map((r) => r.slug);
db.close();

/** Every public page, as the bare path without locale prefix. */
const bares = ['', 'cars', 'book', 'faq', 'about-us', 'contact']
  .concat(categories.map((s) => `cars/${s}`))
  .concat(cars.map((s) => `cars-detail/${s}`));

/** Expected JSON-LD type for a page, beyond the site-wide Organization. */
function expectedType(bare) {
  if (bare === '') return 'AutoRental';
  if (bare === 'cars' || bare.startsWith('cars/')) return 'CollectionPage';
  if (bare === 'faq') return 'FAQPage';
  if (bare === 'contact') return 'ContactPage';
  if (bare === 'about-us') return 'AboutPage';
  if (bare === 'book') return 'ReserveAction';
  if (bare.startsWith('cars-detail/')) return 'Car';
  return null;
}

const attr = (html, re) => (html.match(re) ?? [])[1] ?? '';
const failures = [];
const seen = new Map();

for (const locale of ['en', 'ua']) {
  for (const bare of bares) {
    /** Ukrainian owns the root, English lives under /en (client 22.08.2026). */
    const path =
      locale === 'en'
        ? bare === ''
          ? '/en'
          : `/en/${bare}`
        : bare === ''
          ? '/'
          : `/${bare}`;
    const res = await fetch(`${base}${path}`, { redirect: 'manual' });
    const html = await res.text();
    const problems = [];

    if (res.status !== 200) problems.push(`status ${res.status}`);

    const title = attr(html, /<title>([^<]*)<\/title>/);
    if (title === '') problems.push('no title');
    else if (title.length > 60) problems.push(`title ${title.length} chars`);
    else if (title === siteName) problems.push('title is the bare brand');

    const desc = attr(html, /<meta name="description" content="([^"]*)"/);
    if (desc === '') problems.push('no description');
    else if (desc.length > 160) problems.push(`description ${desc.length} chars`);

    const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
    const expectedCanonical = `${origin}${path === '/' ? '/' : path}`;
    if (canonical !== expectedCanonical) {
      problems.push(`canonical ${canonical || '(none)'} != ${expectedCanonical}`);
    }

    /** React serialises the attribute as `hrefLang`, so match either spelling. */
    const alts = [
      ...html.matchAll(/<link rel="alternate" href[Ll]ang="([^"]+)" href="([^"]+)"/g)
    ].map((m) => [m[1], m[2]]);
    const byLang = Object.fromEntries(alts);
    const enUrl = `${origin}${bare === '' ? '/en' : `/en/${bare}`}`;
    for (const lang of ['en', 'uk', 'x-default']) {
      if (byLang[lang] === undefined) problems.push(`no hreflang ${lang}`);
    }
    if (byLang['x-default'] !== undefined && byLang['x-default'] !== enUrl) {
      problems.push('x-default is not the English URL');
    }

    for (const tag of ['og:title', 'og:url', 'og:site_name', 'og:locale', 'og:image']) {
      if (!html.includes(`property="${tag}"`)) problems.push(`no ${tag}`);
    }
    if (!html.includes('name="twitter:card"')) problems.push('no twitter:card');

    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    let nodes = [];
    try {
      nodes = blocks.map((m) => JSON.parse(m[1]));
    } catch {
      problems.push('unparsable JSON-LD');
    }
    const types = nodes.map((n) => n['@type']);
    if (!types.includes('Organization')) problems.push('no Organization');
    const want = expectedType(bare);
    if (want !== null && !types.includes(want)) problems.push(`no ${want}`);
    if (bare !== '' && !types.includes('BreadcrumbList')) problems.push('no BreadcrumbList');

    /** An empty shell is the failure the audit called out; check the content. */
    const faq = nodes.find((n) => n['@type'] === 'FAQPage');
    if (faq && !Array.isArray(faq.mainEntity)) problems.push('FAQPage without mainEntity');
    const collection = nodes.find((n) => n['@type'] === 'CollectionPage');
    if (collection && collection.mainEntity === undefined) problems.push('CollectionPage without ItemList');
    const car = nodes.find((n) => n['@type'] === 'Car');
    if (car) {
      if (car.offers === undefined) problems.push('Car without offers');
      if (car.seatingCapacity !== undefined && typeof car.seatingCapacity !== 'object') {
        problems.push('seatingCapacity is not a QuantitativeValue');
      }
      if (car.seatingCapacity !== undefined && typeof car.seatingCapacity.value !== 'number') {
        problems.push('seatingCapacity.value is not a number');
      }
    }

    if (!html.includes('googletagmanager')) problems.push('no analytics container');

    const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
    if (h1 !== 1) problems.push(`${h1} <h1>`);

    /** Duplicate titles or descriptions across pages are an indexing problem. */
    for (const [what, value] of [['title', title], ['description', desc]]) {
      if (value === '') continue;
      const key = `${what}:${value}`;
      if (seen.has(key)) problems.push(`${what} duplicates ${seen.get(key)}`);
      else seen.set(key, path);
    }

    if (problems.length > 0) {
      failures.push(`${path}\n    ${problems.join('\n    ')}`);
      process.stdout.write(`FAIL ${path}\n`);
    } else {
      process.stdout.write(`ok   ${path}  ${title.length}/${desc.length}\n`);
    }
  }
}

const total = bares.length * 2;
if (failures.length > 0) {
  process.stderr.write(`\n${failures.length} of ${total} pages failed:\n\n`);
  for (const f of failures) process.stderr.write(`  ${f}\n\n`);
  process.exit(1);
}
process.stdout.write(`\nSEO OK: ${total} pages, both locales.\n`);
