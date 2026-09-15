import { getDb } from './db';

/**
 * Brute-force protection: an identity is blocked after N failed attempts
 * within M minutes (both configurable in settings).
 *
 * Two identities are counted, not one. The address stops a single machine
 * working through a password list. The login name stops the same list arriving
 * from a botnet, where every request comes from an address that has never
 * failed before and the per-address counter never reaches its limit - which is
 * how a per-IP-only lockout is beaten in practice (25.08.2026).
 *
 * The address itself is resolved by `client-ip.ts`, which is the other half of
 * this: counting against a header the attacker writes protects nothing.
 */

function readSettings(db: ReturnType<typeof getDb>) {
  const rows = db
    .prepare("SELECT key, value FROM settings WHERE key IN ('lockout_attempts','lockout_minutes')")
    .all() as unknown as Array<{ key: string; value: string }>;
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    attempts: Number(map.lockout_attempts ?? 5),
    minutes: Number(map.lockout_minutes ?? 15)
  };
}

/** The two columns an attempt is counted against. */
type AttemptColumn = 'ip' | 'login';

/** Those columns as typed constants, so callers never pass a bare string. */
const BY_IP: AttemptColumn = 'ip';
const BY_LOGIN: AttemptColumn = 'login';

/**
 * Failed attempts inside the window, counted for one column.
 */
function failuresFor(
  db: ReturnType<typeof getDb>,
  column: AttemptColumn,
  value: string,
  minutes: number
): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM login_attempts
       WHERE ${column} = ? AND result = 'failure'
         AND created_at >= datetime('now', ?)`
    )
    .get(value, `-${minutes} minutes`) as unknown as { n: number } | undefined;
  return row === undefined ? 0 : row.n;
}

/**
 * Whether this attempt must be refused: either the address or the login name
 * is over the limit.
 *
 * The login name is only counted when one was supplied - an empty box would
 * otherwise let anyone lock out every empty submission at once, and it is not
 * an identity worth protecting.
 */
export function isBlocked(ip: string, login: string = '') {
  const db = getDb();
  const cfg = readSettings(db);
  if (failuresFor(db, BY_IP, ip, cfg.minutes) >= cfg.attempts) return true;
  const name = login.trim();
  if (name === '') return false;
  /**
   * The per-name limit is deliberately looser than the per-address one: a
   * genuine owner mistyping their own password from a new address must not be
   * locked out by an attacker who spent the budget on their name first.
   */
  return failuresFor(db, BY_LOGIN, name, cfg.minutes) >= cfg.attempts * 3;
}

/**
 * Retention of the journal, in days, from Настройки. 0 keeps it for ever,
 * which is the only way to switch the sweep off.
 *
 * The floor is one day rather than zero-as-nothing: a retention shorter than
 * the lockout window would delete the very failures the lockout is counting,
 * and a typo in that box must not quietly disable brute-force protection.
 */
function keepDays(db: ReturnType<typeof getDb>): number {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = 'login_attempts_keep_days'")
    .get() as unknown as { value: string | null } | undefined;
  const raw = row === undefined || row.value === null ? '' : row.value.trim();
  if (raw === '') return DEFAULT_KEEP_DAYS;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return DEFAULT_KEEP_DAYS;
  if (value === 0) return 0;
  return Math.max(1, Math.floor(value));
}

/** Retention used when Настройки holds nothing usable. */
const DEFAULT_KEEP_DAYS = 30;

/** Sweep no more often than this, however many attempts arrive. */
const PURGE_EVERY_MS = 10 * 60 * 1000;

/**
 * When the sweep last ran in this process. A flood of attempts would otherwise
 * run one DELETE per request, which is exactly the moment the panel can least
 * afford the extra work.
 */
let lastPurge = 0;

/**
 * Drop journal rows older than the retention.
 *
 * It runs from `recordAttempt` rather than from a cron: the journal only grows
 * when someone signs in, so the write is the natural place to trim it, and the
 * project deliberately has no scheduler to hang a job on.
 */
export function purgeOldAttempts(force: boolean = false): number {
  const now = Date.now();
  if (!force && now - lastPurge < PURGE_EVERY_MS) return 0;
  lastPurge = now;
  const db = getDb();
  const days = keepDays(db);
  if (days === 0) return 0;
  const result = db
    .prepare("DELETE FROM login_attempts WHERE created_at < datetime('now', ?)")
    .run(`-${days} days`);
  return Number(result.changes);
}

/**
 * Record a login attempt outcome: 'success' | 'failure' | 'blocked'.
 */
export function recordAttempt(ip: string, login: string, result: string) {
  getDb()
    .prepare('INSERT INTO login_attempts (ip, login, result) VALUES (?, ?, ?)')
    .run(ip, login ?? null, result);
  purgeOldAttempts();
}
