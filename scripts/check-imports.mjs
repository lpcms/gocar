import fs from 'node:fs';
import path from 'node:path';

/**
 * Pre-build sanity check: verifies that every named import from a local
 * module (@/... or relative) matches an actual export. Catches the class
 * of "has no exported member" TypeScript errors before `next build`.
 * Run with: node scripts/check-imports.mjs
 */

const SRC = path.join(process.cwd(), 'src');

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

function exportsOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:declare\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+const\s+([A-Za-z0-9_]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+(?:type|interface)\s+([A-Za-z0-9_]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const nm = part.trim().split(/\s+as\s+/).pop().trim();
      if (nm) names.add(nm);
    }
  }
  if (/export\s+default/.test(src)) names.add('default');
  return names;
}

function resolve(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  return fs.existsSync(base) ? base : null;
}

let problems = 0;
for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+'([^']+)'/g)) {
    const spec = m[2];
    if (!(spec.startsWith('@/') || spec.startsWith('.'))) continue;
    const target = resolve(spec, file);
    if (target === null) {
      process.stdout.write(`MISSING MODULE: ${spec} (from ${path.relative(process.cwd(), file)})\n`);
      problems += 1;
      continue;
    }
    const exp = exportsOf(target);
    for (const raw of m[1].split(',')) {
      const nm = raw.trim().split(/\s+as\s+/)[0].trim();
      if (nm && !exp.has(nm)) {
        process.stdout.write(
          `MISSING EXPORT: '${nm}' not in ${spec} ` +
            `(${path.relative(process.cwd(), file)})\n`
        );
        problems += 1;
      }
    }
  }
}
if (problems === 0) process.stdout.write('Import check: OK\n');
else {
  process.stdout.write(`Import check: ${problems} problem(s)\n`);
  process.exit(1);
}
