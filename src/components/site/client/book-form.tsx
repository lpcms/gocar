'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FormField } from '../form-field';
import type { BookData } from '@/lib/site-book';
import type { Locale } from '@/lib/site-nav';

/** Slug of the extra that replaces the deposit instead of adding to the bill. */
const INSURANCE = 'full-coverage-insurance';

/** Days from which the full-coverage insurance can be taken. */
const INSURANCE_MIN_DAYS = 3;

/**
 * Element id of a field, by the name the validation flags it under - so a
 * refusal can both mark the field and take the visitor to it.
 */
const FIELD_IDS: Record<string, string> = {
  vehicle: 'book-vehicle',
  name: 'book-name',
  phone: 'book-phone'
};

/** What kind of gap a field is, so a refusal can name it. */
const FIELD_KINDS: Record<string, string> = {
  vehicle: 'vehicle',
  'pickup-date': 'date',
  'dropoff-date': 'date',
  'pickup-time': 'place',
  'pickup-place': 'place',
  'dropoff-time': 'place',
  'dropoff-place': 'place',
  name: 'contact',
  phone: 'contact'
};

/** Picture shown until a car is picked. */
const PLACEHOLDER = '/images/site/book-placeholder.png';

/** What the confirmation window shows after a successful send. */
type Confirmation = {
  name: string;
  phone: string;
  vehicle: string;
  pickup: string;
  dropoff: string;
  extras: string[];
  comment: string;
  days: number;
  rental: number;
  extras_total: number;
  deposit: number;
  total: number;
};

/** Response shape of /api/lead. */
type LeadResponse = { ok?: boolean; error?: string; details?: Confirmation };

/**
 * Daily rate for a rental length, identical to bracketRate in leads.ts:
 * up to 3 days the first tariff, up to 9 the second, up to 25 the third,
 * beyond that the fourth, each falling back to the previous one.
 */
function bracketRate(tariffs: [number, number, number, number], days: number): number {
  const first = tariffs[0] ?? 0;
  const second = tariffs[1] ?? first;
  const third = tariffs[2] ?? second;
  const fourth = tariffs[3] ?? third;
  if (days <= 3) return first;
  if (days <= 9) return second === 0 ? first : second;
  if (days <= 25) return third === 0 ? second : third;
  return fourth === 0 ? third : fourth;
}

/**
 * Rental length in days, identical to calcDays in leads.ts: a part of a day
 * counts as a whole one from 0.17 of it (four hours), and any valid range is
 * at least one day. The price the visitor sees must be the price the server
 * recomputes, so this cannot drift from the server rule.
 */
function calcDays(
  pickupDate: string,
  pickupTime: string,
  dropoffDate: string,
  dropoffTime: string
): number {
  if (pickupDate === '' || dropoffDate === '') return 0;
  const from = new Date(pickupTime !== '' ? `${pickupDate}T${pickupTime}` : pickupDate);
  const to = new Date(dropoffTime !== '' ? `${dropoffDate}T${dropoffTime}` : dropoffDate);
  const ms = to.getTime() - from.getTime();
  if (!isFinite(ms) || ms <= 0) return 0;
  const raw = ms / 86400000;
  const fraction = Number((raw % 1).toFixed(2));
  const days = fraction >= 0.17 ? Math.ceil(raw) : Math.floor(raw);
  return days > 0 ? days : 1;
}

/**
 * A moment as the confirmation prints it: 01.09.2026 10:00, followed by the
 * place as the visitor read it in the list. The endpoint returns these two as
 * raw field values ("2026-09-01 10:00, hotel uzhhorod"), which is the storage
 * form, not something to show a customer.
 */
function formatMoment(date: string, time: string, place: string): string {
  const parts = date.split('-');
  const day = date === '' ? '' : `${parts[2] ?? ''}.${parts[1] ?? ''}.${parts[0] ?? ''}`;
  const stamp = [day, time].filter((part) => part !== '').join(' ');
  return [stamp, place].filter((part) => part !== '').join(', ');
}

/**
 * The booking form.
 *
 * The only client island of the page, and the reason the page has one at all:
 * the visitor filters the fleet by category, picks a car, sets the dates and
 * the extras, and every one of those steps changes the price and the picture
 * on the spot. The calculation mirrors leads.ts exactly - the server recomputes
 * the total from the database on submit and the client total is never trusted -
 * so the two must agree to the cent.
 *
 * Everything it renders comes from props: the fleet, the extras, the places and
 * every visible string are read from the database by the server component.
 */
export function BookForm({
  locale,
  data,
  carSlug = ''
}: {
  locale: Locale;
  data: BookData;
  carSlug?: string;
}) {
  const t = data.texts;
  /**
   * The car named by `?car=<slug>`, when a visitor arrived from a car page.
   * It seeds the first render, so the category, the vehicle and the photograph
   * are already right in the server markup.
   */
  const preset = data.cars.find((item) => item.slug === carSlug) ?? null;
  /**
   * The chosen categories. An empty list means "All categories", which is why
   * the pill for it is simply the empty state rather than a value of its own
   * (client 22.08.2026): ticking it clears the rest, and ticking any category
   * clears it.
   */
  const [categories, setCategories] = useState<string[]>(preset === null ? [] : [preset.category]);
  const [vehicle, setVehicle] = useState(preset?.name ?? '');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [pickupPlace, setPickupPlace] = useState('');
  const [dropoffDate, setDropoffDate] = useState('');
  const [dropoffTime, setDropoffTime] = useState('');
  const [dropoffPlace, setDropoffPlace] = useState('');
  const [extras, setExtras] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error' | 'invalid'>('idle');
  const [hint, setHint] = useState('');
  /** Fields the last refused submit pointed at, marked until they are filled. */
  const [flagged, setFlagged] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  /**
   * A visitor arriving from a car page: the "Book" button there stores the car
   * name, and the form opens with that car, its category and its picture
   * already chosen. The name is consumed once, so a later visit starts clean.
   */
  useEffect(() => {
    if (preset !== null) return;
    let wanted: string | null = null;
    try {
      wanted = window.localStorage.getItem('VehicleName');
    } catch {
      wanted = null;
    }
    if (wanted === null || wanted === '') return;
    const car = data.cars.find((item) => item.name === wanted);
    if (car === undefined) return;
    setCategories([car.category]);
    setVehicle(car.name);
    try {
      window.localStorage.removeItem('VehicleName');
    } catch {
      /** Storage may be unavailable; the preselect simply does not repeat. */
    }
  }, [data.cars, preset]);

  /**
   * Add or remove one category. Unticking the last one falls back to "All
   * categories" rather than leaving a selection that matches no car.
   */
  const toggleCategory = (name: string): void => {
    setCategories((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    );
  };

  const visibleCars = useMemo(
    () =>
      categories.length === 0
        ? data.cars
        : data.cars.filter((car) => categories.includes(car.category)),
    [categories, data.cars]
  );

  const car = useMemo(
    () => data.cars.find((item) => item.name === vehicle) ?? null,
    [vehicle, data.cars]
  );

  const days = calcDays(pickupDate, pickupTime, dropoffDate, dropoffTime);
  const insurance = data.extras.find((extra) => extra.slug === INSURANCE) ?? null;
  const insuranceAvailable = days >= INSURANCE_MIN_DAYS;
  const insuranceChosen =
    insurance !== null && insuranceAvailable && extras.includes(insurance.value);

  const rental = car === null ? 0 : bracketRate(car.tariffs, days) * days;
  const extrasTotal = data.extras.reduce((sum, extra) => {
    if (extra.slug === INSURANCE || !extras.includes(extra.value)) return sum;
    return sum + (extra.priceType === 'per_order' ? extra.price : extra.price * days);
  }, 0);
  const deposit = insuranceChosen && insurance !== null ? insurance.price : (car?.deposit ?? 0);

  /**
   * The insurance is only offered from three days: a shorter rental drops it
   * from the selection as well, otherwise a visitor who shortens the dates
   * keeps paying a deposit rule that no longer applies.
   */
  useEffect(() => {
    if (insurance === null || insuranceAvailable) return;
    setExtras((current) =>
      current.includes(insurance.value) ? current.filter((v) => v !== insurance.value) : current
    );
  }, [insurance, insuranceAvailable]);

  /** A car that the current category no longer contains is deselected. */
  useEffect(() => {
    if (vehicle === '') return;
    if (visibleCars.some((item) => item.name === vehicle)) return;
    setVehicle('');
  }, [visibleCars, vehicle]);

  /** Keyboard handling of the confirmation window: Escape closes it. */
  useEffect(() => {
    if (confirmation === null) return undefined;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirmation(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmation]);

  /**
   * A reCAPTCHA v3 token for the submission, or an empty string when the keys
   * are not configured or Google's script did not load: the endpoint then
   * verifies nothing, and a visitor is never blocked from booking because a
   * third-party script is unavailable.
   */
  async function recaptchaToken(): Promise<string> {
    const key = data.recaptchaSiteKey;
    const grecaptcha = (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha;
    if (key === '' || grecaptcha === undefined || typeof grecaptcha.ready !== 'function') return '';
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
   * Open the native calendar from anywhere in the date field, not only from
   * the small icon at its right edge: the visitor reads the whole box as the
   * control, and on a phone the icon is a 20px target inside a 40px field.
   */
  function openDatePicker(event: React.MouseEvent<HTMLDivElement>): void {
    const input = event.currentTarget.querySelector('input[type="date"]');
    if (!(input instanceof HTMLInputElement)) return;
    if (typeof input.showPicker !== 'function') {
      input.focus();
      return;
    }
    try {
      input.showPicker();
    } catch {
      /** Already open, or the browser refuses outside a gesture: just focus. */
      input.focus();
    }
  }

  /** Human label of a stored place value. */
  function placeLabel(value: string): string {
    return data.places.find((place) => place.value === value)?.label ?? value;
  }

  /** Toggle one extra. */
  function toggleExtra(value: string): void {
    setExtras((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  /**
   * Refuse a submission: the button says what is missing and every field it is
   * about carries the invalid ring until it is filled in.
   */
  function refuse(text: string, fields: string[]): void {
    setState('invalid');
    setHint(text);
    setFlagged(fields);
    /**
     * Take the visitor to the field instead of leaving them to find it: the
     * form is longer than a screen, and the button that says what is missing
     * sits at its very bottom. The movement is skipped for anyone who asked
     * the system for less of it.
     */
    const first = fields[0];
    if (first !== undefined) {
      window.requestAnimationFrame(() => {
        const element = document.getElementById(FIELD_IDS[first] ?? first);
        if (element === null) return;
        const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        element.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
        element.focus({ preventScroll: true });
      });
    }
    window.setTimeout(() => {
      setState('idle');
      setHint('');
    }, 3000);
  }

  /** Drops a field from the flagged list as soon as it gets a value. */
  function clearFlag(field: string): void {
    setFlagged((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : current
    );
  }

  /**
   * Send the booking. The client checks only what would make the request
   * meaningless - no car, no contact, no valid range; the price, the extras
   * and the deposit are recomputed server-side from the database.
   */
  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (state === 'sending') return;
    /**
     * The two dates are compared as soon as both are set, before anything else
     * is asked for: a return that is not later than the handover is the problem
     * to report, even while the times and places are still empty. With times
     * chosen, an equal pair counts too - that is a zero-day rental, which the
     * server would refuse to price.
     */
    if (pickupDate !== '' && dropoffDate !== '' && days === 0) {
      refuse(t.stateOrder ?? 'The drop-off must be later than the pick-up', ['dropoff-date']);
      return;
    }
    /**
     * Everything that is missing is collected in one pass, in the order the
     * visitor reads the form - car, pick-up, drop-off, contact - so every gap
     * is marked at once and the page goes to the first of them. Checking one
     * group at a time walked the visitor down the form, complaining about the
     * name while the dates above it were still empty.
     */
    const missing: string[] = [
      ...(vehicle === '' ? ['vehicle'] : []),
      ...(pickupDate === '' ? ['pickup-date'] : []),
      ...(pickupTime === '' ? ['pickup-time'] : []),
      ...(pickupPlace === '' ? ['pickup-place'] : []),
      ...(dropoffDate === '' ? ['dropoff-date'] : []),
      ...(dropoffTime === '' ? ['dropoff-time'] : []),
      ...(dropoffPlace === '' ? ['dropoff-place'] : []),
      ...(name.trim() === '' ? ['name'] : []),
      ...(phone.trim() === '' ? ['phone'] : [])
    ];
    if (missing.length > 0) {
      /**
       * One kind of gap gets the message written for it; a mix of kinds gets
       * the general one, because no single specific line would be true.
       */
      const kinds = new Set(missing.map((field) => FIELD_KINDS[field] ?? 'other'));
      const kind = kinds.size === 1 ? [...kinds][0] : 'mixed';
      const message =
        kind === 'vehicle'
          ? (t.stateVehicle ?? 'Select a vehicle')
          : kind === 'contact'
            ? (t.stateRequired ?? 'Fill in name and phone')
            : kind === 'date'
              ? (t.stateDates ?? 'Check the dates')
              : kind === 'place'
                ? (t.statePlace ?? 'Choose the time and place of pick-up and drop-off')
                : (t.stateIncomplete ?? 'Fill in the required fields');
      refuse(message, missing);
      return;
    }
    setState('sending');
    const token = await recaptchaToken();
    const payload: Record<string, unknown> = {
      type: 'booking',
      locale: locale === 'ua' ? 'uk' : 'en',
      page: window.location.pathname,
      vehicle,
      pickup_date: pickupDate,
      pickup_time: pickupTime,
      pickup_place: pickupPlace,
      dropoff_date: dropoffDate,
      dropoff_time: dropoffTime,
      dropoff_place: dropoffPlace,
      extras: data.extras.filter((e) => extras.includes(e.value)).map((e) => e.name),
      name,
      phone,
      comment
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
      const details = body.details ?? null;
      /**
       * The money comes from the server - it is the number the customer is
       * charged by - and so are the extras that were counted, because
       * insurance is deliberately left out of that list and paid for through
       * the deposit instead. Every label the endpoint returns is already in
       * the language the order was placed in (25.08.2026), so nothing is
       * translated back here.
       *
       * The two moments are the visitor's own: the endpoint answers with the
       * storage form ("2026-09-01 10:00, Hotel Uzhhorod"), which is not
       * something to show a customer.
       */
      setConfirmation(
        details === null
          ? null
          : {
              ...details,
              pickup: formatMoment(pickupDate, pickupTime, placeLabel(pickupPlace)),
              dropoff: formatMoment(dropoffDate, dropoffTime, placeLabel(dropoffPlace))
            }
      );
      setState('sent');
      /** The form empties itself, as the legacy confirmation did. */
      setCategories([]);
      setVehicle('');
      setPickupDate('');
      setPickupTime('');
      setPickupPlace('');
      setDropoffDate('');
      setDropoffTime('');
      setDropoffPlace('');
      setExtras([]);
      setName('');
      setPhone('');
      setComment('');
      setFlagged([]);
      /**
       * Analytics event of a completed booking, the same name the Framer page
       * pushed, so the GTM tags built on it keep firing.
       */
      try {
        const holder = window as unknown as { dataLayer?: Array<Record<string, string>> };
        const layer = holder.dataLayer ?? [];
        holder.dataLayer = layer;
        layer.push({ event: 'send_form' });
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
            : (t.submit ?? 'Book');

  const photo = car?.image ?? PLACEHOLDER;

  return (
    <>
      <form className="site-book-form" onSubmit={submit} noValidate>
        <section className="site-book-block">
          <h2 className="site-book-legend">{t.categoriesTitle}</h2>
          {/* The reference keeps "All categories" on a row of its own. */}
          <div className="site-book-pills">
            <label className={`site-book-pill${categories.length === 0 ? ' is-on' : ''}`}>
              <input
                type="checkbox"
                value={t.allCategories}
                checked={categories.length === 0}
                onChange={() => setCategories([])}
              />
              <span>{t.allCategories}</span>
            </label>
          </div>
          <div className="site-book-pills">
            {data.categories.map((item) => (
              <label
                className={`site-book-pill${categories.includes(item) ? ' is-on' : ''}`}
                key={item}
              >
                <input
                  type="checkbox"
                  value={item}
                  checked={categories.includes(item)}
                  onChange={() => toggleCategory(item)}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="site-book-block">
          <h2 className="site-book-legend">{t.vehicleTitle}</h2>
          <div className="site-book-vehicle">
            <FormField
              label={t.vehicleTitle ?? ''}
              htmlFor="book-vehicle"
              compact
              invalid={flagged.includes('vehicle')}
            >
              <select
                id="book-vehicle"
                name="Vehicle"
                className="site-book-select site-book-select--vehicle"
                required
                aria-required="true"
                value={vehicle}
                onChange={(event) => {
                  setVehicle(event.target.value);
                  clearFlag('vehicle');
                }}
              >
                <option value="">{t.vehiclePlaceholder}</option>
                {visibleCars.map((item) => (
                  <option value={item.name} key={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormField>
            <span className="site-book-photo">
              <img src={photo} alt={car === null ? data.placeholderAlt : car.name} />
            </span>
          </div>
        </section>

        {(
          [
            [
              'pickup',
              t.pickupTitle,
              pickupDate,
              setPickupDate,
              pickupTime,
              setPickupTime,
              pickupPlace,
              setPickupPlace
            ],
            [
              'dropoff',
              t.dropoffTitle,
              dropoffDate,
              setDropoffDate,
              dropoffTime,
              setDropoffTime,
              dropoffPlace,
              setDropoffPlace
            ]
          ] as const
        ).map(([id, title, date, setDate, time, setTime, place, setPlace]) => (
          <section className="site-book-block site-book-block--row" key={id}>
            <h2 className="site-book-legend">{title}</h2>
            <div className="site-book-row">
              {/* The calendar of the return opens no earlier than the handover. */}
              <div className="site-book-date" onClick={openDatePicker}>
                <FormField
                  label={`${title} — ${t.datePlaceholder}`}
                  htmlFor={id + '-date'}
                  compact
                  invalid={flagged.includes(id + '-date')}
                >
                  <input
                    id={id + '-date'}
                    type="date"
                    className="site-book-input"
                    placeholder={t.datePlaceholder}
                    required
                    aria-required="true"
                    min={id === 'dropoff' ? pickupDate || undefined : undefined}
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value);
                      clearFlag(id + '-date');
                    }}
                  />
                </FormField>
              </div>
              <FormField
                label={`${title} — ${t.timePlaceholder}`}
                htmlFor={id + '-time'}
                compact
                invalid={flagged.includes(id + '-time')}
              >
                <select
                  id={id + '-time'}
                  className="site-book-select"
                  required
                  aria-required="true"
                  value={time}
                  onChange={(event) => {
                    setTime(event.target.value);
                    clearFlag(id + '-time');
                  }}
                >
                  <option value="">{t.timePlaceholder}</option>
                  {data.times.map((value) => (
                    <option value={value} key={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                label={`${title} — ${t.locationPlaceholder}`}
                htmlFor={id + '-place'}
                compact
                invalid={flagged.includes(id + '-place')}
              >
                <select
                  id={id + '-place'}
                  className="site-book-select"
                  required
                  aria-required="true"
                  value={place}
                  onChange={(event) => {
                    setPlace(event.target.value);
                    clearFlag(id + '-place');
                  }}
                >
                  <option value="">{t.locationPlaceholder}</option>
                  {data.places.map((item) => (
                    <option value={item.value} key={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </section>
        ))}

        <section className="site-book-block">
          <h2 className="site-book-legend">{t.extrasTitle}</h2>
          <div className="site-book-extras">
            {data.extras.map((extra) => {
              const isInsurance = extra.slug === INSURANCE;
              const disabled = isInsurance && !insuranceAvailable;
              const unit = extra.priceType === 'per_order' ? t.perOrder : t.perDay;
              return (
                <div className="site-book-extra" key={extra.slug}>
                  <label
                    className={`site-book-pill${extras.includes(extra.value) ? ' is-on' : ''}${
                      disabled ? ' is-off' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      value={extra.value}
                      checked={extras.includes(extra.value)}
                      disabled={disabled}
                      onChange={() => toggleExtra(extra.value)}
                    />
                    <span>
                      {extra.name}
                      {isInsurance ? null : (
                        <span className="site-book-extra-price">
                          +${extra.price}/{unit}
                        </span>
                      )}
                    </span>
                  </label>
                  {isInsurance && !insuranceAvailable ? (
                    <span className="site-book-extra-note">{t.insuranceNote}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <div className="site-book-summary" aria-live="polite">
          <div className="site-book-summary-row">
            <span>{t.totalDays}:</span>
            <strong>{days}</strong>
          </div>
          <div className="site-book-summary-row">
            <span>{t.totalRental}:</span>
            <strong>${rental}</strong>
          </div>
          <div className="site-book-summary-row">
            <span>{t.totalExtras}:</span>
            <strong>${extrasTotal}</strong>
          </div>
          <div className="site-book-summary-row">
            <span>{t.totalDeposit}:</span>
            <strong>${deposit}</strong>
          </div>
        </div>

        <FormField
          label={t.namePlaceholder ?? ''}
          htmlFor="book-name"
          compact
          invalid={flagged.includes('name')}
        >
          <input
            id="book-name"
            className="site-book-input"
            name="Name"
            placeholder={t.namePlaceholder}
            required
            aria-required="true"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clearFlag('name');
            }}
          />
        </FormField>
        <FormField
          label={t.phonePlaceholder ?? ''}
          htmlFor="book-phone"
          compact
          invalid={flagged.includes('phone')}
        >
          <input
            id="book-phone"
            className="site-book-input"
            name="Phone"
            type="tel"
            placeholder={t.phonePlaceholder}
            required
            aria-required="true"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              clearFlag('phone');
            }}
          />
        </FormField>
        <FormField label={t.commentPlaceholder ?? ''} htmlFor="book-comment" compact area>
          <textarea
            id="book-comment"
            className="site-book-input site-book-textarea"
            name="comment"
            placeholder={t.commentPlaceholder}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </FormField>

        <button className="site-book-submit" type="submit" disabled={state === 'sending'}>
          {buttonLabel}
        </button>
      </form>

      {confirmation === null ? null : (
        <div
          className="site-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t.modalTitle}
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirmation(null);
          }}
        >
          <div className="site-modal">
            <button
              className="site-modal-close"
              type="button"
              aria-label={t.close}
              ref={closeRef}
              onClick={() => setConfirmation(null)}
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
            <div className="site-modal-details">
              <p className="site-modal-details-title">{t.modalDetails}</p>
              {(
                [
                  [t.modalName, confirmation.name],
                  [t.modalPhone, confirmation.phone],
                  [t.modalVehicle, confirmation.vehicle],
                  [t.modalPickup, confirmation.pickup],
                  [t.modalDropoff, confirmation.dropoff],
                  [t.modalExtras, confirmation.extras.join(', ')],
                  [t.modalComment, confirmation.comment]
                ] as const
              )
                .filter(([, value]) => String(value ?? '').trim() !== '')
                .map(([label, value]) => (
                  <div className="site-modal-row" key={label}>
                    <span>{label}:</span>
                    <b>{value}</b>
                  </div>
                ))}
              <hr />
              <div className="site-modal-row">
                <span>{t.priceDays}:</span>
                <b>{confirmation.days}</b>
              </div>
              <div className="site-modal-row">
                <span>{t.priceRental}:</span>
                <b>${confirmation.rental}</b>
              </div>
              <div className="site-modal-row">
                <span>{t.priceExtras}:</span>
                <b>${confirmation.extras_total}</b>
              </div>
              <div className="site-modal-row">
                <span>{t.priceDeposit}:</span>
                <b>${confirmation.deposit}</b>
              </div>
              <div className="site-modal-row site-modal-row--total">
                <span>{t.priceTotal}:</span>
                <b>${confirmation.total}</b>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** The slice of Google's reCAPTCHA API this island uses. */
interface Grecaptcha {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
}
