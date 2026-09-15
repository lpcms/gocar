import { getDb } from './db';

/**
 * Read a single translation value by key and locale, returning the fallback
 * when the row is missing or empty. Centralizes the lookup that several page
 * builders previously duplicated.
 */
export function getTranslation(key: string, locale: 'en' | 'ua', fallback: string): string {
  const db = getDb();
  const row = db
    .prepare('SELECT value FROM translations WHERE key = ? AND locale = ?')
    .get(key, locale) as unknown as { value: string } | undefined;
  return row !== undefined && row.value.trim() !== '' ? row.value : fallback;
}
