/**
 * Create db/gocar.db from the committed template on a fresh checkout.
 *
 * The application does the same on its own at first use, so this is only
 * needed before running a CLI script against the database (create-admin,
 * the schema checks) on an installation that has not served a page yet.
 * Refuses to touch an existing database.
 *
 * Usage: node scripts/init-db.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'db');
const live = path.join(dir, 'gocar.db');
const template = path.join(dir, 'gocar.template.db');

if (fs.existsSync(live)) {
  process.stdout.write('db/gocar.db already exists - left untouched.\n');
  process.exit(0);
}
if (!fs.existsSync(template)) {
  process.stderr.write('db/gocar.template.db is missing.\n');
  process.exit(1);
}
fs.copyFileSync(template, live);
process.stdout.write('Created db/gocar.db from db/gocar.template.db\n');
