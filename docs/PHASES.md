# Zonify implementation phases

These are delivery subdivisions of Phase I in Project plan.xlsx, not changes to workbook dates or status.

| Phase | Workbook scope | State |
| --- | --- | --- |
| 1 | rs001–rs004: authentication, profile, public floor plan, shop directory | Completed and pushed in 9dc9538 |
| 2 | rs009–rs011, rs015: persistent local database, manager master data, floor plan, stalls, shop directory | Completed and pushed in 0fc45e0; persistent database restart verified |
| 3 | rs005–rs006, rs012, rs014, booking portion of rs008: daily single-stall booking, concurrent holds, expiry, history, manager booking control | Completed and pushed in b6067dd; 48 API tests and browser QA passed |
| 4 | rs007, rs013, payment portion of rs008: PromptPay QR, slip uploads, manager review and booking/payment states | Completed and pushed in 2d14a88/061d234; 57 API tests and payment/refund browser QA passed |
| 5 | rs016–rs018: advertisements, dashboard, management and owner reports | Completed and pushed in 94796eb; 66 API tests, builds and desktop/mobile/keyboard browser QA passed |
| 6 | Cross-module system testing, concurrency, browser/mobile/keyboard QA, Docker/HTTPS, backups, installation/user/admin manuals and UAT handoff | Completed; 71 API tests, builds, HTTP/HTTPS browser QA, full Docker stack and restart, native backup/restore passed; manuals and unsigned UAT checklist delivered |

Commit each verified phase before starting the next. Push to the explicitly authorized origin Meawdam/zonify, branch frameeiei. Human UAT acceptance and external deployment cannot be claimed from automated checks; this delivery remains local.
