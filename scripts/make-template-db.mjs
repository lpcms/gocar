/**
 * Build db/gocar.template.db - the committed starting point for a fresh
 * checkout - from the live db/gocar.db.
 *
 * The template carries the site content (cars, categories, extras, reviews,
 * translations, media library, settings) and nothing that belongs to a single
 * installation: leads, admin accounts, sessions and the login journal are
 * emptied, and the Telegram and reCAPTCHA credentials are blanked. The result
 * is compacted twice so no deleted row survives in a free page of the file.
 *
 * Re-run it whenever the content changes and the repository should follow.
 *
 * Usage: node scripts/make-template-db.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dir = path.join(process.cwd(), 'db');
const live = path.join(dir, 'gocar.db');
const template = path.join(dir, 'gocar.template.db');
const scratch = path.join(dir, 'gocar.template.tmp.db');

const PRIVATE_TABLES = ['leads', 'admin_sessions', 'login_attempts', 'admin_users'];
const SECRET_SETTINGS = [
  'telegram_bot_token',
  'telegram_chat_id',
  'recaptcha_site_key',
  'recaptcha_secret_key',
  'recaptcha_v3_site_key',
  'recaptcha_v3_secret_key'
];

if (!fs.existsSync(live)) {
  process.stderr.write(`No live database at ${live}\n`);
  process.exit(1);
}
for (const file of [scratch, template]) fs.rmSync(file, { force: true });

const source = new DatabaseSync(live, { readOnly: true });
source.exec(`VACUUM INTO '${scratch.replace(/'/g, "''")}'`);
source.close();

const db = new DatabaseSync(scratch);
db.exec('PRAGMA foreign_keys = OFF');
for (const table of PRIVATE_TABLES) db.exec(`DELETE FROM ${table}`);
const seq = db
  .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'sqlite_sequence'")
  .get();
if (Number(seq?.n ?? 0) > 0) {
  const names = PRIVATE_TABLES.map((t) => `'${t}'`).join(', ');
  db.exec(`DELETE FROM sqlite_sequence WHERE name IN (${names})`);
}
const blank = db.prepare("UPDATE settings SET value = '' WHERE key = ?");
for (const key of SECRET_SETTINGS) blank.run(key);
db.exec('PRAGMA journal_mode = DELETE');
db.exec(`VACUUM INTO '${template.replace(/'/g, "''")}'`);
db.close();
fs.rmSync(scratch, { force: true });

const size = (fs.statSync(template).size / 1024).toFixed(0);
process.stdout.write(`Template written: db/gocar.template.db (${size} KB)\n`);
