import { getDb } from './db';
import { createSession, newSessionId, verifySession, SESSION_TTL_HOURS } from './auth';

/**
 * The live sessions of the admin panel: the half of authentication that can
 * say no.
 *
 * `auth.ts` signs a token and checks that signature, which proves where the
 * token came from and when it stops being valid - and nothing else. A signed
 * claim cannot be withdrawn, so until this module existed logging out cleared
 * the cookie in one browser while the token itself kept working for the rest
 * of its twelve hours; a token that had leaked could not be taken back at all
 * (25.08.2026).
 *
 * The rule is now the other way round: a token is accepted only while its row
 * is in `admin_sessions`. Logout deletes the row, deleting an administrator
 * cascades to theirs, and expiry sweeps the rest.
 */

/**
 * SQLite compares these as text, and `datetime('now')` is UTC to the second.
 * A JS timestamp has to be written the same way or every comparison against
 * `datetime('now')` is a comparison of two differently-shaped strings.
 */
function toSqlUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Open a session for a signed-in administrator and return the cookie value.
 */
export function startSession(userId: number, ttlHours: number = SESSION_TTL_HOURS): string {
  const sessionId = newSessionId();
  const { token, expiresAt } = createSession(userId, sessionId, ttlHours);
  getDb()
    .prepare('INSERT INTO admin_sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sessionId, userId, toSqlUtc(expiresAt));
  /**
   * Sweep on the way in: sign-in is rare, the delete is indexed, and it means
   * the table never needs a cron of its own.
   */
  purgeExpiredSessions();
  return token;
}

/**
 * The administrator a cookie belongs to, or null.
 *
 * Signature first, then the row: the join also proves the account still
 * exists, so a deleted administrator loses access at once instead of keeping
 * it until their token expires.
 */
export function resolveSession(token: string): number | null {
  const claim = verifySession(token);
  if (claim === null) return null;
  const row = getDb()
    .prepare(
      `SELECT s.user_id AS user_id
         FROM admin_sessions s
         JOIN admin_users u ON u.id = s.user_id
        WHERE s.id = ? AND s.user_id = ? AND s.expires_at > datetime('now')`
    )
    .get(claim.sessionId, claim.userId) as unknown as { user_id: number } | undefined;
  return row === undefined ? null : row.user_id;
}

/**
 * Revoke one session - the token stops being accepted everywhere, not just in
 * the browser that asked to log out.
 *
 * A token that no longer verifies has nothing to revoke, and says so quietly:
 * logging out must succeed even when the cookie is stale or forged, because
 * the caller is about to clear it either way.
 */
export function endSession(token: string): boolean {
  const claim = verifySession(token);
  if (claim === null) return false;
  const result = getDb()
    .prepare('DELETE FROM admin_sessions WHERE id = ? AND user_id = ?')
    .run(claim.sessionId, claim.userId);
  return Number(result.changes) > 0;
}

/**
 * Drop sessions that have run out. Their tokens are refused by the expiry
 * check anyway; this is what stops the table growing for ever.
 */
export function purgeExpiredSessions(): number {
  const result = getDb()
    .prepare("DELETE FROM admin_sessions WHERE expires_at <= datetime('now')")
    .run();
  return Number(result.changes);
}
