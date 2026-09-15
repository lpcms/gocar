import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './db';

/**
 * Read a setting value with a default fallback. Numbers are stored as
 * strings in the settings table; callers coerce as needed.
 */
export function getSetting(key: string, fallback: string | null) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as unknown as { value: string | null } | undefined;
  if (row && row.value !== null) return row.value;
  return fallback ?? null;
}

/**
 * Upsert a single setting.
 */
export function setSetting(key: string, value: string) {
  getDb().prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, String(value ?? ''));
}

/**
 * Telegram credentials resolver — DB first, then config.local.json
 * for backwards compatibility with pre-v3.4.2 installations.
 */
export function getTelegramCreds() {
  const token = getSetting('telegram_bot_token', null);
  const chat = getSetting('telegram_chat_id', null);
  if (token && chat) return { token, chat_id: chat };
  const file = path.join(process.cwd(), 'config.local.json');
  if (fs.existsSync(file)) {
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (cfg.telegram_bot_token && cfg.telegram_chat_id) {
      return { token: cfg.telegram_bot_token, chat_id: cfg.telegram_chat_id };
    }
  }
  return null;
}
