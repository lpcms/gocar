'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

/** The slice of Google's global the token request needs. */
interface Grecaptcha {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
}

/**
 * Action reported to Google, so the score statistics of the admin door are
 * kept apart from those of the public booking form.
 */
const ACTION = 'admin_login';

/**
 * Admin login form (RU): a real form so Enter submits from any field.
 *
 * When reCAPTCHA v3 is configured in Настройки, every attempt carries a token
 * that /api/admin/login verifies before it ever looks at the password. An
 * absent or unusable Google script yields an empty token: the endpoint then
 * refuses the attempt when reCAPTCHA is on, which is the point of turning it
 * on, while an install without keys keeps working untouched.
 */
export function AdminLoginForm({ siteKey }: { siteKey: string }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  /** A fresh reCAPTCHA token, or '' when the feature is off or unavailable. */
  async function token(): Promise<string> {
    const grecaptcha = (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha;
    if (siteKey === '' || grecaptcha === undefined || typeof grecaptcha.ready !== 'function') {
      return '';
    }
    return new Promise<string>((resolve) => {
      try {
        grecaptcha.ready(() => {
          grecaptcha
            .execute(siteKey, { action: ACTION })
            .then(resolve)
            .catch(() => resolve(''));
        });
      } catch {
        resolve('');
      }
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const recaptcha = await token();
    /**
     * An empty token while the feature is on means Google's script never ran -
     * an ad blocker, a privacy extension or a DNS filter, not a wrong
     * password. Sending it anyway would be answered with the generic reCAPTCHA
     * error and, worse, journalized as a failed attempt: five of those in
     * thirty minutes lock the address out. So the attempt is stopped here and
     * the reason is named.
     */
    if (siteKey !== '' && recaptcha === '') {
      setBusy(false);
      setError(
        'Не удалось загрузить проверку Google (reCAPTCHA). Отключите блокировщик рекламы ' +
          'или расширение, блокирующее google.com, и обновите страницу.'
      );
      return;
    }
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login, password, recaptcha })
    });
    if (res.ok) {
      window.location.href = '/admin';
      return;
    }
    setBusy(false);
    if (res.status === 429) {
      setError('Слишком много попыток. Попробуйте позже.');
      return;
    }
    if (res.status === 403) {
      setError('Проверка reCAPTCHA не пройдена. Обновите страницу и попробуйте снова.');
      return;
    }
    setError('Неверный логин или пароль.');
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={(e) => void submit(e)}>
        <h1>
          Go<span style={{ color: '#fd3b3b' }}>Car</span> — админ-панель
        </h1>
        <p className="sub">Вход для администратора</p>
        <div className="field">
          <input
            className="a-input"
            placeholder="Логин"
            value={login}
            autoFocus
            onChange={(e) => setLogin(e.target.value)}
          />
        </div>
        <div className="field">
          <input
            className="a-input"
            placeholder="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="a-btn" style={{ width: '100%' }} disabled={busy} type="submit">
          {busy ? 'Входим…' : 'Войти'}
        </button>
        {error !== '' && <p className="login-error">{error}</p>}
        {siteKey === '' ? null : (
          <p className="sub login-recaptcha">
            Защищено reCAPTCHA. Действуют{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
              Политика конфиденциальности
            </a>{' '}
            и{' '}
            <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer">
              Условия использования
            </a>{' '}
            Google.
          </p>
        )}
      </form>
    </div>
  );
}
