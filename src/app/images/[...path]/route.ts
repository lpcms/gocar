import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { fileResponse } from '@/lib/file-serve';

/**
 * Images imported into the project after the build.
 *
 * Same story as public/uploads: written after the build, so Next's static
 * handler does not know about them. The phase-1 catch-all used to pick them
 * up; it no longer owns any path, so the prefix has a route of its own.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const parts = (await ctx.params).path;
  const clean = decodeURIComponent(parts.join('/'));
  if (clean.includes('..')) {
    return new NextResponse('404 Not Found', { status: 404 });
  }
  const local = path.join(process.cwd(), 'public', 'images', clean);
  if (fs.existsSync(local) && fs.statSync(local).isFile()) {
    return fileResponse(req, local);
  }
  return new NextResponse('404 Not Found', { status: 404 });
}
