# Understand the backend in 30 minutes

You do not need to memorize every line. Learn where data lives, how a request reaches MySQL, and which checks happen before data is changed.

## Minutes 0–5: the big picture

The backend implements three modules: **Professor & Course Management** and **Student Authentication & Anonymous Identity**, plus **Rating & Review Submission**. Reports, votes, and analytics remain future work.

Three programs run locally:

| Program            | Port | Job                                       |
| ------------------ | ---: | ----------------------------------------- |
| React through Vite | 5173 | Displays forms and catalog pages          |
| Node.js + Express  | 3000 | Receives requests, checks rules, runs SQL |
| MySQL              | 3307 | Stores persistent rows                    |

```text
React sends a request
    ↓
Express checks it and selects a route
    ↓
A service validates data and runs SQL
    ↓
MySQL returns rows or confirms a change
    ↓
Express sends JSON back
    ↓
React updates its state and displays the result
```

Vite forwards requests beginning with `/api` to Express. React does not connect directly to MySQL.

Two kinds of storage matter:

- **MySQL:** accounts, catalog records, teaching assignments, saved reviews, sessions, and password-recovery records. These survive a browser refresh.
- **React memory:** search text, selected tabs, and report/vote previews. These reset on a full page reload.

The official curriculum JavaScript file is a source for seeding/importing courses. It is not the live database. Editing it alone does not update existing SQL rows.

## Minutes 5–10: the database

Read [schema.sql](/Users/naman/rate-your-prof/server/schema.sql). It defines eight tables:

| Table             | What one row represents                                       |
| ----------------- | ------------------------------------------------------------- |
| departments       | One department                                                |
| professors        | One professor, with a department ID                           |
| courses           | One course, with a department ID                              |
| professor_courses | One professor teaching one course                             |
| users             | One student or website admin account                          |
| sessions          | One browser session                                           |
| password_resets   | One account's current recovery-code record                    |
| reviews           | One anonymous saved review, with a private unique context key |

### Relationships

A department has many professors and courses. Professors and courses have a **many-to-many relationship**:

```text
Professor A → Course X
Professor A → Course Y
Professor B → Course X
```

`professor_courses` stores these pairs. Its combined primary key prevents the same pair appearing twice.

The database protects relationships:

- A professor/course must reference an existing department.
- An in-use department cannot be deleted.
- Deleting a professor removes their teaching links, while keeping courses.
- Deleting a course removes its teaching links, while keeping professors.
- Account emails and course codes must be unique.

### The important account fields

```text
id              unique account UUID
email           normalized email
password_hash   scrypt encoding; no plaintext password
role            student or admin
anonymous_seed  private random value for anonymous review identities
session_version number used to invalidate old logins
```

Website users are rows in `users`. The MySQL username/password in `.env` belongs to the backend's database connection. They are separate accounts.

The seed supplies the checked-in official NITW faculty/departments and B.Tech course snapshot, including verified teaching links. It adds no sample reviews. Source caveats are in NITW_CATALOG.md.

## Minutes 10–15: catalog reads and admin edits

Open [routes/catalog.js](/Users/naman/rate-your-prof/server/routes/catalog.js) and [services/catalog.js](/Users/naman/rate-your-prof/server/services/catalog.js).

**A route chooses the action. A service performs it.**

For example:

```text
GET /api/catalog
→ catalog route calls snapshot()
→ service reads departments, professors, courses, and teaching links
→ returns public JSON
→ React stores the arrays and renders them
```

The service joins department IDs to department names, converts decimal credits to JavaScript numbers, and turns teaching links into each professor's course-ID list. It selects the fields that should leave the backend.

The current search box filters the downloaded arrays in React on each keystroke. It does not make a SQL request for every character. Backend search endpoints also exist for future use.

### Reading a SQL call

```js
const [rows] = await pool.execute(
  "SELECT id, email FROM users WHERE email = ?",
  [address],
);
```

- `pool` provides reusable database connections.
- `execute` runs a prepared statement.
- `?` receives `address` as a value, separate from SQL syntax.
- `await` waits for the query to finish.
- mysql2 returns `[rows, metadata]`, so `[rows]` extracts the result array.
- `rows[0]` means the first database row.

The separate parameter array helps prevent SQL injection. Table names are chosen from fixed code branches, not submitted by users.

### Saving a professor

```text
Admin submits form
→ backend checks login and admin role
→ service validates name, department, designation, and course IDs
→ begin transaction
→ insert/update professor
→ replace their teaching links
→ commit
→ React reloads catalog
```

A **transaction** makes related changes succeed or fail together. If a selected course is invalid, the transaction rolls back instead of leaving a half-completed edit.

[db.js](/Users/naman/rate-your-prof/server/db.js) provides the helper: borrow one connection, begin, perform work, commit or roll back, and always release the connection.

## Minutes 15–22: signup, login, and sessions

Open [services/auth.js](/Users/naman/rate-your-prof/server/services/auth.js) and [routes/auth.js](/Users/naman/rate-your-prof/server/routes/auth.js).

### Signup

React sends email, password, and guideline agreement.

The server:

1. Trims/lowercases email and checks the exact `student.nitw.ac.in` domain.
2. Rejects plus aliases, missing agreement, and invalid password length.
3. Generates a UUID and private random seed.
4. Hashes the password with scrypt and a fresh random salt.
5. Inserts a student account into MySQL.
6. Returns a success message or an account-already-exists error.

Signup does not automatically log the account in. A submitted `role: "admin"` cannot grant admin privileges. The database default assigns student role.

There is no signup verification code or Google OAuth yet. Checking an email domain does not prove ownership of the inbox.

### Password storage

The stored value has this shape:

```text
scrypt$salt$derived-hash
```

The plaintext password is not saved to MySQL. On login, the server uses the stored salt to derive a candidate hash and compares it with the stored hash. It does not decrypt a password.

### Login

```text
Check email/password
→ generate a new session ID
→ save userId, current session_version, and CSRF token in session
→ write session JSON to MySQL
→ send rmp.sid cookie to browser
```

The cookie identifies the session; it does not contain the full account or session JSON. HttpOnly prevents browser JavaScript from reading the cookie. The browser sends it automatically with later requests.

For a later request:

```text
Cookie identifies session
→ load unexpired session from MySQL
→ load account using session.userId
→ compare stored session version with account.session_version
→ allow or reject signed-in access
```

[lib/session-store.js](/Users/naman/rate-your-prof/server/lib/session-store.js) loads, saves, updates expiry, and deletes session rows. [middleware/auth.js](/Users/naman/rate-your-prof/server/middleware/auth.js) checks the current account and role.

A session is configured for a one-day lifetime. Expired rows are unusable; a background job physically removes expired rows hourly.

Logout deletes the current browser's session and clears its cookie.

### Authentication, authorization, and CSRF

These are three different checks:

| Check          | Question answered                                            |
| -------------- | ------------------------------------------------------------ |
| Authentication | Is this a valid signed-in account?                           |
| Authorization  | Is that account allowed to perform this action?              |
| CSRF token     | Does the mutation carry the token belonging to this session? |

Admin catalog edits require an admin role loaded from MySQL. React hiding an admin button is not sufficient protection.

React gets a CSRF token through `/api/auth/session` and sends it as `X-CSRF-Token` when changing data. This also applies to signup/login. The token is separate from the HttpOnly cookie. A supplied browser Origin must match the configured origin.

## Minutes 22–26: recovery and anonymous identity

### Password recovery

Forgot-password generates a six-digit code. MySQL stores its **keyed hash**, expiry, send time, and failed-attempt count.

The actual code is delivered through either:

- Development mode: a private JSON file in `.local/mail/`.
- SMTP mode: email through the configured provider.

Codes expire in ten minutes, have a sixty-second resend cooldown, and become unusable after five wrong guesses. Signup/login never ask for this code.

A valid reset changes the password hash, deletes the code, and increments `session_version`. The current browser is logged out. Other devices' old sessions fail the version check on their next request; their rows need not be immediately deleted.

The attempt counter matters: a wrong guess must commit its counter increase before an error is returned. Otherwise rollback would erase the failed attempt.

### Anonymous reviews

The backend can calculate a private keyed hash from:

```text
account's private seed + professor ID + course ID
```

The same account/context gives the same key. Another professor/course gives another key. The key is not returned by the eligibility API.

Module 3 now uses this key in a MySQL UNIQUE constraint. The server validates ratings/text/tags/semester/confirmation, checks the teaching link, and inserts the review transactionally. Concurrent duplicate submissions return 409. Public responses omit the private key and account details. The current eligibility check confirms a teaching link, not whether the student attended the course.

## Minutes 26–30: connect the files and check understanding

The remaining files support the flows you just learned:

| File/group                                       | Responsibility                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| index.js                                         | Start API, check database access, prune expired sessions, shut down cleanly      |
| app.js                                           | Assemble middleware, request limits, sessions, routes, and error handling        |
| config.js                                        | Read/validate backend-only environment settings                                  |
| lib/validation.js                                | Validate and normalize incoming values                                           |
| lib/security.js                                  | Hash passwords, generate secrets/codes, derive keyed hashes                      |
| lib/errors.js                                    | Translate failures into consistent JSON/status codes                             |
| lib/mail.js                                      | Deliver recovery messages through files or SMTP                                  |
| scripts/setup-local.js                           | Provision the isolated local database and website admin                          |
| scripts/migrate.js + migrations/                 | Create/upgrade tables without rebuilding account data                            |
| scripts/seed.js                                  | Insert missing initial departments/courses without overwriting edits             |
| scripts/collect-nitw.js + scripts/import-nitw.js | Collect/verify official sources, then safely import with a backup                |
| scripts/create-admin.js                          | Create an admin through an administrative command                                |
| tests/                                           | Check success, rejection, transactions, sessions, and migrations using test data |

The backend's `.env` contains its database credentials and separate session, recovery, and anonymous-identity secrets. These are not included in the frontend bundle.

To inspect persisted data in a MySQL client:

```sql
USE rate_my_prof;
SHOW TABLES;
SELECT code, name, credits, semester FROM courses;
SELECT id, email, role, session_version FROM users;
SELECT * FROM professor_courses;
```

Use your configured DB_NAME if it differs. SQL clients bypass Express validation and website permissions; database constraints still apply.

You understand the main implementation if you can answer:

1. Why does React talk to Express rather than MySQL?
2. What does professor_courses represent?
3. Why is a professor edit a transaction?
4. Why does MySQL store a password hash?
5. How does a cookie connect a browser to a MySQL session?
6. How does resetting a password invalidate older logins?
7. Which data currently disappears on refresh?

Answers: Express enforces rules and keeps database credentials private; the table stores teaching pairs; edits and links must succeed together; hashing avoids storing readable passwords; the cookie identifies a server-side session row; the account version increases; React-only state including report/vote previews disappears on full reload.

For reference while reading, use [PROJECT_CODE_GUIDE.md](PROJECT_CODE_GUIDE.md). The longer [BACKEND_CODE_GUIDE.md](BACKEND_CODE_GUIDE.md) is optional when you want to inspect a particular operation in detail.
