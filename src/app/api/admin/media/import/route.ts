import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';
import { backfillDimensions } from '@/lib/media';

/**
 * Scan the snapshot asset directories for images and register any that
 * are not yet in the media table, so they appear in the library and can
 * receive EN/UA alt text. Existing files are referenced in place (no
 * re-processing); original_path uniqueness prevents duplicate imports.
 *
 * Covered directories (relative to /public): assets/img, assets/framer,
 * uploads - minus the folders of the sections that manage their own pictures,
 * uploads/cars (Автомобили) and uploads/review (Отзывы), which a scan steps
 * over. Recognised extensions: webp, png, jpg, jpeg, avif, gif, svg.
 */

const PUBLIC = path.join(process.cwd(), 'public');
/**
 * Directories scanned for images (relative to /public). Scanning is recursive,
 * apart from the folders that belong to a section of their own.
 */
const SCAN_DIRS = ['assets/img', 'assets/framer', 'uploads'];
/**
 * Folders whose images are not the library's business. Car photos are uploaded
 * and described in Автомобили and review avatars in Отзывы - each with its own
 * upload field and its own EN/UA alt - so a scan must never sweep them into the
 * general Images library, where they would show up a second time and be
 * editable from two places at once. The walk does not descend into them, and
 * the folders are created on every scan so an upload always has a home.
 */
const SECTION_DIRS = [
  'uploads/cars',
  'uploads/avto',
  'uploads/review',
  'uploads/reviews',
  'assets/img/cars',
  'assets/img/reviews'
];
/**
 * Of those, the ones an upload actually writes to, created on every scan so a
 * fresh install always has them. The rest of SECTION_DIRS are older or
 * alternative spellings the walk steps over as well, so a photo left behind by
 * an install that has not run the folder migration yet is still never adopted.
 */
const ENSURE_DIRS = ['uploads/cars', 'uploads/review'];
const IMAGE_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg', '.avif', '.gif', '.svg']);

/**
 * Recursively list image files under a directory, returning their
 * public-relative URL paths (leading slash). Section folders are stepped over.
 */
function listImages(relDir: string): string[] {
  const abs = path.join(PUBLIC, relDir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      const rel = full.slice(PUBLIC.length).split(path.sep).join('/').replace(/^\//, '');
      if (stat.isDirectory()) {
        if (!SECTION_DIRS.includes(rel)) walk(full);
        continue;
      }
      if (!IMAGE_EXT.has(path.extname(name).toLowerCase())) continue;
      out.push(`/${rel}`);
    }
  };
  walk(abs);
  return out;
}

export async function POST(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;

  /**
   * Ensure the per-section image folders exist so uploads/moves have a
   * home even before any images are placed there.
   */
  for (const dir of ENSURE_DIRS) {
    try {
      fs.mkdirSync(path.join(PUBLIC, dir), { recursive: true });
    } catch {
      /* ignore */
    }
  }

  const db = getDb();
  /**
   * Guard against duplicates by file hash (base name without dir/extension),
   * not just exact path: the same image can already be registered under a
   * different path form (e.g. .webp vs .png), and re-adding it would show it
   * twice. Load the set of hashes already present once.
   */
  const hashOf = (p: string): string => {
    let s = String(p ?? '').split('?')[0] ?? '';
    const slash = s.lastIndexOf('/');
    if (slash !== -1) s = s.slice(slash + 1);
    const dot = s.lastIndexOf('.');
    if (dot !== -1) s = s.slice(0, dot);
    return s;
  };
  const existingHashes = new Set<string>();
  for (const r of db.prepare('SELECT original_path, webp_path FROM media').all() as unknown as Array<{ original_path: string; webp_path: string }>) {
    existingHashes.add(hashOf(r.webp_path || r.original_path));
    existingHashes.add(hashOf(r.original_path || r.webp_path));
  }
  /**
   * A review avatar is a bare path on the review, with no media row behind it,
   * so the hashes above would not cover it. It belongs to Отзывы just as a car
   * photo belongs to Автомобили, and is skipped for the same reason.
   */
  for (const r of db.prepare(
    "SELECT avatar_url FROM reviews WHERE avatar_url IS NOT NULL AND avatar_url <> ''"
  ).all() as unknown as Array<{ avatar_url: string }>) {
    existingHashes.add(hashOf(r.avatar_url));
  }
  /**
   * Newly discovered files enter the general Images library. Files already in
   * media (including car photos tagged 'avto' and review photos tagged
   * 'review') are skipped by hash, so a scan never duplicates or pulls them
   * back into the general library.
   */
  const insert = db.prepare(
    `INSERT INTO media (original_path, webp_path, width, height, alt_en, alt_ua, folder)
     VALUES (?, ?, ?, ?, '', '', 'general')`
  );

  const { default: sharp } = await import('sharp');

  /**
   * Read pixel dimensions of a public-relative image; null on failure
   * (e.g. SVG without intrinsic size or unreadable file).
   */
  const dimsOf = async (url: string): Promise<{ w: number | null; h: number | null }> => {
    try {
      const abs = path.join(PUBLIC, url.replace(/^\//, ''));
      const meta = await sharp(abs).metadata();
      return { w: meta.width ?? null, h: meta.height ?? null };
    } catch {
      return { w: null, h: null };
    }
  };

  let imported = 0;
  let skipped = 0;
  for (const dir of SCAN_DIRS) {
    for (const url of listImages(dir)) {
      const h = hashOf(url);
      if (existingHashes.has(h)) {
        skipped += 1;
        continue;
      }
      /**
       * Snapshot images are already web-ready; reference the same file
       * for both original and webp columns without re-encoding, but record
       * real dimensions so the library can show them.
       */
      const { w, h: hgt } = await dimsOf(url);
      insert.run(url, url, w, hgt);
      existingHashes.add(h);
      imported += 1;
    }
  }

  /**
   * Keep the library clean: any media row referenced by a car (image_id or
   * preview*_id) belongs to the car photos folder, not the general library.
   * Re-tag such rows as 'avto' so a scan can never surface car photos in the
   * Images section, even if they were registered as general earlier.
   */
  const reclass = db.prepare(
    `UPDATE media SET folder = 'avto'
     WHERE folder = 'general'
       AND id IN (
         SELECT image_id FROM cars WHERE image_id IS NOT NULL
         UNION SELECT preview1_id FROM cars WHERE preview1_id IS NOT NULL
         UNION SELECT preview2_id FROM cars WHERE preview2_id IS NOT NULL
         UNION SELECT preview3_id FROM cars WHERE preview3_id IS NOT NULL
       )`
  );
  /**
   * The same for a review avatar, which points at its file by path rather than
   * by media id.
   */
  const reclassReview = db.prepare(
    `UPDATE media SET folder = 'review'
     WHERE folder = 'general'
       AND (
         original_path IN (SELECT avatar_url FROM reviews WHERE avatar_url IS NOT NULL)
         OR webp_path IN (SELECT avatar_url FROM reviews WHERE avatar_url IS NOT NULL)
       )`
  );
  const reclassified = Number(reclass.run().changes) + Number(reclassReview.run().changes);

  /**
   * Rows registered before the library could read every format (the site's own
   * SVG and WebP imagery) carry no pixel size and show a dash. A scan is the
   * natural place to repair them, so nobody has to run a migration by hand.
   */
  const measured = await backfillDimensions();

  return NextResponse.json({ ok: true, imported, skipped, reclassified, measured });
}
