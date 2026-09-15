import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Singleton connection to the project SQLite database via the built-in
 * node:sqlite driver (no native compilation required).
 * WAL for concurrent reads under SSR, foreign keys enforced.
 */
let instance: DatabaseSync | null = null;

/**
 * Where the database lives.
 *
 * The live database, db/gocar.db, is never committed. A fresh checkout starts
 * from db/gocar.template.db - the site content without leads, admin accounts,
 * sessions or credentials - copied into place on first use. On Vercel the
 * deployment filesystem is read-only, so the copy goes to the temp directory
 * instead: the site renders in full, but anything written there lives only as
 * long as that function instance.
 */
function resolveDbPath(): string {
  const dir = path.join(process.cwd(), 'db');
  const live = path.join(dir, 'gocar.db');
  if (fs.existsSync(live)) return live;
  const template = path.join(dir, 'gocar.template.db');
  const target = process.env.VERCEL ? path.join(os.tmpdir(), 'gocar.db') : live;
  if (!fs.existsSync(target) && fs.existsSync(template)) {
    fs.copyFileSync(template, target);
  }
  return target;
}

/**
 * Return the shared database connection, opening it on first use.
 */
export function getDb(): DatabaseSync {
  if (instance === null) {
    instance = new DatabaseSync(resolveDbPath());
    instance.exec('PRAGMA journal_mode = WAL');
    instance.exec('PRAGMA foreign_keys = ON');
  }
  return instance;
}
