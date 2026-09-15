import fs from 'node:fs';
import path from 'node:path';

/**
 * Static pre-build audit for the strict-mode error classes that have
 * bitten this project: unchecked index access used as a typed argument,
 * untyped function parameters, unsafe DB-result casts, and stray unknown
 * arrays. This is a heuristic backstop (not a substitute for tsc) that
 * lets us catch the common regressions without a full type-check.
 */

const SRC = path.join(process.cwd(), 'src');

/**
 * Recursively collect .ts/.tsx files, excluding declaration files.
 */
function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

/**
 * Split a parameter list on top-level commas (ignoring generics/parens).
 */
function splitTop(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if ('<([{'.includes(ch)) depth += 1;
    else if ('>)]}'.includes(ch)) depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/**
 * Collect local function signatures (name -> parameter types) so call
 * sites can be checked for literal-argument/parameter type mismatches —
 * the "Argument of type X is not assignable to parameter of type Y"
 * class. Heuristic: only literal arguments (string/number/boolean/null)
 * are checked, since their type is unambiguous.
 */
function collectSignatures(files) {
  const sigs = new Map();
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const re = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const params = [];
      for (const raw of splitTop(m[2].trim())) {
        const p = raw.trim();
        if (!p) continue;
        const mm = p.match(/^(\.\.\.)?(\w+)\s*(\?)?\s*:\s*(.+?)(\s*=\s*.+)?$/);
        if (mm) {
          params.push({
            name: mm[2],
            optional: Boolean(mm[3] || mm[5]),
            type: mm[4].trim(),
            rest: Boolean(mm[1])
          });
        } else {
          params.push({ name: p, optional: false, type: 'any', rest: false });
        }
      }
      if (!sigs.has(m[1])) sigs.set(m[1], params);
    }
  }
  return sigs;
}

/**
 * Classify a call argument as a literal type, or null when it's an
 * expression whose type we can't infer statically.
 */
function literalType(arg) {
  const a = arg.trim();
  /**
   * `'x' as const` narrows to the literal type 'x', which is accepted by any
   * union containing that literal - treat it as satisfying the parameter, so
   * we don't false-positive on valid const assertions.
   */
  if (/\bas\s+const\b/.test(a)) return null;
  if (/^['"`]/.test(a)) return 'string';
  if (/^-?\d+(\.\d+)?$/.test(a)) return 'number';
  if (a === 'true' || a === 'false') return 'boolean';
  if (a === 'null') return 'null';
  if (a === 'undefined') return 'undefined';
  return null;
}

/**
 * Whether a declared parameter type accepts the given literal kind.
 */
function typeAccepts(ptype, lit) {
  const parts = ptype.replace(/\s/g, '').split('|');
  if (parts.includes('any') || parts.includes('unknown')) return true;
  return parts.includes(lit);
}

const problems = [];
const allFiles = walk(SRC);
const signatures = collectSignatures(allFiles);

for (const file of allFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(process.cwd(), file);

  /**
   * Non-null assertions (x!.y, x![i], x!)) are forbidden by the project's
   * ESLint (@typescript-eslint/no-non-null-assertion) and break the build.
   */
  const bangRe = /[A-Za-z0-9_)\]]!(?=[.\[)])/g;
  let bm;
  while ((bm = bangRe.exec(src)) !== null) {
    const line = src.slice(0, bm.index).split('\n').length;
    problems.push(`${rel}:${line}  non-null assertion '!' is forbidden (no-non-null-assertion)`);
  }

  /**
   * A literal type annotation on a literal value (const x: 'a' = 'a') must be
   * written `'a' as const` per @typescript-eslint/prefer-as-const, otherwise
   * `next build` fails. Flag `: '<lit>' = '<lit>'` and numeric equivalents.
   */
  const asConstRe = /:\s*('[^']*'|"[^"]*"|\d+)\s*=\s*\1/g;
  let am;
  while ((am = asConstRe.exec(src)) !== null) {
    const line = src.slice(0, am.index).split('\n').length;
    problems.push(
      `${rel}:${line}  literal type annotation on a literal - use '${am[1]} as const' (prefer-as-const)`
    );
  }

  /**
   * With noUncheckedIndexedAccess, indexing an array yields `T | undefined`,
   * so calling a method straight off `arr[0].foo()` or `str.split(x)[0].foo`
   * is a type error. Flag `)[<digits>].` and `][<digits>].` patterns that
   * dereference an indexed result without a `?? fallback` guard first. This
   * mirrors the tsc build failure that check-strict cannot run directly.
   */
  const unsafeIdxRe = /(?:\)|\])\[\d+\]\s*\./g;
  let im;
  while ((im = unsafeIdxRe.exec(src)) !== null) {
    const before = src.slice(Math.max(0, im.index - 2), im.index + im[0].length);
    /** Skip when wrapped in a `(... ?? ...)` guard on the same access. */
    const lineStart = src.lastIndexOf('\n', im.index) + 1;
    const lineText = src.slice(lineStart, src.indexOf('\n', im.index));
    if (lineText.includes('??')) continue;
    const line = src.slice(0, im.index).split('\n').length;
    problems.push(
      `${rel}:${line}  indexed access '${before.trim()}' may be undefined (noUncheckedIndexedAccess) - guard with '?? fallback'`
    );
  }

  /**
   * Unused function parameters break the build under the project's ESLint
   * (@typescript-eslint/no-unused-vars). Flag any named parameter of an
   * exported/plain function that never appears again in the file body.
   * Parameters intentionally ignored should be prefixed with '_'.
   *
   * Only whole-line `function name(...)` declarations at low indentation are
   * checked, to avoid matching client-side JS embedded inside template
   * strings (which ESLint parses correctly and never flags).
   */
  const srcNoStr = src
    .replace(/`(?:\\[\s\S]|\$\{[^}]*\}|[^\\`])*`/g, (s) => ' '.repeat(s.length))
    .replace(/'(?:\\.|[^'\\])*'/g, (s) => ' '.repeat(s.length))
    .replace(/"(?:\\.|[^"\\])*"/g, (s) => ' '.repeat(s.length));
  const paramFnRe = /^ {0,4}(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/gm;
  let fm;
  while ((fm = paramFnRe.exec(srcNoStr)) !== null) {
    const rawParams = fm[2] ?? '';
    if (rawParams.trim() === '') continue;
    const bodyStart = fm.index + fm[0].length;
    /** Check usage against the ORIGINAL body so uses inside strings count. */
    const body = src.slice(bodyStart);
    for (const raw of rawParams.split(',')) {
      const nameMatch = /^\s*([A-Za-z_]\w*)\s*[:?]?/.exec(raw);
      if (!nameMatch) continue;
      const pname = nameMatch[1] ?? '';
      if (pname === '' || pname.startsWith('_')) continue;
      /** Count uses of the param name in the function body (word boundary). */
      const useRe = new RegExp(`\\b${pname}\\b`, 'g');
      const uses = (body.slice(0, 4000).match(useRe) ?? []).length;
      if (uses === 0) {
        const line = srcNoStr.slice(0, fm.index).split('\n').length;
        problems.push(`${rel}:${line}  parameter '${pname}' of ${fm[1]}(...) is never used (no-unused-vars)`);
      }
    }
  }

  /**
   * Index access (arr[0]) used as an argument or before a property/call,
   * without a `?? fallback`, is `T | undefined` under noUncheckedIndexedAccess.
   */
  /**
   * Client-side JavaScript embedded in template strings (injected <script>
   * bodies) is not type-checked by TypeScript, so index accesses there must
   * not be reported. Blank string contents before scanning.
   */
  const srcForIdx = src
    .replace(/`(?:\\[\s\S]|\$\{[^}]*\}|[^\\`])*`/g, (t) => ' '.repeat(t.length))
    .replace(/'(?:\\.|[^'\\])*'/g, (t) => ' '.repeat(t.length))
    .replace(/"(?:\\.|[^"\\])*"/g, (t) => ' '.repeat(t.length));
  const idxRe = /\b(\w+(?:\.\w+)*)\[(\d+)\]/g;
  let m;
  while ((m = idxRe.exec(srcForIdx)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    const after = srcForIdx.slice(end, end + 8);
    const prev = srcForIdx.slice(Math.max(0, start - 15), start);
    /** Left-hand assignment target: arr[0] = ... — not a read. */
    if (/^\s*=[^=]/.test(after)) continue;
    /** Already guarded with a nullish fallback. */
    if (/^\s*\?\?/.test(after)) continue;
    /** Inside an `if (...)` / `while (...)` test — undefined is falsy, allowed. */
    const lineStart = srcForIdx.lastIndexOf('\n', start) + 1;
    const lineHead = srcForIdx.slice(lineStart, start);
    if (/\b(if|while)\s*\(/.test(lineHead) && !/[?:]/.test(after.slice(0, 2))) continue;
    /** Numeric literal index into a numeric-looking member is the risky case:
        used as an argument, before a property/call, in a return, or as an
        assigned value. */
    const usedAsArg = /^\s*[.,)]/.test(after);
    const wrapped = ['Number(', 'String(', 'from(', 'Boolean('].some((w) => prev.includes(w));
    const inReturn = /\breturn\s*$/.test(prev.trimEnd() + ' ') || /\breturn\s+[\w.]*$/.test(prev);
    const asValue = /^\s*;/.test(after);
    if (usedAsArg || wrapped || inReturn || asValue) {
      const ln = srcForIdx.slice(0, start).split('\n').length;
      problems.push(`${rel}:${ln}  index access ${m[1]}[${m[2]}] may be undefined (add ?? fallback)`);
    }
  }

  /**
   * `let` bindings that are never reassigned break the build under the
   * project's ESLint (prefer-const). Scan declarations in real code only -
   * client-side JS embedded in template strings is not linted - and report
   * any whose name never appears on the left of an assignment or with an
   * increment/decrement afterwards.
   */
  const srcForLet = src
    .replace(/`(?:\\[\s\S]|\$\{[^}]*\}|[^\\`])*`/g, (t) => ' '.repeat(t.length))
    .replace(/'(?:\\.|[^'\\])*'/g, (t) => ' '.repeat(t.length))
    .replace(/"(?:\\.|[^"\\])*"/g, (t) => ' '.repeat(t.length));
  const letRe = /\blet\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=/g;
  let lm;
  while ((lm = letRe.exec(srcForLet)) !== null) {
    const name = lm[1] ?? '';
    if (name === '') continue;
    /**
     * Search the ORIGINAL text for reassignment: blanking string literals
     * also corrupts regex literals (they contain quotes), which would hide
     * a genuine `name = ...` and produce a false report.
     */
    const rest = src.slice(lm.index + lm[0].length);
    /** Reassignment: `name =` (not ==/===), or compound/increment forms. */
    const reassigned =
      new RegExp(`\\b${name}\\s*(?:=[^=]|\\+\\+|--|[-+*/%|&^]=|\\?\\?=)`).test(rest) ||
      new RegExp(`(?:\\+\\+|--)\\s*\\b${name}\\b`).test(rest);
    if (!reassigned) {
      const line = srcForLet.slice(0, lm.index).split('\n').length;
      problems.push(`${rel}:${line}  '${name}' is never reassigned - use const (prefer-const)`);
    }
  }

  /**
   * Untyped named-function parameters (implicit any under strict). Template
   * and quoted string contents are blanked first so client-side JS embedded
   * in strings is not mis-parsed as TypeScript function declarations.
   */
  const srcForFns = src
    .replace(/`(?:\\[\s\S]|\$\{[^}]*\}|[^\\`])*`/g, (s) => ' '.repeat(s.length))
    .replace(/'(?:\\.|[^'\\])*'/g, (s) => ' '.repeat(s.length))
    .replace(/"(?:\\.|[^"\\])*"/g, (s) => ' '.repeat(s.length));
  const fnRe = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
  while ((m = fnRe.exec(srcForFns)) !== null) {
    for (const p of splitTop(m[2].trim())) {
      const t = p.trim();
      if (!t || t[0] === '{' || t[0] === '[') continue;
      if (!t.includes(':') && !t.includes('=')) {
        const ln = srcForFns.slice(0, m.index).split('\n').length;
        problems.push(`${rel}:${ln}  parameter '${t}' of ${m[1]}(...) has no type`);
      }
    }
  }

  /**
   * DB result cast straight to a named/inline type without going through
   * unknown (node:sqlite returns Record<string, SQLOutputValue>).
   */
  const castRe = /\.(all|get)\((?:[^()]|\([^()]*\))*\)\s+as\s+((?!unknown\b)[A-Za-z{][^;]*?);/gs;
  while ((m = castRe.exec(src)) !== null) {
    const ln = src.slice(0, m.index).split('\n').length;
    problems.push(`${rel}:${ln}  unsafe DB cast (use 'as unknown as ...')`);
  }

  /**
   * Stray unknown[] annotations feed SQLInputValue params poorly.
   */
  const unkRe = /:\s*unknown\[\]/g;
  while ((m = unkRe.exec(src)) !== null) {
    const ln = src.slice(0, m.index).split('\n').length;
    problems.push(`${rel}:${ln}  unknown[] annotation (use a concrete element type)`);
  }

  /**
   * Unused named imports, type/interface declarations, and top-level
   * const bindings (ESLint no-unused-vars). Heuristic: a name that
   * appears only once in the file (its declaration) is unused.
   */
  const countName = (name) => {
    const re2 = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'g');
    return (src.match(re2) || []).length;
  };
  let um;
  const importRe = /import\s+(?:type\s+)?\{([^}]+)\}\s+from/g;
  while ((um = importRe.exec(src)) !== null) {
    for (const raw of um[1].split(',')) {
      const nm = raw.trim().split(/\s+as\s+/).pop().trim();
      if (nm && countName(nm) <= 1) {
        const ln = src.slice(0, um.index).split('\n').length;
        problems.push(`${rel}:${ln}  unused import '${nm}'`);
      }
    }
  }
  const typeRe = /\b(?:type|interface)\s+([A-Z]\w+)/g;
  while ((um = typeRe.exec(src)) !== null) {
    if (countName(um[1]) <= 1) {
      const ln = src.slice(0, um.index).split('\n').length;
      problems.push(`${rel}:${ln}  unused type '${um[1]}'`);
    }
  }
  const constRe = /^\s*const\s+([a-z]\w+)\s*=/gm;
  while ((um = constRe.exec(src)) !== null) {
    if (countName(um[1]) <= 1) {
      const ln = src.slice(0, um.index).split('\n').length;
      problems.push(`${rel}:${ln}  unused const '${um[1]}'`);
    }
  }

  /**
   * Literal call-argument vs parameter-type mismatches for local functions.
   */
  for (const [name, params] of signatures) {
    if (params.length === 0) continue;
    const callRe = new RegExp(`(?<![.\\w])${name}\\s*\\(([^;]*?)\\)`, 'g');
    let cm;
    while ((cm = callRe.exec(src)) !== null) {
      const head = src.slice(Math.max(0, cm.index - 40), cm.index);
      if (/function\s+$/.test(head)) continue;
      const argstr = cm[1];
      if (argstr.trim() === '') continue;
      const args = splitTop(argstr);
      args.forEach((arg, i) => {
        const lit = literalType(arg);
        if (lit === null) return;
        let p = null;
        if (i < params.length) p = params[i];
        else if (params.length && params[params.length - 1].rest) p = params[params.length - 1];
        if (!p) return;
        if (!typeAccepts(p.type, lit)) {
          const ln = src.slice(0, cm.index).split('\n').length;
          problems.push(
            `${rel}:${ln}  ${name}(...) arg#${i + 1}=${arg.trim().slice(0, 20)} (${lit}) not assignable to ${p.name}: ${p.type}`
          );
        }
      });
    }
  }


  /**
   * Template-literal interpolations ${name} that reference a bare
   * identifier never declared, imported, or bound as a parameter in the
   * file - a type error tsc would flag (e.g. a ${hoverCss} whose const was
   * deleted) but which the sandbox cannot run.
   */
  {
    const known = new Set([
      'JSON', 'String', 'Number', 'Boolean', 'Math', 'Object', 'Array',
      'process', 'locale', 'origin', 'name', 'html', 'req', 'out', 'undefined'
    ]);
    const declMatch = src.matchAll(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g);
    for (const d of declMatch) known.add(d[1]);
    const destrMatch = src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g);
    for (const d of destrMatch) {
      for (const raw of d[1].split(',')) {
        const nm = raw.split(/\s*:\s*/).pop().split(/\s+as\s+/).pop().trim();
        if (/^[A-Za-z_$][\w$]*$/.test(nm)) known.add(nm);
      }
    }
    const impMatch = src.matchAll(/import\s+(?:(?:\*\s+as\s+([A-Za-z_$][\w$]*))|([A-Za-z_$][\w$]*)|\{([^}]*)\})/g);
    for (const im2 of impMatch) {
      if (im2[1]) known.add(im2[1]);
      if (im2[2]) known.add(im2[2]);
      if (im2[3]) for (const n of im2[3].split(',')) {
        const nm = n.split(/\s+as\s+/).pop().trim();
        if (nm) known.add(nm);
      }
    }
    const parMatch = src.matchAll(/\(([^()]*)\)\s*(?::[^={]+)?(?:=>|\{)/g);
    for (const pr of parMatch) {
      for (const raw of pr[1].split(',')) {
        const nm = raw.trim().replace(/[:=?].*$/, '').replace(/^\.\.\./, '').trim();
        if (/^[A-Za-z_$][\w$]*$/.test(nm)) known.add(nm);
      }
    }
    const seen = new Set();
    const itp2 = src.matchAll(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g);
    for (const it of itp2) {
      const idName = it[1];
      if (known.has(idName) || seen.has(idName)) continue;
      seen.add(idName);
      const ln = src.slice(0, it.index).split('\n').length;
      problems.push(`${rel}:${ln}  \`\${${idName}}\` references an undeclared name`);
    }
  }

  /**
   * `let` bindings that are never reassigned break the build under the
   * project's ESLint (prefer-const). Flag a simple `let name = ...;` when the
   * name is never the target of a later assignment or increment/decrement.
   * Uses the string-stripped source so assignments inside template strings do
   * not mask a real reassignment, and skips destructuring/multi-declarations
   * to stay conservative (no false positives).
   */
  const letDeclRe = /(?:^|[;{}\s])let\s+([A-Za-z_$][\w$]*)\s*=/g;
  let pcm;
  while ((pcm = letDeclRe.exec(srcNoStr)) !== null) {
    const nm = pcm[1];
    /**
     * Look for a later reassignment in the ORIGINAL source, but only within
     * the current function body: bound the search at the next top-level `}`
     * (column-0 closing brace) so a same-named `let` in another function does
     * not suppress a real prefer-const hit. Searching raw text (not the
     * string-stripped copy) avoids regex-literal false positives; a stray
     * match inside a string only suppresses the warning, which is safe.
     */
    const restAll = src.slice(pcm.index + pcm[0].length);
    const fnEnd = restAll.search(/\n\}/);
    const after = fnEnd === -1 ? restAll : restAll.slice(0, fnEnd);
    const reassignRe = new RegExp(
      `(?:^|[^\\w$.])${nm}\\s*(?:=[^=]|\\+=|-=|\\*=|/=|%=|\\|\\|=|&&=|\\?\\?=|\\+\\+|--)|(?:\\+\\+|--)\\s*${nm}\\b`
    );
    if (!reassignRe.test(after)) {
      const line = src.slice(0, pcm.index).split('\n').length;
      problems.push(`${rel}:${line}  'let ${nm}' is never reassigned - use 'const' (prefer-const)`);
    }
  }

}

if (problems.length === 0) {
  process.stdout.write('Strict audit: OK\n');
} else {
  process.stdout.write(`Strict audit: ${problems.length} issue(s)\n`);
  for (const p of problems) process.stdout.write(`  ${p}\n`);
  process.exit(1);
}
