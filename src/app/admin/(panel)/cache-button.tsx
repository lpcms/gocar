'use client';

import { useState } from 'react';
import { useToast } from '../admin-toast';

interface PurgeStep {
  label: string;
  files: number;
  bytes: number;
}

interface PurgeResult {
  ok: boolean;
  steps: PurgeStep[];
  totalFiles: number;
  totalBytes: number;
  ms: number;
}

/**
 * Format a byte count for display in the admin UI.
 */
function humanSize(bytes: number): string {
  if (bytes <= 0) return '0 КБ';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1048576).toFixed(1)} МБ`;
}

/**
 * Dashboard tile that clears the public-site caches.
 *
 * Rendered as a normal stat tile so it lines up with the counters next to
 * it. While the request is in flight the tile reports progress and is
 * disabled, so it is always clear whether the work has finished; each step
 * and the final summary are also announced through the standard toast.
 */
export default function CacheButton() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const toast = useToast();

  async function clearCache() {
    if (busy) return;
    setBusy(true);
    setStatus('Очистка…');
    toast.push('Очистка кеша начата');
    try {
      const res = await fetch('/api/admin/cache', { method: 'POST' });
      if (!res.ok) {
        setStatus('Ошибка');
        toast.push(`Ошибка очистки кеша (${res.status})`);
        return;
      }
      const data = (await res.json()) as PurgeResult;
      for (const step of data.steps) {
        toast.push(`${step.label}: ${step.files} файл(ов), ${humanSize(step.bytes)}`);
      }
      setStatus(`Готово · ${data.totalFiles} файл(ов)`);
      toast.push(
        `Кеш очищен: ${data.totalFiles} файл(ов), ${humanSize(data.totalBytes)} за ${data.ms} мс`
      );
    } catch {
      setStatus('Ошибка');
      toast.push('Не удалось очистить кеш');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="a-stat">
      <button
        className="a-btn"
        onClick={() => void clearCache()}
        disabled={busy}
        style={{ width: '100%' }}
      >
        {busy ? 'Очистка…' : 'Очистить кеш'}
      </button>
      <div className="l" style={{ marginTop: 8 }}>
        {status !== '' ? status : 'Кеш публичных страниц'}
      </div>
    </div>
  );
}
