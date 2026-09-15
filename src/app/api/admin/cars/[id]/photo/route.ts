import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';
import { storeImage } from '@/lib/media';

/**
 * Car photo management for a single car. Handles four slots — the main
 * image and three preview (slider) photos — each backed by a media row.
 *
 * POST (multipart/form-data): upload a new file into a slot. Fields:
 *   slot     = 'image' | 'preview1' | 'preview2' | 'preview3'
 *   file     = the image
 *   alt_en, alt_ua = alt text stored on the media row
 * The WebP width is taken from car_image_max_width (main) or
 * car_preview_max_width (previews) so the two photo kinds resize
 * independently of the global media setting.
 *
 * PATCH (application/json): update alt text of the media already linked
 *   to a slot without re-uploading. Fields: slot, alt_en, alt_ua.
 *
 * DELETE (application/json): unlink a slot (sets the *_id column to NULL;
 *   the media row itself is kept in the library). Field: slot.
 *
 * Per TZ v5.4 §2.4 these values live in the database; the public
 * snapshot pages start reflecting them only in Phase 2.
 */

const SLOTS = ['image', 'preview1', 'preview2', 'preview3'] as const;

/**
 * Column name for a slot (identical here, but kept explicit and guarded).
 */
function slotColumn(slot: string): string | null {
  return (SLOTS as readonly string[]).includes(slot) ? `${slot}_id` : null;
}

/**
 * Read a numeric setting with a fallback (settings store strings).
 */
function numSetting(key: string, fallback: number): number {
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as unknown as { value: string } | undefined;
  const parsed = row ? Number(row.value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Confirm the car exists; returns its id or null.
 */
function carExists(id: number): boolean {
  const row = getDb()
    .prepare('SELECT id FROM cars WHERE id = ?')
    .get(id) as unknown as { id: number } | undefined;
  return Boolean(row);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!carExists(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await req.formData().catch(() => null);
  if (form === null) {
    return NextResponse.json({ ok: false, error: 'form' }, { status: 400 });
  }
  const slot = String(form.get('slot') ?? '');
  const column = slotColumn(slot);
  if (column === null) {
    return NextResponse.json({ ok: false, error: 'bad_slot' }, { status: 422 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'file_required' }, { status: 422 });
  }
  if (!/^image\//.test(file.type)) {
    return NextResponse.json({ ok: false, error: 'not_image' }, { status: 422 });
  }

  const box = slot === 'image'
    ? {
        width: numSetting('car_image_max_width', 1200),
        height: numSetting('car_image_max_height', 900)
      }
    : {
        width: numSetting('car_preview_max_width', 800),
        height: numSetting('car_preview_max_height', 600)
      };
  const buffer = Buffer.from(await file.arrayBuffer());
  const altEn = String(form.get('alt_en') ?? '');
  const altUa = String(form.get('alt_ua') ?? '');

  try {
    const media = await storeImage(buffer, file.name, altEn, altUa, box, 'avto' as const);
    getDb()
      .prepare(`UPDATE cars SET ${column} = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(media.id, id);
    return NextResponse.json({ ok: true, slot, media });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!carExists(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    slot?: string;
    alt_en?: string;
    alt_ua?: string;
  };
  const column = slotColumn(String(body.slot ?? ''));
  if (column === null) {
    return NextResponse.json({ ok: false, error: 'bad_slot' }, { status: 422 });
  }
  const db = getDb();
  const link = db
    .prepare(`SELECT ${column} AS mid FROM cars WHERE id = ?`)
    .get(id) as unknown as { mid: number | null } | undefined;
  const mediaId = link?.mid ?? null;
  if (mediaId === null) {
    return NextResponse.json({ ok: false, error: 'no_media' }, { status: 422 });
  }
  db.prepare('UPDATE media SET alt_en = ?, alt_ua = ? WHERE id = ?').run(
    String(body.alt_en ?? ''),
    String(body.alt_ua ?? ''),
    mediaId
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!carExists(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { slot?: string };
  const column = slotColumn(String(body.slot ?? ''));
  if (column === null) {
    return NextResponse.json({ ok: false, error: 'bad_slot' }, { status: 422 });
  }
  getDb()
    .prepare(`UPDATE cars SET ${column} = NULL, updated_at = datetime('now') WHERE id = ?`)
    .run(id);
  return NextResponse.json({ ok: true });
}
