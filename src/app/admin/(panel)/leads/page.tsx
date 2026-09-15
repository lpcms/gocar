'use client';


import { useCallback, useEffect, useState } from 'react';

interface Lead {
  id: number;
  type: 'booking' | 'contact';
  status: 'new' | 'processed';
  locale: string;
  name: string;
  phone: string | null;
  email: string | null;
  days: number | null;
  grand_total: number | null;
  car_title: string | null;
  score: number | null;
  created_at: string;
}

/**
 * Leads list with filters (type / status / date range), pagination
 * and a link to the detail page.
 */
export default function LeadsPage() {
  const [items, setItems] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    if (type) qs.set('type', type);
    if (status) qs.set('status', status);
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const res = await fetch(`/api/admin/leads?${qs.toString()}`);
    const data = (await res.json()) as { items: Lead[]; total: number; perPage: number };
    setItems(data.items); setTotal(data.total); setPerPage(data.perPage);
  }, [page, type, status, from, to]);
  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const typeFilters: Array<[string, string]> = [
    ['', 'все'], ['booking', 'заказы'], ['contact', 'контакты']
  ];
  const statusFilters: Array<[string, string]> = [
    ['', 'все статусы'], ['new', 'новые'], ['processed', 'обработанные']
  ];

  return (
    <div>
      <div className="a-toolbar">
        <h1>Заявки</h1>
      </div>
      <div className="a-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
          <label><b>Тип</b>
            <select className="a-input" value={type}
              onChange={(e) => { setPage(1); setType(e.target.value); }}>
              {typeFilters.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </select></label>
          <label><b>Статус</b>
            <select className="a-input" value={status}
              onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
              {statusFilters.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </select></label>
          <label><b>С даты</b>
            <input className="a-input" type="date" value={from}
              onChange={(e) => { setPage(1); setFrom(e.target.value); }}/></label>
          <label><b>По дату</b>
            <input className="a-input" type="date" value={to}
              onChange={(e) => { setPage(1); setTo(e.target.value); }}/></label>
        </div>
      </div>
      <table className="a-table">
        <thead>
          <tr>
            <th style={{ width: 60 }}>#</th>
            <th style={{ width: 150 }}>Дата</th>
            <th style={{ width: 90 }}>Сумма $</th>
            <th style={{ width: 100 }}>Тип</th>
            <th style={{ width: 100 }}>Статус</th>
            <th>Имя</th>
            <th>Контакт</th>
            <th>Авто</th>
            <th style={{ width: 60 }}>Дни</th>
            <th style={{ width: 70 }}>Оценка</th>
            <th style={{ width: 100 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td style={{ fontSize: 12, color: '#7a7f89' }}>{r.created_at}</td>
              <td>{r.grand_total !== null ? `$${r.grand_total}` : '—'}</td>
              <td>
                <span className={`a-badge ${r.type === 'booking' ? 'success' : 'blocked'}`}>
                  {r.type === 'booking' ? 'заказ' : 'контакт'}
                </span>
              </td>
              <td>
                <span className={`a-badge ${r.status === 'new' ? 'failure' : 'success'}`}>
                  {r.status === 'new' ? 'новая' : 'обработана'}
                </span>
              </td>
              <td>{r.name}</td>
              <td>{r.phone ?? r.email ?? '—'}</td>
              <td>{r.car_title ?? '—'}</td>
              <td style={{ textAlign: 'center' }}>{r.days ?? '—'}</td>
              <td style={{ textAlign: 'center' }}>
                {r.score !== null ? r.score.toFixed(1) : '—'}
              </td>
              <td>
                <a className="a-btn" href={`/admin/leads/${r.id}`}>Открыть</a>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={11} style={{ textAlign: 'center', color: '#7a7f89' }}>
              Ничего не найдено
            </td></tr>
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
