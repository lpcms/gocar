'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/app/admin/admin-toast';

interface Values {
  default_locale: string;
  ga_id: string; gtm_id: string; fb_pixel_id: string;
  recaptcha_site_key: string; recaptcha_secret_key: string;
  recaptcha_score_threshold: string;
  telegram_bot_token: string; telegram_chat_id: string;
  lockout_attempts: string; lockout_minutes: string;
  login_attempts_keep_days: string;
  image_max_width: string; image_quality: string;
  car_image_max_width: string; car_image_max_height: string;
  car_preview_max_width: string; car_preview_max_height: string;
  robots_txt: string;
  site_domain: string; site_name: string; favicon_url: string; og_image_default: string;
  contact_phone: string; contact_email: string;
  contact_telegram: string; contact_whatsapp: string; contact_viber: string;
  contact_instagram: string; contact_whatsapp_url: string;
  google_maps_key: string;
  google_maps_iframe: string; google_maps_iframe_ua: string;
  work_hours_en: string; work_hours_ua: string;
  contact_geo: string;
  seo_title_en: string; seo_title_ua: string;
  seo_description_en: string; seo_description_ua: string;
}

/**
 * Admin settings: five sections in a single page (SEO/analytics, forms,
 * security, media, admin password). Secrets are stored server-side and
 * shown as "hidden" until re-entered.
 */
export default function SettingsPage() {
  const [values, setValues] = useState<Values | null>(null);
  const [stored, setStored] = useState<Record<string, boolean>>({});
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [origin, setOrigin] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  async function load() {
    const res = await fetch('/api/admin/settings');
    const data = (await res.json()) as { values: Values; stored: Record<string, boolean> };
    setValues(data.values); setStored(data.stored);
  }
  useEffect(() => { void load(); }, []);
  const set = <K extends keyof Values>(key: K, v: string) => {
    if (values === null) return;
    setValues({ ...values, [key]: v });
  };

  /**
   * Copy a string to the clipboard with a toast confirmation.
   */
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.push('Скопировано');
    } catch {
      toast.push('Не удалось скопировать');
    }
  }

  async function save() {
    if (values === null) return;
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values)
    });
    toast.push(res.ok ? 'Настройки сохранены' : 'Ошибка сохранения');
    void load();
  }
  async function changePwd() {
    if (pwd.next.length < 8) return toast.push('Минимум 8 символов');
    if (pwd.next !== pwd.confirm) return toast.push('Пароли не совпадают');
    const res = await fetch('/api/admin/password', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(pwd)
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      if (data.error === 'wrong_current') return toast.push('Неверный текущий пароль');
      if (data.error === 'too_short') return toast.push('Минимум 8 символов');
      if (data.error === 'mismatch') return toast.push('Пароли не совпадают');
      return toast.push('Ошибка');
    }
    toast.push('Пароль обновлён');
    setPwd({ current: '', next: '', confirm: '' });
  }

  if (values === null) return <div>Загрузка…</div>;

  return (
    <div>
      <div className="a-toolbar">
        <h1>Настройки</h1>
        <button className="a-btn" onClick={() => void save()}>Сохранить всё</button>
      </div>

      <div className="a-card">
        <h3 style={{ marginTop: 0 }}>Общие</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
          <label><b>Язык по умолчанию</b>
            {/* Украинский — корень сайта, английский — /en. Значение решает,
                на каком языке откроется первый визит без сохранённого выбора
                и без определяемой страны. */}
            <select className="a-input" value={values.default_locale}
              onChange={(e) => set('default_locale', e.target.value)}>
              <option value="uk">Українська /</option>
              <option value="en">English /en</option>
            </select></label>
          <label><b>Google Analytics ID</b>
            <input className="a-input" value={values.ga_id}
              placeholder="G-XXXXXXXX" onChange={(e) => set('ga_id', e.target.value)}/></label>
          <label><b>Google Tag Manager ID</b>
            <input className="a-input" value={values.gtm_id}
              placeholder="GTM-XXXXXX" onChange={(e) => set('gtm_id', e.target.value)}/></label>
          <label><b>Facebook Pixel ID</b>
            <input className="a-input" value={values.fb_pixel_id}
              placeholder="123456789012345" onChange={(e) => set('fb_pixel_id', e.target.value)}/></label>
        </div>
      </div>

      <div className="a-card">
        <h3 style={{ marginTop: 0 }}>SEO по умолчанию</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label><b>Title EN</b>
            <input className="a-input" value={values.seo_title_en}
              onChange={(e) => set('seo_title_en', e.target.value)}/></label>
          <label><b>Title UA</b>
            <input className="a-input" value={values.seo_title_ua}
              onChange={(e) => set('seo_title_ua', e.target.value)}/></label>
          <label><b>Description EN</b>
            <textarea className="a-input" rows={2} value={values.seo_description_en}
              onChange={(e) => set('seo_description_en', e.target.value)}/></label>
          <label><b>Description UA</b>
            <textarea className="a-input" rows={2} value={values.seo_description_ua}
              onChange={(e) => set('seo_description_ua', e.target.value)}/></label>
        </div>
        <label style={{ marginTop: 14, display: 'grid', gap: 4 }}>
          <b>robots.txt</b>
          <textarea className="a-input" rows={5} style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}
            value={values.robots_txt} onChange={(e) => set('robots_txt', e.target.value)}/>
          <span style={{ color: '#7a7f89', fontSize: 12 }}>
            Отдаётся публично по адресу <code>/robots.txt</code>. Строка <code>Sitemap:</code>
            {' '}добавляется автоматически из «Базового домена сайта» — вписывать её вручную
            не нужно. Админ-панель в этот файл не заносим: он публичный, и строка
            {' '}<code>Disallow</code> только подсказала бы адрес; от индексации её закрывает
            заголовок <code>noindex</code>. Пустое поле — отдаётся значение по умолчанию.
          </span>
        </label>
      </div>

      <div className="a-card">
        <h3 style={{ marginTop: 0 }}>Домен и карта сайта</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
          <label><b>Базовый домен сайта</b>
            <input className="a-input" value={values.site_domain}
              placeholder="https://gocar.run"
              onChange={(e) => set('site_domain', e.target.value)}/>
            <span style={{ color: '#7a7f89', fontSize: 12 }}>
              Используется для канонических ссылок и карты сайта. Если пусто — берётся текущий адрес.
            </span></label>
          <label><b>Название сайта</b>
            <input className="a-input" value={values.site_name}
              placeholder="GoCar"
              onChange={(e) => set('site_name', e.target.value)}/>
            <span style={{ color: '#7a7f89', fontSize: 12 }}>
              Префикс в title внутренних страниц и карточек авто: «Название — Страница».
            </span></label>
          <label><b>Favicon сайта</b>
            <input className="a-input" value={values.favicon_url}
              placeholder="/uploads/favicon.svg"
              onChange={(e) => set('favicon_url', e.target.value)}/>
            <span style={{ color: '#7a7f89', fontSize: 12 }}>
              Иконка вкладки. Путь (/uploads/…) или полный URL. Если пусто — стандартный
              {' '}<code>/favicon.ico</code>.
            </span></label>
          <label><b>OG-картинка по умолчанию</b>
            <input className="a-input" value={values.og_image_default}
              placeholder="/uploads/og-default.webp"
              onChange={(e) => set('og_image_default', e.target.value)}/>
            <span style={{ color: '#7a7f89', fontSize: 12 }}>
              Для превью в соцсетях, когда у страницы нет своей.
            </span></label>
        </div>
        <div style={{
          marginTop: 14, display: 'flex', alignItems: 'center', gap: 10,
          background: '#f4f5f7', borderRadius: 8, padding: '10px 12px'
        }}>
          <b style={{ whiteSpace: 'nowrap' }}>Карта сайта:</b>
          <code style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(values.site_domain || origin).replace(/\/+$/, '')}/sitemap.xml
          </code>
          <button className="a-btn" style={{ whiteSpace: 'nowrap' }}
            onClick={() => void copy(`${(values.site_domain || origin).replace(/\/+$/, '')}/sitemap.xml`)}>
            Копировать
          </button>
          <a className="a-btn ghost" style={{ whiteSpace: 'nowrap' }}
            href={`${(values.site_domain || origin).replace(/\/+$/, '')}/sitemap.xml`}
            target="_blank" rel="noreferrer">Открыть</a>
        </div>
        <p style={{ color: '#7a7f89', fontSize: 12, marginBottom: 0 }}>
          Карта формируется автоматически: страницы сайта, все категории и все автомобили
          со статусом Live, каждая ссылка в двух языках. Авто в статусе Draft и удалённые
          в карту не попадают.
        </p>
      </div>

      <div className="a-card">
        <h3 style={{ marginTop: 0 }}>Контакты</h3>
        <p style={{ color: '#7a7f89', fontSize: 13, marginTop: 0 }}>
          Эти значения показываются на сайте: телефон — в шапке, контакты и график —
          в подвале и на странице «Контакты», всё вместе — в разметке schema.org.
          Пустое поле просто не выводится.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
          <label><b>Телефон</b>
            <input className="a-input" value={values.contact_phone}
              placeholder="+380500451912" onChange={(e) => set('contact_phone', e.target.value)}/></label>
          <label><b>Email</b>
            <input className="a-input" value={values.contact_email}
              placeholder="info@gocar.run" onChange={(e) => set('contact_email', e.target.value)}/></label>
          <label><b>Telegram</b>
            <input className="a-input" value={values.contact_telegram}
              placeholder="https://t.me/…" onChange={(e) => set('contact_telegram', e.target.value)}/></label>
          <label><b>Viber</b>
            <input className="a-input" value={values.contact_viber}
              placeholder="viber://chat?number=…" onChange={(e) => set('contact_viber', e.target.value)}/></label>
          <label><b>Instagram</b>
            <input className="a-input" value={values.contact_instagram}
              placeholder="https://instagram.com/…" onChange={(e) => set('contact_instagram', e.target.value)}/></label>
          <label><b>Whatsapp</b>
            <input className="a-input" value={values.contact_whatsapp_url}
              placeholder="https://wa.me/380500451912" onChange={(e) => set('contact_whatsapp_url', e.target.value)}/></label>
          <label><b>Location EN</b>
            <input className="a-input" value={values.google_maps_key}
              placeholder="Haraidy St, 32/27, Uzhhorod, Ukraine" onChange={(e) => set('google_maps_key', e.target.value)}/></label>
          <label><b>Location UA</b>
            <input className="a-input" value={values.contact_whatsapp}
              placeholder="вул. Гарайди, 32/27, Ужгород, Україна" onChange={(e) => set('contact_whatsapp', e.target.value)}/></label>
          <label><b>График работы EN</b>
            <input className="a-input" value={values.work_hours_en}
              placeholder="Mon-Sun: 08:00-20:00" onChange={(e) => set('work_hours_en', e.target.value)}/></label>
          <label><b>График работы UA</b>
            <input className="a-input" value={values.work_hours_ua}
              placeholder="Пн-Нд: 08:00-20:00" onChange={(e) => set('work_hours_ua', e.target.value)}/></label>
          <label><b>Координаты</b>
            <input className="a-input" value={values.contact_geo}
              placeholder="48.6208, 22.2879" onChange={(e) => set('contact_geo', e.target.value)}/>
            <span style={{ color: '#7a7f89', fontSize: 12 }}>
              Широта и долгота офиса через запятую — правый клик по точке в Google Maps,
              первая строка меню. Идут в разметку schema.org (AutoRental → geo).
            </span></label>
        </div>
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <b>Ссылка на Iframe Google Maps EN</b>
            <textarea className="a-input" rows={3} style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}
              placeholder='<iframe src="https://www.google.com/maps/embed?..."></iframe> или URL из embed'
              value={values.google_maps_iframe}
              onChange={(e) => set('google_maps_iframe', e.target.value)}/>
            <span style={{ color: '#7a7f89', fontSize: 12 }}>
              Код встраивания карты (или ссылка из «Поделиться → Встроить карту») для
              англоязычной страницы контактов.
            </span>
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <b>Ссылка на Iframe Google Maps UA</b>
            <textarea className="a-input" rows={3} style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}
              placeholder='<iframe src="https://www.google.com/maps/embed?..."></iframe> или URL из embed'
              value={values.google_maps_iframe_ua}
              onChange={(e) => set('google_maps_iframe_ua', e.target.value)}/>
            <span style={{ color: '#7a7f89', fontSize: 12 }}>
              Та же карта на украинском (в коде встраивания параметр «hl=uk»). Если поле
              пустое, украинская страница показывает карту из поля EN.
            </span>
          </label>
        </div>
      </div>

      <div className="a-card">
        <h3 style={{ marginTop: 0 }}>Формы и Telegram</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label><b>Telegram Bot Token</b>
            <input className="a-input" type="password" autoComplete="new-password"
              value={values.telegram_bot_token}
              placeholder={stored.telegram_bot_token ? '••••••• (сохранён)' : ''}
              onChange={(e) => set('telegram_bot_token', e.target.value)}/></label>
          <label><b>Telegram Chat ID</b>
            <input className="a-input" value={values.telegram_chat_id}
              placeholder="-100…"
              onChange={(e) => set('telegram_chat_id', e.target.value)}/></label>
          <label><b>reCAPTCHA v3 Site Key</b>
            <input className="a-input" value={values.recaptcha_site_key}
              onChange={(e) => set('recaptcha_site_key', e.target.value)}/></label>
          <label><b>reCAPTCHA v3 Secret</b>
            <input className="a-input" type="password" autoComplete="new-password"
              value={values.recaptcha_secret_key}
              placeholder={stored.recaptcha_secret_key ? '••••••• (сохранён)' : ''}
              onChange={(e) => set('recaptcha_secret_key', e.target.value)}/></label>
          <label><b>Порог reCAPTCHA</b>
            <input className="a-input" type="number" min="0" max="1" step="0.1"
              value={values.recaptcha_score_threshold}
              placeholder="0.5"
              onChange={(e) => set('recaptcha_score_threshold', e.target.value)}/></label>
        </div>
        <p style={{ color: '#7a7f89', fontSize: 12, marginTop: 10 }}>
          Заявки с оценкой ниже порога отклоняются. 0 — пропускать всех, 1 — только
          заведомых людей; рекомендуемое значение 0.5. Оценка каждой заявки видна
          в разделе Заявки. reCAPTCHA включается, только когда заполнены оба ключа.
        </p>
        <p style={{ color: '#7a7f89', fontSize: 12, marginTop: 10 }}>
          Секретные поля не отображаются после сохранения. Пустое поле не перезаписывает значение.
          При переходе с <code>config.local.json</code> — введите токен и chat_id один раз,
          дальше система использует БД.
        </p>
      </div>

      <div className="a-card">
        <h3 style={{ marginTop: 0 }}>Безопасность (админ-панель)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <label><b>Блокировать после N неудач</b>
            <input className="a-input" type="number" min={1} value={values.lockout_attempts}
              onChange={(e) => set('lockout_attempts', e.target.value)}/>
            <span style={{ color: '#7a7f89', fontSize: 12 }}>
              Считается и по IP, и по имени учётной записи — второе не даёт подбирать
              пароль с разных адресов. Лимит по имени втрое больше.
            </span></label>
          <label><b>Окно блокировки, минут</b>
            <input className="a-input" type="number" min={1} value={values.lockout_minutes}
              onChange={(e) => set('lockout_minutes', e.target.value)}/>
            <span style={{ color: '#7a7f89', fontSize: 12 }}>
              За сколько минут назад считаются неудачные попытки.
            </span></label>
          <label><b>Хранить журнал входов, дней</b>
            <input className="a-input" type="number" min={0} value={values.login_attempts_keep_days}
              onChange={(e) => set('login_attempts_keep_days', e.target.value)}/>
            <span style={{ color: '#7a7f89', fontSize: 12 }}>
              Записи старше указанного срока удаляются автоматически. 0 — хранить всё
              (тогда чистить журнал придётся вручную в разделе «Попытки входа»).
            </span></label>
        </div>
      </div>

      <div className="a-card">
        <h3 style={{ marginTop: 0 }}>Медиа</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label><b>Максимальная ширина изображения, px</b>
            <input className="a-input" type="number" min={200} value={values.image_max_width}
              onChange={(e) => set('image_max_width', e.target.value)}/></label>
          <label><b>Качество изображения WebP (1–100)</b>
            <input className="a-input" type="number" min={1} max={100} value={values.image_quality}
              onChange={(e) => set('image_quality', e.target.value)}/></label>
        </div>
        <div style={{ color: '#7a7f89', fontSize: 12, marginTop: 6 }}>
          Применяется к изображениям, которые загружаются в разделе «Изображения»:
          более широкая картинка уменьшается до этой ширины, а WebP-копия пишется
          с указанным качеством. Фото автомобилей и отзывов используют свои размеры ниже.
        </div>
        <div style={{ height: 1, background: '#e3e6ea', margin: '16px 0' }}/>
        <b style={{ fontSize: 14 }}>Размеры фото автомобилей</b>
        <div style={{ color: '#7a7f89', fontSize: 12, margin: '4px 0 12px' }}>
          Фото вписывается в заданный прямоугольник без искажения и обрезки (по большей стороне).
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label><b>Размер основного фото авто, Ширина px</b>
            <input className="a-input" type="number" min={200} value={values.car_image_max_width}
              onChange={(e) => set('car_image_max_width', e.target.value)}/></label>
          <label><b>Размер основного фото авто, Высота px</b>
            <input className="a-input" type="number" min={200} value={values.car_image_max_height}
              onChange={(e) => set('car_image_max_height', e.target.value)}/></label>
          <label><b>Размер доп. фото авто, Ширина px</b>
            <input className="a-input" type="number" min={200} value={values.car_preview_max_width}
              onChange={(e) => set('car_preview_max_width', e.target.value)}/></label>
          <label><b>Размер доп. фото авто, Высота px</b>
            <input className="a-input" type="number" min={200} value={values.car_preview_max_height}
              onChange={(e) => set('car_preview_max_height', e.target.value)}/></label>
        </div>
      </div>

      <div className="a-card">
        <h3 style={{ marginTop: 0 }}>Смена пароля администратора</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 14, alignItems: 'end' }}>
          <label><b>Текущий пароль</b>
            <input className="a-input" type="password" autoComplete="current-password"
              value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })}/></label>
          <label><b>Новый пароль</b>
            <input className="a-input" type="password" autoComplete="new-password"
              value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })}/></label>
          <label><b>Повторите новый</b>
            <input className="a-input" type="password" autoComplete="new-password"
              value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}/></label>
          <button className="a-btn" onClick={() => void changePwd()}>Обновить пароль</button>
        </div>
        <p style={{ color: '#7a7f89', fontSize: 12, marginTop: 10 }}>Минимум 8 символов.</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="a-btn" onClick={() => void save()}>Сохранить всё</button>
      </div>
    </div>
  );
}
