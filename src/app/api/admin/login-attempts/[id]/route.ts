import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';

/**
 * Delete a single login-attempt record.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { id } = await ctx.params;
  getDb().prepare('DELETE FROM login_attempts WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
