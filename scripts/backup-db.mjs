import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Consistent SQLite snapshot via VACUUM INTO; safe under an active
 * WAL-mode connection. Rolls the file to backups/gocar-YYYYMMDD-HHMM.db.
 */
const ROOT = process.cwd();
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const backupDir = path.join(ROOT, 'backups');
fs.mkdirSync(backupDir, { recursive: true });
const target = path.join(backupDir, `gocar-${stamp}.db`);
const db = new DatabaseSync(path.join(ROOT, 'db', 'gocar.db'));
db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
db.close();
process.stdout.write(`Backup written: ${target}\n`);
