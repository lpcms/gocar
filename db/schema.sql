-- =============================================================
-- gocar.run — SQLite schema, draft for approval (Stage 0)
-- Multilingual pattern: *_translations tables, locale IN ('en','ua')
-- =============================================================

/**
 * Car categories (Class). Slug is used by the /cars#{slug} filter.
 */
CREATE TABLE categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT NOT NULL UNIQUE,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE category_translations (
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    locale      TEXT NOT NULL CHECK (locale IN ('en','ua')),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (category_id, locale)
);

/**
 * Cars. Category deletion is blocked while cars reference it (RESTRICT).
 */
CREATE TABLE cars (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          TEXT NOT NULL UNIQUE,
    status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('live','draft')),
    category_id   INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    price_per_day INTEGER NOT NULL,          -- USD
    deposit       INTEGER NOT NULL,          -- USD
    engine        TEXT,                      -- '2.0T'
    transmission  TEXT,                      -- 'Automatic' | 'Manual'
    fuel_type     TEXT,                      -- 'Petrol' | 'Diesel'
    seats         TEXT,                      -- '5', '8 passengers'
    drivetrain    TEXT,                      -- 'FWD' | 'AWD' | 'Повний привід'
    tariff_1_3    INTEGER NOT NULL,          -- USD/day, 1-3 days
    tariff_4_9    INTEGER NOT NULL,
    tariff_10_25  INTEGER NOT NULL,
    tariff_26     INTEGER NOT NULL,          -- 26+ days
    form_aliases  TEXT,                      -- CSV of legacy option values for /book Vehicle
    related_slugs TEXT,                      -- CSV of slugs shown in 'You may also like'
    is_popular    INTEGER NOT NULL DEFAULT 0,-- shown in the Popular Cars block on /cars
    sort_order    INTEGER NOT NULL DEFAULT 0,-- manual order: admin list and the Cars menu
    image_id      INTEGER REFERENCES media(id),
    preview1_id   INTEGER REFERENCES media(id),
    preview2_id   INTEGER REFERENCES media(id),
    preview3_id   INTEGER REFERENCES media(id),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE car_translations (
    car_id      INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    locale      TEXT NOT NULL CHECK (locale IN ('en','ua')),
    title       TEXT NOT NULL,
    description TEXT,
    engine       TEXT NOT NULL DEFAULT '',
    transmission TEXT NOT NULL DEFAULT '',
    fuel_type    TEXT NOT NULL DEFAULT '',
    seats        TEXT NOT NULL DEFAULT '',
    drivetrain   TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (car_id, locale)
);

/**
 * Car features, up to 6 per car (position 1..6), localized.
 */
CREATE TABLE car_features (
    car_id   INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 6),
    locale   TEXT NOT NULL CHECK (locale IN ('en','ua')),
    title    TEXT NOT NULL,
    text     TEXT,
    PRIMARY KEY (car_id, position, locale)
);

/**
 * Booking extras. price_type: 'per_day' | 'per_order'.
 */
CREATE TABLE extras (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slug       TEXT NOT NULL UNIQUE,
    price      INTEGER NOT NULL,             -- USD
    price_type TEXT NOT NULL CHECK (price_type IN ('per_day','per_order')),
    is_active  INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE extra_translations (
    extra_id INTEGER NOT NULL REFERENCES extras(id) ON DELETE CASCADE,
    locale   TEXT NOT NULL CHECK (locale IN ('en','ua')),
    name     TEXT NOT NULL,
    PRIMARY KEY (extra_id, locale)
);

/**
 * Static pages (home, about-us, cars, faq, contact, book, 404).
 * Content blocks stored as JSON; SEO fields per locale.
 */
CREATE TABLE pages (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE                -- '', 'about-us', 'cars', ...
);

CREATE TABLE page_translations (
    page_id          INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    locale           TEXT NOT NULL CHECK (locale IN ('en','ua')),
    meta_title       TEXT,
    meta_description TEXT,
    canonical_url    TEXT,
    og_title         TEXT,
    og_description   TEXT,
    og_image_id      INTEGER REFERENCES media(id),
    structured_data  TEXT,                   -- JSON-LD override, optional
    content          TEXT,                   -- JSON content blocks
    PRIMARY KEY (page_id, locale)
);

/**
 * UI translations (menu items, buttons, form labels...):
 * key -> en/ua value with NEW/DONE workflow status.
 */
CREATE TABLE translations (
    key    TEXT NOT NULL,
    locale TEXT NOT NULL CHECK (locale IN ('en','ua')),
    value  TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','done')),
    PRIMARY KEY (key, locale)
);

/**
 * 301/302 redirects.
 */
CREATE TABLE redirects (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    from_path  TEXT NOT NULL UNIQUE,
    to_path    TEXT NOT NULL,
    type       INTEGER NOT NULL DEFAULT 301 CHECK (type IN (301,302)),
    is_active  INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/**
 * Leads: bookings and contact submissions in one table, payload differs.
 * Money fields are the SERVER-side calculation.
 */
CREATE TABLE leads (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    type          TEXT NOT NULL CHECK (type IN ('booking','contact')),
    status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','processed')),
    locale        TEXT NOT NULL,
    -- common
    name          TEXT NOT NULL,
    phone         TEXT,                      -- booking
    email         TEXT,                      -- contact
    message       TEXT,                      -- contact
    source_page   TEXT,                      -- contact: '/contact'
    -- booking
    car_id        INTEGER REFERENCES cars(id) ON DELETE SET NULL,
    pickup_at     TEXT,
    pickup_place  TEXT,
    dropoff_at    TEXT,
    dropoff_place TEXT,
    extras_json   TEXT,                      -- [{extra_id, name, price, price_type}]
    days          INTEGER,
    rental_total  INTEGER,                   -- USD, server-calculated
    extras_total  INTEGER,
    deposit       INTEGER,
    grand_total   INTEGER,
    car_title     TEXT,                      -- vehicle title snapshot (leads survive car deletion)
    comment       TEXT,                      -- booking free-text note
    score         REAL,                      -- reCAPTCHA v3 rating, NULL when not checked
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

/**
 * Admin users and login attempt journal (lockout source of truth).
 */
CREATE TABLE admin_users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    login         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE login_attempts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ip         TEXT NOT NULL,
    login      TEXT,
    result     TEXT NOT NULL CHECK (result IN ('success','failure','blocked')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_login_attempts_ip_time ON login_attempts(ip, created_at);
/** The per-name half of the lockout, and the retention sweep. */
CREATE INDEX idx_login_attempts_login_time ON login_attempts(login, created_at);
CREATE INDEX idx_login_attempts_time ON login_attempts(created_at);

/**
 * Live admin sessions - the list of tokens that are currently allowed in.
 *
 * The session cookie is a signed claim and nothing else, so until this table
 * existed there was no way to take one back: logging out cleared the cookie in
 * that one browser while the token itself stayed valid for the rest of its
 * twelve hours (25.08.2026). A row here is what makes a token acceptable, so
 * deleting the row is the revocation.
 *
 * ON DELETE CASCADE means removing an administrator also drops every session
 * they hold, which is the other revocation the panel offers.
 */
CREATE TABLE admin_sessions (
    id         TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);
CREATE INDEX idx_admin_sessions_user ON admin_sessions(user_id);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);

/**
 * Uploaded media. Original is kept for re-generation on settings change.
 */
CREATE TABLE media (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    original_path TEXT NOT NULL,
    webp_path     TEXT NOT NULL,
    width         INTEGER,
    height        INTEGER,
    alt_en        TEXT NOT NULL,
    alt_ua        TEXT NOT NULL,
    folder        TEXT NOT NULL DEFAULT 'general' CHECK (folder IN ('general','avto','review')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

/**
 * Key-value settings (default_locale, ga_id, gtm_id, fb_pixel_id, recaptcha keys,
 * telegram_bot_token, telegram_chat_id, lockout_attempts, lockout_minutes,
 * image_quality, image_max_width, robots_txt, seo defaults...).
 */
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);


/**
 * Customer reviews shown on the home page (snapshot until Phase 2 admin
 * rendering; CRUD is available immediately for editing/moderation).
 */
CREATE TABLE reviews (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    author       TEXT NOT NULL,
    author_ua    TEXT NOT NULL DEFAULT '',
    text_en      TEXT NOT NULL,
    text_ua      TEXT,
    avatar_url   TEXT,
    avatar_alt_en TEXT NOT NULL DEFAULT '',
    avatar_alt_ua TEXT NOT NULL DEFAULT '',
    is_published INTEGER NOT NULL DEFAULT 1,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
