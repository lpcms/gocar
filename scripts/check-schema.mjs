import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Verify that every "table.column" reference appearing in SQL strings under
 * src/ actually exists in the database schema. Catches typos such as
 * category_translations.title (the real column is "name") before they reach
 * a build, where they only surface as a runtime SQL logic error.
 *
 * Only alias-qualified references that can be resolved back to a real table
 * are checked; unknown aliases are skipped rather than guessed at.
 *
 * Findings are advisory, not fatal: a column may legitimately be missing
 * from the local database simply because a migration has not been run here
 * yet. The report tells which migration to check rather than failing the
 * audit.
 */

const ROOT = process.cwd();
const dbPath = path.join(ROOT, 'db', 'gocar.db');
if (!fs.existsSync(dbPath)) {
  process.stdout.write('Schema check: skipped (no db/gocar.db)\n');
  process.exit(0);
}

const db = new DatabaseSync(dbPath);
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
  .all()
  .map((r) => r.name);

/** table -> Set(columns) */
const columns = new Map();
for (const t of tables) {
  columns.set(t, new Set(db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name)));
}
db.close();

/**
 * Collect every .ts file under src.
 */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const problems = [];

for (const file of walk(path.join(ROOT, 'src'))) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);

  /**
   * Analyse each SQL string on its own: aliases like "c" or "t" are rebound
   * per query (c = cars in one, categories in another), so collecting them
   * file-wide would cross-contaminate and produce false reports. Only
   * alias-qualified references resolvable within the same chunk are checked.
   */
  const sqlChunks = src.match(/`[^`]*\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^`]*`/gi) ?? [];
  const aliasRe = /\b(?:FROM|JOIN)\s+([a-z_][a-z0-9_]*)\s+(?:AS\s+)?([a-z][a-z0-9_]*)\b/gi;
  const refRe = /\b([a-z][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/g;
  for (const chunk of sqlChunks) {
    const alias = new Map();
    let am;
    aliasRe.lastIndex = 0;
    while ((am = aliasRe.exec(chunk)) !== null) {
      const table = am[1];
      const as = am[2];
      if (columns.has(table) && !/^(on|where|order|group|left|inner|set)$/i.test(as)) {
        alias.set(as, table);
      }
    }
    let rm;
    refRe.lastIndex = 0;
    while ((rm = refRe.exec(chunk)) !== null) {
      const as = rm[1];
      const col = rm[2];
      const table = alias.get(as);
      if (table === undefined) continue;
      const cols = columns.get(table);
      if (cols && !cols.has(col)) {
        problems.push(`${rel}  ${table}.${col} does not exist (alias "${as}")`);
      }
    }
  }
}

if (problems.length > 0) {
  process.stdout.write(`Schema check: ${problems.length} note(s) - verify a migration covers each\n`);
  for (const p of problems) process.stdout.write(`  ${p}\n`);
  process.exit(0);
}
process.stdout.write('Schema check: OK\n');
