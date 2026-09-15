'use client';

import { useToast } from '@/app/admin/admin-toast';

import { useCallback, useEffect, useState } from 'react';

interface Attempt {
  id: number;
  ip: string;
  login: string | null;
  result: 'success' | 'failure' | 'blocked';
  created_at: string;
}

const LABELS: Record<Attempt['result'], string> = {
  success: 'успех',
  failure: 'неудача',
  blocked: 'блокировка'
};

/**
 * Login attempts journal (client-rendered) with a result filter,
 * pagination and per-row / bulk delete.
 */
export default function LoginAttemptsPage() {
  const [items, setItems] = useState<Attempt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(30);
  const [result, setResult] = useState<string>('');

  const toast = useToast();
  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    if (result !== '') qs.set('result', result);
    const res = await fetch(`/api/admin/login-attempts?${qs.toString()}`);
    const data = (await res.json()) as {
      items: Attempt[]; total: number; perPage: number;
    };
    setItems(data.items);
    setTotal(data.total);
    setPerPage(data.perPage);
  }, [page, result]);
  useEffect(() => { void load(); }, [load]);

  async function removeOne(row: Attempt) {
    if (!confirm(`Удалить запись #${row.id}?`)) return;
    await fetch(`/api/admin/login-attempts/${row.id}`, { method: 'DELETE' });
    void load();
  }
  async function clearAll() {
    if (!confirm('Очистить весь журнал попыток входа?')) return;
    const res = await fetch('/api/admin/login-attempts?before=all', { method: 'DELETE' });
    toast.push(res.ok ? 'Журнал очищен' : 'Ошибка');
    setPage(1);
    void load();
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const filters: Array<[string, string]> = [
    ['', 'все'],
    ['success', 'успех'],
    ['failure', 'неудача'],
    ['blocked', 'блокировка']
  ];
  return (
    <div>
      <div className="a-toolbar">
        <h1>Попытки входа</h1>
        <button className="a-btn ghost" onClick={() => void clearAll()}>Очистить всё</button>
      </div>
      <p className="a-filters">
        {filters.map(([value, label]) => (
          <a
            key={label}
            href="#"
            className={result === value ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); setPage(1); setResult(value); }}
          >
            {label}
          </a>
        ))}
      </p>
      <table className="a-table">
        <thead>
          <tr>
            <th style={{ width: 180 }}>Дата (UTC)</th>
            <th>IP</th>
            <th>Логин</th>
            <th style={{ width: 130 }}>Результат</th>
            <th style={{ width: 120 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td>{r.created_at}</td>
              <td>{r.ip}</td>
              <td>{r.login ?? '—'}</td>
              <td><span className={`a-badge ${r.result}`}>{LABELS[r.result]}</span></td>
              <td><button className="a-btn ghost" onClick={() => void removeOne(r)}>Удалить</button></td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: '#7a7f89' }}>Записей нет</td></tr>
          )}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="a-pager">
          <a href="#" onClick={(e) => { e.preventDefault(); setPage(Math.max(1, page - 1)); }}>‹</a>
          <span className="muted">{page} из {totalPages}</span>
          <a href="#" onClick={(e) => { e.preventDefault(); setPage(Math.min(totalPages, page + 1)); }}>›</a>
          <span className="muted" style={{ marginLeft: 12 }}>Всего: {total}</span>
        </div>
      )}
    </div>
  );
}
