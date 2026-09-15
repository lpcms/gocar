'use client';

import { useToast } from '@/app/admin/admin-toast';

import { use, useEffect, useState } from 'react';

interface CarRow {
  id: number;
  slug: string;
  status: 'live' | 'draft';
  category_id: number;
  price_per_day: number;
  deposit: number;
  is_popular: number;
  sort_order: number;
  engine: string | null;
  transmission: string | null;
  fuel_type: string | null;
  seats: string | null;
  tariff_1_3: number;
  tariff_4_9: number;
  tariff_10_25: number;
  tariff_26: number;
  form_aliases: string | null;
  related_slugs: string | null;
  image_id: number | null;
  preview1_id: number | null;
  preview2_id: number | null;
  preview3_id: number | null;
}

interface Photo {
  id: number;
  webp_path: string;
  original_path: string;
  alt_en: string;
  alt_ua: string;
}
type PhotoSlot = 'image' | 'preview1' | 'preview2' | 'preview3';
type PhotoMap = Record<PhotoSlot, Photo | null>;

interface Translation {
  locale: 'en' | 'ua';
  title: string;
  description: string | null;
  engine: string;
  transmission: string;
  fuel_type: string;
  seats: string;
  drivetrain: string;
}
interface Feature { position: number; locale: 'en' | 'ua'; title: string; text: string | null; }
interface CategoryOpt { id: number; slug: string; name_en: string; name_ua: string; }
interface CarOpt { id: number; slug: string; title_en: string; title_ua: string; status: string; }

/**
 * Per-car editor with full field set (matches the Framer CMS model +
 * form_aliases). Features 1-6 have EN/UA title+text; empty ones are
 * dropped on save. Tariff brackets match the runtime rate table.
 */
export default function CarEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [car, setCar] = useState<CarRow | null>(null);
  const [trs, setTrs] = useState<Record<'en' | 'ua', Translation>>({
    en: { locale: 'en', title: '', description: '', engine: '', transmission: '', fuel_type: '', seats: '', drivetrain: '' },
    ua: { locale: 'ua', title: '', description: '', engine: '', transmission: '', fuel_type: '', seats: '', drivetrain: '' }
  });
  const [features, setFeatures] = useState<Feature[]>([]);
  const [cats, setCats] = useState<CategoryOpt[]>([]);
  const [allCars, setAllCars] = useState<CarOpt[]>([]);
  const [photos, setPhotos] = useState<PhotoMap>({
    image: null, preview1: null, preview2: null, preview3: null
  });
  const toast = useToast();

  useEffect(() => {
    void (async () => {
      const [carRes, catRes, carsRes] = await Promise.all([
        fetch(`/api/admin/cars/${id}`), fetch('/api/admin/categories'), fetch('/api/admin/cars')
      ]);
      const data = (await carRes.json()) as {
        car: CarRow; translations: Translation[]; features: Feature[]; photos: PhotoMap;
      };
      setCar(data.car);
      if (data.photos) setPhotos(data.photos);
      const nextTrs = { ...trs };
      for (const t of data.translations) nextTrs[t.locale] = t;
      setTrs(nextTrs);
      const grid: Feature[] = [];
      for (let pos = 1; pos <= 6; pos += 1) {
        for (const locale of ['en', 'ua'] as const) {
          const found = data.features.find((f) => f.position === pos && f.locale === locale);
          grid.push(found ?? { position: pos, locale, title: '', text: '' });
        }
      }
      setFeatures(grid);
      const catData = (await catRes.json()) as { items: CategoryOpt[] };
      const carsData = (await carsRes.json()) as { items: CarOpt[] };
      setAllCars(carsData.items);
      setCats(catData.items);
    })();
  }, [id]);

  function updateCar<K extends keyof CarRow>(key: K, value: CarRow[K]) {
    if (car === null) return;
    setCar({ ...car, [key]: value });
  }
  function updateFeature(index: number, patch: Partial<Feature>) {
    setFeatures(features.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }
  const note = (t: string) => toast.push(t);

  /**
   * Selected "You may also like" cars, stored as a CSV of slugs on the car
   * row and edited here as a checkbox list.
   */
  const relatedSlugs: string[] = (car?.related_slugs ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');

  /**
   * What the picker offers: published cars only, minus this one.
   *
   * A draft used to be listed dimmed with a "draft" badge, which was
   * confusing - `getRelatedCars` filters by status, so picking one never put
   * anything on the page (client 22.08.2026). A car that is already selected
   * and has since been unpublished stays in the list, otherwise its slug would
   * sit in the saved value with no way to see or remove it.
   */
  const relatedChoices = allCars.filter(
    (c) => c.slug !== car?.slug && (c.status === 'live' || relatedSlugs.includes(c.slug))
  );

  /**
   * Add or remove one slug from the related selection.
   */
  function toggleRelated(slug: string) {
    if (car === null) return;
    const next = relatedSlugs.includes(slug)
      ? relatedSlugs.filter((s) => s !== slug)
      : [...relatedSlugs, slug];
    updateCar('related_slugs', next.join(','));
  }

  /**
   * Upload a file into a photo slot; the server resizes per the car photo
   * settings and links the new media row to the car.
   */
  async function uploadPhoto(slot: PhotoSlot, file: File) {
    /**
     * Validate client-side first so the common cases give a clear reason
     * instead of a generic failure: the API accepts images only, and very
     * large files fail on the server during processing.
     */
    if (!/^image\//.test(file.type)) {
      return note('Нужен файл изображения (JPG, PNG, WebP)');
    }
    const maxMb = 15;
    if (file.size > maxMb * 1024 * 1024) {
      return note(`Файл слишком большой: ${(file.size / 1048576).toFixed(1)} МБ (максимум ${maxMb} МБ)`);
    }

    const fd = new FormData();
    fd.append('slot', slot);
    fd.append('file', file);
    fd.append('alt_en', photos[slot]?.alt_en ?? '');
    fd.append('alt_ua', photos[slot]?.alt_ua ?? '');
    const res = await fetch(`/api/admin/cars/${id}/photo`, { method: 'POST', body: fd });
    if (!res.ok) {
      /**
       * Surface the server's reason so upload problems are diagnosable
       * rather than showing a generic message.
       */
      const detail = (await res.json().catch(() => null)) as { error?: string } | null;
      const reasons: Record<string, string> = {
        file_required: 'Файл не выбран',
        not_image: 'Файл не является изображением',
        bad_slot: 'Неизвестный слот фото',
        form: 'Не удалось прочитать форму'
      };
      const raw = detail?.error ?? '';
      const human = reasons[raw] ?? (raw !== '' ? raw : `Ошибка ${res.status}`);
      return note(`Ошибка загрузки фото: ${human}`);
    }
    const data = (await res.json()) as { media: Photo };
    setPhotos({ ...photos, [slot]: data.media });
    note('Фото загружено');
  }

  /**
   * Update just the alt text of a slot's existing media.
   */
  async function saveAlt(slot: PhotoSlot) {
    const p = photos[slot];
    if (p === null) return;
    const res = await fetch(`/api/admin/cars/${id}/photo`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slot, alt_en: p.alt_en, alt_ua: p.alt_ua })
    });
    note(res.ok ? 'Alt сохранён' : 'Ошибка');
  }

  /**
   * Unlink a slot (keeps the media in the library).
   */
  async function clearPhoto(slot: PhotoSlot) {
    const res = await fetch(`/api/admin/cars/${id}/photo`, {
      method: 'DELETE', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slot })
    });
    if (!res.ok) return note('Ошибка');
    setPhotos({ ...photos, [slot]: null });
    note('Фото отвязано');
  }

  function setAltLocal(slot: PhotoSlot, patch: Partial<Pick<Photo, 'alt_en' | 'alt_ua'>>) {
    const p = photos[slot];
    if (p === null) return;
    setPhotos({ ...photos, [slot]: { ...p, ...patch } });
  }

  async function save() {
    if (car === null) return;
    const res = await fetch(`/api/admin/cars/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...car, translations: Object.values(trs), features })
    });
    if (res.status === 409) return note('Slug уже занят');
    note(res.ok ? 'Сохранено' : 'Ошибка сохранения');
  }

  if (car === null) return <div>Загрузка…</div>;
  const featurePairs: number[] = [1, 2, 3, 4, 5, 6];
  return (
    <div>
      <div className="a-toolbar">
        <h1>Редактор: {trs.en.title || car.slug}</h1>
        <a className="a-btn ghost" href="/admin/cars">← К списку</a>
        <button className="a-btn" onClick={() => void save()}>Сохранить</button>
      </div>

      <div className="a-card">
        <h3 style={{ marginTop: 0 }}>Фотографии</h3>
        <p style={{ color: '#7a7f89', fontSize: 13, marginTop: 0 }}>
          Основное фото — карточка и превью; три доп. фото — слайдер на подробной странице.
          Размеры задаются в Настройках. Для каждого фото можно указать alt (EN/UA).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {(['image', 'preview1', 'preview2', 'preview3'] as PhotoSlot[]).map((slot) => {
            const p = photos[slot];
            const label = slot === 'image' ? 'Основное' : `Доп. ${slot.replace('preview', '')}`;
            return (
              <div key={slot} style={{ border: '1px solid #e3e6ea', borderRadius: 8, padding: 10 }}>
                <b style={{ fontSize: 13 }}>{label}</b>
                <div style={{
                  marginTop: 8, height: 90, borderRadius: 6, background: '#f4f5f7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                }}>
                  {p ? (
                    <img src={p.webp_path} alt={p.alt_en}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}/>
                  ) : (
                    <span style={{ color: '#aeb4bd', fontSize: 12 }}>нет фото</span>
                  )}
                </div>
                <input type="file" accept="image/*" style={{ marginTop: 8, fontSize: 12, width: '100%' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadPhoto(slot, f);
                    e.target.value = '';
                  }}/>
                <input className="a-input" placeholder="Alt EN" style={{ marginTop: 6 }}
                  value={p?.alt_en ?? ''} disabled={p === null}
                  onChange={(e) => setAltLocal(slot, { alt_en: e.target.value })}/>
                <input className="a-input" placeholder="Alt UA" style={{ marginTop: 6 }}
                  value={p?.alt_ua ?? ''} disabled={p === null}
                  onChange={(e) => setAltLocal(slot, { alt_ua: e.target.value })}/>
                {p && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="a-btn" style={{ flex: 1, padding: '4px 0', fontSize: 12 }}
                      onClick={() => void saveAlt(slot)}>Сохранить</button>
                    <button className="a-btn ghost" style={{ flex: 1, padding: '4px 0', fontSize: 12 }}
                      onClick={() => void clearPhoto(slot)}>Убрать</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="a-card">
        <h3 style={{ marginTop: 0 }}>Основное</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label><b>Название EN</b>
            <input className="a-input" value={trs.en.title}
              onChange={(e) => setTrs({ ...trs, en: { ...trs.en, title: e.target.value } })}/></label>
          <label><b>Название UA</b>
            <input className="a-input" value={trs.ua.title}
              onChange={(e) => setTrs({ ...trs, ua: { ...trs.ua, title: e.target.value } })}/></label>
          <label><b>Slug (URL)</b>
            <input className="a-input" value={car.slug}
              onChange={(e) => updateCar('slug', e.target.value)}/></label>
          <label><b>Статус</b>
            <select className="a-input" value={car.status}
              onChange={(e) => updateCar('status', e.target.value as CarRow['status'])}>
              <option value="live">Live</option>
              <option value="draft">Draft</option>
            </select></label>
          <label><b>Категория</b>
            <select className="a-input" value={car.category_id}
              onChange={(e) => updateCar('category_id', Number(e.target.value))}>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name_en} — {c.name_ua} [{c.slug}]</option>
              ))}
            </select></label>
          <label><b>Алиасы для селекта формы</b>
            <input className="a-input" value={car.form_aliases ?? ''}
              placeholder="VW Golf, Golf Mk7"
              onChange={(e) => updateCar('form_aliases', e.target.value)}/></label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
          <label><b>Описание EN</b>
            <textarea className="a-input" rows={3} value={trs.en.description ?? ''}
              onChange={(e) => setTrs({ ...trs, en: { ...trs.en, description: e.target.value } })}/></label>
          <label><b>Описание UA</b>
            <textarea className="a-input" rows={3} value={trs.ua.description ?? ''}
              onChange={(e) => setTrs({ ...trs, ua: { ...trs.ua, description: e.target.value } })}/></label>
        </div>
      </div>

      <div className="a-card">
        <h3 style={{ marginTop: 0 }}>Тарифы и цены</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <label><b>Базовая цена $/день</b>
            <input className="a-input" type="number" value={car.price_per_day}
              onChange={(e) => updateCar('price_per_day', Number(e.target.value))}/></label>
          <label><b>Депозит $</b>
            <input className="a-input" type="number" value={car.deposit}
              onChange={(e) => updateCar('deposit', Number(e.target.value))}/></label>
          <label><b>Порядок</b>
            <input className="a-input" type="number" value={car.sort_order}
              onChange={(e) => updateCar('sort_order', Number(e.target.value))}/></label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={car.is_popular === 1}
              onChange={(e) => updateCar('is_popular', e.target.checked ? 1 : 0)}/>
            <b>Популярное</b>
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 14 }}>
          <label><b>1–3 дней $/д</b>
            <input className="a-input" type="number" value={car.tariff_1_3}
              onChange={(e) => updateCar('tariff_1_3', Number(e.target.value))}/></label>
          <label><b>4–9 дней $/д</b>
            <input className="a-input" type="number" value={car.tariff_4_9}
              onChange={(e) => updateCar('tariff_4_9', Number(e.target.value))}/></label>
          <label><b>10–25 дней $/д</b>
            <input className="a-input" type="number" value={car.tariff_10_25}
              onChange={(e) => updateCar('tariff_10_25', Number(e.target.value))}/></label>
          <label><b>26+ дней $/д</b>
            <input className="a-input" type="number" value={car.tariff_26}
              onChange={(e) => updateCar('tariff_26', Number(e.target.value))}/></label>
        </div>
      </div>

      <div className="a-card">
        <h3 style={{ marginTop: 0 }}>Технические данные EN</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          <label><b>Двигатель</b>
            <input className="a-input" value={trs.en.engine}
              onChange={(e) => setTrs({ ...trs, en: { ...trs.en, engine: e.target.value } })}/></label>
          <label><b>КПП</b>
            <input className="a-input" value={trs.en.transmission}
              onChange={(e) => setTrs({ ...trs, en: { ...trs.en, transmission: e.target.value } })}/></label>
          <label><b>Топливо</b>
            <input className="a-input" value={trs.en.fuel_type}
              onChange={(e) => setTrs({ ...trs, en: { ...trs.en, fuel_type: e.target.value } })}/></label>
          <label><b>Места</b>
            <input className="a-input" value={trs.en.seats}
              onChange={(e) => setTrs({ ...trs, en: { ...trs.en, seats: e.target.value } })}/></label>
          <label><b>Привод</b>
            <input className="a-input" value={trs.en.drivetrain} placeholder="Front-wheel drive"
              onChange={(e) => setTrs({ ...trs, en: { ...trs.en, drivetrain: e.target.value } })}/></label>
        </div>
      </div>

      <div className="a-card">
        <h3 style={{ marginTop: 0 }}>Технические данные UA</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          <label><b>Двигатель</b>
            <input className="a-input" value={trs.ua.engine} placeholder={trs.en.engine}
              onChange={(e) => setTrs({ ...trs, ua: { ...trs.ua, engine: e.target.value } })}/></label>
          <label><b>КПП</b>
            <input className="a-input" value={trs.ua.transmission} placeholder={trs.en.transmission}
              onChange={(e) => setTrs({ ...trs, ua: { ...trs.ua, transmission: e.target.value } })}/></label>
          <label><b>Топливо</b>
            <input className="a-input" value={trs.ua.fuel_type} placeholder={trs.en.fuel_type}
              onChange={(e) => setTrs({ ...trs, ua: { ...trs.ua, fuel_type: e.target.value } })}/></label>
          <label><b>Места</b>
            <input className="a-input" value={trs.ua.seats} placeholder={trs.en.seats}
              onChange={(e) => setTrs({ ...trs, ua: { ...trs.ua, seats: e.target.value } })}/></label>
          <label><b>Привод</b>
            <input className="a-input" value={trs.ua.drivetrain} placeholder={trs.en.drivetrain}
              onChange={(e) => setTrs({ ...trs, ua: { ...trs.ua, drivetrain: e.target.value } })}/></label>
        </div>
        <div style={{ color: '#7a7f89', fontSize: 12, marginTop: 8 }}>
          Пустое поле — на украинской странице покажется значение из EN.
        </div>
      </div>

      {/**
        * Features 1-6 block is temporarily hidden per request. The state and
        * save logic remain intact so it can be re-enabled by flipping this
        * flag back to true without any data loss.
        */}
      {false && (
      <div className="a-card">
        <h3 style={{ marginTop: 0 }}>Особенности (features 1–6)</h3>
        {featurePairs.map((pos) => {
          const en = features.findIndex((f) => f.position === pos && f.locale === 'en');
          const ua = features.findIndex((f) => f.position === pos && f.locale === 'ua');
          return (
            <div key={pos} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', gap: 14, marginBottom: 12 }}>
              <div style={{ color: '#7a7f89', paddingTop: 10 }}>#{pos}</div>
              <div style={{ display: 'grid', gap: 6 }}>
                <input className="a-input" placeholder="Заголовок EN"
                  value={features[en]?.title ?? ''}
                  onChange={(e) => updateFeature(en, { title: e.target.value })}/>
                <textarea className="a-input" rows={2} placeholder="Текст EN"
                  value={features[en]?.text ?? ''}
                  onChange={(e) => updateFeature(en, { text: e.target.value })}/>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <input className="a-input" placeholder="Заголовок UA"
                  value={features[ua]?.title ?? ''}
                  onChange={(e) => updateFeature(ua, { title: e.target.value })}/>
                <textarea className="a-input" rows={2} placeholder="Текст UA"
                  value={features[ua]?.text ?? ''}
                  onChange={(e) => updateFeature(ua, { text: e.target.value })}/>
              </div>
            </div>
          );
        })}
      </div>
      )}

      <div className="a-card">
        <h3 style={{ marginTop: 0 }}>Вам также могут понравиться авто</h3>
        <p style={{ color: '#7a7f89', fontSize: 13, marginTop: 0 }}>
          Отметьте авто для блока «You may also like» на странице этого автомобиля.
          Фото, название и цена берутся из БД. Если ничего не выбрано — блок на
          странице не показывается.
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 8, maxHeight: 260, overflowY: 'auto',
          border: '1px solid #e3e6ea', borderRadius: 8, padding: 12
        }}>
          {relatedChoices.map((c) => {
            const selected = relatedSlugs.includes(c.slug);
            return (
              <label key={c.id} style={{
                display: 'flex', gap: 8, alignItems: 'center', fontSize: 13,
                opacity: c.status === 'live' ? 1 : 0.5
              }}>
                <input type="checkbox" checked={selected}
                  onChange={() => toggleRelated(c.slug)}/>
                <span>
                  {c.title_en || c.slug}
                  {c.status !== 'live' && (
                    <b style={{ color: '#c98a00', marginLeft: 6, fontSize: 11 }}>draft</b>
                  )}
                </span>
              </label>
            );
          })}
          {relatedChoices.length === 0 && (
            <div style={{ color: '#7a7f89', fontSize: 13 }}>
              Других опубликованных авто нет.
            </div>
          )}
        </div>
        <div style={{ color: '#7a7f89', fontSize: 12, marginTop: 8 }}>
          Выбрано: {relatedSlugs.length}. В списке только опубликованные авто: черновик
          в блоке всё равно не показывается.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="a-btn" onClick={() => void save()}>Сохранить</button>
      </div>
    </div>
  );
}
