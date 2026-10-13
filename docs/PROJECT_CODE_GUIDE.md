# Project code map

Start with [BACKEND_30_MIN_GUIDE.md](BACKEND_30_MIN_GUIDE.md). This file maps the code without repeating entire source files, so explanations do not become stale after edits.

## Frontend

| File                             | Purpose                                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| src/main.jsx                     | Mount React and load the ordinary CSS stylesheet                                                                             |
| src/App.jsx                      | Small hash router, page titles, auth/catalog gates, providers                                                                |
| src/services/api.js              | Fetch JSON, send session cookies/CSRF, refresh a stale CSRF token once                                                       |
| src/context/AuthContext.jsx      | Current account, login/logout/recovery, session refresh                                                                      |
| src/context/DataContext.jsx      | Load catalog and saved reviews; derive simple display summaries; save/delete catalog records; keep report previews in memory |
| src/components/Layout.jsx        | Shared header, navigation/mobile menu, account controls                                                                      |
| src/components/AccessGate.jsx    | Loading/error/retry and student/admin page access                                                                            |
| src/components/UI.jsx            | Links, initials avatars, stars, tags, filters, tabs, headings, dialogs                                                       |
| src/components/Icon.jsx          | Small inline SVG icon set                                                                                                    |
| src/components/ProfessorCard.jsx | Professor summary and saved-review count                                                                                     |
| src/components/ReviewCard.jsx    | Anonymous saved review; explicitly temporary helpful/report interactions                                                     |
| src/pages/Home.jsx               | Search entry point and campus photograph                                                                                     |
| src/pages/Directory.jsx          | Local search/filter, alphabetical order, professor list/grid, course cards                                                   |
| src/pages/Profile.jsx            | Catalog detail, source link, teaching relationships, saved reviews                                                           |
| src/pages/WriteReview.jsx        | Six ratings, semester/text/tags/confirmation; POST real review and reload data                                               |
| src/pages/Auth.jsx               | Signup/login and password recovery forms                                                                                     |
| src/pages/Admin.jsx              | Catalog forms, overview, and moderation preview                                                                              |
| src/pages/DepartmentAdmin.jsx    | Department CRUD                                                                                                              |
| src/pages/Information.jsx        | About, privacy, and guidelines                                                                                               |
| src/pages/Insights.jsx           | Intentional blank placeholder                                                                                                |
| src/pages/NotFound.jsx           | Missing-route feedback                                                                                                       |
| src/styles.css                   | Shared theme, components, page layouts, responsive rules                                                                     |
| shared/reviewOptions.js          | Rating order and tag allowlist shared by React/server                                                                        |
| public/nitw-campus.png           | User-provided campus photo                                                                                                   |
| vite.config.js                   | JSX/build configuration and development API proxy                                                                            |

React state controls forms, search, tabs, and preview interactions. The API is authoritative for accounts, catalog records, and saved reviews. Directory search currently filters downloaded records in React; the backend also supplies search endpoints. JSX renders review text as text rather than injecting HTML.

## Backend

| File                           | Purpose                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| server/index.js                | Startup/database check, loopback API listener, hourly session pruning, graceful shutdown                     |
| server/config.js               | Read and validate backend-only environment settings                                                          |
| server/app.js                  | Security headers, request limits/body parsing, cookie sessions, CSRF/user middleware, routes, error handling |
| server/db.js                   | Connection pool and transaction helper                                                                       |
| server/schema.sql              | Catalog, account, session/recovery, and review tables                                                        |
| server/middleware/auth.js      | CSRF/origin protection, session-version/account reload, student/admin access                                 |
| server/lib/validation.js       | Text/email/password/ID/code checks                                                                           |
| server/lib/security.js         | scrypt passwords, random secrets/codes, HMAC keys, timing-safe comparison                                    |
| server/lib/session-store.js    | MySQL adapter for express-session                                                                            |
| server/lib/mail.js             | SMTP or private development recovery messages                                                                |
| server/lib/errors.js           | Consistent HTTP/SQL error responses                                                                          |
| server/routes/catalog.js       | Public catalog reads and admin changes                                                                       |
| server/services/catalog.js     | Validated SQL/transactions and public catalog mapping                                                        |
| server/routes/auth.js          | Signup/login/logout/recovery/session/eligibility URLs                                                        |
| server/services/auth.js        | Account rules, password recovery, private review identity                                                    |
| server/routes/reviews.js       | Public review read and rate-limited student submission                                                       |
| server/services/reviews.js     | Server review validation, transactional insertion, duplicate/privacy handling                                |
| server/lib/nitw-curriculum.js  | Parse scheme/syllabus headers, preserve unknown credits, handle wrapped PDF text                             |
| server/scripts/collect-nitw.js | Discover official rosters/current curricula, collect/verify source facts                                     |
| server/scripts/import-nitw.js  | Backup and transactionally sync snapshot without deleting accounts/reviews/manual data                       |
| server/scripts/seed.js         | Insert missing snapshot entries without overwriting edits                                                    |
| server/scripts/migrate.js      | Create missing tables and run idempotent schema upgrades                                                     |
| server/scripts/local-mysql.js  | Start/stop this project's isolated MySQL instance                                                            |
| server/scripts/setup-local.js  | Provision isolated database/credentials/schema/catalog/admin                                                 |
| server/scripts/create-admin.js | Explicit website admin creation                                                                              |
| server/migrations/             | Half-credit compatibility, removed-feature cleanup, source/nullable-credit support                           |
| server/tests/                  | Helper/parser tests and isolated real-MySQL API/integration tests                                            |

## Data files

`shared/nitwCatalog.json` is the checked-in public-data snapshot, not the live database. `docs/NITW_IMPORT_REPORT.json` records per-department/program coverage, hashes, profile comparisons, source disagreements, exclusions, and unmatched teaching entries. Raw HTML/PDFs and private database backups stay under ignored `.local/`.

The former CSE-only hand-maintained dataset/importer were removed. Setup, initial seeding, and explicit refresh now use one official snapshot and one import function. Only source-backed professor/course links are added; department membership is not treated as proof of teaching a course.

## Follow one request

```text
React form → api.js → Express middleware → route → service
           → validation / SQL transaction → MySQL
           → deliberate public JSON → React state → screen
```

Catalog writes require administrator authorization. Review writes require a student account, CSRF, a real teaching link, valid six integer ratings (1–5), an allowed semester, optional text up to 1,000 characters, at most five different allowed tags, and confirmation. The server computes its own private key; submitted user IDs/keys/roles are not trusted.

The review table stores no email/user ID. Its unique HMAC context key enforces one review per account × professor × course. A new browser or backend process reads the same MySQL reviews. Reports/helpful votes still reset on refresh because their later modules are not implemented.
