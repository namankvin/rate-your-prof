# Backend request walkthrough

Read [BACKEND_30_MIN_GUIDE.md](BACKEND_30_MIN_GUIDE.md) for the main explanation and [PROJECT_CODE_GUIDE.md](PROJECT_CODE_GUIDE.md) for the file map. This replaces the old duplicated source listing; the actual source remains the best reference for current lines.

## Catalog

`GET /api/catalog` reaches catalogRoutes, which calls snapshot in the catalog service. It reads departments, professors, courses, and teaching links on one transaction connection. The public mapping supplies department names, numeric-or-unknown credits, source links, and course-ID arrays.

The collector creates a public JSON snapshot from NITW. Seed inserts missing entries while preserving edits. Explicit catalog sync refreshes official entries after a private backup, retaining stable IDs and existing account/review data. Neither script adds reviews. Read [NITW_CATALOG.md](NITW_CATALOG.md) before rerunning collection.

## Account signup and login

Register checks normalized email/domain/agreement and password length, then inserts a UUID, scrypt hash, and private random seed. The schema supplies student role. Unique email handles concurrent duplicate signup. No signup code or Google OAuth is used.

Login compares a candidate password hash, regenerates the session ID, and records userId/session version/CSRF token. MySqlSessionStore saves session JSON; the signed HttpOnly cookie identifies the session. loadUser reloads the current database role/version on later requests. Logout destroys one session. Recovery increases the account version so old sessions stop working.

## Review submission

1. React POSTs professorId, courseId, semester, six ratings, optional text, tags, and confirmation to `/api/reviews`.
2. Middleware checks cookie/session, origin/CSRF, student access, and request rate.
3. validateReview checks types/ranges/lengths/allowlists. React validation improves feedback but cannot replace these checks.
4. A transaction locks the teaching assignment. reviewIdentity validates the relationship using the same connection and derives a private HMAC key.
5. INSERT writes the review. UNIQUE(context_key) makes concurrent duplicate submissions return 409 REVIEW_EXISTS.
   Keep ANONYMOUS_SECRET stable across deployments so existing duplicate keys remain valid.

6. Public GET returns explicit review fields; the private key/seed and account data are never serialized.
7. React reloads saved reviews; a browser refresh or backend restart preserves them because MySQL owns the data.

Reviews reference professors/courses with RESTRICT foreign keys, protecting feedback from accidental catalog deletion. Moderation/reporting/voting and advanced analytics remain future modules.

## SQL and transactions

`const [rows] = await pool.execute(sql, values)` extracts the row array from mysql2's `[rows, metadata]`. `rows[0]` is the first row. Placeholders bind values separately from SQL syntax. Fixed code branches choose table names.

transaction borrows one connection, begins, awaits a callback, commits on return, rolls back on throw, and always releases the connection. A wrong recovery guess returns false inside its transaction so its failed-attempt increment commits; the HTTP error is thrown afterward.

## Persisted data

MySQL contains departments, professors, courses, professor_courses, users, sessions, password_resets, and reviews. Search fields/tabs/report/vote previews are React memory. Rate-limit counters are Node memory. Secrets are backend environment values, not frontend constants. Development mail/admin credentials and raw import sources are private local files excluded from Git.
