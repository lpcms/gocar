'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminModal } from '@/app/admin/admin-modal';
import { useToast } from '@/app/admin/admin-toast';

interface Category {
  id: number;
  slug: string;
  sort_order: number;
  name_en: string;
  name_ua: string;
  /** SEO paragraph printed under the heading on /cars/<slug>. */
  description_en: string;
  description_ua: string;
  cars_count: number;
}

const EMPTY: Omit<Category, 'id' | 'cars_count'> = {
  slug: '', name_en: '', name_ua: '', description_en: '', description_ua: '', sort_order: 0
};

/**
 * Categories manager: search + add-modal on top, editable rows below.
 * Delete refused (409 in_use) while any car references the category.
 */
export default function CategoriesPage() {
  const [items, setItems] = useState<Category[] | null>(null);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<null | typeof EMPTY>(null);
  const toast = useToast();

  async function load() {
    const res = await fetch('/api/admin/categories');
    const data = (await res.json()) as { items: Category[] };
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
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(modal)
    });
    if (res.status === 409) return note('Slug уже занят');
    if (!res.ok) return note('Проверьте поля');
    setModal(null);
    void load();
  }
  async function save(row: Category) {
    const res = await fetch(`/api/admin/categories/${row.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(row)
    });
    note(res.ok ? 'Сохранено' : 'Ошибка сохранения');
  }
  async function remove(row: Category) {
    if (row.cars_count > 0) return note(`Используется в ${row.cars_count} авто`);
    if (!confirm(`Удалить категорию "${row.name_en}"?`)) return;
    const res = await fetch(`/api/admin/categories/${row.id}`, { method: 'DELETE' });
    if (res.status === 409) return note('Категория используется');
    if (!res.ok) return note('Ошибка удаления');
    void load();
  }

  if (items === null) return <div>Загрузка…</div>;
  return (
    <div>
      <div className="a-toolbar">
        <h1>Категории</h1>
        <input
          className="a-input a-search"
          placeholder="Поиск по slug / названию…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="a-btn" onClick={() => setModal({ ...EMPTY })}>+ Добавить</button>
      </div>
      {/*
        One <tbody> per category: name, slug and order on the first row, the
        SEO text on the second. They are one record, so the group carries a
        single hover and no rule between its rows. The EN text is exactly as
        wide as the two name fields above it and the UA text fills the rest,
        so the second row leaves no empty cells.
      */}
      <table className="a-table a-cats">
        <thead>
          <tr>
            <th style={{ width: '26%' }}>EN</th>
            <th style={{ width: '26%' }}>UA</th>
            <th>Slug</th>
            <th style={{ width: 100 }}>Порядок</th>
            <th style={{ width: 60 }}>Авто</th>
            <th style={{ width: 190 }}></th>
          </tr>
        </thead>
        {filtered.map((row) => {
          const idx = items.indexOf(row);
          return (
            <tbody className="a-cat" key={row.id}>
              <tr>
                <td><input className="a-input" value={row.name_en}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,name_en:e.target.value}; setItems(n); }}/></td>
                <td><input className="a-input" value={row.name_ua}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,name_ua:e.target.value}; setItems(n); }}/></td>
                <td><input className="a-input" value={row.slug}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,slug:e.target.value}; setItems(n); }}/></td>
                <td><input className="a-input" type="number" value={row.sort_order}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,sort_order:Number(e.target.value)}; setItems(n); }}/></td>
                <td style={{ textAlign: 'center' }}>{row.cars_count}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="a-btn" onClick={() => void save(row)}>Сохранить</button>{' '}
                  <button className="a-btn ghost" onClick={() => void remove(row)}>Удалить</button>
                </td>
              </tr>
              {/*
                SEO text of the category page, one cell per locale: EN takes
                the two name columns above it, UA the whole remaining width.
              */}
              <tr>
                <td colSpan={2}>
                  <label><b>Описание EN</b>
                    <textarea className="a-input" rows={6} value={row.description_en}
                      onChange={(e) => { const n=[...items]; n[idx]={...row,description_en:e.target.value}; setItems(n); }}/></label>
                </td>
                <td colSpan={4}>
                  <label><b>Описание UA</b>
                    <textarea className="a-input" rows={6} value={row.description_ua}
                      onChange={(e) => { const n=[...items]; n[idx]={...row,description_ua:e.target.value}; setItems(n); }}/></label>
                </td>
              </tr>
            </tbody>
          );
        })}
        {filtered.length === 0 && (
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: '#7a7f89' }}>
              Ничего не найдено
            </td></tr>
          </tbody>
        )}
      </table>
      {modal !== null && (
        <AdminModal title="Новая категория" onClose={() => setModal(null)}>
          <label><b>Slug</b>
            <input className="a-input" value={modal.slug}
              onChange={(e) => setModal({ ...modal, slug: e.target.value })}/></label>
          <label><b>Название EN</b>
            <input className="a-input" value={modal.name_en}
              onChange={(e) => setModal({ ...modal, name_en: e.target.value })}/></label>
          <label><b>Название UA</b>
            <input className="a-input" value={modal.name_ua}
              onChange={(e) => setModal({ ...modal, name_ua: e.target.value })}/></label>
          <label><b>Описание EN</b>
            <textarea className="a-input" rows={3} value={modal.description_en}
              onChange={(e) => setModal({ ...modal, description_en: e.target.value })}/></label>
          <label><b>Описание UA</b>
            <textarea className="a-input" rows={3} value={modal.description_ua}
              onChange={(e) => setModal({ ...modal, description_ua: e.target.value })}/></label>
          <label><b>Порядок</b>
            <input className="a-input" type="number" value={modal.sort_order}
              onChange={(e) => setModal({ ...modal, sort_order: Number(e.target.value) })}/></label>
          <button className="a-btn" onClick={() => void create()}>Создать</button>
        </AdminModal>
      )}
    </div>
  );
}
