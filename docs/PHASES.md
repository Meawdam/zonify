# Zonify implementation phases

These are delivery subdivisions of Phase I in Project plan.xlsx, not changes to workbook dates or status.

| Phase | Workbook scope | State |
| --- | --- | --- |
| 1 | rs001–rs004: authentication, profile, public floor plan, shop directory | Completed and pushed in 9dc9538 |
| 2 | rs009–rs011, rs015: persistent local database, manager master data, floor plan, stalls, shop directory | Completed; 37 API tests, production builds, manager browser QA and persistent database restart verified |
| 3 | rs005–rs006, rs012, rs014, booking portion of rs008: daily single-stall booking, concurrent holds, expiry, history, manager booking control | Pending |
| 4 | rs007, rs013, payment portion of rs008: PromptPay QR, slip uploads, manager review and booking/payment states | Pending |
| 5 | rs016–rs018: advertisements, dashboard, management and owner reports | Pending |
| 6 | Cross-module system testing, concurrency, browser/mobile/keyboard QA, Docker/HTTPS, backups, installation/user/admin manuals and UAT handoff | Pending; Phase 1–2 checks only |

Commit each verified phase before starting the next. Push to the explicitly authorized origin Meawdam/zonify, branch frameeiei. Human UAT acceptance and external deployment cannot be claimed from automated checks; this delivery remains local.
