'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminModal } from '@/app/admin/admin-modal';
import { useToast } from '@/app/admin/admin-toast';

interface Redirect {
  id: number;
  from_path: string;
  to_path: string;
  type: 301 | 302;
  created_at: string;
}

const EMPTY: Omit<Redirect, 'id' | 'created_at'> = {
  from_path: '', to_path: '', type: 301
};

/**
 * Redirects manager: search + add-modal on top, inline editable table.
 * Server-side guard rejects cycles (409 cycle) and duplicate sources
 * (409 from_taken); errors are surfaced as toasts.
 */
export default function RedirectsPage() {
  const [items, setItems] = useState<Redirect[] | null>(null);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<null | typeof EMPTY>(null);
  const toast = useToast();

  async function load() {
    const res = await fetch('/api/admin/redirects');
    const data = (await res.json()) as { items: Redirect[] };
    setItems(data.items);
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    if (items === null) return [];
    const q = query.trim().toLowerCase();
    if (q === '') return items;
    return items.filter((r) =>
      r.from_path.toLowerCase().includes(q) || r.to_path.toLowerCase().includes(q)
    );
  }, [items, query]);

  function surfaceError(res: Response, data: { error?: string }): void {
    if (res.status === 409 && data.error === 'cycle') toast.push('Обнаружен цикл');
    else if (res.status === 409 && data.error === 'from_taken') toast.push('Такой источник уже есть');
    else if (res.status === 422) toast.push('Заполните оба пути');
    else toast.push('Ошибка сохранения');
  }

  async function create() {
    if (modal === null) return;
    const res = await fetch('/api/admin/redirects', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(modal)
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return surfaceError(res, data);
    toast.push('Создано'); setModal(null); void load();
  }
  async function save(row: Redirect) {
    const res = await fetch(`/api/admin/redirects/${row.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(row)
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return surfaceError(res, data);
    toast.push('Сохранено'); void load();
  }
  async function remove(row: Redirect) {
    if (!confirm(`Удалить редирект "${row.from_path}"?`)) return;
    const res = await fetch(`/api/admin/redirects/${row.id}`, { method: 'DELETE' });
    toast.push(res.ok ? 'Удалено' : 'Ошибка'); void load();
  }

  if (items === null) return <div>Загрузка…</div>;
  return (
    <div>
      <div className="a-toolbar">
        <h1>Редиректы</h1>
        <input className="a-input a-search" placeholder="Поиск по путям…"
          value={query} onChange={(e) => setQuery(e.target.value)}/>
        <button className="a-btn" onClick={() => setModal({ ...EMPTY })}>+ Добавить</button>
      </div>
      <div className="a-card" style={{ color: '#7a7f89' }}>
        Пути указываются с ведущим слэшем: <code>/old-page</code> → <code>/new-page</code>.
        Внешний URL (https://…) допустим как цель. Циклы и дубли источника отклоняются.
      </div>
      <table className="a-table">
        <thead>
          <tr>
            <th>Откуда</th>
            <th>Куда</th>
            <th style={{ width: 90 }}>Код</th>
            <th style={{ width: 160 }}>Создан</th>
            <th style={{ width: 200 }}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => {
            const idx = items.indexOf(row);
            return (
              <tr key={row.id}>
                <td><input className="a-input" value={row.from_path}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,from_path:e.target.value}; setItems(n); }}/></td>
                <td><input className="a-input" value={row.to_path}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,to_path:e.target.value}; setItems(n); }}/></td>
                <td>
                  <select className="a-input" value={row.type}
                    onChange={(e) => { const n=[...items]; n[idx]={...row,type:Number(e.target.value) as 301|302}; setItems(n); }}>
                    <option value={301}>301</option>
                    <option value={302}>302</option>
                  </select>
                </td>
                <td style={{ fontSize: 12, color: '#7a7f89' }}>{row.created_at}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="a-btn" onClick={() => void save(row)}>Сохранить</button>{' '}
                  <button className="a-btn ghost" onClick={() => void remove(row)}>Удалить</button>
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: '#7a7f89' }}>Ничего не найдено</td></tr>
          )}
        </tbody>
      </table>
      {modal !== null && (
        <AdminModal title="Новый редирект" onClose={() => setModal(null)}>
          <label><b>Откуда</b>
            <input className="a-input" placeholder="/old-page" value={modal.from_path}
              onChange={(e) => setModal({ ...modal, from_path: e.target.value })}/></label>
          <label><b>Куда</b>
            <input className="a-input" placeholder="/new-page или https://…" value={modal.to_path}
              onChange={(e) => setModal({ ...modal, to_path: e.target.value })}/></label>
          <label><b>Код</b>
            <select className="a-input" value={modal.type}
              onChange={(e) => setModal({ ...modal, type: Number(e.target.value) as 301|302 })}>
              <option value={301}>301 — постоянный</option>
              <option value={302}>302 — временный</option>
            </select></label>
          <button className="a-btn" onClick={() => void create()}>Создать</button>
        </AdminModal>
      )}
    </div>
  );
}
