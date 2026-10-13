# Official NITW catalog audit

Collected: **2026-10-13T18:52:37.765Z**. Sources: [department index](https://nitw.ac.in/departments) and [current B.Tech curriculum index](https://nitw.ac.in/path/?dept=/NewBTechCurriculum).

The snapshot includes **15 departments, 398 roster entries representing 389 distinct faculty identities, 1009 academic course codes, and 423 source-backed teaching links**. Repeated ERP identities across department/adjunct rosters are one professor, preventing duplicate review contexts. No reviews were seeded.

## How coverage was checked

- Read every department card in the official index, then every regular/adjunct faculty heading in each department roster. Each department reports its card count and extracted count. Nonteaching staff, research scholars, and retired-person archives are outside this active-roster scope.
- Followed all 12 PDFs in the current central B.Tech tab. Department pages sometimes link older documents; the central current tab is authoritative for this snapshot. Minor/honors/elective courses inside these documents are included when they have real codes.
- Independently scanned scheme-table course-code tokens and compared them with parsed records. Every program has zero uncaptured coded scheme entries. Detailed syllabus headers fill available titles/credits.
- Cross-checked roster-linked ERP profile names: 368 matched directly or through initial/order normalization, 19 spelling/abbreviation variants were reviewed, and two people have no official ERP profile link in their roster. Their names remain roster-backed; no teaching links are guessed for them.
- Imported teaching links only when the public ERP Courses Handled table says UG and both its normalized title and exact code match the current catalog. Historical/PG/unmatched/renamed entries remain in the report, not in invented assignments. A published course-handled entry is not a guarantee that the professor teaches it this semester.
- Checked duplicate IDs, department references, course/professor assignment references, document hashes, and repeatable database import. Visually inspected representative curriculum tables and the suspicious printed zero-credit entries.

## Department coverage

| Official department                                                     | Faculty cards / extracted |
| ----------------------------------------------------------------------- | ------------------------: |
| [Biotechnology](https://www.nitw.ac.in/bio)                             |                   20 / 20 |
| [Chemical Engineering](https://www.nitw.ac.in/chem)                     |                   27 / 27 |
| [Chemistry](https://www.nitw.ac.in/che)                                 |                   22 / 22 |
| [Civil Engineering](https://www.nitw.ac.in/ce)                          |                   49 / 49 |
| [Computational & Data Science](https://www.nitw.ac.in/cds)              |                     6 / 6 |
| [Computer Science and Engineering](https://www.nitw.ac.in/cse)          |                   43 / 43 |
| [Education](https://www.nitw.ac.in/education)                           |                     8 / 8 |
| [Electrical Engineering](https://www.nitw.ac.in/eee)                    |                   42 / 42 |
| [Electronics and Communication Engineering](https://www.nitw.ac.in/ece) |                   39 / 39 |
| [Humanities and Social Science](https://www.nitw.ac.in/hss)             |                   10 / 10 |
| [Management Studies](https://www.nitw.ac.in/som)                        |                   15 / 15 |
| [Mathematics](https://www.nitw.ac.in/math)                              |                   26 / 26 |
| [Mechanical Engineering](https://www.nitw.ac.in/mec)                    |                   48 / 48 |
| [Metallurgical and Materials Engineering](https://nitw.ac.in/mme)       |                   21 / 21 |
| [Physics](https://nitw.ac.in/physics)                                   |                   22 / 22 |

## Current B.Tech curriculum coverage

Counts below include shared codes repeated between programs and noncredit activity codes before deduplication/exclusions. They are not counts of unique catalog courses.

| Program / source PDF                                                                                                                                                                                                      | Published codes found | Uncaptured scheme codes |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------: | ----------------------: |
| [Civil Engineering](https://nitw.ac.in/api/static/files/B.Tech_Civil_Engineering-Curriculum-new-2024-25_2024-7-19-15-39-22.pdf)                                                                                           |                   124 |                       0 |
| [Electrical and Electronics Engineering](https://nitw.ac.in/api/static/files/B.Tech_Electrical_and_Electronics_Engineering-Curriculum-new-2024-25_2024-7-19-15-44-57.pdf)                                                 |                    94 |                       0 |
| [Mechanical Engineering](https://nitw.ac.in/api/static/files/CURRICULUM_&_SYLLABI_B.Tech.MECHANICAL_ENGINEERING__Revised_2026-1-5-16-54-18.pdf)                                                                           |                   133 |                       0 |
| [Electronics and Communication Engineering](https://nitw.ac.in/api/static/files/1_B.Tech_Electronics_and_Communication_Engineering-Curriculum-new-2024-25_2024-7-19-15-43-2.pdf)                                          |                   102 |                       0 |
| [Metallurgical and Materials Engineering](https://nitw.ac.in/api/static/files/B.Tech_Metallurgical_and_Materials_Engineering-Curriculum-new-2024-25_2024-7-19-15-48-4.pdf)                                                |                    90 |                       0 |
| [Chemical Engineering](https://nitw.ac.in/api/static/files/B.Tech_Chemical_Curriculum_Book_24082025_2025-8-29-9-58-19.pdf)                                                                                                |                   117 |                       0 |
| [Computer Science and Engineering](https://nitw.ac.in/api/static/files/1_B.Tech_Computer_Science_and_Engineering-Curriculum-new-2024-25_2024-7-19-15-40-32.pdf)                                                           |                   116 |                       0 |
| [Biotechnology](https://nitw.ac.in/api/static/files/B.Tech_Biotechnology-Curriculum-new-2024-25_2024-7-19-15-36-41.pdf)                                                                                                   |                    88 |                       0 |
| [Electronics and Communication Engineering (VLSI Design and Technology)](<https://nitw.ac.in/api/static/files/2_B.Tech_Electronics_and_Communication_Engineering_(VLSIDT)-Curriculum-new-2024-25_2024-7-19-15-43-53.pdf>) |                    82 |                       0 |
| [Mathematics and Computing](https://nitw.ac.in/api/static/files/B.Tech-MathComp-10-July-2025_2025-7-16-15-52-42.pdf)                                                                                                      |                    98 |                       0 |
| [Computer Science and Engineering ( Artificial Intelligence & Data Science)](<https://nitw.ac.in/api/static/files/2_B.Tech_Computer_Science_and_Engineering_(AI&DS)-Curriculum-new-2024-25_2024-7-19-15-41-56.pdf>)       |                    90 |                       0 |
| [Electrical and Electronics Engineering (Electric Mobility)](https://nitw.ac.in/api/static/files/ee_ElectricMobility_2026-8-20-19-32-8.pdf)                                                                               |                    92 |                       0 |

## Explicit source limitations

1. **Unknown credits:** BT1328, BT1438, CS1338, EC1361, and ME1450 lack a confidently associated credit value in the supplied tables/definitions. Their SQL credits are NULL and the frontend says “Credits not specified.”
2. **Printed zero credits:** CH1326, CH1338, CH1339, CH1340, and CH1429 explicitly print `(0)` in their detailed headers, despite three-hour L-T-P entries. The original zero is retained and flagged here; no replacement value is invented.
3. **Source disagreements:** the report records 15 title/credit discrepancies across documents (some are harmless wording differences). The first central-index occurrence is the canonical row; alternatives and URLs are retained. Codes such as MM1213, MA1163, and CS1208 have materially different published titles, and MA1264 has different credits. The chosen source is available from each course profile.
4. **Excluded activities:** IC1101/IC1102 EAA sports/yoga activities have no owning academic department in the official index. Their 22 appearances are listed as exclusions; they are not imported as academic professor-review courses. Uncoded elective slots and `XX` placeholders are not actual named course records.
5. **Unspecified semesters:** elective/definition entries without a clearly attached semester say “Not specified.” A shared course may appear in different semesters across programs; the current simple catalog uses one canonical row per code rather than modeling every program/cohort.
6. **Two roster-only identities:** Prof. Bidyadhar Subudhi links outside the official ERP, and Prof. K. Rajeswar Rao has no ERP profile link. They retain their department-roster provenance.

These limitations originate in the published sources or the current one-row-per-code catalog model. The importer does not claim that inconsistent official documents can be made authoritative through scraping alone.

## Reviewed name variations

Names remain as printed on the department roster. The following roster-linked ERP variations were checked; exact source URLs and pairs are retained so future changes do not silently inherit a previous review.

| Roster name                                                                                  | Linked ERP profile name          |
| -------------------------------------------------------------------------------------------- | -------------------------------- |
| [Prof. Onkara Perumal. P](https://erp.nitw.ac.in/ext/profile/bt-popomal)                     | Prof. O Perumal                  |
| [Prof. A. Vamsi Krishna Reddy](https://erp.nitw.ac.in/ext/profile/ch-vamsianyam)             | Prof. Anyam Vamsikrishna Reddy   |
| [Prof. Vidyasagar Shilapuram](https://erp.nitw.ac.in/ext/profile/ch-vidyasagars)             | Prof. S Vidya Sagar              |
| [Prof. V. Rajeshkumar](https://erp.nitw.ac.in/ext/profile/cy-rajeshv)                        | Prof. Venkatachalam Rajesh Kumar |
| [Prof. Rathish Kumar Pancharathi](https://erp.nitw.ac.in/ext/profile/ce-rateeshp)            | Prof. P Ratish Kumar             |
| [Prof. S. Anitha Priyadharshani](https://erp.nitw.ac.in/ext/profile/ce-priyadharshanianitha) | Prof. S Anitha Priyadarshani     |
| [Prof. R. B. V. Subramaanyam](https://erp.nitw.ac.in/ext/profile/cs-rbvs66)                  | Prof. R B V Subrahmanyam         |
| [Prof. Madhavi Reddy Kesari](https://erp.nitw.ac.in/ext/profile/hs-madhavik24)               | Prof. K Madhavi                  |
| [Prof. Karneddi Harish](https://erp.nitw.ac.in/ext/profile/ee-hkarneddi)                     | Prof. Karneedi Harish            |
| [Prof. Vishwanathan N](https://erp.nitw.ac.in/ext/profile/ee-nvn)                            | Prof. N Viswanathan              |
| [Prof. Ch. V. Rama Rao](https://erp.nitw.ac.in/ext/profile/ec-chvramarao)                    | Prof. Chevula Venkata Rama Rao   |
| [Prof. Ramya Devi Bommanaboina](https://erp.nitw.ac.in/ext/profile/hs-ramyadevi)             | Prof. Ramya Devi Bommanabiona    |
| [Prof. Francis Sudhakar](https://erp.nitw.ac.in/ext/profile/sm-kfsudhakar)                   | Prof. K Francis Sudhakar         |
| [Prof. P. Muthu](https://erp.nitw.ac.in/ext/profile/ma-pm)                                   | Prof. Muthu Poosan Moopanar      |
| [Prof. Sreenivasa Rao Y](https://erp.nitw.ac.in/ext/profile/ma-ysr)                          | Prof. Y Sreenivasarao            |
| [Prof. Bangarubabu Popuri](https://erp.nitw.ac.in/ext/profile/me-bangaru)                    | Prof. P. Bangaru Babu            |
| [Prof. Chandramohan V. P.](https://erp.nitw.ac.in/ext/profile/me-vpcm80)                     | Prof. V P Chandra Mohan          |
| [Prof. Surya Prakash Rao Ch](https://erp.nitw.ac.in/ext/profile/me-cspr)                     | Prof. Ch S Prakasha Rao          |
| [Prof. K Uday Kumar](https://erp.nitw.ac.in/ext/profile/ph-kanapuram.udaykumar)              | Prof. Udaykumar Khanapuram       |

## Reproduce or update

```sh
npx playwright install chromium
# pdftotext must also be installed (Poppler).
npm run catalog:collect
npm run catalog:sync
```

Collection writes `shared/nitwCatalog.json` and [NITW_IMPORT_REPORT.json](NITW_IMPORT_REPORT.json). Raw HTML/PDFs stay in ignored `.local/nitw/`. Sync saves a private catalog backup, runs schema upgrades, and upserts in one transaction. It preserves account/review data, stable IDs, manual catalog records, and existing manual assignments. Initial `db:seed` uses the same snapshot without overwriting edited records.

A network/extraction failure aborts collection before replacing the checked-in snapshot. Missing code/title or unknown department mappings are surfaced. A source disagreement is reported instead of automatically inventing a corrected course or teaching link. Optional `--cached` is for parser/debug work, not a claim that cached profiles were freshly fetched.
