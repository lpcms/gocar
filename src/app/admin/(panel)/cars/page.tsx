'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminModal } from '@/app/admin/admin-modal';
import { useToast } from '@/app/admin/admin-toast';

interface CarRow {
  id: number;
  slug: string;
  status: 'live' | 'draft';
  price_per_day: number;
  deposit: number;
  is_popular: number;
  sort_order: number;
  category_slug: string;
  title_en: string;
  title_ua: string;
  image_path: string | null;
}

interface CategoryOpt { id: number; slug: string; name_en: string; }

const EMPTY = { slug: '', title_en: '', title_ua: '', category_id: 0 };

/**
 * Cars list: search + status filter + add-modal on top; each row links
 * to a per-car editor with the full field set.
 */
export default function CarsPage() {
  const [items, setItems] = useState<CarRow[] | null>(null);
  const [cats, setCats] = useState<CategoryOpt[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'live' | 'draft'>('all');
  const [modal, setModal] = useState<null | typeof EMPTY>(null);
  const toast = useToast();

  async function load() {
    const [carsRes, catRes] = await Promise.all([
      fetch('/api/admin/cars'), fetch('/api/admin/categories')
    ]);
    const carsData = (await carsRes.json()) as { items: CarRow[] };
    const catData = (await catRes.json()) as { items: CategoryOpt[] };
    setItems(carsData.items);
    setCats(catData.items);
  }
  useEffect(() => { void load(); }, []);
  const note = (t: string) => toast.push(t);

  const filtered = useMemo(() => {
    if (items === null) return [];
    const q = query.trim().toLowerCase();
    return items.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (q === '') return true;
      return r.slug.toLowerCase().includes(q) ||
             r.title_en.toLowerCase().includes(q) ||
             r.title_ua.toLowerCase().includes(q);
    });
  }, [items, query, status]);

  async function create() {
    if (modal === null) return;
    const res = await fetch('/api/admin/cars', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(modal)
    });
    if (res.status === 409) return note('Slug уже занят');
    if (!res.ok) return note('Проверьте поля');
    const data = (await res.json()) as { id: number };
    window.location.href = `/admin/cars/${data.id}`;
  }
  async function remove(row: CarRow) {
    if (!confirm(`Удалить "${row.title_en}"?`)) return;
    const res = await fetch(`/api/admin/cars/${row.id}`, { method: 'DELETE' });
    note(res.ok ? 'Удалено' : 'Ошибка'); void load();
  }

  if (items === null) return <div>Загрузка…</div>;
  const filters: Array<[typeof status, string]> = [
    ['all', 'все'], ['live', 'Live'], ['draft', 'Draft']
  ];
  return (
    <div>
      <div className="a-toolbar">
        <h1>Автомобили</h1>
        <input className="a-input a-search" placeholder="Поиск…"
          value={query} onChange={(e) => setQuery(e.target.value)}/>
        <button className="a-btn" onClick={() => setModal({ ...EMPTY, category_id: cats[0]?.id ?? 0 })}>
          + Добавить
        </button>
      </div>
      <p className="a-filters">
        {filters.map(([value, label]) => (
          <a key={label} href="#"
             className={status === value ? 'active' : ''}
             onClick={(e) => { e.preventDefault(); setStatus(value); }}>
            {label}
          </a>
        ))}
      </p>
      <table className="a-table">
        <thead>
          <tr>
            <th style={{ width: 80 }}>Порядок</th>
            <th style={{ width: 64 }}>Фото</th>
            <th>EN</th><th>UA</th>
            <th>Slug</th>
            <th style={{ width: 100 }}>Категория</th>
            <th style={{ width: 110, whiteSpace: 'nowrap' }}>Цена $/д</th>
            <th style={{ width: 110, whiteSpace: 'nowrap' }}>Депозит $</th>
            <th style={{ width: 100 }}>Популярное</th>
            <th style={{ width: 80 }}>Статус</th>
            <th style={{ width: 180 }}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.id}>
              <td>{row.sort_order}</td>
              <td>
                {row.image_path ? (
                  <img src={row.image_path} alt={row.title_en}
                    style={{ width: 48, height: 32, objectFit: 'cover', borderRadius: 4, display: 'block' }}/>
                ) : (
                  <span style={{
                    display: 'inline-block', width: 48, height: 32, borderRadius: 4,
                    background: '#eceef1', color: '#aeb4bd', fontSize: 10,
                    textAlign: 'center', lineHeight: '32px'
                  }}>—</span>
                )}
              </td>
              <td>{row.title_en}</td>
              <td>{row.title_ua}</td>
              <td>{row.slug}</td>
              <td>{row.category_slug}</td>
              <td>${row.price_per_day}</td>
              <td>${row.deposit}</td>
              <td>{row.is_popular === 1 ? 'Да' : 'Нет'}</td>
              <td>
                <span className={`a-badge ${row.status === 'live' ? 'success' : 'blocked'}`}>
                  {row.status}
                </span>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <a className="a-btn" href={`/admin/cars/${row.id}`}>Изменить</a>{' '}
                <button className="a-btn ghost" onClick={() => void remove(row)}>Удалить</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={10} style={{ textAlign: 'center', color: '#7a7f89' }}>Ничего не найдено</td></tr>
          )}
        </tbody>
      </table>
      {modal !== null && (
        <AdminModal title="Новый автомобиль" onClose={() => setModal(null)}>
          <label><b>Slug (URL)</b>
            <input className="a-input" value={modal.slug}
              onChange={(e) => setModal({ ...modal, slug: e.target.value })}/></label>
          <label><b>Название EN</b>
            <input className="a-input" value={modal.title_en}
              onChange={(e) => setModal({ ...modal, title_en: e.target.value })}/></label>
          <label><b>Название UA</b>
            <input className="a-input" value={modal.title_ua}
              onChange={(e) => setModal({ ...modal, title_ua: e.target.value })}/></label>
          <label><b>Категория</b>
            <select className="a-input" value={modal.category_id}
              onChange={(e) => setModal({ ...modal, category_id: Number(e.target.value) })}>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.slug} — {c.name_en}</option>
              ))}
            </select></label>
          <p style={{ color: '#7a7f89', fontSize: 13, margin: 0 }}>
            Остальные поля (тарифы, features, фото) — после создания в редакторе карточки.
          </p>
          <button className="a-btn" onClick={() => void create()}>Создать и открыть</button>
        </AdminModal>
      )}
    </div>
  );
}
