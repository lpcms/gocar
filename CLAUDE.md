# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                     # Next dev server, http://localhost:3000 (serves BOTH public site and /admin)
npm run build                   # runs prebuild = check-imports + check-strict first
npm run lint                    # eslint . (no-console is an error)
npm run format                  # prettier --write .

node scripts/check-all.mjs      # MANDATORY before delivering anything:
                                # imports + strict + schema + schema drift + tsc
                                # must print "ALL CHECKS PASSED"

npm run db:init                 # create db/gocar.db from db/gocar.template.db (refuses to overwrite)
npm run db:template             # rebuild the committed template from the live DB, minus private data
npm run images:site             # rebuild the 640/1024/1920 WebP variants of public/images/site
                                # (their top widths are listed in src/lib/site-images.ts)
node scripts/create-admin.mjs <login> <password>
node scripts/backup-db.mjs      # snapshot to backups/gocar-YYYYMMDD-HHMM.db

node scripts/qa-seo.mjs [baseUrl]     # needs a running server; head + JSON-LD on all 50 pages
node scripts/qa-locale.mjs [baseUrl]  # needs a running server; the whole language policy
node scripts/check-schema-drift.mjs   # db/schema.sql vs the live database
node scripts/diag-dead-code.mjs       # modules under src/ nothing imports
node scripts/diag-jsonld-empty.mjs    # blanks the settings, proves no empty value reaches the markup
```

There is **no test framework**. Verification is: `check-all.mjs`, the `scripts/qa-*.mjs` audits against a running server (`qa-seo`, `qa-locale`), and the `scripts/diag-*.mjs` diagnostics. One-off diagnostics were removed before the GitHub delivery (15.09.2026); write a new `diag-*.mjs` when a rendering bug needs one.

`scripts/**` is excluded from tsconfig and is plain `.mjs` — Node built-ins only, no TypeScript.

## Architecture

The public site **is** React: server components under `src/app/(site-uk)` and
`src/app/(site-en)`, with a handful of client islands. The Framer snapshot layer
that used to serve it was removed on 22.08.2026 (phase 2, stage 6).

**Routing and locales.** Ukrainian is the default language and owns the root;
English lives under `/en`. The scheme is defined once, in `src/lib/locale-path.ts`
(`LOCALE_PREFIX`, `localePath`, `localeFromPath`, `stripLocale`, `mirrorPath`) —
a module with no imports, because `src/middleware.ts` runs on the edge runtime and
cannot pull in the database layer. `site-nav.ts` re-exports it for everything else.

Two route groups, each with its own root layout, because a layout owns `<html lang>`
and the two languages differ. The Ukrainian group owns the root and therefore the
app's single catch-all (`[...notfound]`), which turns any unmatched path into a real
404 and answers the legacy `/uk/*` addresses with a 308 to their new home.

**Language policy** (`src/lib/locale-policy.ts`): the `gocar_locale` cookie wins;
otherwise the country of the request (Cloudflare / Vercel / NGINX headers, falling
back to `Accept-Language`); otherwise Настройки → «Язык по умолчанию». **A crawler
is never redirected** — that guard is what keeps both languages indexable, and the
SEO audit calls the absence of blind IP redirects a deliberate strength. The cookie
half runs in middleware; the first-visit half runs in the Ukrainian root layout,
which is the only place with both the database and every first visit.

**Head and structured data.** `src/lib/site-meta.ts` builds Next `Metadata` (title,
description, canonical, hreflang, OG/Twitter) and `src/lib/site-jsonld.ts` builds the
JSON-LD graph; both read the same admin rows the pages render. Every URL comes from
Настройки → `site_domain`, never the request host — two hosts would otherwise
self-canonicalise into separate clusters. `x-default` is the English URL, matching
the sitemap.

**Assets.** `public/uploads` and `public/images` are written after the build, so
Next's static handler does not know about them; each has its own route under
`src/app`. `public/assets/img` and `public/assets/framer` hold only media-library
images referenced by the `media` table; the Framer self-healing route is gone.

**reCAPTCHA** can be switched off per area for local work via `config.local.json`:
`{"recaptcha": {"admin": false, "forms": false}}`. Absent means on, so production is
unaffected. Google rejects an automated browser outright, so without this nothing
can be driven through the admin login or the booking form in a test.

**Admin (`src/app/admin/`)** is real React (route group `(panel)` + `login`), Russian UI, backed by `src/app/api/admin/*`. Auth is dependency-free: scrypt hashes and HMAC-signed `gocar_admin` cookies in `src/lib/auth.ts`, session secret auto-generated into `config.local.json`; API routes gate on `requireAdmin()` (`src/lib/admin-guard.ts`); `src/lib/lockout.ts` + the `login_attempts` table implement configurable lockout (counted against both the address and the login name, with the address resolved by `src/lib/client-ip.ts` - never the client-written first hop of `x-forwarded-for`), and the journal is swept to Настройки → «Хранить журнал входов, дней»; sessions are revocable - `src/lib/admin-session.ts` + the `admin_sessions` table, a token is accepted only while its row is live, so logout takes it back; the login is also behind reCAPTCHA v3, verified before the password is ever looked at. `src/middleware.ts` never authenticates — it forwards `x-pathname` and applies the locale redirect, and skips `/admin` entirely.

**Data.** SQLite via the built-in `node:sqlite` (`DatabaseSync`) — **no native modules anywhere in the project**; `sharp` is the only non-Next dependency. `src/lib/db.ts` is the singleton (WAL, foreign keys on). 18 tables in `db/schema.sql`; content is split `<entity>` + `<entity>_translations` (locale `en`/`ua`), with free-form `translations` for UI strings and `settings` for site config.

**Leads.** `src/lib/leads.ts` (used by `/api/lead`) recomputes price server-side from DB tariffs + extras — client-submitted totals are always ignored — then sends Telegram (format preserved 1:1 from the legacy integration) and writes the `leads` table. Honeypot fields filter spam. Telegram credentials live in the `settings` table in production; `config.local.json` (gitignored) is the local fallback.

## Conventions

These come from `instructions.md` (the project's standing instructions) and are enforced by tooling:

- **JSDoc `/** ... *\/` comments only.** No `//`, no plain `/* */`, no trailing inline comments. Comments in English. This applies inside the injected client-side script strings too.
- **No `console.*`** — `no-console` is an ESLint error. CLI scripts write to `process.stdout` / `process.stderr` directly.
- No debug flags, commented-out code, or hardcoded test data in delivered code.
- `strict` + `noUncheckedIndexedAccess` are on. `check-strict.mjs` additionally rejects: non-null assertions (`x!`), unguarded indexed access (needs `?? fallback`), `let` that is never reassigned, unused imports/types/consts/params (prefix intentionally unused params with `_`), and DB casts that skip `unknown` — always `as unknown as T`, never `.get(...) as T`.
- `check-schema.mjs` validates every `table.column` in SQL strings against the live DB; `check-imports.mjs` validates named imports against actual exports.
- Locale type is `'en' | 'ua'` in code. Ukrainian has **no** URL prefix (it owns the root) and English is under `/en`; never hardcode either — go through `LOCALE_PREFIX` / `localePath` in `src/lib/locale-path.ts`.
- Respond to the user in Russian; keep answers concise.
- After two failed iterations on the same bug, stop guessing — read the upstream documentation or add real diagnostics (a `diag-*.mjs` script) instead of trying a third variation.

## Operational cautions

- `db/gocar.db` is never committed. `src/lib/db.ts` copies `db/gocar.template.db` into place when it is missing — to the temp directory on Vercel, whose filesystem is read-only (writes there are not persistent). The template must never contain leads, admin users, sessions or credentials: rebuild it only with `npm run db:template`.
- The repository (github.com/lpcms/gocar) is public.
- `next.config.mjs` caps build parallelism (`cpus: 1`, no worker threads) because the production host OOM-kills the default build; ESLint is skipped during build since prebuild already ran it.
- Production is live and takes real bookings. Migrations and anything touching `db/gocar.db` should be run with a backup in hand.
