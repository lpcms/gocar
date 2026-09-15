import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, burnPasswordTime, SESSION_TTL_HOURS } from '@/lib/auth';
import { startSession } from '@/lib/admin-session';
import { ADMIN_COOKIE } from '@/lib/admin-guard';
import { isBlocked, recordAttempt } from '@/lib/lockout';
import { verifyRecaptcha, RECAPTCHA_ADMIN } from '@/lib/recaptcha';
import { clientIp } from '@/lib/client-ip';
import { getDb } from '@/lib/db';

/**
 * Admin login: lockout check -> reCAPTCHA -> password verification -> session
 * cookie. Every attempt is journalized (success / failure / blocked).
 *
 * The reCAPTCHA check runs before the password is ever looked at, so a bot
 * cannot use this endpoint as a password oracle. It is skipped entirely while
 * the keys are empty in Настройки, and a token is only demanded once they are
 * filled - which is what makes turning the feature on a settings change rather
 * than a deploy. Google being unreachable lets the attempt through to the
 * password: an outage at a third party must not lock the owner out of the
 * panel, and the password plus the lockout still stand behind it.
 *
 * The attempt is counted against two identities, the address and the login
 * name, and either one being over the limit refuses the request. The address
 * alone stops a single machine working through a password list; the login name
 * is what still stops the same list arriving from a botnet, where every
 * request has an address of its own (25.08.2026).
 *
 * The cookie it hands out names a row in `admin_sessions`, which is what lets
 * logging out take the token back rather than only forgetting it locally.
 */

/**
 * Whether this request reached us over TLS. Behind the proxy the app itself
 * always sees plain http on a socket, so the proxy's `x-forwarded-proto` is
 * the only truthful answer; the request URL is the fallback for a server
 * exposed directly.
 */
function isHttps(req: NextRequest): boolean {
  const forwarded = ((req.headers.get('x-forwarded-proto') ?? '').split(',')[0] ?? '')
    .trim()
    .toLowerCase();
  if (forwarded !== '') return forwarded === 'https';
  return req.nextUrl.protocol === 'https:';
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req.headers);
  const body = (await req.json().catch(() => ({}))) as {
    login?: string;
    password?: string;
    recaptcha?: string;
  };
  const login = String(body.login ?? '').slice(0, 100);

  if (isBlocked(ip, login)) {
    recordAttempt(ip, login, 'blocked');
    return NextResponse.json({ ok: false, error: 'blocked' }, { status: 429 });
  }

  const captcha = await verifyRecaptcha(
    String(body.recaptcha ?? ''),
    ip === 'local' ? '' : ip,
    RECAPTCHA_ADMIN
  );
  if (!captcha.ok) {
    /**
     * The reason never reaches the client - it would tell a bot which half of
     * the check to work around - but without it in the log a rejected login is
     * indistinguishable from a wrong password, and a key that is not
     * registered for the production domain looks like a broken panel.
     */
    process.stderr.write(`gocar: admin recaptcha rejected (${captcha.reason})\n`);
    recordAttempt(ip, login, 'failure');
    return NextResponse.json({ ok: false, error: 'recaptcha' }, { status: 403 });
  }
  if (captcha.suspicious) {
    /**
     * A score below the threshold is not a reason to refuse the owner their
     * own panel - reCAPTCHA rates a new key low until the site has fed it
     * traffic, and the password plus the lockout are the real guard here.
     */
    process.stderr.write(`gocar: admin low score (${String(captcha.score)}), password required\n`);
  }

  const user = getDb()
    .prepare('SELECT id, password_hash FROM admin_users WHERE login = ?')
    .get(login) as unknown as { id: number; password_hash: string } | undefined;

  /**
   * An unknown login used to come back instantly while a known one spent the
   * ~100ms scrypt takes, which told an attacker which names exist before they
   * had guessed a single password. Both paths now do the same work.
   */
  if (user === undefined) {
    burnPasswordTime(String(body.password ?? ''));
    recordAttempt(ip, login, 'failure');
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!verifyPassword(String(body.password ?? ''), user.password_hash)) {
    recordAttempt(ip, login, 'failure');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  recordAttempt(ip, login, 'success');
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, startSession(user.id), {
    httpOnly: true,
    sameSite: 'strict',
    /**
     * Never over plain http. The site redirects http to https before anything
     * else, but a single request that slips past the redirect would put the
     * session token on the wire in clear; `secure` makes the browser refuse to
     * send it at all.
     *
     * The condition is the scheme this very request arrived on, not
     * NODE_ENV: production is started through `server.js`, which calls Next
     * with `dev: false` without ever setting that variable, so keying off it
     * would have left the flag off on the one host that needs it. Reading the
     * scheme also leaves http://localhost working, where a `secure` cookie
     * would silently break sign-in.
     */
    secure: isHttps(req),
    path: '/',
    maxAge: SESSION_TTL_HOURS * 3600
  });
  return res;
}
