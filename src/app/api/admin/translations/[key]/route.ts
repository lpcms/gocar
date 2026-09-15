import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';

/**
 * Update translation values for one key. Status is derived from value
 * (non-empty = 'done', empty = 'new'), unless overridden by the payload.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ key: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { key: raw } = await ctx.params;
  const key = decodeURIComponent(raw);
  const body = (await req.json().catch(() => ({}))) as {
    en_value?: string; ua_value?: string;
    en_status?: 'new' | 'done'; ua_status?: 'new' | 'done';
  };
  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO translations (key, locale, value, status) VALUES (?, ?, ?, ?)
     ON CONFLICT(key, locale) DO UPDATE SET value = excluded.value, status = excluded.status`
  );
  if (body.en_value !== undefined) {
    const status = body.en_status ?? (body.en_value.trim() === '' ? 'new' : 'done');
    upsert.run(key, 'en', body.en_value, status);
  }
  if (body.ua_value !== undefined) {
    const status = body.ua_status ?? (body.ua_value.trim() === '' ? 'new' : 'done');
    upsert.run(key, 'ua', body.ua_value, status);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ key: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { key: raw } = await ctx.params;
  const key = decodeURIComponent(raw);
  getDb().prepare('DELETE FROM translations WHERE key = ?').run(key);
  return NextResponse.json({ ok: true });
}
