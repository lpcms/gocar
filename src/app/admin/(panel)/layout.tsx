import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { verifySession } from '@/lib/auth';
import { AdminSidebar } from '@/app/admin/admin-sidebar';
import { ToastProvider } from '@/app/admin/admin-toast';
import '../admin.css';

/**
 * Guarded admin shell: session check (server) + client-side sidebar
 * with a URL-driven active highlight.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const token = store.get('gocar_admin')?.value ?? '';
  if (verifySession(token) === null) {
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
