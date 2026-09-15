/**
 * Opening hours, as the admin writes them, turned into structured data.
 *
 * Настройки → «Часы работы» is a free-text line printed in the footer and on
 * the contact page: "Mon-Sun: 08:00-19:00" in English, "Пн-Нд: 08:00-19:00"
 * in Ukrainian. Schema.org wants the same fact as an
 * `OpeningHoursSpecification` with real day names and 24-hour times, which is
 * what puts the opening state into the local pack.
 *
 * Nothing is ever guessed: a line that does not parse yields an empty list and
 * the property is left out of the markup entirely. The SEO audit of
 * 15.08.2026 refused to invent hours for exactly this reason, and a wrong
 * "open now" is worse than no hours at all.
 */

/** One parsed interval, in the shape schema.org expects. */
export type OpeningHours = {
  dayOfWeek: string[];
  opens: string;
  closes: string;
};

/** Days in week order, with the abbreviations both locales use. */
const DAYS: { name: string; tokens: string[] }[] = [
  { name: 'Monday', tokens: ['mon', 'пн'] },
  { name: 'Tuesday', tokens: ['tue', 'вт'] },
  { name: 'Wednesday', tokens: ['wed', 'ср'] },
  { name: 'Thursday', tokens: ['thu', 'чт'] },
  { name: 'Friday', tokens: ['fri', 'пт'] },
  { name: 'Saturday', tokens: ['sat', 'сб'] },
  { name: 'Sunday', tokens: ['sun', 'нд', 'вс'] }
];

/**
 * Index of a day abbreviation in week order, or -1.
 */
function dayIndex(token: string): number {
  const clean = token.trim().toLowerCase().replace(/\.$/, '');
  return DAYS.findIndex((day) => day.tokens.some((t) => clean.startsWith(t)));
}

/**
 * Normalise a time to HH:MM, or '' when it is not a time.
 */
function normalizeTime(raw: string): string {
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(raw.trim());
  if (match === null) return '';
  const hours = Number(match[1] ?? '');
  const minutes = Number(match[2] ?? '');
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '';
  if (hours > 24 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Parse one "Mon-Fri: 09:00-18:00" segment.
 */
function parseSegment(segment: string): OpeningHours | null {
  const parts = segment.split(':');
  if (parts.length < 2) return null;
  /** The day part is everything before the first colon; the rest is the time. */
  const dayPart = (parts[0] ?? '').trim();
  const timePart = parts.slice(1).join(':').trim();

  const times = timePart.split(/[–—-]/).map((t) => t.trim());
  if (times.length !== 2) return null;
  const opens = normalizeTime(times[0] ?? '');
  const closes = normalizeTime(times[1] ?? '');
  if (opens === '' || closes === '') return null;

  const bounds = dayPart.split(/[–—-]/).map((d) => d.trim()).filter((d) => d !== '');
  if (bounds.length === 1) {
    const only = dayIndex(bounds[0] ?? '');
    if (only < 0) return null;
    return { dayOfWeek: [DAYS[only]?.name ?? ''], opens, closes };
  }
  if (bounds.length !== 2) return null;
  const from = dayIndex(bounds[0] ?? '');
  const to = dayIndex(bounds[1] ?? '');
  if (from < 0 || to < 0) return null;

  /** A range may wrap the week ("Fri-Mon"), so walk forward from the start. */
  const names: string[] = [];
  for (let i = 0; i < DAYS.length; i += 1) {
    const index = (from + i) % DAYS.length;
    names.push(DAYS[index]?.name ?? '');
    if (index === to) break;
  }
  return { dayOfWeek: names, opens, closes };
}

/**
 * Parse a whole "Часы работы" line. Several intervals may be listed, split by
 * a comma or a semicolon.
 */
export function parseWorkHours(raw: string): OpeningHours[] {
  const line = raw.trim();
  if (line === '') return [];
  const out: OpeningHours[] = [];
  for (const segment of line.split(/[,;]/)) {
    const parsed = parseSegment(segment);
    if (parsed !== null) out.push(parsed);
  }
  return out;
}
