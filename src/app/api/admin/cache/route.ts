import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { requireAdmin } from '@/lib/admin-guard';

/**
 * Cache maintenance for the public site.
 *
 * Next's own route cache under .next/cache can keep serving a response
 * produced before the latest admin edits. Clearing it makes the next request
 * re-render from current data. Only cached artefacts are removed - nothing
 * that cannot be rebuilt automatically.
 */

const ROOT = process.cwd();

/**
 * Recursively delete files matching a predicate, returning how many were
 * removed and how many bytes they occupied. Missing directories are not an
 * error: there is simply nothing cached yet.
 */
function purge(dir: string, matches: (file: string) => boolean): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  if (!fs.existsSync(dir)) return { files, bytes };
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = purge(full, matches);
      files += sub.files;
      bytes += sub.bytes;
      continue;
    }
    if (!matches(full)) continue;
    try {
      bytes += fs.statSync(full).size;
      fs.unlinkSync(full);
      files += 1;
    } catch {
      /** A file held open by another process is skipped, not fatal. */
    }
  }
  return { files, bytes };
}

/**
 * Clear the public-site caches and report what was removed.
 */
export async function POST(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied !== null) return denied;

  const started = Date.now();
  const steps: Array<{ label: string; files: number; bytes: number }> = [];

  const nextCache = purge(path.join(ROOT, '.next', 'cache'), () => true);
  steps.push({ label: 'Кеш Next.js', ...nextCache });

  const totalFiles = steps.reduce((n, s) => n + s.files, 0);
  const totalBytes = steps.reduce((n, s) => n + s.bytes, 0);

  return NextResponse.json({
    ok: true,
    steps,
    totalFiles,
    totalBytes,
    ms: Date.now() - started
  });
}
