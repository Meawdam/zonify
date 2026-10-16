# Zonify review fixes implementation plan

**Goal:** Complete the eight review items in `promt.mb`, preserving Thai UI, server booking/payment rules, existing edits, and the current branch. No deployment or remote writes.

**Architecture:** Keep resource data keyed by URL and account scope; retain successful data only for the same resource on transient refresh failures. Use URL-derived view state, explicit Bangkok time parsing, and server-provided initial public data. Split existing admin features without rewriting backend contracts.

**Spec:** User-supplied `C:/Users/Admin/Downloads/promt.mb`, adopted by the user's instruction to proceed. Execute inline; routine implementation choices are authorized by item 6.

**Baseline:** `frameeiei`, `f4c96ec`; existing README/untracked documents/artifacts are user work. Next 16.3.6 package docs inspected for fetch/cache/searchParams/router. Browser plugin not available; use bundled Playwright with isolated fixture API on 4100 and frontend on 3100.

## Review focus
- No previous booking/filter/account data may appear during resource changes or after 401/403.
- Refresh/retry must not unmount slip inputs or discard FileList.
- URL navigation must preserve history and reject unsafe return URLs.
- Transfer time must reject calendar rollover and be device-timezone independent.
- Initial public data must not cause immediate duplicate requests or shared caching of availability/private data.

## Tasks
- [x] 1. Reproduce polling form loss with fixture API; add regression coverage, then fix keyed resource lifecycle and all retaining consumers.
- [x] 2. Verify held → pending_payment → payment_review → confirmed in backend; correct dialog/action copy and show next steps.
- [x] 3. Add validated URL helpers and URL-derived section/filter state, safe shop return links, dirty editor guards; test reload/history.
- [x] 4. Capture mobile baseline; add inline selection summary and shared map/list selection with supported status/zone/price filters. Verify 360/390/768/1440 and enlarged text.
- [x] 5. Link payment hints/errors, focus first invalid field, preserve values; test invalid files/API errors/keyboard.
- [x] 6. Add strict Bangkok-local → ISO parser and tests for invalid dates, day rollover and UTC/Bangkok devices.
- [x] 7. Measure baseline cold/warm loads using identical fixture delay; preload markets/categories/floor on server, cache only reference data, avoid duplicate hydration fetch. Measure again.
- [x] 8. Split catalog/floor/users from admin navigation and bookings/reports; replace arbitrary row index signature, consolidate shared Button/StallPlan styles. Inspect actual chunks before considering lazy imports.
- [x] 9. Run frontend typecheck/lint/build, relevant backend tests/build, regression/browser checks and diff check. Record measured results and limits in Thai.

## Verification
Use existing pnpm scripts; frontend regression runner uses Node assertions and bundled Playwright (no application dependency added). Fixtures never connect to real data or banks. Production builds and browser scripts supply BACKEND_URL explicitly. Browser evidence goes under ignored `.data/brownfield/review-fixes/` per repository workflow. Any test not run is reported as unverified.

## Completion ledger

All eight implementation items and final verification completed. See `docs/REVIEW-FIXES-2026-10-16.md` for reproductions, measured results, review fixes and environment limits. Rulings: preserve the shared current branch/user work; use Webpack because Turbopack CSS workers fail in this environment; use native return navigation after a production-only duplicate-hash reproduction; enter admin through a document boundary for reliable beforeunload fallback. No commits or remote writes were requested/performed.
