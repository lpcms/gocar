/**
 * Does `db/schema.sql` still describe the database we actually run?
 *
 * The schema file is only used for a clean install; the live database is built
 * from it plus 37 one-off `migrate-*.mjs` scripts. Nothing keeps the two in
 * step, so a column added by a migration and never back-ported leaves the file
 * unable to create a working database - which only shows up the day someone
 * installs from scratch.
 *
 * `check-schema.mjs` is a different check: it validates that the columns the
 * code queries exist in the live database. This one compares the live database
 * against the file.
 *
 *   node scripts/check-schema-drift.mjs
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { join } from 'node:path';

const db = new DatabaseSync(join(process.cwd(), 'db', 'gocar.db'));
const schema = fs.readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf8');

/**
 * The CREATE TABLE body for one table as the schema file writes it, or null.
 * Brace counting rather than a regex: a column default can contain a
 * parenthesis, and `[\s\S]*?\);` stops at the first one it meets.
 */
function schemaBody(table) {
  const head = new RegExp(`CREATE TABLE\\s+(?:IF NOT EXISTS\\s+)?["'\`]?${table}["'\`]?\\s*\\(`, 'i');
  const start = schema.search(head);
  if (start < 0) return null;
  const open = schema.indexOf('(', start);
  let depth = 0;
  for (let i = open; i < schema.length; i += 1) {
    if (schema[i] === '(') depth += 1;
    else if (schema[i] === ')') {
      depth -= 1;
      if (depth === 0) return schema.slice(open + 1, i);
    }
  }
  return null;
}

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((r) => r.name);

const problems = [];
for (const table of tables) {
  const body = schemaBody(table);
  if (body === null) {
    problems.push(`${table}: table is missing from schema.sql entirely`);
    continue;
  }
  const live = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  for (const column of live) {
    if (!new RegExp(`(^|[\\s,("'\`])${column}([\\s,)"'\`]|$)`, 'm').test(body)) {
      problems.push(`${table}.${column}: in the database, not in schema.sql`);
    }
  }
}

db.close();

process.stdout.write(`Tables in the database: ${tables.length}\n`);
if (problems.length === 0) {
  process.stdout.write('schema.sql matches the live database.\n');
} else {
  process.stdout.write(`\nDrift (${problems.length}):\n`);
  for (const p of problems) process.stdout.write(`  ${p}\n`);
  process.stdout.write(
    '\nA clean install from schema.sql would not match production.\n' +
      'Back-port the missing columns into db/schema.sql.\n'
  );
  process.exit(1);
}
