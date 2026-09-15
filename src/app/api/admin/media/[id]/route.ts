import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';
import { deleteMedia, replaceImageFile } from '@/lib/media';

/**
 * Media item: update alt text, replace the picture itself, or delete
 * (removes files from disk).
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  const body = (await req.json().catch(() => ({}))) as { alt_en?: string; alt_ua?: string };
  const db = getDb();
  const cur = db.prepare('SELECT alt_en, alt_ua FROM media WHERE id = ?').get(id) as unknown as | { alt_en: string; alt_ua: string } | undefined;
  if (!cur) return NextResponse.json({ ok: false }, { status: 404 });
  db.prepare('UPDATE media SET alt_en = ?, alt_ua = ? WHERE id = ?').run(
    body.alt_en !== undefined ? String(body.alt_en) : cur.alt_en,
    body.alt_ua !== undefined ? String(body.alt_ua) : cur.alt_ua,
    id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { id } = await ctx.params;
  const ok = deleteMedia(Number(id));
  return NextResponse.json({ ok });
}

/**
 * Replace the picture behind one library entry and save its alt text in the
 * same step - what the Изменить dialog submits.
 *
 * The file keeps its stored name, so every page that already shows it picks up
 * the new image without a single reference changing. The response carries the
 * measured size next to the one that was recorded before, which is what lets
 * the dialog tell the admin that the new picture is not the shape of the old.
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  const db = getDb();
  const cur = db.prepare('SELECT alt_en, alt_ua FROM media WHERE id = ?').get(id) as unknown as
    | { alt_en: string; alt_ua: string }
    | undefined;
  if (cur === undefined) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  const form = await req.formData().catch(() => null);
  if (form === null) {
    return NextResponse.json({ ok: false, error: 'form' }, { status: 400 });
  }

  const file = form.get('file');
  let replaced: Awaited<ReturnType<typeof replaceImageFile>> | null = null;
  if (file instanceof File && file.size > 0) {
    /**
     * SVG arrives as image/svg+xml, every raster format as image/*; a browser
     * that sends nothing usable is refused rather than guessed at.
     */
    if (!/^image\//.test(file.type)) {
      return NextResponse.json({ ok: false, error: 'not_image' }, { status: 422 });
    }
    try {
      replaced = await replaceImageFile(id, Buffer.from(await file.arrayBuffer()));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const known = ['not_found', 'remote_file', 'svg_expected', 'unsupported_target'];
      return NextResponse.json({ ok: false, error: msg }, { status: known.includes(msg) ? 422 : 500 });
    }
  }

  const altEn = form.get('alt_en');
  const altUa = form.get('alt_ua');
  db.prepare('UPDATE media SET alt_en = ?, alt_ua = ? WHERE id = ?').run(
    altEn === null ? cur.alt_en : String(altEn),
    altUa === null ? cur.alt_ua : String(altUa),
    id
  );

  const item = db.prepare(
    'SELECT id, original_path, webp_path, width, height, alt_en, alt_ua, created_at FROM media WHERE id = ?'
  ).get(id);
  return NextResponse.json({ ok: true, item, replaced });
}
