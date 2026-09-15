import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './db';

/**
 * Persist an uploaded image: store the original, produce a WebP
 * (resized to image_max_width from settings, quality from settings)
 * and record both in the media table with EN/UA alt text.
 */

const UPLOADS = path.join(process.cwd(), 'public', 'uploads');

/**
 * Where an upload of each library lands, under public/uploads. The database
 * tags a car photo 'avto' - the value the media table has always used - while
 * the folder people actually look at is named after the section it serves, so
 * the two are mapped here rather than assumed to be the same word.
 */
const UPLOAD_DIRS: Record<'general' | 'avto' | 'review', string> = {
  general: '',
  avto: 'cars',
  review: 'review'
};

function readSetting(key: string, fallback: string | number | null) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as unknown as { value: string } | undefined;
  return row ? row.value : fallback;
}

/**
 * Reserve a filesystem-safe base name for the upload (short hex + ext).
 */
function makeBase(originalName: string) {
  const ext = path.extname(originalName || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  const hex = crypto.randomBytes(6).toString('hex');
  return { base: hex, ext: ext || '.bin' };
}

/**
 * An optional target box for resizing. When provided, the image is fit
 * inside the box preserving aspect ratio (no cropping, never enlarged).
 * A null dimension leaves that axis unconstrained.
 */
interface ResizeBox {
  width: number | null;
  height: number | null;
}

/**
 * Process one image buffer end-to-end and insert a media row.
 * Returns the created row shape. Requires the sharp dependency.
 * When `box` is provided its dimensions win over the global
 * image_max_width setting (used for car main vs preview photos), fitting
 * the image inside the box without cropping or upscaling.
 */
export async function storeImage(
  buffer: Buffer,
  originalName: string,
  altEn: string,
  altUa: string,
  box: ResizeBox | null = null,
  folder: 'general' | 'avto' | 'review' = 'general'
) {
  /**
   * A car photo and a review avatar belong to their own section, which manages
   * and describes them; each therefore lands in a folder of its own, which the
   * Images library never scans. Only a general upload goes to uploads itself.
   */
  const name = UPLOAD_DIRS[folder];
  const sub = name === '' ? '' : `${name}/`;
  const dir = path.join(UPLOADS, name);
  fs.mkdirSync(dir, { recursive: true });
  const { base, ext } = makeBase(originalName);
  const originalDisk = path.join(dir, `${base}${ext}`);
  const webpDisk = path.join(dir, `${base}.webp`);
  fs.writeFileSync(originalDisk, buffer);

  const quality = Number(readSetting('image_quality', 82));
  const { default: sharp } = await import('sharp');
  const image = sharp(buffer, { failOn: 'none' });
  const meta = await image.metadata();
  const srcWidth = meta.width ?? null;

  /**
   * Build the resize pipeline. With a box, fit inside it (both axes when
   * present). Without a box, fall back to the global max-width behaviour.
   */
  const boxWidth = box && box.width && box.width > 0 ? box.width : null;
  const boxHeight = box && box.height && box.height > 0 ? box.height : null;
  let pipeline = image;
  if (boxWidth !== null || boxHeight !== null) {
    pipeline = image.resize({
      width: boxWidth ?? undefined,
      height: boxHeight ?? undefined,
      fit: 'inside',
      withoutEnlargement: true
    });
  } else {
    const maxWidth = Number(readSetting('image_max_width', 1600));
    pipeline = srcWidth && srcWidth > maxWidth ? image.resize({ width: maxWidth }) : image;
  }
  const info = await pipeline.webp({ quality }).toFile(webpDisk);
  const width = info.width ?? srcWidth;
  const height = info.height ?? (meta.height ?? null);

  const res = getDb().prepare(
    `INSERT INTO media (original_path, webp_path, width, height, alt_en, alt_ua, folder)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `/uploads/${sub}${base}${ext}`,
    `/uploads/${sub}${base}.webp`,
    width, height,
    String(altEn ?? ''), String(altUa ?? ''), folder
  );
  return {
    id: Number(res.lastInsertRowid),
    original_path: `/uploads/${sub}${base}${ext}`,
    webp_path: `/uploads/${sub}${base}.webp`,
    width, height,
    alt_en: String(altEn ?? ''), alt_ua: String(altUa ?? '')
  };
}

/**
 * Remove media row and its files from disk. Missing files are ignored.
 */
export function deleteMedia(id: number) {
  const row = getDb().prepare('SELECT original_path, webp_path FROM media WHERE id = ?').get(id) as unknown as { original_path: string; webp_path: string } | undefined;
  if (!row) return false;
  for (const rel of [row.original_path, row.webp_path]) {
    const file = path.join(process.cwd(), 'public', String(rel).replace(/^\//, ''));
    try { fs.unlinkSync(file); } catch { /* absent */ }
  }
  getDb().prepare('DELETE FROM media WHERE id = ?').run(id);
  return true;
}

/**
 * Extensions the replacement writer can produce. A stored file keeps its name
 * when its image is replaced, so the new bytes have to be written in the
 * format that name promises - sharp re-encodes into it whatever was uploaded.
 */
const REPLACEABLE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);

/**
 * Whether a buffer holds SVG source. An `.svg` path can only ever be replaced
 * by SVG source: there is no rasteriser in reverse, and writing PNG bytes into
 * a file the site serves as image/svg+xml would render nothing.
 */
function looksLikeSvg(buffer: Buffer): boolean {
  return /<svg[\s>]/i.test(buffer.subarray(0, 4096).toString('utf8'));
}

/**
 * What the replacement did, so the admin can be told when the new picture is
 * not the size the old one was.
 */
export interface ReplacedImage {
  width: number | null;
  height: number | null;
  previousWidth: number | null;
  previousHeight: number | null;
}

/**
 * Replace the file behind an existing media row, keeping every stored path
 * unchanged - the site keeps referencing the same name, so nothing else has to
 * be touched. An imported file has a single path; an upload has two (the
 * original and its WebP copy) and both are rewritten from the new image.
 *
 * The oversize guard of `storeImage` applies here as well: an upload wider than
 * image_max_width is scaled down to it, so replacing a picture can never leave
 * a multi-megapixel file on the site.
 *
 * @throws `not_found` when the row is unknown, `remote_file` when the row
 * points at a URL rather than a file of ours, `svg_expected` when an `.svg`
 * path is handed anything but SVG source, `unsupported_target` for a stored
 * extension sharp cannot write.
 */
export async function replaceImageFile(id: number, buffer: Buffer): Promise<ReplacedImage> {
  const db = getDb();
  const row = db.prepare(
    'SELECT original_path, webp_path, width, height FROM media WHERE id = ?'
  ).get(id) as unknown as
    | { original_path: string; webp_path: string; width: number | null; height: number | null }
    | undefined;
  if (row === undefined) throw new Error('not_found');

  /** One entry for an imported file, two for an upload and its WebP copy. */
  const targets = [...new Set([row.original_path, row.webp_path])];
  for (const rel of targets) {
    if (!rel.startsWith('/')) throw new Error('remote_file');
  }

  const { default: sharp } = await import('sharp');
  const svgSource = looksLikeSvg(buffer);
  const quality = Number(readSetting('image_quality', 82));
  const maxWidth = Number(readSetting('image_max_width', 1600));
  const meta = await sharp(buffer, { failOn: 'none' }).metadata();
  const srcWidth = meta.width ?? null;

  let width: number | null = null;
  let height: number | null = null;
  for (const rel of targets) {
    const ext = path.extname(rel).toLowerCase();
    const file = path.join(process.cwd(), 'public', rel.replace(/^\//, ''));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (ext === '.svg') {
      if (!svgSource) throw new Error('svg_expected');
      fs.writeFileSync(file, buffer);
      width = meta.width ?? width;
      height = meta.height ?? height;
      continue;
    }
    if (!REPLACEABLE_EXT.has(ext)) throw new Error('unsupported_target');
    const base = sharp(buffer, { failOn: 'none' });
    const sized = srcWidth !== null && srcWidth > maxWidth ? base.resize({ width: maxWidth }) : base;
    const encoded =
      ext === '.png' ? sized.png()
        : ext === '.jpg' || ext === '.jpeg' ? sized.jpeg({ quality })
          : ext === '.avif' ? sized.avif({ quality })
            : ext === '.gif' ? sized.gif()
              : sized.webp({ quality });
    const info = await encoded.toFile(file);
    width = info.width ?? width;
    height = info.height ?? height;
  }

  db.prepare('UPDATE media SET width = ?, height = ? WHERE id = ?').run(width, height, id);
  return { width, height, previousWidth: row.width, previousHeight: row.height };
}

/**
 * Fill in the pixel size of rows that never got one. The library used to
 * register the site's own imagery through a hand-rolled header reader that
 * knew PNG and JPEG only, so every SVG and WebP among them was stored without
 * dimensions and shown as a dash. Rows whose file is missing, or which point
 * at a remote URL, are left alone.
 *
 * @returns how many rows were filled.
 */
export async function backfillDimensions(): Promise<number> {
  const db = getDb();
  const rows = db.prepare(
    'SELECT id, webp_path, original_path FROM media WHERE width IS NULL OR height IS NULL'
  ).all() as unknown as Array<{ id: number; webp_path: string; original_path: string }>;
  if (rows.length === 0) return 0;
  const { default: sharp } = await import('sharp');
  const update = db.prepare('UPDATE media SET width = ?, height = ? WHERE id = ?');
  let filled = 0;
  for (const row of rows) {
    const rel = row.webp_path !== '' ? row.webp_path : row.original_path;
    if (!rel.startsWith('/')) continue;
    const file = path.join(process.cwd(), 'public', rel.replace(/^\//, ''));
    if (!fs.existsSync(file)) continue;
    try {
      const meta = await sharp(file).metadata();
      if (meta.width === undefined || meta.height === undefined) continue;
      update.run(meta.width, meta.height, row.id);
      filled += 1;
    } catch {
      /** An unreadable file keeps its dash rather than failing the scan. */
    }
  }
  return filled;
}
