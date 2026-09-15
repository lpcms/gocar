import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';

interface TranslationRow {
  key: string;
  en_value: string | null;
  en_status: 'new' | 'done';
  ua_value: string | null;
  ua_status: 'new' | 'done';
}

/**
 * UI translations API: list keys with EN/UA values and statuses, add a
 * new key, update or remove existing rows.
 */
export async function GET(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const rows = getDb().prepare(
    `SELECT
       key,
       MAX(CASE WHEN locale = 'en' THEN value END) AS en_value,
       COALESCE(MAX(CASE WHEN locale = 'en' THEN status END), 'new') AS en_status,
       MAX(CASE WHEN locale = 'ua' THEN value END) AS ua_value,
       COALESCE(MAX(CASE WHEN locale = 'ua' THEN status END), 'new') AS ua_status
     FROM translations
     GROUP BY key
     ORDER BY key`
  ).all() as unknown as TranslationRow[];
  return NextResponse.json({ ok: true, items: rows });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const body = (await req.json().catch(() => ({}))) as {
    key?: string; en_value?: string; ua_value?: string;
  };
  const key = String(body.key ?? '').trim();
  if (!key) return NextResponse.json({ ok: false, error: 'required' }, { status: 422 });
  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM translations WHERE key = ? LIMIT 1').get(key);
  if (exists) return NextResponse.json({ ok: false, error: 'key_taken' }, { status: 409 });
  const enValue = String(body.en_value ?? '');
  const uaValue = String(body.ua_value ?? '');
  const upsert = db.prepare(
    'INSERT INTO translations (key, locale, value, status) VALUES (?, ?, ?, ?)'
  );
  upsert.run(key, 'en', enValue, enValue.trim() === '' ? 'new' : 'done');
  upsert.run(key, 'ua', uaValue, uaValue.trim() === '' ? 'new' : 'done');
  return NextResponse.json({ ok: true });
}
