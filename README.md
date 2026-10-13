# RateMyProf — NIT Warangal

A React + plain CSS frontend with a Node.js/Express/MySQL backend. **Modules 1–3 are implemented.** Google OAuth is intentionally deferred.

- Catalog: official departments/faculty and current B.Tech courses, with source links and verified teaching assignments.
- Accounts: configured NITW email domain, password login/logout, MySQL sessions, CSRF protection, password recovery.
- Reviews: six ratings, optional text, up to five predefined tags, semester, and confirmation. Reviews persist anonymously; one submission per account × professor × course is enforced by MySQL.
- Module 4's advanced discovery/aggregates, Module 5's moderation, and Module 6's analytics remain future work. Helpful votes/reports are clearly marked frontend previews. Insights is blank and comparison is removed.

## Run locally

Requires Node.js 20.19+ (or a supported newer version), npm, and MySQL 8.4+. The local helper locates mysqld on common macOS paths; set MYSQLD_PATH if needed.

```sh
npm install
npm run setup:local
```

Setup creates this project's isolated MySQL instance on **127.0.0.1:3307**, a private `.env`, the schema, the checked-in official catalog, and a local website administrator. It preserves an existing `.env` and existing account data. Initial admin credentials are in `.local/admin-account.txt`.

For subsequent sessions:

```sh
npm run db:local
```

Run the following in two separate terminals:

```sh
npm run dev:server
```

```sh
npm run dev
```

Open **http://localhost:5173/**. The configured browser origin must match APP_ORIGIN. Vite proxies `/api` to Express on port 3000. If either port is already occupied, stop the earlier instance instead of starting duplicates.

The approved email domain comes from STUDENT_EMAIL_DOMAINS in `.env`; `.env.example` defaults to student.nitw.ac.in. Signup creates the account without an email code, then the student signs in with a password. Domain checking does not prove mailbox ownership. Google OAuth will be added separately.

Password recovery still uses codes. In development, `.local/mail/` contains private JSON recovery messages; these do not send mail to an inbox. Production requires SMTP configuration.

For an independently managed database, create the database/user, configure `.env`, then run `npm run db:migrate`, `npm run db:seed`, and `npm run admin:create`. Older cleanup migrations that drop obsolete objects require provisioning privileges; `setup:local` uses the isolated local root connection for that purpose. Normal API requests use the restricted application account.

## Refresh the official catalog

The checked-in `shared/nitwCatalog.json` snapshot allows setup without scraping the website each time. See [NITW_CATALOG.md](docs/NITW_CATALOG.md) for sources, verification, and known source discrepancies.

To collect a fresh snapshot, install the development browser and Poppler's `pdftotext` command:

```sh
npx playwright install chromium
# On macOS, install Poppler if pdftotext is missing:
brew install poppler
npm run catalog:collect
```

The collector visits NITW's department rosters (including published adjunct tabs), the **current** central B.Tech curriculum tab, all its PDFs, and roster-linked public ERP profiles. It extracts public catalog facts, checks coverage, and writes a verification report. It does not collect student details, faculty phone numbers, or email addresses.

```sh
npm run catalog:sync
```

Sync privately backs up catalog tables, applies migrations, and imports the snapshot. It preserves account/review data, stable IDs, and manually created records. Official records are refreshed; existing manual teaching links are retained. `npm run db:seed` instead inserts missing initial records without overwriting edits. No command seeds reviews.

Optional collector settings: CHROMIUM_PATH, PDFTOTEXT_PATH. `node server/scripts/collect-nitw.js --cached` reuses already downloaded PDFs/profile pages for debugging; use a normal collection run to refresh those sources. Raw pages/PDFs/backups remain ignored under `.local/nitw/`.

## Main API routes

| Route                                                           | Purpose                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| GET /api/catalog                                                | Public departments, professors, courses, and teaching links  |
| GET /api/professors, /api/courses                               | Public list/search/filter                                    |
| GET /api/professors/:id, /api/courses/:id                       | Public detail                                                |
| POST/PUT/DELETE /api/departments, /api/professors, /api/courses | Admin catalog changes; detail IDs required for edits/deletes |
| GET /api/auth/session                                           | Own account, CSRF token, allowed domains                     |
| POST /api/auth/register, /api/auth/login, /api/auth/logout      | Password account lifecycle                                   |
| POST /api/auth/forgot-password, /api/auth/reset-password        | Recovery                                                     |
| GET /api/auth/review-eligibility                                | Signed-in teaching-link check                                |
| GET /api/reviews                                                | Anonymous saved reviews                                      |
| POST /api/reviews                                               | Student-only validated submission; duplicate returns 409     |

All mutations require the session's CSRF token. Public review responses never include email, user ID, password hash, private seed, or duplicate-enforcement key. Reviews reference professors/courses with restrictive foreign keys: a catalog record with saved reviews cannot be silently deleted.

## Tests and learning

```sh
npm test
npm run test:integration
npm run build
```

Unit tests cover helpers, review validation, and extraction/snapshot integrity. Integration tests use an isolated temporary MySQL database/user, covering permissions, CRUD, sessions/recovery, review persistence/privacy, duplicate races, and repeatable catalog import. The integration suite requires the local MySQL server and private provisioning credential; it does not wipe the application database.

- [30-minute backend guide](docs/BACKEND_30_MIN_GUIDE.md)
- [Project file map](docs/PROJECT_CODE_GUIDE.md)
- [Backend request walkthrough](docs/BACKEND_CODE_GUIDE.md)
- [Six-module status](docs/MODULE_GUIDE.md)
- [Official catalog audit](docs/NITW_CATALOG.md)

`.env`, `.local/`, node_modules, dist, and credentials are excluded from Git. Share `.env.example`, never your actual secrets. A production deployment additionally needs its public listening address, HTTPS/origin/cookie configuration, encrypted remote MySQL connection, and real mail delivery configured; this change does not deploy hosting.
