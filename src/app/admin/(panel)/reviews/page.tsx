'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminModal } from '@/app/admin/admin-modal';
import { useToast } from '@/app/admin/admin-toast';

interface Review {
  id: number;
  author: string;
  author_ua: string;
  text_en: string;
  text_ua: string | null;
  avatar_url: string | null;
  avatar_alt_en: string;
  avatar_alt_ua: string;
  is_published: number;
  sort_order: number;
  created_at: string;
}

const EMPTY: Omit<Review, 'id' | 'created_at'> = {
  author: '', author_ua: '', text_en: '', text_ua: '', avatar_url: '',
  avatar_alt_en: '', avatar_alt_ua: '',
  is_published: 1, sort_order: 0
};

/**
 * Reviews manager: search + add-modal on top, inline row editor below.
 */
export default function ReviewsPage() {
  const [items, setItems] = useState<Review[] | null>(null);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<null | typeof EMPTY>(null);
  const toast = useToast();

  async function load() {
    const res = await fetch('/api/admin/reviews');
    const data = (await res.json()) as { items: Review[] };
    setItems(data.items);
  }
  useEffect(() => { void load(); }, []);
  const note = (t: string) => toast.push(t);

  const filtered = useMemo(() => {
    if (items === null) return [];
    const q = query.trim().toLowerCase();
    if (q === '') return items;
    return items.filter(
      (r) => r.author.toLowerCase().includes(q) ||
             r.text_en.toLowerCase().includes(q) ||
             (r.text_ua ?? '').toLowerCase().includes(q)
    );
  }, [items, query]);

  async function create() {
    if (modal === null) return;
    if (!modal.author.trim() || !modal.text_en.trim()) return note('Автор и текст EN обязательны');
    const res = await fetch('/api/admin/reviews', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(modal)
    });
    if (!res.ok) return note('Ошибка создания');
    setModal(null); void load();
  }
  async function save(row: Review) {
    const res = await fetch(`/api/admin/reviews/${row.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(row)
    });
    note(res.ok ? 'Сохранено' : 'Ошибка сохранения');
  }
  async function remove(row: Review) {
    if (!confirm(`Удалить отзыв "${row.author}"?`)) return;
    const res = await fetch(`/api/admin/reviews/${row.id}`, { method: 'DELETE' });
    note(res.ok ? 'Удалено' : 'Ошибка'); void load();
  }

  if (items === null) return <div>Загрузка…</div>;
  return (
    <div>
      <div className="a-toolbar">
        <h1>Отзывы</h1>
        <input className="a-input a-search" placeholder="Поиск по автору или тексту…"
          value={query} onChange={(e) => setQuery(e.target.value)}/>
        <button className="a-btn" onClick={() => setModal({ ...EMPTY })}>+ Добавить</button>
      </div>
      {filtered.map((row) => {
        const idx = items.indexOf(row);
        return (
          <div key={row.id} className="a-card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <label><b>Автор EN</b>
                <input className="a-input" value={row.author}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,author:e.target.value}; setItems(n); }}/></label>
              <label><b>Автор UA</b>
                <input className="a-input" value={row.author_ua}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,author_ua:e.target.value}; setItems(n); }}/></label>
              <label><b>URL аватара</b>
                <input className="a-input" value={row.avatar_url ?? ''}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,avatar_url:e.target.value}; setItems(n); }}/></label>
              <label><b>Порядок</b>
                <input className="a-input" type="number" value={row.sort_order}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,sort_order:Number(e.target.value)}; setItems(n); }}/></label>
              <label><b>ALT EN аватара</b>
                <input className="a-input" value={row.avatar_alt_en}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,avatar_alt_en:e.target.value}; setItems(n); }}/></label>
              <label><b>ALT UA аватара</b>
                <input className="a-input" value={row.avatar_alt_ua}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,avatar_alt_ua:e.target.value}; setItems(n); }}/></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <label><b>Текст EN</b>
                <textarea className="a-input" rows={4} value={row.text_en}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,text_en:e.target.value}; setItems(n); }}/></label>
              <label><b>Текст UA</b>
                <textarea className="a-input" rows={4} value={row.text_ua ?? ''}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,text_ua:e.target.value}; setItems(n); }}/></label>
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 14 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={!!row.is_published}
                  onChange={(e) => { const n=[...items]; n[idx]={...row,is_published:e.target.checked?1:0}; setItems(n); }}/>
                <b>Опубликован</b>
              </label>
              <div style={{ color: '#7a7f89', fontSize: 12 }}>Создан: {row.created_at}</div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="a-btn" onClick={() => void save(row)}>Сохранить</button>
                <button className="a-btn ghost" onClick={() => void remove(row)}>Удалить</button>
              </div>
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && (
        <div className="a-card" style={{ textAlign: 'center', color: '#7a7f89' }}>
          Ничего не найдено
        </div>
      )}
      {modal !== null && (
        <AdminModal title="Новый отзыв" onClose={() => setModal(null)}>
          <label><b>Автор EN</b>
            <input className="a-input" value={modal.author}
              onChange={(e) => setModal({ ...modal, author: e.target.value })}/></label>
          <label><b>Автор UA</b>
            <input className="a-input" value={modal.author_ua}
              onChange={(e) => setModal({ ...modal, author_ua: e.target.value })}/></label>
          <label><b>URL аватара</b>
            <input className="a-input" value={modal.avatar_url ?? ''}
              onChange={(e) => setModal({ ...modal, avatar_url: e.target.value })}/></label>
          <label><b>ALT EN аватара</b>
            <input className="a-input" value={modal.avatar_alt_en}
              onChange={(e) => setModal({ ...modal, avatar_alt_en: e.target.value })}/></label>
          <label><b>ALT UA аватара</b>
            <input className="a-input" value={modal.avatar_alt_ua}
              onChange={(e) => setModal({ ...modal, avatar_alt_ua: e.target.value })}/></label>
          <label><b>Текст EN</b>
            <textarea className="a-input" rows={4} value={modal.text_en}
              onChange={(e) => setModal({ ...modal, text_en: e.target.value })}/></label>
          <label><b>Текст UA</b>
            <textarea className="a-input" rows={4} value={modal.text_ua ?? ''}
              onChange={(e) => setModal({ ...modal, text_ua: e.target.value })}/></label>
          <label><b>Порядок</b>
            <input className="a-input" type="number" value={modal.sort_order}
              onChange={(e) => setModal({ ...modal, sort_order: Number(e.target.value) })}/></label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={!!modal.is_published}
              onChange={(e) => setModal({ ...modal, is_published: e.target.checked ? 1 : 0 })}/>
            <b>Опубликован</b>
          </label>
          <button className="a-btn" onClick={() => void create()}>Создать</button>
        </AdminModal>
      )}
    </div>
  );
}
