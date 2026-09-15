<div align="center">

# 🚗 GoCar — Car Rental & Online Booking

**Rent a car in Uzhhorod in a few clicks.**
A bilingual car-rental website with live pricing, online booking, instant Telegram notifications
and a full-featured admin panel.

[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003B57?logo=sqlite&logoColor=white)](https://nodejs.org/api/sqlite.html)
[![Node.js](https://img.shields.io/badge/Node.js-24.x-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

🌐 **Live:** [gocar.run](https://gocar.run)

</div>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🧰 Tech Stack](#-tech-stack)
- [🚀 Quick Start](#-quick-start)
- [⚙️ Configuration](#️-configuration)
- [🗄️ Database](#️-database)
- [📜 Scripts](#-scripts)
- [🗂️ Project Structure](#️-project-structure)
- [🌍 Languages & SEO](#-languages--seo)
- [🛡️ Security](#️-security)
- [☁️ Deployment](#️-deployment)
- [✅ Quality Checks](#-quality-checks)
- [📄 License](#-license)

---

## ✨ Features

### 🚘 For customers

| | |
|---|---|
| 🚙 **Car catalogue** | Categories, filters, detailed car pages with galleries and specifications |
| 📅 **Online booking** | Pick-up / drop-off date, time and place, optional extras, live price estimate |
| 💸 **Honest pricing** | The final price is always recalculated on the server from the tariff grid |
| 💬 **Contact forms** | Requests land in Telegram within seconds |
| 🌍 **Two languages** | Ukrainian (default) and English, with automatic language detection |
| 📱 **Responsive** | Tuned for every breakpoint, from phones to wide desktops |

### 🔧 For the owner — admin panel at `/admin`

- 🚗 **Cars** — prices, tariffs by rental length, deposits, photos, EN/UA descriptions
- 🗂️ **Categories & extras** — child seats, insurance, delivery and other add-ons
- 📨 **Leads** — every booking and request with its full price breakdown
- ⭐ **Reviews**, 🖼️ **media library** with EN/UA alt text, 🔀 **redirects**
- 🌐 **Translations** — every string of the site is editable
- ⚙️ **Settings** — contacts, SEO, analytics (GTM / GA), Telegram, reCAPTCHA, image quality
- 🔐 **Login journal** — attempts log with configurable lockout

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 15** (App Router, React Server Components) |
| UI | **React 19**, hand-written CSS, self-hosted Inter font |
| Language | **TypeScript** — `strict` + `noUncheckedIndexedAccess` |
| Database | **SQLite** via the built-in `node:sqlite` — no native modules |
| Images | **sharp** — resizing and WebP conversion of uploads |
| Auth | `node:crypto` only — scrypt password hashes, HMAC-signed revocable sessions |
| Notifications | Telegram Bot API |
| Anti-spam | Google reCAPTCHA v3 + honeypot fields |

> `sharp` is the only runtime dependency besides Next.js and React.

---

## 🚀 Quick Start

**Requirements:** Node.js **24.x** (22.13+ works as well — `node:sqlite` must be available).

```bash
# 1. Install dependencies
npm install

# 2. Create the local database from the bundled template
npm run db:init

# 3. Create an administrator
npm run admin:create -- admin YOUR_STRONG_PASSWORD

# 4. Start the dev server
npm run dev
```

| URL | What |
|---|---|
| http://localhost:3000 | Public site (Ukrainian) |
| http://localhost:3000/en | Public site (English) |
| http://localhost:3000/admin | Admin panel |

---

## ⚙️ Configuration

Almost everything is configured **in the admin panel** (Settings) and stored in the database:
contacts, SEO texts, the site domain, analytics IDs, Telegram bot token and chat ID, reCAPTCHA keys.

### `config.local.json` (optional, git-ignored)

Local-only overrides — copy [`config.local.example.json`](config.local.example.json):

```json
{
  "recaptcha": { "admin": false, "forms": false },
  "telegram_bot_token": "PASTE_YOUR_TOKEN_HERE",
  "telegram_chat_id": "PASTE_CHAT_ID_HERE"
}
```

- `recaptcha.admin` / `recaptcha.forms` — switch reCAPTCHA off for local work and automated tests
  (absent means **on**).
- Telegram keys are a fallback used only when they are not set in the admin panel.
- The admin session secret is generated into this file on first use.

### Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | Port (or unix-socket path) for `npm start`, default `3000` |
| `HOST` | Listen address for `npm start`, default `0.0.0.0` |
| `SESSION_SECRET` | Admin session signing key. **Required on read-only hosts such as Vercel**; elsewhere it is generated automatically |

---

## 🗄️ Database

SQLite, 18 tables, schema in [`db/schema.sql`](db/schema.sql). Content is split into
`<entity>` + `<entity>_translations` (locales `en` / `ua`).

| File | In git | Purpose |
|---|:---:|---|
| `db/gocar.template.db` | ✅ | Site content (cars, categories, extras, reviews, translations, media, settings) — **no leads, no admin accounts, no credentials** |
| `db/gocar.db` | ❌ | The live database of an installation |
| `backups/` | ❌ | Snapshots made by `npm run db:backup` |

On first start the application copies the template to `db/gocar.db` automatically.
To refresh the template after editing content: `npm run db:template`.

> ⚠️ Production takes real bookings — make a backup (`npm run db:backup`) before any manual
> change to `db/gocar.db`.

---

## 📜 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` | Production build (runs the import and strict-mode audits first) |
| `npm start` | Production server (`server.js`, TCP port or unix socket) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run check` | **All pre-delivery checks** — imports, strict audit, SQL schema, schema drift, `tsc` |
| `npm run db:init` | Create `db/gocar.db` from the template (never overwrites) |
| `npm run db:backup` | Snapshot the database into `backups/gocar-YYYYMMDD-HHMM.db` |
| `npm run db:template` | Rebuild `db/gocar.template.db` from the live database, stripped of private data |
| `npm run admin:create -- <login> <password>` | Create an administrator or reset a password |

Audits against a running server:

```bash
node scripts/qa-seo.mjs http://localhost:3000     # <head> and JSON-LD on every page
node scripts/qa-locale.mjs http://localhost:3000  # the whole language policy
node scripts/diag-dead-code.mjs                   # modules under src/ that nothing imports
```

---

## 🗂️ Project Structure

```text
gocar/
├── db/
│   ├── schema.sql              # database schema
│   └── gocar.template.db       # content template for a fresh install
├── public/
│   ├── fonts/                  # self-hosted Inter
│   ├── images/                 # site imagery and review avatars
│   ├── uploads/                # car photos, favicon, OG image (managed by the admin)
│   └── assets/                 # media-library images
├── scripts/                    # CLI tools: checks, database, admin, audits
├── src/
│   ├── app/
│   │   ├── (site-uk)/          # Ukrainian site — owns the root URL
│   │   ├── (site-en)/en/       # English site under /en
│   │   ├── admin/              # admin panel (Russian UI)
│   │   ├── api/                # booking/lead endpoint and admin API
│   │   ├── sitemap.xml/        # dynamic sitemap
│   │   └── robots.txt/         # robots.txt, editable in the admin
│   ├── components/site/        # page sections and client islands
│   ├── lib/                    # database, pricing, leads, auth, SEO, i18n
│   ├── styles/                 # tokens, typography, site styles
│   └── middleware.ts           # locale redirect (edge runtime)
├── server.js                   # production entry point
└── next.config.mjs
```

---

## 🌍 Languages & SEO

- 🇺🇦 **Ukrainian** is the default and lives at the root (`/`); 🇬🇧 **English** lives under `/en`.
- Language choice: the `gocar_locale` cookie → the visitor's country → the default language from
  Settings. **Search engine crawlers are never redirected**, so both languages stay indexable.
- Every page ships a canonical URL, `hreflang` alternates (`x-default` → English), Open Graph /
  Twitter cards and a JSON-LD graph — all built from the admin data.
- `sitemap.xml` and `robots.txt` are generated dynamically; the admin panel and the API send
  `X-Robots-Tag: noindex`.

---

## 🛡️ Security

- Passwords hashed with **scrypt**; sessions are **HMAC-signed and revocable** (logout really ends them).
- **Login lockout** by IP and by login name, with a login journal and automatic cleanup.
- Constant-time checks that do not reveal which admin logins exist.
- **reCAPTCHA v3** on the admin login and on public forms, verified before anything else.
- Prices sent by the browser are **ignored** — the server recalculates every booking.
- **HSTS** on every response.

---

## ☁️ Deployment

### 🖥️ Own server / Node.js hosting (recommended for production)

```bash
npm ci
npm run build
npm start            # PORT=3000 by default; PORT may also be a unix-socket path
```

- `server.js` pins the working directory to the project folder, so hosting panels that start the
  app by a file (e.g. CityHost) work out of the box.
- Keep `db/`, `public/uploads/` and `config.local.json` on a **persistent disk** and back up
  `db/gocar.db` regularly (`npm run db:backup`, e.g. from cron).
- Put the app behind NGINX (or the panel's proxy) for TLS.

### ▲ Vercel

The project builds and deploys on Vercel with no extra configuration:

1. Import the repository in Vercel — the framework (Next.js) and Node.js 24 are detected automatically.
2. Add the environment variable `SESSION_SECRET` (any long random string).
3. Deploy.

> ⚠️ **Vercel's filesystem is read-only and serverless.** The site starts from
> `db/gocar.template.db`, copied into temporary storage, so every public page works — but
> changes made in the admin panel, new leads and uploaded photos are **not persistent** and are
> lost when an instance is recycled (booking notifications still reach Telegram). Use Vercel for
> previews and demos; run production on a host with a persistent disk.

---

## ✅ Quality Checks

There is no separate test framework — correctness is enforced by static audits:

```bash
npm run check        # must print "ALL CHECKS PASSED"
npm run lint
```

`npm run check` validates that:

- every named import resolves to a real export;
- there are no non-null assertions, unguarded indexed access or unused code;
- every `table.column` used in SQL exists in the database;
- `db/schema.sql` matches the live database;
- TypeScript compiles with zero errors.

A pre-commit hook (husky + lint-staged) runs ESLint and Prettier on staged files.

---

## 📄 License

Distributed under the **Apache License 2.0** — see [LICENSE](LICENSE).

<div align="center">

Made with ❤️ for **GoCar** · Uzhhorod, Ukraine 🇺🇦

</div>
