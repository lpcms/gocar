'use client';

import { useEffect, useRef, useState } from 'react';
import { AdminModal } from '@/app/admin/admin-modal';
import { useToast } from '@/app/admin/admin-toast';

interface MediaItem {
  id: number;
  original_path: string;
  webp_path: string;
  width: number | null;
  height: number | null;
  alt_en: string;
  alt_ua: string;
  created_at: string;
}

/**
 * What the server measured after writing a replacement, next to what the row
 * held before it.
 */
interface Replaced {
  width: number | null;
  height: number | null;
  previousWidth: number | null;
  previousHeight: number | null;
}

/**
 * Human-readable reasons for the errors the media endpoints report.
 */
const MEDIA_ERRORS: Record<string, string> = {
  not_image: 'Файл не является изображением',
  file_required: 'Файл не выбран',
  svg_expected: 'Это изображение хранится в формате SVG — заменить его можно только файлом SVG',
  remote_file: 'Файл лежит на внешнем хосте, заменить его отсюда нельзя',
  unsupported_target: 'Формат этого файла не поддерживается для замены',
  not_found: 'Изображение не найдено',
  form: 'Не удалось прочитать форму'
};

/**
 * Pixel size as the table and the dialog show it: a dash while nothing is
 * known about the file.
 */
function sizeText(width: number | null, height: number | null): string {
  return width !== null && height !== null ? `${width}×${height}` : '—';
}

/**
 * Replacement dialog: the picture as it is now, the fields that describe it,
 * and a file field that overwrites it under the same name.
 *
 * The size shown is the real one - the stored dimensions until a new file is
 * picked, the new file's own from that moment on. A picture of a different
 * shape than the one it replaces is not refused, only pointed out: the layouts
 * that show it were built around the old proportions.
 */
function ReplaceDialog({
  item,
  src,
  onClose,
  onSaved
}: {
  item: MediaItem;
  src: string;
  onClose: () => void;
  onSaved: (item: MediaItem, replaced: Replaced | null) => void;
}) {
  const [altEn, setAltEn] = useState(item.alt_en);
  const [altUa, setAltUa] = useState(item.alt_ua);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /**
   * The object URL of the previous pick is released when another file is
   * chosen and when the dialog closes.
   */
  useEffect(() => {
    if (preview === null) return undefined;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  /**
   * Take a file from the field: show it, and measure it, so the admin sees
   * what is about to be written before anything is written.
   */
  function pickFile(next: File | null) {
    setError('');
    setPicked(null);
    if (next === null || !/^image\//.test(next.type)) {
      setFile(null);
      setPreview(null);
      if (next !== null) setError(MEDIA_ERRORS['not_image'] ?? 'Файл не является изображением');
      return;
    }
    setFile(next);
    const url = URL.createObjectURL(next);
    setPreview(url);
    const probe = new window.Image();
    probe.onload = () => setPicked({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.src = url;
  }

  /**
   * Write the alt text, and the new file when one was picked.
   */
  async function save() {
    setBusy(true);
    setError('');
    const body = new FormData();
    if (file !== null) body.append('file', file);
    body.append('alt_en', altEn);
    body.append('alt_ua', altUa);
    const res = await fetch(`/api/admin/media/${item.id}`, { method: 'PUT', body });
    setBusy(false);
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { error?: string } | null;
      const raw = detail?.error ?? '';
      setError(MEDIA_ERRORS[raw] ?? (raw !== '' ? raw : `Ошибка ${res.status}`));
      return;
    }
    const data = (await res.json()) as { item: MediaItem; replaced: Replaced | null };
    onSaved(data.item, data.replaced);
  }

  const shownWidth = picked !== null ? picked.width : item.width;
  const shownHeight = picked !== null ? picked.height : item.height;
  const differs =
    picked !== null &&
    item.width !== null &&
    item.height !== null &&
    (picked.width !== item.width || picked.height !== item.height);

  return (
    <AdminModal title="Изменить изображение" onClose={onClose}>
      <div style={{
        height: 190, borderRadius: 10, background: '#f4f5f7',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
      }}>
        <img src={preview ?? src} alt={item.alt_en}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <b style={{ fontSize: 14 }}>Файл</b>
          <div style={{ fontSize: 13, color: '#7a7f89', wordBreak: 'break-all' }}>{item.webp_path}</div>
        </div>
        <div>
          <b style={{ fontSize: 14 }}>Ширина × Высота</b>
          <div style={{ fontSize: 13, color: '#7a7f89' }}>
            {sizeText(shownWidth, shownHeight)} px
            {picked !== null ? ` (было ${sizeText(item.width, item.height)})` : ''}
          </div>
        </div>
      </div>

      <label><b>Заменить файл</b>
        <input className="a-input" type="file" accept="image/*"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}/>
      </label>
      <div style={{ color: '#7a7f89', fontSize: 13, marginTop: -6 }}>
        Новый файл перезапишет текущий под тем же именем — картинка поменяется
        везде, где она уже стоит на сайте. Если файл не выбран, сохранится
        только текст alt.
      </div>

      {differs && picked !== null && (
        <div style={{
          background: '#fff3e0', color: '#8a5a00', border: '1px solid #f0d9ac',
          borderRadius: 9, padding: '10px 12px', fontSize: 13
        }}>
          Новое изображение другого размера: {sizeText(picked.width, picked.height)} px
          вместо {sizeText(item.width, item.height)} px. Заменить можно, но на странице
          картинка может встать иначе — после сохранения стоит проверить, как она выглядит.
        </div>
      )}

      <label><b>ALT EN</b>
        <input className="a-input" value={altEn} onChange={(e) => setAltEn(e.target.value)}/></label>
      <label><b>ALT UA</b>
        <input className="a-input" value={altUa} onChange={(e) => setAltUa(e.target.value)}/></label>

      {error !== '' && <div style={{ color: '#c02626', fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="a-btn ghost" onClick={onClose} disabled={busy}>Отмена</button>
        <button className="a-btn" onClick={() => void save()} disabled={busy}>
          {busy ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </AdminModal>
  );
}

/**
 * Image library: lists every image the site owns - scanned from its own
 * folders or uploaded here - as a table of thumbnail, pixel size and EN/UA alt
 * text, with a dialog that replaces the picture itself. The site reads that alt
 * text back through `getMediaAlt`, so this table is where every image on the
 * public pages is described, in both languages.
 *
 * Car photos and review avatars are not here: each is managed in its own
 * section, which owns its alt text as well.
 */
export default function MediaPage() {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  /**
   * A replaced file keeps its name, so the browser would go on showing the
   * copy it already has; the stamp of the last replacement is appended to the
   * thumbnail's URL to get past that.
   */
  const [stamp, setStamp] = useState<Record<number, number>>({});
  /** The upload block over the table: its file field, alt text and state. */
  const fileRef = useRef<HTMLInputElement>(null);
  const [newAltEn, setNewAltEn] = useState('');
  const [newAltUa, setNewAltUa] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const toast = useToast();

  async function load() {
    const res = await fetch('/api/admin/media');
    const data = (await res.json()) as { items: MediaItem[] };
    setItems(data.items);
  }
  useEffect(() => { void load(); }, []);

  /** Thumbnail URL of one row, past the browser cache after a replacement. */
  function srcOf(item: MediaItem): string {
    const version = stamp[item.id] ?? 0;
    return version === 0 ? item.webp_path : `${item.webp_path}?v=${version}`;
  }

  /**
   * Register snapshot images (assets/img, assets/framer, uploads) into the
   * media table so they can receive alt text.
   */
  async function importSnapshot() {
    if (!confirm('Сканировать изображения сайта и добавить новые в список?')) return;
    setBusy(true);
    const res = await fetch('/api/admin/media/import', { method: 'POST' });
    setBusy(false);
    if (!res.ok) return toast.push('Ошибка сканирования');
    const data = (await res.json()) as { imported: number; skipped: number; measured: number };
    const measured = data.measured > 0 ? `, размеры дописаны: ${data.measured}` : '';
    toast.push(`Добавлено: ${data.imported}, уже было: ${data.skipped}${measured}`);
    void load();
  }

  /**
   * Add a new image to the library. The server resizes it to the width and
   * quality of Настройки → Медиа and answers with the stored row, which is put
   * at the head of the list - where the table's own order (newest first) would
   * put it anyway - so alt text being typed in other rows survives.
   */
  async function upload() {
    setUploadError('');
    const field = fileRef.current;
    const file = field?.files?.[0] ?? null;
    if (file === null) return setUploadError('Файл не выбран');
    if (!/^image\//.test(file.type)) return setUploadError('Нужен файл изображения (JPG, PNG, WebP, SVG)');
    const maxMb = 15;
    if (file.size > maxMb * 1024 * 1024) {
      return setUploadError(
        `Файл слишком большой: ${(file.size / 1048576).toFixed(1)} МБ (максимум ${maxMb} МБ)`
      );
    }
    const body = new FormData();
    body.append('file', file);
    body.append('alt_en', newAltEn);
    body.append('alt_ua', newAltUa);
    setUploading(true);
    const res = await fetch('/api/admin/media', { method: 'POST', body });
    setUploading(false);
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { error?: string } | null;
      const raw = detail?.error ?? '';
      return setUploadError(MEDIA_ERRORS[raw] ?? (raw !== '' ? raw : `Ошибка ${res.status}`));
    }
    const data = (await res.json()) as { item: MediaItem };
    setItems(items === null ? [data.item] : [data.item, ...items]);
    setNewAltEn('');
    setNewAltUa('');
    if (field !== null) field.value = '';
    toast.push(`Загружено: ${sizeText(data.item.width, data.item.height)} px`);
  }

  /**
   * Persist the EN/UA alt text of a single image.
   */
  async function saveAlts(item: MediaItem) {
    const res = await fetch(`/api/admin/media/${item.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alt_en: item.alt_en, alt_ua: item.alt_ua })
    });
    toast.push(res.ok ? 'Сохранено' : 'Ошибка');
  }

  /**
   * Delete a single image from the library after confirmation, then reload.
   */
  async function deleteItem(item: MediaItem) {
    if (!confirm('Удалить это изображение из списка?')) return;
    const res = await fetch(`/api/admin/media/${item.id}`, { method: 'DELETE' });
    if (!res.ok) return toast.push('Ошибка удаления');
    toast.push('Удалено');
    void load();
  }

  /**
   * Take the row back from the dialog: the table shows what was written, the
   * thumbnail is reloaded, and a change of shape is said out loud once more.
   */
  function applySaved(saved: MediaItem, replaced: Replaced | null) {
    if (items !== null) {
      setItems(items.map((it) => (it.id === saved.id ? saved : it)));
    }
    setEditing(null);
    if (replaced === null) {
      toast.push('Сохранено');
      return;
    }
    setStamp({ ...stamp, [saved.id]: Date.now() });
    const changed =
      replaced.previousWidth !== null &&
      replaced.previousHeight !== null &&
      (replaced.width !== replaced.previousWidth || replaced.height !== replaced.previousHeight);
    toast.push(
      changed
        ? `Изображение заменено: ${sizeText(replaced.width, replaced.height)} px вместо ` +
            `${sizeText(replaced.previousWidth, replaced.previousHeight)} px`
        : 'Изображение заменено'
    );
  }

  function setField(idx: number, patch: Partial<Pick<MediaItem, 'alt_en' | 'alt_ua'>>) {
    if (items === null) return;
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    setItems(next);
  }

  if (items === null) return <div>Загрузка…</div>;
  return (
    <div>
      <div className="a-toolbar">
        <h1>Изображения</h1>
        <button className="a-btn" disabled={busy} onClick={() => void importSnapshot()}>
          {busy ? 'Сканирование…' : 'Сканировать изображения сайта'}
        </button>
      </div>

      <div className="a-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 14, alignItems: 'end' }}>
          <label><b>Файл</b>
            <input className="a-input" type="file" accept="image/*" ref={fileRef}/></label>
          <label><b>ALT EN</b>
            <input className="a-input" value={newAltEn}
              onChange={(e) => setNewAltEn(e.target.value)}/></label>
          <label><b>ALT UA</b>
            <input className="a-input" value={newAltUa}
              onChange={(e) => setNewAltUa(e.target.value)}/></label>
          <button className="a-btn" disabled={uploading} onClick={() => void upload()}>
            {uploading ? 'Загрузка…' : 'Загрузить'}
          </button>
        </div>
        <div style={{ color: '#7a7f89', fontSize: 13, marginTop: 10 }}>
          Изображение уменьшается до «Максимальной ширины изображения» и пишется в WebP
          с качеством из Настройки → Медиа. Новая картинка встаёт первой строкой таблицы —
          alt можно заполнить сразу здесь или потом в самой строке.
        </div>
        {uploadError !== '' && (
          <div style={{ color: '#c02626', fontSize: 13, marginTop: 8 }}>{uploadError}</div>
        )}
      </div>

      <table className="a-table">
        <thead>
          <tr>
            <th style={{ width: 84 }}>Фото</th>
            <th style={{ width: 180 }}>Имя</th>
            <th style={{ width: 90 }}>Ширина</th>
            <th style={{ width: 90 }}>Высота</th>
            <th>Alt EN</th>
            <th>Alt UA</th>
            <th style={{ width: 260 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id}>
              <td>
                <div style={{
                  width: 64, height: 44, borderRadius: 6, background: '#f4f5f7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                }}>
                  <img src={srcOf(item)} alt={item.alt_en}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}/>
                </div>
              </td>
              <td style={{ fontSize: 13, wordBreak: 'break-all' }}>
                {(item.webp_path || '').split('/').pop()}
              </td>
              <td>{item.width ?? '—'}{item.width ? ' px' : ''}</td>
              <td>{item.height ?? '—'}{item.height ? ' px' : ''}</td>
              <td>
                <input className="a-input" value={item.alt_en}
                  onChange={(e) => setField(idx, { alt_en: e.target.value })}/>
              </td>
              <td>
                <input className="a-input" value={item.alt_ua}
                  onChange={(e) => setField(idx, { alt_ua: e.target.value })}/>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="a-btn" onClick={() => void saveAlts(item)}>Сохранить</button>
                {' '}
                <button className="a-btn ghost" onClick={() => setEditing(item)}>Изменить</button>
                {' '}
                <button className="a-btn ghost" onClick={() => void deleteItem(item)}>Удалить</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', color: '#7a7f89' }}>
                Список пуст. Нажмите «Сканировать изображения сайта».
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editing !== null && (
        <ReplaceDialog
          key={editing.id}
          item={editing}
          src={srcOf(editing)}
          onClose={() => setEditing(null)}
          onSaved={applySaved}
        />
      )}
    </div>
  );
}
