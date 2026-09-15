'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminModal } from '@/app/admin/admin-modal';
import { useToast } from '@/app/admin/admin-toast';

interface Row {
  key: string;
  en_value: string | null;
  en_status: 'new' | 'done';
  ua_value: string | null;
  ua_status: 'new' | 'done';
}

const EMPTY = { key: '', en_value: '', ua_value: '' };

/**
 * UI translations manager: search + status filter + add-modal on top,
 * inline editable rows in the table below. Statuses NEW / DONE reflect
 * whether the value is present; saving refreshes both.
 */
export default function TranslationsPage() {
  const [items, setItems] = useState<Row[] | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'new' | 'done'>('');
  const [modal, setModal] = useState<null | typeof EMPTY>(null);
  const toast = useToast();

  async function load() {
    const res = await fetch('/api/admin/translations');
    const data = (await res.json()) as { items: Row[] };
    setItems(data.items);
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    if (items === null) return [];
    const q = query.trim().toLowerCase();
    return items.filter((r) => {
      if (statusFilter === 'new' && r.en_status === 'done' && r.ua_status === 'done') return false;
      if (statusFilter === 'done' && (r.en_status === 'new' || r.ua_status === 'new')) return false;
      if (q === '') return true;
      return (
        r.key.toLowerCase().includes(q) ||
        (r.en_value ?? '').toLowerCase().includes(q) ||
        (r.ua_value ?? '').toLowerCase().includes(q)
      );
    });
  }, [items, query, statusFilter]);

  const stats = useMemo(() => {
    if (items === null) return { total: 0, needsWork: 0 };
    const needsWork = items.filter((r) => r.en_status === 'new' || r.ua_status === 'new').length;
    return { total: items.length, needsWork };
  }, [items]);

  async function create() {
    if (modal === null) return;
    if (!modal.key.trim()) return toast.push('Ключ обязателен');
    const res = await fetch('/api/admin/translations', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(modal)
    });
    if (res.status === 409) return toast.push('Ключ уже занят');
    if (!res.ok) return toast.push('Ошибка создания');
    setModal(null); void load();
  }
  async function save(row: Row) {
    const res = await fetch(`/api/admin/translations/${encodeURIComponent(row.key)}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ en_value: row.en_value ?? '', ua_value: row.ua_value ?? '' })
    });
    toast.push(res.ok ? 'Сохранено' : 'Ошибка сохранения');
    void load();
  }
  async function remove(row: Row) {
    if (!confirm(`Удалить ключ "${row.key}"?`)) return;
    const res = await fetch(`/api/admin/translations/${encodeURIComponent(row.key)}`, { method: 'DELETE' });
    toast.push(res.ok ? 'Удалено' : 'Ошибка'); void load();
  }

  if (items === null) return <div>Загрузка…</div>;
  const filters: Array<[typeof statusFilter, string]> = [
    ['', 'все'], ['new', 'непереведённые'], ['done', 'готовые']
  ];
  return (
    <div>
      <div className="a-toolbar">
        <h1>Переводы UI</h1>
        <input className="a-input a-search" placeholder="Поиск по ключу или значению…"
          value={query} onChange={(e) => setQuery(e.target.value)}/>
        <button className="a-btn" onClick={() => setModal({ ...EMPTY })}>+ Добавить</button>
      </div>
      <div className="a-card" style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <div>Всего ключей: <b>{stats.total}</b></div>
        <div>Требуют перевода: <b style={{ color: stats.needsWork > 0 ? '#fd3b3b' : '#1d7a3d' }}>
          {stats.needsWork}</b></div>
        <div className="a-filters" style={{ marginLeft: 'auto' }}>
          {filters.map(([value, label]) => (
            <a key={label} href="#"
               className={statusFilter === value ? 'active' : ''}
               onClick={(e) => { e.preventDefault(); setStatusFilter(value); }}>
              {label}
            </a>
          ))}
        </div>
      </div>
      <table className="a-table">
        <thead>
          <tr>
            <th>EN</th>
            <th>UA</th>
            <th>Ключ</th>
            <th style={{ width: 90 }}>EN</th>
            <th style={{ width: 90 }}>UA</th>
            <th style={{ width: 200 }}></th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            /**
             * Group rows by the page prefix (text before the first dot in
             * the key). Keys without a dot fall under "Общие". A header row
             * is emitted whenever the group changes.
             */
            const groupOf = (key: string): string => {
              const dot = key.indexOf('.');
              return dot > 0 ? key.slice(0, dot) : 'Общие';
            };
            let lastGroup = '';
            const out: React.JSX.Element[] = [];
            for (const row of filtered) {
              const idx = items.indexOf(row);
              const group = groupOf(row.key);
              if (group !== lastGroup) {
                lastGroup = group;
                out.push(
                  <tr key={`group-${group}`}>
                    <td colSpan={6} style={{
                      background: '#f4f5f7', fontWeight: 700, textTransform: 'uppercase',
                      fontSize: 12, letterSpacing: 0.4, color: '#4a4f59'
                    }}>{group}</td>
                  </tr>
                );
              }
              const enVal = row.en_value ?? '';
              const uaVal = row.ua_value ?? '';
              /**
               * Use a multi-line textarea once either side's text is long
               * enough that a single-line input becomes awkward to edit.
               */
              const longField = Math.max(enVal.length, uaVal.length) > 60;
              out.push(
                <tr key={row.key}>
                  <td>{longField
                    ? <textarea className="a-input" rows={3} value={enVal}
                        onChange={(e) => { const n=[...items]; n[idx]={...row,en_value:e.target.value}; setItems(n); }}/>
                    : <input className="a-input" value={enVal}
                        onChange={(e) => { const n=[...items]; n[idx]={...row,en_value:e.target.value}; setItems(n); }}/>}</td>
                  <td>{longField
                    ? <textarea className="a-input" rows={3} value={uaVal}
                        onChange={(e) => { const n=[...items]; n[idx]={...row,ua_value:e.target.value}; setItems(n); }}/>
                    : <input className="a-input" value={uaVal}
                        onChange={(e) => { const n=[...items]; n[idx]={...row,ua_value:e.target.value}; setItems(n); }}/>}</td>
                  <td style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, color: '#7a7f89' }}>
                    {row.key}
                  </td>
                  <td><span className={`a-badge ${row.en_status === 'done' ? 'success' : 'failure'}`}>
                    {row.en_status === 'done' ? 'DONE' : 'NEW'}</span></td>
                  <td><span className={`a-badge ${row.ua_status === 'done' ? 'success' : 'failure'}`}>
                    {row.ua_status === 'done' ? 'DONE' : 'NEW'}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="a-btn" onClick={() => void save(row)}>Сохранить</button>{' '}
                    <button className="a-btn ghost" onClick={() => void remove(row)}>Удалить</button>
                  </td>
                </tr>
              );
            }
            return out;
          })()}
          {filtered.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center', color: '#7a7f89' }}>Ничего не найдено</td></tr>
          )}
        </tbody>
      </table>
      {modal !== null && (
        <AdminModal title="Новый ключ перевода" onClose={() => setModal(null)}>
          <label><b>Ключ</b>
            <input className="a-input" value={modal.key} placeholder="напр. form.thank_you"
              onChange={(e) => setModal({ ...modal, key: e.target.value })}/></label>
          <label><b>Значение EN</b>
            <textarea className="a-input" rows={2} value={modal.en_value}
              onChange={(e) => setModal({ ...modal, en_value: e.target.value })}/></label>
          <label><b>Значение UA</b>
            <textarea className="a-input" rows={2} value={modal.ua_value}
              onChange={(e) => setModal({ ...modal, ua_value: e.target.value })}/></label>
          <button className="a-btn" onClick={() => void create()}>Создать</button>
        </AdminModal>
      )}
    </div>
  );
}
