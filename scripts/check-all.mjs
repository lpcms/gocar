/**
 * Run every pre-delivery check in one go (TZ v5.4 §5 items 11-13): import
 * resolution, strict-index audit, the schema the code queries, the drift
 * between db/schema.sql and the live database, and real TypeScript errors.
 * Exits non-zero if any real problem is found, so a build-breaking mistake is
 * caught here instead of at the client's build.
 *
 * Usage: node scripts/check-all.mjs
 */
import { execSync } from 'node:child_process';

const steps = [
  ['imports', 'node scripts/check-imports.mjs'],
  ['strict', 'node scripts/check-strict.mjs'],
  ['schema', 'node scripts/check-schema.mjs'],
  ['drift', 'node scripts/check-schema-drift.mjs'],
  ['tsc', 'node scripts/check-tsc.mjs']
];

let failed = false;
for (const [name, cmd] of steps) {
  try {
    const out = execSync(cmd + ' 2>&1', { encoding: 'utf8', cwd: process.cwd() });
    const last = out.trim().split('\n').filter((l) => !/Experimental|trace-warnings/.test(l)).pop() || '';
    process.stdout.write(`[OK]   ${name}: ${last}\n`);
  } catch (err) {
    failed = true;
    const out = (err.stdout || '') + (err.stderr || '');
    process.stdout.write(`[FAIL] ${name}:\n`);
    for (const l of out.split('\n').filter((x) => x.trim() !== '').slice(-10)) {
      process.stdout.write(`         ${l}\n`);
    }
  }
}

process.stdout.write(failed ? '\nCHECKS FAILED\n' : '\nALL CHECKS PASSED\n');
process.exit(failed ? 1 : 0);
