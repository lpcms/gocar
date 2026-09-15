'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface Toast { id: number; text: string; }
interface Ctx { push: (text: string) => void; }

const ToastCtx = createContext<Ctx>({ push: () => undefined });

/**
 * useToast() from any admin client component: push('Сохранено').
 * The toast fades in the center of the viewport for ~2 seconds.
 */
export function useToast(): Ctx {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text }]);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="a-toast-stack">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={(id) => setToasts((prev) => prev.filter((p) => p.id !== id))}/>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDone(toast.id), 2000);
    return () => clearTimeout(t);
  }, [toast.id, onDone]);
  return <div className="a-toast">{toast.text}</div>;
}
