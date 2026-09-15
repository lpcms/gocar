import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { currentAdminId } from '@/lib/admin-guard';
import { AdminSidebar } from '@/app/admin/admin-sidebar';
import { ToastProvider } from '@/app/admin/admin-toast';
import '../admin.css';

/**
 * Guarded admin shell: session check (server) + client-side sidebar
 * with a URL-driven active highlight.
 *
 * Through the same resolver the API routes use, so the pages and the endpoints
 * agree on what a valid session is - including that the account behind it
 * still exists.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if ((await currentAdminId()) === null) {
    redirect('/admin/login');
  }
  return (
    <ToastProvider>
      <div className="a-shell">
        <AdminSidebar />
        <main className="a-main">{children}</main>
      </div>
    </ToastProvider>
  );
}
