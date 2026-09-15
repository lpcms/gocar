'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminModal } from '@/app/admin/admin-modal';
import { useToast } from '@/app/admin/admin-toast';

interface Extra {
  id: number;
  slug: string;
  price: number;
  price_type: 'per_day' | 'per_order';
  is_active: number;
  sort_order: number;
  name_en: string;
  name_ua: string;
}

const EMPTY: Omit<Extra, 'id'> = {
  slug: '', name_en: '', name_ua: '', price: 0, price_type: 'per_day',
  is_active: 1, sort_order: 0
};

/**
 * Extras manager: search + add-modal on top, editable rows below.
 */
export default function ExtrasPage() {
  const [items, setItems] = useState<Extra[] | null>(null);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<null | typeof EMPTY>(null);
  const toast = useToast();

  async function load() {
    const res = await fetch('/api/admin/extras');
    const data = (await res.json()) as { items: Extra[] };
    setItems(data.items);
  }
  useEffect(() => { void load(); }, []);
  const note = (t: string) => toast.push(t);

  const filtered = useMemo(() => {
    if (items === null) return [];
    const q = query.trim().toLowerCase();
    if (q === '') return items;
    return items.filter(
      (r) => r.slug.toLowerCase().includes(q) ||
             r.name_en.toLowerCase().includes(q) ||
             r.name_ua.toLowerCase().includes(q)
    );
  }, [items, query]);

  async function create() {
    if (modal === null) return;
    const res = await fetch('/api/admin/extras', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(modal)
    });
    if (res.status === 409) return note('Slug уже занят');
    if (!res.ok) return note('Проверьте поля');
    setModal(null); void load();
  }
  async function save(row: Extra) {
    const res = await fetch(`/api/admin/extras/${row.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(row)
    });
    note(res.ok ? 'Сохранено' : 'Ошибка');
  }
  async function remove(row: Extra) {
    if (!confirm(`Удалить опцию "${row.name_en}"?`)) return;
    const res = await fetch(`/api/admin/extras/${row.id}`, { method: 'DELETE' });
    note(res.ok ? 'Удалено' : 'Ошибка'); void load();
  }

  if (items === null) return <div>Загрузка…</div>;
  return (
    <div>
      <div className="a-toolbar">
        <h1>Опции заказа (extras)</h1>
        <input className="a-input a-search" placeholder="Поиск…"
          value={query} onChange={(e) => setQuery(e.target.value)}/>
        <button className="a-btn" onClick={() => setModal({ ...EMPTY })}>+ Добавить</button>
      </div>
      <table className="a-table">
        <thead>
          <tr>
            <th>EN</th><th>UA</th><th>Slug</th>
            <th style={{ width: 130 }}>Цена $</th>
            <th style={{ width: 120 }}>Тип</th>
            <th style={{ width: 80 }}>Активно</th>
            <th style={{ width: 80 }}>Порядок</th>
            <th style={{ width: 200 }}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => {
            const idx = items.indexOf(row);
            return (
              <tr key={row.id}>
                <td><input className="a-input" value={row.name_en}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,name_en:e.target.value}; setItems(n); }}/></td>
                <td><input className="a-input" value={row.name_ua}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,name_ua:e.target.value}; setItems(n); }}/></td>
                <td><input className="a-input" value={row.slug}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,slug:e.target.value}; setItems(n); }}/></td>
                <td><input className="a-input" type="number" value={row.price} style={{ minWidth: 90 }}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,price:Number(e.target.value)}; setItems(n); }}/></td>
                <td>
                  <select className="a-input" value={row.price_type}
                    onChange={(e) => { const n=[...items]; n[idx]={...row,price_type:e.target.value as Extra['price_type']}; setItems(n); }}>
                    <option value="per_day">за день</option>
                    <option value="per_order">за заказ</option>
                  </select>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={!!row.is_active}
                    onChange={(e) => { const n=[...items]; n[idx]={...row,is_active:e.target.checked?1:0}; setItems(n); }}/>
                </td>
                <td><input className="a-input" type="number" value={row.sort_order}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,sort_order:Number(e.target.value)}; setItems(n); }}/></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="a-btn" onClick={() => void save(row)}>Сохранить</button>{' '}
                  <button className="a-btn ghost" onClick={() => void remove(row)}>Удалить</button>
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr><td colSpan={8} style={{ textAlign: 'center', color: '#7a7f89' }}>Ничего не найдено</td></tr>
          )}
        </tbody>
      </table>
      {modal !== null && (
        <AdminModal title="Новая опция" onClose={() => setModal(null)}>
          <label><b>Slug</b>
            <input className="a-input" value={modal.slug}
              onChange={(e) => setModal({ ...modal, slug: e.target.value })}/></label>
          <label><b>Название EN</b>
            <input className="a-input" value={modal.name_en}
              onChange={(e) => setModal({ ...modal, name_en: e.target.value })}/></label>
          <label><b>Название UA</b>
            <input className="a-input" value={modal.name_ua}
              onChange={(e) => setModal({ ...modal, name_ua: e.target.value })}/></label>
          <label><b>Цена ($)</b>
            <input className="a-input" type="number" value={modal.price}
              onChange={(e) => setModal({ ...modal, price: Number(e.target.value) })}/></label>
          <label><b>Тип цены</b>
            <select className="a-input" value={modal.price_type}
              onChange={(e) => setModal({ ...modal, price_type: e.target.value as Extra['price_type'] })}>
              <option value="per_day">за день</option>
              <option value="per_order">за заказ</option>
            </select></label>
          <label><b>Порядок</b>
            <input className="a-input" type="number" value={modal.sort_order}
              onChange={(e) => setModal({ ...modal, sort_order: Number(e.target.value) })}/></label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={!!modal.is_active}
              onChange={(e) => setModal({ ...modal, is_active: e.target.checked ? 1 : 0 })}/>
            <b>Активно</b></label>
          <button className="a-btn" onClick={() => void create()}>Создать</button>
        </AdminModal>
      )}
    </div>
  );
}
