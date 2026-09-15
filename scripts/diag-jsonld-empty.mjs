/**
 * Nothing empty may reach the structured data.
 *
 * A setting the admin has not filled in must be absent from the graph, not
 * present as `""` or `null`: an empty property is a validation error in Search
 * Console, and an invented one is worse. This blanks every company setting in
 * turn, asks the server for the page, and reports any key that survived.
 *
 * The database is restored before the script exits, including on failure.
 *
 *   node scripts/diag-jsonld-empty.mjs [baseUrl]
 */

import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/+$/, '');

/** Everything the business entity and the graph read. */
const KEYS = [
  'contact_phone',
  'contact_email',
  'contact_whatsapp',
  'contact_geo',
  'contact_telegram',
  'contact_viber',
  'contact_instagram',
  'contact_whatsapp_url',
  'og_image_default',
  'work_hours_en',
  'work_hours_ua'
];

/** Pages whose graph is checked. */
const PAGES = ['/', '/contact', '/en/contact', '/cars', '/cars-detail/toyota-camry', '/faq'];

const db = new DatabaseSync(join(process.cwd(), 'db', 'gocar.db'));
const saved = new Map();
for (const key of KEYS) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  saved.set(key, row ? row.value : null);
}

/**
 * Walk the parsed graph and collect the paths whose value is empty.
 */
function emptyPaths(node, trail = '') {
  const found = [];
  if (Array.isArray(node)) {
    node.forEach((item, i) => found.push(...emptyPaths(item, `${trail}[${i}]`)));
    return found;
  }
  if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      found.push(...emptyPaths(value, trail === '' ? key : `${trail}.${key}`));
    }
    return found;
  }
  if (node === null || node === undefined || (typeof node === 'string' && node.trim() === '')) {
    found.push(trail);
  }
  return found;
}

/**
 * Every JSON-LD node of one page.
 */
async function graphOf(path) {
  const html = await (await fetch(`${base}${path}`)).text();
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  return blocks.map((m) => JSON.parse(m[1].replace(/\\u003c/g, '<')));
}

let failures = 0;
try {
  db.prepare(`UPDATE settings SET value = '' WHERE key IN (${KEYS.map(() => '?').join(',')})`).run(
    ...KEYS
  );
  process.stdout.write('All company settings blanked.\n\n');

  for (const path of PAGES) {
    const nodes = await graphOf(path);
    const problems = [];
    for (const node of nodes) {
      for (const p of emptyPaths(node)) problems.push(`${node['@type']}.${p}`);
    }
    if (problems.length > 0) {
      failures += 1;
      process.stdout.write(`FAIL ${path}\n    ${problems.join('\n    ')}\n`);
    } else {
      process.stdout.write(`ok   ${path}  ${nodes.map((n) => n['@type']).join(', ')}\n`);
    }
  }
} finally {
  for (const [key, value] of saved) {
    if (value === null) db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    else db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(value, key);
  }
  db.close();
  process.stdout.write('\nSettings restored.\n');
}

if (failures > 0) process.exit(1);
