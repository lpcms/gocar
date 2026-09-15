import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';

/**
 * Reviews CRUD list + create. Shown on the home page (snapshot until
 * Phase 2 flips the home page to DB-driven rendering).
 */
export async function GET(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const rows = getDb().prepare(
    'SELECT * FROM reviews ORDER BY sort_order, id'
  ).all();
  return NextResponse.json({ ok: true, items: rows });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const body = (await req.json().catch(() => ({}))) as {
    author?: string; author_ua?: string; text_en?: string; text_ua?: string; avatar_url?: string;
    avatar_alt_en?: string; avatar_alt_ua?: string;
    is_published?: number; sort_order?: number;
  };
  const author = String(body.author ?? '').trim();
  const textEn = String(body.text_en ?? '').trim();
  if (!author || !textEn) {
    return NextResponse.json({ ok: false, error: 'required' }, { status: 422 });
  }
  const res = getDb().prepare(
    `INSERT INTO reviews (author, author_ua, text_en, text_ua, avatar_url, avatar_alt_en, avatar_alt_ua, is_published, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    author,
    String(body.author_ua ?? ''),
    textEn,
    body.text_ua ? String(body.text_ua) : null,
    body.avatar_url ? String(body.avatar_url) : null,
    String(body.avatar_alt_en ?? ''),
    String(body.avatar_alt_ua ?? ''),
    body.is_published === 0 ? 0 : 1,
    Number(body.sort_order ?? 0)
  );
  return NextResponse.json({ ok: true, id: Number(res.lastInsertRowid) });
}
