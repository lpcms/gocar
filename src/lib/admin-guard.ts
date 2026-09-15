import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { resolveSession } from './admin-session';

/** Name of the session cookie, so the routes never spell it out twice. */
export const ADMIN_COOKIE = 'gocar_admin';

/**
 * Who the session cookie belongs to, or null.
 *
 * The work is `resolveSession`: signature, expiry, a live row in
 * `admin_sessions` and an account that still exists. A revoked token fails
 * here, which is what makes logging out mean something.
 */
export async function currentAdminId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value ?? '';
  if (token === '') return null;
  return resolveSession(token);
}

/**
 * Guard for admin API routes: returns null when authorized,
 * a 401 NextResponse otherwise.
 */
export async function requireAdmin() {
  if ((await currentAdminId()) === null) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  return null;
}
