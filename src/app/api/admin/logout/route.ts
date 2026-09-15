import { NextRequest, NextResponse } from 'next/server';
import { endSession } from '@/lib/admin-session';
import { ADMIN_COOKIE } from '@/lib/admin-guard';

/**
 * Admin logout: revoke the session, expire the cookie and return to the login
 * page.
 *
 * The revocation is the part that used to be missing. Clearing the cookie only
 * makes this browser forget the token; the token itself stayed valid for the
 * rest of its twelve hours, so a copy taken from a shared machine - or from a
 * log, or a backup - still opened the panel long after the owner believed they
 * had left it. Deleting the row in `admin_sessions` is what actually takes it
 * back (25.08.2026).
 *
 * A stale or forged cookie revokes nothing and is not an error: the answer is
 * the same either way, and the caller ends up signed out regardless.
 *
 * The redirect uses a root-relative Location header instead of an absolute URL
 * built from req.url. Behind CityHost's NGINX->socket proxy, req.url carries
 * the internal origin (localhost), so an absolute redirect would send the
 * browser to https://localhost:3000/admin/login. A relative Location is
 * resolved by the browser against the current host, keeping it on the real
 * domain regardless of the proxy setup.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get(ADMIN_COOKIE)?.value ?? '';
  if (token !== '') {
    endSession(token);
  }
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: '/admin/login' }
  });
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
