'use client';

import { useToast } from '@/app/admin/admin-toast';

import { use, useEffect, useState } from 'react';

interface Lead {
  id: number;
  type: 'booking' | 'contact';
  status: 'new' | 'processed';
  locale: string;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  source_page: string | null;
  car_title: string | null;
  pickup_at: string | null;
  pickup_place: string | null;
  dropoff_at: string | null;
  dropoff_place: string | null;
  extras_json: string | null;
  comment: string | null;
  days: number | null;
  rental_total: number | null;
  extras_total: number | null;
  deposit: number | null;
  grand_total: number | null;
  created_at: string;
}

interface ExtraItem { label: string; price: number; }

/**
 * Lead detail: booking card mirrors the confirmation modal, contact
 * card shows the message. Status toggle and delete on top.
 */
export default function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lead, setLead] = useState<Lead | null>(null);
  const toast = useToast();

  async function load() {
    const res = await fetch(`/api/admin/leads/${id}`);
    const data = (await res.json()) as { lead: Lead };
    setLead(data.lead);
  }
  useEffect(() => { void load(); }, [id]);
  const note = (t: string) => toast.push(t);

  async function toggleStatus() {
    if (!lead) return;
    const next = lead.status === 'new' ? 'processed' : 'new';
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: next })
    });
    note(res.ok ? 'Статус обновлён' : 'Ошибка'); void load();
  }
  async function remove() {
    if (!confirm('Удалить заявку?')) return;
    const res = await fetch(`/api/admin/leads/${id}`, { method: 'DELETE' });
    if (res.ok) window.location.href = '/admin/leads';
    else note('Ошибка удаления');
  }

  if (lead === null) return <div>Загрузка…</div>;

  const extras: ExtraItem[] = lead.extras_json ? JSON.parse(lead.extras_json) : [];
  const rows: Array<[string, string | number | null]> =
    lead.type === 'booking'
      ? [
          ['Имя', lead.name], ['Телефон', lead.phone],
          ['Автомобиль', lead.car_title], ['Локаль', lead.locale],
          ['Подача', lead.pickup_at ? `${lead.pickup_at}, ${lead.pickup_place ?? ''}` : null],
          ['Возврат', lead.dropoff_at ? `${lead.dropoff_at}, ${lead.dropoff_place ?? ''}` : null],
          ['Комментарий', lead.comment]
        ]
      : [
          ['Имя', lead.name], ['Email', lead.email],
          ['Страница', lead.source_page], ['Локаль', lead.locale]
        ];

  return (
    <div>
      <div className="a-toolbar">
        <h1>Заявка #{lead.id}</h1>
        <a className="a-btn ghost" href="/admin/leads">← К списку</a>
        <button className="a-btn" onClick={() => void toggleStatus()}>
          {lead.status === 'new' ? 'Взять в работу' : 'Вернуть в «новые»'}
        </button>
        <button className="a-btn ghost" onClick={() => void remove()}>Удалить</button>
      </div>
      <div className="a-card">
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <span className={`a-badge ${lead.type === 'booking' ? 'success' : 'blocked'}`}>
            {lead.type === 'booking' ? 'заказ' : 'контакт'}
          </span>
          <span className={`a-badge ${lead.status === 'new' ? 'failure' : 'success'}`}>
            {lead.status === 'new' ? 'новая' : 'обработана'}
          </span>
          <span style={{ color: '#7a7f89' }}>{lead.created_at}</span>
        </div>
        <table className="a-table">
          <tbody>
            {rows.filter(([, v]) => v).map(([k, v]) => (
              <tr key={k}><td style={{ width: 180, color: '#7a7f89' }}>{k}</td><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
        {lead.type === 'contact' && lead.message !== null && (
          <div style={{ marginTop: 14 }}>
            <div style={{ color: '#7a7f89', marginBottom: 6 }}>Сообщение</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{lead.message}</div>
          </div>
        )}
        {lead.type === 'booking' && (
          <div style={{ marginTop: 14 }}>
            {extras.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: '#7a7f89', marginBottom: 6 }}>Опции</div>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {extras.map((e, i) => <li key={i}>{e.label} — ${e.price}</li>)}
                </ul>
              </div>
            )}
            <table className="a-table">
              <tbody>
                <tr><td style={{ width: 180, color: '#7a7f89' }}>Дней</td><td>{lead.days}</td></tr>
                <tr><td style={{ color: '#7a7f89' }}>Аренда</td><td>${lead.rental_total}</td></tr>
                <tr><td style={{ color: '#7a7f89' }}>Опции</td><td>${lead.extras_total}</td></tr>
                <tr><td style={{ color: '#7a7f89' }}>Депозит</td><td>${lead.deposit}</td></tr>
                <tr><td style={{ color: '#fd3b3b', fontWeight: 700 }}>Итого</td>
                    <td style={{ color: '#fd3b3b', fontWeight: 700 }}>${lead.grand_total}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
