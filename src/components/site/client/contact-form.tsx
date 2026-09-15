'use client';

import { useEffect, useRef, useState } from 'react';
import { FormField } from '../form-field';
import type { ContactData } from '@/lib/site-contact';
import type { Locale } from '@/lib/site-nav';

/** Element id of every field, so a refusal can both mark it and go to it. */
const FIELD_IDS: Record<string, string> = {
  name: 'contact-name',
  email: 'contact-email',
  message: 'contact-message'
};

/**
 * An address is accepted when it has one @ with something on either side and a
 * dot in the domain. The endpoint is the authority on what it stores; this is
 * only here so an obvious typo is caught before the visitor waits for a round
 * trip.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** What the form is doing, which is also what the button says. */
type State = 'idle' | 'invalid' | 'sending' | 'sent' | 'error';

/** Response shape of /api/lead. */
type LeadResponse = { ok?: boolean; error?: string };

/** The reCAPTCHA v3 object Google's script puts on the window. */
interface Grecaptcha {
  ready: (cb: () => void) => void;
  execute: (key: string, options: { action: string }) => Promise<string>;
}

/**
 * The contact form.
 *
 * The only client island of the page: three fields, a one-pass validation and
 * a confirmation window. The submission goes to the same /api/lead as the
 * booking form - the endpoint verifies the reCAPTCHA token, filters the
 * honeypot, sends Telegram and writes the leads table - so none of that logic
 * lives here (plan section 5, "серверная логика не меняется").
 */
export function ContactForm({ locale, data }: { locale: Locale; data: ContactData }) {
  const t = data.texts;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  /** Filled only by a robot: a visitor never sees the field. */
  const [website, setWebsite] = useState('');
  const [flagged, setFlagged] = useState<string[]>([]);
  const [hint, setHint] = useState('');
  const [state, setState] = useState<State>('idle');
  const [done, setDone] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  /** Keyboard handling of the confirmation window: Escape closes it. */
  useEffect(() => {
    if (!done) return undefined;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDone(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [done]);

  /**
   * A reCAPTCHA v3 token for the submission, or an empty string when the keys
   * are not configured or Google's script did not load: the endpoint then
   * verifies nothing, and a visitor is never blocked from writing to us
   * because a third-party script is unavailable.
   */
  async function recaptchaToken(): Promise<string> {
    const key = data.recaptchaSiteKey;
    const grecaptcha = (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha;
    if (key === '' || grecaptcha === undefined || typeof grecaptcha.ready !== 'function') {
      return '';
    }
    return new Promise<string>((resolve) => {
      try {
        grecaptcha.ready(() => {
          grecaptcha
            .execute(key, { action: 'lead' })
            .then(resolve)
            .catch(() => resolve(''));
        });
      } catch {
        resolve('');
      }
    });
  }

  /**
   * Refuse the submission: mark every field that is at fault, name the reason
   * on the button and take the visitor to the first gap from the top.
   */
  function refuse(reason: string, fields: string[]): void {
    setFlagged(fields);
    setHint(reason);
    setState('invalid');
    const id = FIELD_IDS[fields[0] ?? ''];
    if (id !== undefined) {
      const node = document.getElementById(id);
      if (node !== null) {
        node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        node.focus({ preventScroll: true });
      }
    }
    window.setTimeout(() => setState('idle'), 4000);
  }

  /**
   * Validate in one pass, then send. Every empty field is marked at once, so
   * the visitor sees the whole gap instead of discovering it one field at a
   * time; a filled but malformed address is a separate message.
   */
  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (state === 'sending') return;

    const missing: string[] = [
      ...(name.trim() === '' ? ['name'] : []),
      ...(email.trim() === '' ? ['email'] : []),
      ...(message.trim() === '' ? ['message'] : [])
    ];
    if (missing.length > 0) {
      refuse(t.stateRequired ?? 'Fill in the required fields', missing);
      return;
    }
    if (!EMAIL.test(email.trim())) {
      refuse(t.stateEmail ?? 'Check the email address', ['email']);
      return;
    }

    setFlagged([]);
    setState('sending');
    const token = await recaptchaToken();
    const payload: Record<string, unknown> = {
      type: 'contact',
      locale: locale === 'ua' ? 'uk' : 'en',
      page: window.location.pathname,
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      website
    };
    if (token !== '') payload.recaptcha_token = token;

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = (await res.json()) as LeadResponse;
      if (!res.ok || body.ok !== true) {
        setState('error');
        window.setTimeout(() => setState('idle'), 4000);
        return;
      }
      setDone(true);
      setState('sent');
      setName('');
      setEmail('');
      setMessage('');
      /**
       * Analytics event of a sent message, the same name the Framer page
       * pushed, so the GTM tags built on it keep firing.
       */
      try {
        const holder = window as unknown as { dataLayer?: Array<Record<string, string>> };
        const layer = holder.dataLayer ?? [];
        holder.dataLayer = layer;
        layer.push({ event: 'send_contact_form' });
      } catch {
        /** Analytics must never block the confirmation. */
      }
      window.setTimeout(() => setState('idle'), 4000);
    } catch {
      setState('error');
      window.setTimeout(() => setState('idle'), 4000);
    }
  }

  const buttonLabel =
    state === 'sending'
      ? (t.stateSending ?? 'Sending…')
      : state === 'sent'
        ? (t.stateSent ?? 'Sent ✓')
        : state === 'error'
          ? (t.stateError ?? 'Error, try again')
          : state === 'invalid'
            ? hint
            : (t.submit ?? 'Submit');

  return (
    <>
      <form className="site-contact-form" onSubmit={submit} noValidate>
        <FormField
          label={t.namePlaceholder ?? ''}
          htmlFor="contact-name"
          invalid={flagged.includes('name')}
        >
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            placeholder={t.namePlaceholder}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>

        <FormField
          label={t.emailPlaceholder ?? ''}
          htmlFor="contact-email"
          invalid={flagged.includes('email')}
        >
          <input
            id="contact-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>

        <FormField
          label={t.messagePlaceholder ?? ''}
          htmlFor="contact-message"
          area
          invalid={flagged.includes('message')}
        >
          <textarea
            id="contact-message"
            name="message"
            rows={4}
            required
            placeholder={t.messagePlaceholder}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </FormField>

        {/* Honeypot: hidden from people, filtered by the endpoint. */}
        <input
          className="site-contact-trap"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />

        <button className="site-contact-submit" type="submit" disabled={state === 'sending'}>
          {buttonLabel}
        </button>
      </form>

      {!done ? null : (
        <div
          className="site-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t.modalTitle}
          onClick={(event) => {
            if (event.target === event.currentTarget) setDone(false);
          }}
        >
          <div className="site-modal">
            <button
              className="site-modal-close"
              type="button"
              aria-label={t.close}
              ref={closeRef}
              onClick={() => setDone(false)}
            >
              ×
            </button>
            <span className="site-modal-check" aria-hidden="true">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 12.5l5 5L20 7"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h2 className="site-modal-title">{t.modalTitle}</h2>
            <p className="site-modal-sub">{t.modalSub}</p>
          </div>
        </div>
      )}
    </>
  );
}
