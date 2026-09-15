'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';

/**
 * Reusable modal for admin forms (create/edit). Close on backdrop click
 * and on Escape; scroll-lock while open.
 */
export function AdminModal({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div className="a-modal-overlay" onClick={onClose}>
      <div className="a-modal" onClick={(e) => e.stopPropagation()}>
        <div className="a-modal-head">
          <h2>{title}</h2>
          <button className="a-modal-close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="a-modal-body">{children}</div>
      </div>
    </div>
  );
}
