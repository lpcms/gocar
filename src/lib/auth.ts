import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Password hashing and session tokens using built-in node:crypto only
 * (scrypt KDF + HMAC-signed cookies) — no native dependencies.
 */

const SCRYPT_KEYLEN = 64;

/**
 * Fixed salt for the decoy hash of `burnPasswordTime`. It guards nothing and
 * is never stored - its only job is to make the KDF do a real unit of work.
 */
const DUMMY_SALT = Buffer.from('gocar-timing-equalizer', 'utf8');

/**
 * Hash a password: returns "scrypt:<salt-hex>:<hash-hex>".
 */
export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Constant-time password verification against a stored hash.
 */
export function verifyPassword(password: string, stored: string) {
  const parts = String(stored).split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const salt = Buffer.from(parts[1] ?? '', 'hex');
  const expected = Buffer.from(parts[2] ?? '', 'hex');
  const actual = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/**
 * Spend the same time a real verification would, and discard the result.
 *
 * Called when the login does not exist: without it the endpoint answered a
 * wrong name instantly and a right one after the ~100ms scrypt costs, which is
 * a reliable oracle for which admin logins exist - the first half of a
 * password attack, handed over for free (25.08.2026).
 */
export function burnPasswordTime(password: string) {
  crypto.scryptSync(password, DUMMY_SALT, SCRYPT_KEYLEN);
}

/**
 * A secret generated on a read-only filesystem, where it cannot be saved; it
 * is kept for the life of the process instead.
 */
let processSecret = '';

/**
 * Session secret: the SESSION_SECRET environment variable when set, otherwise
 * config.local.json (generated on first use).
 */
export function getSessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET ?? '';
  if (fromEnv !== '') return fromEnv;
  if (processSecret !== '') return processSecret;
  const file = path.join(process.cwd(), 'config.local.json');
  const config = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  if (!config.session_secret) {
    config.session_secret = crypto.randomBytes(32).toString('hex');
    try {
      fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf8');
    } catch {
      processSecret = String(config.session_secret);
    }
  }
  return String(config.session_secret);
}

/** How long a session lasts, in hours. */
export const SESSION_TTL_HOURS = 12;

/**
 * Identifier of one session, unique per sign-in.
 *
 * It is what a token is revoked *by*: the cookie names a row in
 * `admin_sessions`, and deleting that row takes the token back. Random rather
 * than sequential so a valid id cannot be guessed from another one, and hex so
 * it never contains the '.' the token is split on.
 */
export function newSessionId() {
  return crypto.randomBytes(18).toString('hex');
}

/**
 * What a verified token claims.
 */
export interface SessionClaim {
  userId: number;
  sessionId: string;
}

/**
 * Create a signed session token: "<userId>.<expiresAtMs>.<sessionId>.<hmac>".
 *
 * The signature proves the token was minted here and the expiry bounds it, but
 * neither can be withdrawn - which is why the session id is in the payload and
 * why `admin-session.ts` writes a row for it. A token whose row is gone is
 * refused however well it is signed.
 */
export function createSession(
  userId: number,
  sessionId: string,
  ttlHours: number = SESSION_TTL_HOURS
): { token: string; expiresAt: number } {
  const exp = Date.now() + ttlHours * 3600000;
  const payload = `${userId}.${exp}.${sessionId}`;
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex');
  return { token: `${payload}.${sig}`, expiresAt: exp };
}

/**
 * Verify the signature and the expiry of a session token, and return what it
 * claims. It says nothing about whether the session is still live - that is
 * `resolveSession` in admin-session.ts, and it is the half that can say no
 * after a logout.
 */
export function verifySession(token: string): SessionClaim | null {
  const parts = String(token || '').split('.');
  if (parts.length !== 4) {
    return null;
  }
  const [uid, exp, sid, sig] = parts;
  const payload = `${uid ?? ''}.${exp ?? ''}.${sid ?? ''}`;
  const expected = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex');
  const a = Buffer.from(sig ?? '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  if (Number(exp) < Date.now()) {
    return null;
  }
  const userId = Number(uid);
  const sessionId = sid ?? '';
  if (!Number.isInteger(userId) || userId <= 0 || sessionId === '') {
    return null;
  }
  return { userId, sessionId };
}
