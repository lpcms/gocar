/**
 * Real TypeScript errors, as `next build` would see them.
 *
 * The earlier version only counted an error as real when its file matched
 * `src/(lib|app/[[)`, so every mistake in `src/components` was filed as "env
 * noise" - and `TS2307` (cannot find module) was ignored outright. That is how
 * a missing `@types/react-dom` sat behind a green "ALL CHECKS PASSED" while
 * `npm run build` failed on it (22.08.2026). The whole point of this check is
 * to fail here instead of at the client's build, so anything under src/ now
 * counts.
 *
 * What is still filtered: Next's generated `.next/types`, which go stale the
 * moment a route file moves and are rewritten on the next build anyway.
 *
 * Usage: node scripts/check-tsc.mjs
 */
import { execSync } from 'node:child_process';

let output = '';
try {
  output = execSync('npx tsc --noEmit --skipLibCheck 2>&1', { encoding: 'utf8', cwd: process.cwd() });
} catch (err) {
  output = (err.stdout || '') + (err.stderr || '');
}

const lines = output.split('\n').filter((l) => /error TS\d+/.test(l));

/** Generated route types; stale until the next build regenerates them. */
const GENERATED = /^\.next[\/]/;

const real = lines.filter((l) => !GENERATED.test(l.trim()));

if (real.length === 0) {
  process.stdout.write(`tsc: OK (${lines.length - real.length} generated-type errors ignored)\n`);
} else {
  process.stdout.write(`tsc: ${real.length} error(s):\n`);
  for (const l of real) {
    process.stdout.write(`  ${l}\n`);
  }
  process.exit(1);
}
