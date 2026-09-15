import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';

/**
 * Single lead: fetch, mark new/processed, delete.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { id } = await ctx.params;
  const row = getDb().prepare('SELECT * FROM leads WHERE id = ?').get(Number(id));
  if (!row) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, lead: row });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { status?: string };
  const next = body.status === 'processed' ? 'processed' : 'new';
  getDb().prepare('UPDATE leads SET status = ? WHERE id = ?').run(next, Number(id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { id } = await ctx.params;
  getDb().prepare('DELETE FROM leads WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
