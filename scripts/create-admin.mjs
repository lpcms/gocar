import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Create or update the admin user:
 *   node scripts/create-admin.mjs <login> <password>
 * Also ensures the session secret exists in config.local.json.
 *
 * The hashing and the secret file are reimplemented here rather than imported:
 * scripts are plain .mjs on Node built-ins and cannot import src/lib/auth.ts.
 * The script used to import a "src/lib/auth.mjs" that has never existed, so it
 * failed on every run. Both routines below must stay identical to
 * `hashPassword` and `getSessionSecret` in src/lib/auth.ts - a password written
 * in another format simply never verifies.
 */

/** Key length of the scrypt digest, as in src/lib/auth.ts. */
const SCRYPT_KEYLEN = 64;

/**
 * Hash a password: returns "scrypt:<salt-hex>:<hash-hex>".
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Session secret from config.local.json, generated on first use.
 */
function getSessionSecret() {
  const file = path.join(process.cwd(), 'config.local.json');
  const config = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  if (!config.session_secret) {
    config.session_secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf8');
  }
  return config.session_secret;
}

const [, , login, password] = process.argv;
if (!login || !password) {
  process.stderr.write('Usage: node scripts/create-admin.mjs <login> <password>\n');
  process.exit(1);
}
if (password.length < 8) {
  process.stderr.write('Password must be at least 8 characters.\n');
  process.exit(1);
}
getSessionSecret();
const db = new DatabaseSync(path.join(process.cwd(), 'db', 'gocar.db'));
const hash = hashPassword(password);
const existing = db.prepare('SELECT id FROM admin_users WHERE login = ?').get(login);
if (existing) {
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hash, existing.id);
  process.stdout.write(`Admin "${login}" password updated.\n`);
} else {
  db.prepare('INSERT INTO admin_users (login, password_hash) VALUES (?, ?)').run(login, hash);
  process.stdout.write(`Admin "${login}" created.\n`);
}
db.close();
