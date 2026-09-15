/**
 * What is still reachable from the app, and what is not.
 *
 * Stage 6 removes the Framer layer, and "looks unused" is not good enough to
 * delete a file in a project with no version control. This walks the real
 * import graph from every entry point Next can reach - every `page.tsx`,
 * `layout.tsx`, `route.ts`, `not-found.tsx`, `middleware.ts` - and reports the
 * modules under src/ that nothing pulls in.
 *
 * Dynamic `import()` counts: several modules are loaded that way on purpose,
 * so a regex that only saw static imports would call them dead.
 *
 *   node scripts/diag-dead-code.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

/**
 * Every file under a directory, recursively.
 */
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const all = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts'));

/** Anything Next mounts by convention is a root of the graph. */
const ENTRY = /(^|[\\/])(page|layout|route|not-found|error|template|default)\.tsx?$/;
const entries = all.filter((f) => ENTRY.test(f) || f === path.join(SRC, 'middleware.ts'));

/**
 * Resolve one import specifier to a file under src/, or null when it points
 * outside the project (a package) or cannot be found.
 */
function resolve(spec, from) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx')
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * Every specifier a file imports, static and dynamic.
 */
function importsOf(file) {
  const text = fs.readFileSync(file, 'utf8');
  const specs = [];
  for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]\s*\)?/g)) {
    specs.push(m[1]);
  }
  return specs;
}

const reached = new Set();
const queue = [...entries];
while (queue.length > 0) {
  const file = queue.pop();
  if (reached.has(file)) continue;
  reached.add(file);
  for (const spec of importsOf(file)) {
    const target = resolve(spec, file);
    if (target !== null && !reached.has(target)) queue.push(target);
  }
}

const dead = all.filter((f) => !reached.has(f)).sort();
const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');

process.stdout.write(`Entry points: ${entries.length}\n`);
process.stdout.write(`Reachable:    ${reached.size} of ${all.length}\n\n`);
if (dead.length === 0) {
  process.stdout.write('Nothing unreachable.\n');
} else {
  process.stdout.write(`Unreachable (${dead.length}):\n`);
  let bytes = 0;
  for (const f of dead) {
    const size = fs.statSync(f).size;
    bytes += size;
    process.stdout.write(`  ${rel(f)}  ${(size / 1024).toFixed(1)} KB\n`);
  }
  process.stdout.write(`\nTotal: ${(bytes / 1024).toFixed(0)} KB\n`);
}
