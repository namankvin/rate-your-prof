# Six modules and current status

| #   | Module                                      | Status                                                                                                                                         |
| --- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Professor & Course Management               | Implemented: official catalog, source audit/import scripts, search, admin CRUD, verified teaching links                                        |
| 2   | Student Authentication & Anonymous Identity | Implemented: password accounts, sessions/recovery, private identity helper; Google OAuth deferred                                              |
| 3   | Rating & Review Submission                  | Implemented: persistent anonymous reviews, six validated ratings, semester/text/tags/confirmation, unique account/professor/course key         |
| 4   | Professor Rating & Student Discovery        | Basic saved-review display and simple frontend summaries exist; advanced filtering, breakdowns, pagination APIs, and privacy thresholds remain |
| 5   | Moderation, Reporting & Trust               | Frontend report/moderation previews only; persistent reports, abuse checks, moderation states, and audit trail remain                          |
| 6   | Analytics, Insights & Administration        | Planned; Insights blank, comparison removed, helpful votes remain previews                                                                     |

Module 1 defines what can be reviewed. Module 2 identifies participating accounts. Module 3 saves feedback. Module 4 makes feedback useful. Module 5 maintains trust. Module 6 provides higher-level insights.

Read [BACKEND_30_MIN_GUIDE.md](BACKEND_30_MIN_GUIDE.md) for the data flows, [PROJECT_CODE_GUIDE.md](PROJECT_CODE_GUIDE.md) for the file map, and [NITW_CATALOG.md](NITW_CATALOG.md) for source coverage and limitations.

Module 3's private context key is generated on the server using the account's private seed and professor/course IDs. A database UNIQUE constraint rejects concurrent duplicates, including across semesters. Public review responses contain no account identity or private key. Domain-only password registration does not prove mailbox ownership; Google OAuth remains separate work.
