/**
 * The language policy, exercised against a running server.
 *
 * Replaces check-locale.mjs, which re-implemented the old mirror() in
 * JavaScript and asserted against its own copy. Two things made that
 * worthless: the rule moved out of a client script into middleware plus the
 * root layout, and on 22.08.2026 the whole scheme flipped - Ukrainian owns the
 * root, English lives under /en. A copy of the logic can only ever agree with
 * itself, so this drives the real endpoints instead.
 *
 * The order under test, set by the client:
 *   1. an explicit choice in the `gocar_locale` cookie beats everything;
 *   2. otherwise the country of the request - outside Ukraine means English;
 *   3. otherwise Настройки → «Язык по умолчанию».
 * A crawler is never redirected, which is what keeps both languages
 * crawlable.
 *
 *   node scripts/qa-locale.mjs [baseUrl]
 */

import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/+$/, '');

const db = new DatabaseSync(join(process.cwd(), 'db', 'gocar.db'));
const defaultRow = db.prepare("SELECT value FROM settings WHERE key = 'default_locale'").get();
const savedDefault = defaultRow ? defaultRow.value : 'uk';

/** A browser that is not a crawler; the default agent looks like neither. */
const HUMAN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

/**
 * One request, following nothing, reporting where the server pointed.
 */
async function probe(path, headers) {
  const res = await fetch(`${base}${path}`, {
    redirect: 'manual',
    headers: { 'user-agent': HUMAN, ...headers }
  });
  const location = res.headers.get('location');
  if (location === null) return { status: res.status, to: '' };
  const url = new URL(location, base);
  return { status: res.status, to: `${url.pathname}${url.search}` };
}

/** [name, path, headers, expected status, expected destination] */
const CASES = [
  ['no signal at all stays Ukrainian', '/', {}, 200, ''],
  ['country UA stays', '/', { 'cf-ipcountry': 'UA' }, 200, ''],
  ['country US goes to English', '/', { 'cf-ipcountry': 'US' }, 307, '/en'],
  ['country US keeps the page', '/cars', { 'cf-ipcountry': 'US' }, 307, '/en/cars'],
  ['unplaceable country (XX) stays', '/', { 'cf-ipcountry': 'XX' }, 200, ''],
  ['Vercel header works too', '/', { 'x-vercel-ip-country': 'DE' }, 307, '/en'],
  [
    'cookie ua beats a foreign country',
    '/',
    { 'cf-ipcountry': 'US', cookie: 'gocar_locale=ua' },
    200,
    ''
  ],
  ['cookie en on a Ukrainian URL', '/cars', { cookie: 'gocar_locale=en' }, 302, '/en/cars'],
  ['cookie ua on an English URL', '/en/cars', { cookie: 'gocar_locale=ua' }, 302, '/cars'],
  ['cookie matches the path, no move', '/en/cars', { cookie: 'gocar_locale=en' }, 200, ''],
  [
    'Googlebot from the US is never moved',
    '/',
    { 'cf-ipcountry': 'US', 'user-agent': GOOGLEBOT },
    200,
    ''
  ],
  ['Googlebot reaches the English tree directly', '/en', { 'user-agent': GOOGLEBOT }, 200, ''],
  ['Accept-Language en-US', '/', { 'accept-language': 'en-US,en;q=0.9' }, 307, '/en'],
  ['Accept-Language uk-UA', '/', { 'accept-language': 'uk-UA,uk;q=0.9' }, 200, ''],
  ['Accept-Language * is not a preference', '/', { 'accept-language': '*' }, 200, ''],
  ['a file is never redirected', '/sw.js', { 'cf-ipcountry': 'US' }, 200, ''],
  ['the admin is never redirected', '/admin/login', { cookie: 'gocar_locale=ua' }, 200, ''],
  ['legacy /uk is permanently moved', '/uk', {}, 308, '/'],
  ['legacy /uk/cars is permanently moved', '/uk/cars', {}, 308, '/cars'],
  /**
   * The legacy cases above passed while every indexed old address answered 404
   * in a real browser: they were written without a cookie, and it was the
   * remembered choice that broke them - middleware mirrored /uk to /en/uk,
   * which no route claims, before the redirect could run (24.08.2026). The
   * permanent move is the same for everyone; the language is applied to the
   * address it lands on, one request later.
   */
  ['legacy /uk with an English choice remembered', '/uk', { cookie: 'gocar_locale=en' }, 308, '/'],
  [
    'legacy /uk/cars with an English choice remembered',
    '/uk/cars',
    { cookie: 'gocar_locale=en' },
    308,
    '/cars'
  ],
  ['legacy /uk with a Ukrainian choice remembered', '/uk', { cookie: 'gocar_locale=ua' }, 308, '/'],
  ['legacy /uk for a crawler', '/uk', { 'user-agent': GOOGLEBOT }, 308, '/'],
  [
    'a legacy address keeps its query string',
    '/uk/cars?utm_source=google',
    {},
    308,
    '/cars?utm_source=google'
  ],
  ['the mirrored legacy address is retired too', '/en/uk/cars', {}, 308, '/en/cars'],
  /**
   * Next normalises the trailing slash itself, before middleware is asked
   * anything, so this address is moved in two steps and neither of them is a
   * loop: /uk/ -> /uk -> /.
   */
  ['a trailing slash is normalised first', '/uk/', {}, 308, '/uk']
];

let failures = 0;

/**
 * Run one table of cases and report each line.
 */
async function run(cases) {
  for (const [name, path, headers, status, to] of cases) {
    const got = await probe(path, headers);
    const ok = got.status === status && got.to === to;
    if (!ok) failures += 1;
    const arrow = got.to === '' ? '' : ` -> ${got.to}`;
    process.stdout.write(
      `${ok ? 'ok  ' : 'FAIL'} ${name}\n     ${path} => ${got.status}${arrow}` +
        (ok ? '\n' : `   (expected ${status}${to === '' ? '' : ` -> ${to}`})\n`)
    );
  }
}

try {
  process.stdout.write(`default_locale = ${savedDefault}\n\n`);
  await run(CASES);

  /**
   * The admin's default only decides a first visit, so it is checked with no
   * cookie and no country header.
   */
  process.stdout.write('\ndefault_locale = en\n\n');
  db.prepare("UPDATE settings SET value = 'en' WHERE key = 'default_locale'").run();
  await run([
    ['English default sends a first visit to /en', '/', {}, 307, '/en'],
    ['a country still outranks the default', '/', { 'cf-ipcountry': 'UA' }, 200, ''],
    ['a cookie still outranks the default', '/', { cookie: 'gocar_locale=ua' }, 200, ''],
    ['Googlebot is still never moved', '/', { 'user-agent': GOOGLEBOT }, 200, '']
  ]);
} finally {
  db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(savedDefault, 'default_locale');
  db.close();
  process.stdout.write(`\ndefault_locale restored to ${savedDefault}.\n`);
}

if (failures > 0) {
  process.stderr.write(`\n${failures} case(s) failed.\n`);
  process.exit(1);
}
process.stdout.write('LOCALE OK\n');
