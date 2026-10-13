# RateMyProf — React, Express, and MySQL

A responsive professor-review student project. **Modules 1 and 2 are implemented and connected to the frontend.** Modules 3–6 retain their frontend previews.

- **Module 1:** persistent departments, professors, courses, teaching relationships, search/filter APIs, and admin CRUD.
- **Module 2:** student-domain registration without an email code, login/logout, password reset, MySQL-backed sessions, admin authorization, and the private anonymous-identity foundation.
- **Frontend:** React, JavaScript/JSX, HTML, and plain CSS. No TypeScript, Tailwind, router library, or UI framework.
- **Backend:** Node.js, Express, MySQL 8.4+, `mysql2`, `express-session`, Nodemailer, and Node’s built-in cryptography.

**Learn the code:** [Complete frontend/backend learning guide](docs/PROJECT_CODE_GUIDE.md).

## Start on this laptop

Requirements: Node.js 20.19+ or 22.12+, and MySQL Server 8.4+. Your laptop already has MySQL under `/opt/anaconda3/bin`.

```sh
npm install
npm run setup:local
```

The setup helper creates an isolated MySQL instance on **127.0.0.1:3307**, stores its files under `.local/`, generates a private `.env`, creates tables, inserts official CSE courses only (professors start empty), and creates a local admin. It does not change another MySQL instance or overwrite an existing `.env`.

Open two terminals in this project:

```sh
# Terminal 1: backend
npm run dev:server
```

```sh
# Terminal 2: frontend
npm run dev
```

Open **http://localhost:5173**. Vite forwards `/api` requests to Express at port 3000. React never connects directly to MySQL.

The database and both servers have already been started during implementation. After restarting your laptop, use `npm run db:local`, then start the backend and frontend again. Use `npm run db:stop` to stop only the project’s MySQL instance. Stop the frontend/backend terminals with Ctrl+C.

## Try the implemented features

### Student account

1. Open `/#/register`.
2. Use an address ending in **@student.nitw.ac.in**. Plus-address aliases are rejected.
3. Use a password of **12–128 characters** and agree to the guidelines.
4. The account is created immediately. Choose **Continue to login** and sign in with the same email/password. Signup and login do not ask for a verification code.
5. If the email already exists, the form explains that and provides a sign-in link. It does not replace the existing account's password.
6. Accounts that were previously waiting for email verification can also sign in with their original password.
7. Reload: the login session persists. Log out: the server session is destroyed.

**Google OAuth is planned for later.** Student-domain checking currently validates the address format/domain, not ownership of that inbox.

Password recovery remains separate: `/#/forgot-password` requests a reset code, then `/#/reset-password` accepts the code and a new password. Local reset messages are saved privately in `.local/mail/`; no email reaches an inbox until SMTP is configured. Reset codes expire after ten minutes, allow five wrong guesses, and have a one-minute resend cooldown.

### Administrator

Open **`.local/admin-account.txt`** locally for the generated admin email and password. Do not commit or share this file. Log in at `/#/login`; administrators land on `/#/admin`.

You can add/edit/delete departments, professors, and courses, and assign courses in the professor editor. Changes survive refresh. A department containing professors or courses cannot be deleted until those records are moved or removed.

Student registration always creates the `student` role. Only the local database-admin script can create admin accounts; the browser cannot promote itself.

## Use an existing MySQL server instead

Skip `setup:local`. Create a database and database user yourself, copy `.env.example` to `.env`, and set your own host, port, database, user, password, and three independent random secrets.

```sh
npm run db:migrate
npm run db:seed
npm run admin:create
```

The database must already exist. `db:migrate` creates missing Module 1/2 tables and applies the explicit half-credit upgrade. Further schema changes should become explicit numbered migrations.

`db:seed` inserts the official CSE courses only (professors start empty) and preserves existing records/teaching mappings. It can reinsert deleted curriculum courses; it never creates sample professors or reviews.

`admin:create` uses `ADMIN_EMAIL` and optional `ADMIN_PASSWORD` from `.env`. Without a supplied password, it generates one and saves it privately. Re-running it does not reset an existing administrator’s password or promote an existing student.

## Configure real email

Set these backend `.env` values using your provider’s SMTP settings:

```env
MAIL_MODE=smtp
MAIL_FROM=RateMyProf <your-verified-sender@example.com>
SMTP_HOST=your-provider-smtp-host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
```

For providers using implicit TLS on port 465, use `SMTP_SECURE=true` and `SMTP_PORT=465`. Port 587 uses STARTTLS; the transport requires TLS. Restart the backend after editing configuration.

No SMTP provider credentials were supplied, so real external delivery has not been verified. The code supports it; the current running app uses private local file delivery.

## Environment variables

`.env.example` documents every variable. `.env`, database files, mail messages, and local admin credentials are ignored by Git.

Use **`APP_ENV`** for backend environment selection. Do not add `NODE_ENV=development` to the root `.env`: Vite also reads this file and it can accidentally bundle development React into a production build.

`SESSION_SECRET`, `OTP_SECRET`, and `ANONYMOUS_SECRET` must be independent random values of at least 32 characters. Keep the anonymous secret stable so future review identities remain consistent. Never put any secret in a `VITE_` variable.

## Pages

| Route after `#`                                             | Purpose                                                     |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| `/`                                                         | Landing page                                                |
| `/professors`                                               | Searchable professor directory, list/grid                   |
| `/professors/:id`                                           | Professor profile, courses, empty reviews                   |
| `/professors/:id/reviews`                                   | Reviews (initially empty)                                   |
| `/courses`                                                  | Course directory                                            |
| `/courses/:id`                                              | Course profile and related professors                       |
| `/courses/:id/reviews`                                      | Course reviews (initially empty)                            |
| `/write-review`                                             | Signed-in-user review preview; Module 3 persistence pending |
| `/register`                                                 | Account creation without an email code                      |
| `/login`                                                    | Student/admin login                                         |
| `/forgot-password`, `/reset-password`                       | Real password recovery                                      |
| `/insights`                                                 | Blank page reserved for later implementation                |
| `/about`, `/guidelines`, `/privacy`                         | Project and community information                           |
| `/admin`                                                    | Protected admin dashboard                                   |
| `/admin/professors`, `/admin/courses`, `/admin/departments` | Protected persistent catalog management                     |
| `/admin/moderation`                                         | Protected frontend moderation preview                       |
| Unknown route/profile                                       | 404                                                         |

Examples: `/#/professors` and `/#/courses/cs1206`. Hash routing works without static-host rewrites. The site footer, campus favorites, and homepage guidance section are removed for now.

## Current CSE course catalog

The course catalog uses **101 CS-coded entries** from the supplied NITW B.Tech. Computer Science & Engineering curriculum, effective AY 2024-25:

- 37 core, lab, project, and Fractal Course entries from pages 6–9.
- 49 professional electives from pages 10–11.
- 6 CSE minor and 9 CSE honors courses from page 13.

Non-CS-coded courses and the CS13XX/CS14XX elective-slot placeholders are excluded. Source titles/codes, semesters, and credits are in `shared/cseCurriculum.js`. No professor assignment is inferred from this curriculum. Use admin to assign courses when the teaching roster is known.

The importer has already replaced the old course catalog. Its previous courses and teaching assignments are backed up privately in `.local/catalog-before-curriculum-*.json`. It preserves accounts/professors and valid assignments to courses retained by code. To explicitly reapply the catalog later:

```sh
npm run catalog:import
```

This command removes courses absent from the curriculum, so use it only when you intend that replacement. `db:seed` performs additive inserts instead. `db:migrate` now includes the idempotent half-credit migration; credits support 0.5 increments and the admin form accepts them.

The professor catalog is currently empty. Existing professor records/teaching assignments were privately backed up under `.local/professors-before-removal-*.json` before removal. Add actual professors through admin when ready.

The homepage uses the supplied photo at `public/nitw-campus.png`, with no quote card or corner labels. The avatar/star testimonial strip is removed. Professor/course directories omit the “MySQL catalog” label. The top project notice, platform statistics strip, footer, campus favorites, and guidance section are removed.

## Verification

```sh
npm test                 # cryptography, validation, configuration
npm run test:integration # real MySQL API tests in an isolated disposable database
npm run build            # production React bundle
```

The integration command requires the project-local MySQL setup and its private root credential file. It creates its own test database/user and removes them afterward; it does not reset your application database.

Validated during implementation: **4 unit tests and 13 integration test results**, plus browser checks for code-free registration, duplicate-account handling, login persistence, password reset/logout, student/admin separation, catalog CRUD and course mappings, and responsive page checks at phone/tablet widths. The dependency audit passed with no reported vulnerabilities at implementation time.

## What remains a preview

Reviews start empty. No review text, ratings, tags, counts, or semester trends are seeded. Profiles display “Not rated” and “No reviews yet.” Insights is blank, and comparison is removed. The review form and moderation interface remain frontend previews for later modules; user-created previews are not persisted to MySQL.

The private review-identity helper is implemented and tested. Module 3 must use it on the server when saving a review, then enforce a unique submission constraint. The current eligibility API returns a boolean, never the private identity key, and does not save a review.

Email ownership is not verified during current signup. The unique-email rule and alias check reduce duplicate-account abuse; they do not establish one physical person per account without a separate institutional identity/roster integration.

## Production notes

Build the frontend, configure `APP_ENV=production`, `APP_ORIGIN=https://your-domain`, SMTP delivery, and a production MySQL database, then run `npm start`. Express serves `dist/` and `/api` from one origin. Place its loopback listener behind an HTTPS reverse proxy; set `TRUST_PROXY=true` only when that topology is configured correctly.

File-email mode and HTTP application origins are rejected in production. Cookies become Secure. Use restricted runtime database grants, backups, and an appropriate shared rate-limit store if running multiple backend processes. The local setup and in-process rate limiter are intended for one-laptop development, not an unreviewed production deployment.
