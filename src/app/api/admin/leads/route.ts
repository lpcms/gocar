import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';

/**
 * Leads list API: pagination + optional filters type / status / date.
 * Booking rows carry the server-side price snapshot; contact rows have
 * email/message. Extras are stored as JSON per row.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const status = url.searchParams.get('status');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const perPage = 25;
  const offset = (page - 1) * perPage;

  const where: string[] = [];
  const args: Array<string | number> = [];
  if (type === 'booking' || type === 'contact') { where.push('type = ?'); args.push(type); }
  if (status === 'new' || status === 'processed') { where.push('status = ?'); args.push(status); }
  if (from) { where.push('created_at >= ?'); args.push(`${from} 00:00:00`); }
  if (to) { where.push('created_at <= ?'); args.push(`${to} 23:59:59`); }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM leads ${whereSql}`).get(...args) as unknown as { n: number }).n;
  const rows = db.prepare(
    `SELECT id, type, status, locale, name, phone, email, days, grand_total, car_title,
            score, created_at
     FROM leads ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`
  ).all(...args, perPage, offset);
  return NextResponse.json({ ok: true, items: rows, total, page, perPage });
}
