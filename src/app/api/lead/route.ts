import { NextRequest, NextResponse } from 'next/server';
import { processLead } from '@/lib/leads';
import { verifyRecaptcha, RECAPTCHA_FORMS } from '@/lib/recaptcha';
import { clientIp } from '@/lib/client-ip';

/**
 * Lead intake endpoint (Next runtime).
 *
 * The reCAPTCHA check runs here rather than inside processLead, which is the
 * pure core: it prices the booking, words the notification and writes the row,
 * and stays free of the request context. It is a no-op unless both keys are
 * configured.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const payload: unknown = await req.json().catch(() => null);
  if (payload === null || typeof payload !== 'object') {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const body = payload as Record<string, unknown>;

  const token = typeof body.recaptcha_token === 'string' ? body.recaptcha_token : '';
  /**
   * Through the shared resolver: the first entry of `x-forwarded-for` is
   * written by the client, and handing Google an address the visitor made up
   * makes the `remoteip` half of the check worthless.
   */
  const resolved = clientIp(req.headers);
  const ip = resolved === 'local' ? '' : resolved;
  const check = await verifyRecaptcha(token, ip, RECAPTCHA_FORMS);
  if (!check.ok) {
    /**
     * The reason stays out of the response - it would tell a bot which half of
     * the check to work around - but it belongs in the log: a lead lost to a
     * misconfigured key looks exactly like a lead lost to a bot.
     */
    process.stderr.write(
      `gocar: lead recaptcha rejected (${check.reason}, score ${String(check.score)})\n`
    );
    return NextResponse.json({ ok: false, error: 'recaptcha' }, { status: 400 });
  }
  if (check.suspicious) {
    /**
     * Below the threshold, but the token is genuine. The booking is taken and
     * the score travels with it, so the admin sees how it rated instead of the
     * visitor seeing a dead form.
     */
    process.stderr.write(`gocar: lead low score (${String(check.score)}), accepted\n`);
  }
  /**
   * Carry the rating into the stored lead, so the admin can see how each
   * submission scored and tune the threshold from real numbers.
   */
  if (check.score !== null) {
    body.score = check.score;
  }

  const result = await processLead(body);
  return NextResponse.json(result.body, { status: result.status });
}
