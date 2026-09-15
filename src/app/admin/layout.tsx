import type { ReactNode } from 'react';

/**
 * Root layout of the admin panel. It used to live at src/app/layout.tsx and be
 * shared with the public render, which forced a single <html lang> on both;
 * the phase-2 site needs its own per-locale document, so each tree now owns a
 * root layout of its own.
 *
 * The interactions stylesheet that the shared layout linked is gone: it targets
 * legacy .gocar-* hooks that exist only in the Framer snapshots, and those are
 * served by the catch-all route handler, which no layout applies to.
 */
/**
 * `robots: noindex` on the whole tree, as a second lock next to the
 * `X-Robots-Tag` header in next.config.mjs: the header is the one that also
 * covers non-HTML answers, this one survives a proxy that strips headers. The
 * page it matters for is `/admin/login` - everything behind it redirects a
 * visitor without a session, and a crawler never has one.
 */
export const metadata = {
  title: 'GoCar - Rent a car in Uzhhorod',
  robots: { index: false, follow: false }
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
