import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';
import { storeImage } from '@/lib/media';

/**
 * Media library: list, upload. Uploads accept multipart/form-data with
 * the "file", "alt_en" and "alt_ua" fields; sharp produces a WebP copy
 * according to image_max_width / image_quality settings.
 */
export async function GET(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  /**
   * The Images library shows only general-purpose images. Car photos ('avto')
   * and review photos ('review') are managed from their own sections and are
   * excluded here so the library stays clean.
   */
  const rows = getDb().prepare(
    "SELECT * FROM media WHERE folder = 'general' ORDER BY id DESC"
  ).all();
  return NextResponse.json({ ok: true, items: rows });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const form = await req.formData().catch(() => null);
  if (form === null) {
    return NextResponse.json({ ok: false, error: 'form' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'file_required' }, { status: 422 });
  }
  if (!/^image\//.test(file.type)) {
    return NextResponse.json({ ok: false, error: 'not_image' }, { status: 422 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const altEn = String(form.get('alt_en') ?? '');
  const altUa = String(form.get('alt_ua') ?? '');
  /**
   * Which library this upload belongs to. Callers from the car / review forms
   * pass 'avto' / 'review' so their photos stay out of the general Images
   * library; the default is 'general'.
   */
  const folderRaw = String(form.get('folder') ?? 'general');
  const folder = ['general', 'avto', 'review'].includes(folderRaw) ? folderRaw : 'general';
  try {
    const row = await storeImage(buffer, file.name, altEn, altUa, null, folder as 'general' | 'avto' | 'review');
    /**
     * Hand back the stored row rather than what storeImage returned: the
     * library's table renders created_at as well, and reading it back is what
     * lets the page put the new image at the top of the list without a reload
     * that would drop alt text someone is in the middle of typing.
     */
    const item = getDb().prepare(
      'SELECT id, original_path, webp_path, width, height, alt_en, alt_ua, created_at FROM media WHERE id = ?'
    ).get(row.id);
    return NextResponse.json({ ok: true, media: row, item });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
