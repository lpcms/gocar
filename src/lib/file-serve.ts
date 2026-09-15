import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Serving files from disk for the routes that Next's static handler cannot
 * cover, extracted from the phase-1 catch-all when the public pages moved to
 * their own app routes (22.08.2026).
 *
 * `public/uploads` and `public/images` are written after the build, so the
 * static handler does not know they exist.
 *
 * The byte-range handling is the delicate part and is preserved verbatim: the
 * Framer CMS loader asks for slices with a `?range=` query and validates the
 * returned length, so that form must get a 200 with a sliced body, while a
 * real HTTP `Range:` header gets a standard 206.
 */

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};


/**
 * Send one file, honouring both range forms.
 */
export function fileResponse(req: NextRequest, file: string, status = 200): NextResponse {
  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  const noStore = file.endsWith('.framercms');
  const cache = noStore ? 'no-store' : 'public, max-age=3600';
  const size = fs.statSync(file).size;

  /**
   * Byte-range selection. The Framer CMS loader requests slices of
   * .framercms index/data files and validates the returned length against
   * the slice it asked for. It passes the range as a `?range=start-end`
   * query parameter (not an HTTP Range header); returning the whole file
   * for such a request produces "Request failed: Unexpected response
   * length" and a fatal blank page. Honor both forms — the query parameter
   * and a standard Range header.
   */
  const headerRange = req.headers.get('range');
  let queryRange: string | null = null;
  try {
    const q = new URL(req.url).searchParams.get('range');
    if (q !== null) queryRange = `bytes=${q}`;
  } catch {
    /* ignore malformed URL */
  }
  /**
   * Prefer the query-parameter range: it is the Framer CMS loader's own
   * mechanism and, unlike an HTTP Range header, it expects a plain 200
   * response whose body is exactly the requested slice (a 206 makes the
   * loader throw "Request failed: 206 Partial Content"). A real HTTP Range
   * header still gets a standard 206.
   */
  const fromQuery = queryRange !== null;
  const range = queryRange ?? headerRange;
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (m && ((m[1] ?? '') !== '' || (m[2] ?? '') !== '')) {
    const g1 = m[1] ?? '';
    const g2 = m[2] ?? '';
    let start = g1 === '' ? size - Number(g2) : Number(g1);
    let end = g1 !== '' && g2 !== '' ? Number(g2) : size - 1;
    if (start < 0) start = 0;
    if (end >= size) end = size - 1;
    if (start > end || start >= size) {
      return new NextResponse(null, {
        status: 416,
        headers: { 'content-range': `bytes */${size}` }
      });
    }
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(end - start + 1);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    const rangeHeaders: Record<string, string> = {
      'content-type': type,
      'content-length': String(buf.length),
      'accept-ranges': 'bytes',
      'cache-control': cache
    };
    if (!fromQuery) {
      rangeHeaders['content-range'] = `bytes ${start}-${end}/${size}`;
    }
    return new NextResponse(new Uint8Array(buf), {
      status: fromQuery ? 200 : 206,
      headers: rangeHeaders
    });
  }
  return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
    status,
    headers: {
      'content-type': type,
      'content-length': String(size),
      'accept-ranges': 'bytes',
      'cache-control': cache
    }
  });
}
