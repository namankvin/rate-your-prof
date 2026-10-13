# Module implementation status

Start with [BACKEND_30_MIN_GUIDE.md](BACKEND_30_MIN_GUIDE.md) for a short explanation of the implemented backend and data flows.

For the backend source walkthrough and data flows, read [BACKEND_CODE_GUIDE.md](BACKEND_CODE_GUIDE.md).

Read [PROJECT_CODE_GUIDE.md](PROJECT_CODE_GUIDE.md) for the full frontend/backend explanation and learning sequence.

## Module 1: Professor & Course Management — implemented

- MySQL tables for departments, professors, courses, and teaching relationships.
- Professor catalog starts empty; no professor names are seeded.
- 101 CS-coded courses from the supplied AY 2024-25 curriculum; no non-CSE courses or sample reviews.
- Half-credit migration and source-backed catalog importer with private backup.
- Public catalog/list/detail APIs with search and department/course filters.
- Server-validated administrator CRUD, including department management.
- Transactional teaching assignments; foreign-key constraints.
- React directories, profiles, filters, and admin forms connected to MySQL.
- Loading, connection-error, retry, validation, and authorization feedback.

Start reading `server/schema.sql`, `server/services/catalog.js`, `server/routes/catalog.js`, `src/context/DataContext.jsx`, and `src/pages/Admin.jsx`.

## Module 2: Student Authentication & Anonymous Identity — implemented

- Registration limited to `student.nitw.ac.in`, canonical email uniqueness, and alias checks.
- Signup/login use email and password without a verification code. Existing pending accounts can sign in; duplicate signup offers sign-in instead.
- Password recovery retains random reset codes, ten-minute expiry, five wrong attempts, and resend cooldown.
- Salted password hashing using Node’s built-in scrypt.
- Login, logout, and password reset. Google OAuth is planned for later; inbox ownership is not checked during signup.
- MySQL-backed HttpOnly cookie sessions with login regeneration.
- Password reset invalidates sessions on all devices through a version counter.
- Server-side administrator authorization and frontend access gates.
- A private per-user seed and keyed per-professor/course review identity helper.
- SMTP delivery support; current local configuration saves mail privately to `.local/mail/`.

Start reading `server/services/auth.js`, `server/lib/security.js`, `server/middleware/auth.js`, `src/context/AuthContext.jsx`, and `src/pages/Auth.jsx`.

## Module 3: Rating & Review Submission — frontend preview, next to implement

The review form validates ratings/tags and calls the real signed-in-account eligibility API. Submission still changes temporary frontend state only. Next, add a reviews table and submission API, use the private identity helper server-side, enforce a unique context key, and implement server-side review validation. Do not expose private identity keys or student identity in public review responses.

## Module 4: Professor Rating & Student Discovery — frontend preview

Profiles, review filters, and discovery screens exist. Catalog information is real MySQL data, but reviews start empty and no sample ratings are displayed. Add real aggregates, pagination, tag counts, and course-specific ratings after Module 3.

## Module 5: Moderation, Reporting & Trust — frontend preview

Report dialogs and the protected moderation screen exist. Reports and moderation decisions remain in-memory previews. Add persistent reports, moderation states, abuse checks, privacy thresholds, and audit logs.

## Module 6: Analytics, Insights & Administration — planned (blank page)

Insights is blank and professor comparison is removed from the frontend for now. Add real semester/department aggregates and helpful-vote persistence. Protect small cohorts and keep private account data out of analytics.

## Intended responsibility boundaries

Module 1 defines **what** can be reviewed. Module 2 defines **who** can participate. Module 3 collects feedback. Module 4 presents it. Module 5 maintains trust. Module 6 provides aggregated insights.
