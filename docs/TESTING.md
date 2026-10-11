# Verification record — 2026-10-11

## Phase 1 and Phase 2

- Backend: pnpm build passed.
- Backend: pnpm test passed 37 tests, 0 failed (16 authentication, 10 public catalog, 11 manager administration).
- Frontend: pnpm lint and pnpm build passed with routes /, /register, /login, /profile, /admin and /shops/[id].
- git diff --check passed. backend/.env, frontend/.env.local and .data/mongodb are ignored and excluded from commits.

API tests create isolated MongoMemoryServer databases. Coverage includes authentication/session revocation, role checks, input validation, concurrent email registration, all catalog CRUD operations, foreign references, duplicate grid positions/codes, optimistic concurrency, inactive visibility, zone deactivation/reactivation and idempotent seeds. A browser-discovered empty-description/database mismatch was fixed and added as an API regression test.

## Browser checks actually performed

Browser plugin not available. Used installed Chrome with bundled Playwright. The manager mutation workflow used a separate zonify_browser_phase2 database, removed only after QA. User-facing zonify data was preserved.

- Desktop 1440×1000 and mobile 390×844.
- Anonymous /admin redirected to login; customer received denied access.
- Manager login → create market/category/zone/stall/shop → edit stall price and position → search saved shop on public page → edit floor plan → deactivate zone → its stall becomes unavailable → refresh preserves authentication.
- Manager cannot see account-delete controls; owner sees them, with self-deletion disabled.
- Keyboard focus moved from stall code to row field with Tab.
- Mobile document had no horizontal page overflow; tables and floor plans scroll within their own regions.
- Screenshots of desktop lists/floor editor and mobile lists/forms were inspected.
- No browser runtime errors in the completed workflow.
- Final production build: manager login using environment-seeded credentials → admin → floor → mobile → logout passed with no console errors or warnings. Next.js smooth-scroll annotation was added to resolve the observed navigation warning.

Earlier Phase 1 browser checks passed registration → login → refresh → profile edit → password change → login again → logout, public search/filter/pagination, details/deep links, live availability polling and failed-load/retry behavior.

## Persistence check actually performed

Native MongoDB on 127.0.0.1:27017, data directory D:\zonify\.data\mongodb. Took an ordered-content SHA-256 snapshot excluding password hashes, restarted only this workspace MongoDB, and confirmed identical content afterwards:
3 users, 3 markets, 4 categories, 11 zones, 66 stalls, 13 shops and 14 sample daily-state records.

The live preview now uses the persistent zonify database, backend port 4000 and frontend production build port 3000. Local secrets remain only in ignored environment files.

## Remaining verification

Docker runtime, HTTPS cookie behavior through a real HTTPS proxy, backup/restore and final delivery checks remain for Phase 6. Human UAT and acceptance have not occurred and are not represented by automated tests.


## Phase 3

Backend build passed. The full API suite passed 48 tests (37 previous + 11 bookings). The booking suite was rerun after the strict hold-query change and passed all 11 tests. Coverage includes one stall/day, 20 simultaneous distinct buyers with one winner, idempotent retries without repricing or extending expiry, stored-price confirmation, customer ownership, manager hold release, worker expiry, expiry/reacquisition, sample/disabled availability and stale operations not affecting a successor. Public floor-plan reads include these authoritative reservations. Swagger documents all nine booking/hold endpoints.

Frontend lint and production build passed, including /bookings and /bookings/[id]. Installed Chrome with Playwright was used because the Browser plugin is not available. The completed workflow used an isolated zonify_browser_phase3 database, desktop 1440×1000 and mobile 390×844:

- Guest registration/login preserved selected market/stall/date and returned to the floor plan; external login redirect was rejected.
- Hold → reload → confirm to pending payment displayed the correct price and numeric countdown. Pending payment is explicitly unpaid; payment collection belongs to Phase 4.
- A second account using a stale floor plan received a visible 409 conflict. It could not read the first account's booking or use its controls.
- Manager filters/cancellation and hold release preserved reasons and returned the stall to public availability.
- Expired holds lost confirmation controls and kept their history.
- Mobile keyboard confirmation, customer cancellation, history/status filters, and pagination after cancelling the sole item on the last page passed. No document-level horizontal overflow.
- Injected 503 hid stale booking details; retry restored the current record. Customer access to /admin was denied.
- No unhandled runtime errors or console warnings. Expected 404/409 and injected 503 responses were exercised deliberately. Desktop/mobile screenshots were visually inspected.

Repeated QA runs reached the configured login rate limit; a fresh isolated backend was started and the final complete browser run passed without weakening the limiter. QA never wrote bookings to the persistent user database. The local preview was restored to the native persistent zonify database after QA.

## Phase 4

- Backend build passed; full isolated API suite passed 57 tests, zero failures (48 previous + 9 payments).
- Frontend lint and production build passed after fixing browser-discovered validation/notice issues.
- QR tests independently parsed Thai account/currency/amount tags and recalculated CRC-16. QR data URLs contain PNG images, price uses the booking snapshot, recipient stays fixed after initial issuance, and repeat issuance does not extend expiry. Missing/malformed recipient configuration returns 503 safely.
- Upload tests exercised ownership/Origin, PNG/JPEG signatures and full decode, MIME mismatch, malformed multipart, invalid fields/references/precision, damaged images and 5 MB limits. Images are reencoded as JPEG, stored privately, and no binary/hash/password leaks into booking JSON. Only the customer owning that booking or a manager/owner can read an image.
- Concurrent uploads produced one accepted attempt and one retained image. Review does not expire a reserved slot automatically. Approve/reject races have one winning transition; old-attempt reviews cannot approve new evidence. Wrong amount cannot be approved.
- Concurrent approvals of different bookings using one transaction reference have one winner. Unique reference and image indexes prevent reusing accepted evidence even after paid cancellation. Cancellation creates a pending refund, and manual refund recording is authorized/idempotent with a retained reference.

Browser plugin not available; installed Chrome with Playwright used isolated zonify_browser_phase4, desktop 1440×1000 and mobile 390×844. The completed flow was hold → confirm → QR → invalid file/future-time field errors → keyboard upload → reload → manager image/rejection → customer correction/upload → manager approval → customer confirmed state → paid cancellation → pending refund → manager refund record → customer refunded state. Cross-account private-image reads returned 404. No horizontal page overflow, blank page, framework overlay, unhandled runtime errors or console warnings in the final completed flow. Desktop review and mobile QR/review/refund screenshots were inspected.

Browser QA found Chrome's HTML pattern uses Unicode v-mode and required changing the reference pattern; a stale customer submission notice after approval was also fixed by tying notices to the resulting status. Final workflow passed after both fixes.

Automated checks used an explicitly synthetic PromptPay account and synthetic slip images. No funds were transferred; no bank app scan, live bank integration or actual bank verification is claimed. The persistent local environment has no receiving account configured; the operator must set PROMPTPAY_ID/PROMPTPAY_NAME and verify them before collecting real payments. Local preview was restored to persistent zonify after QA; payment evidence is included in MongoDB backups.

## Phase 5

Backend build passed. Full isolated API suite passed 66 tests, zero failures (57 previous + 9 advertisements/reports). Frontend lint and production build passed.

- Advertisements: role/Origin checks, actual calendar dates, inclusive Bangkok display boundaries, market/shop/category visibility, foreign references, immutable market IDs, version races, soft deactivation and seeds preserving edited/disabled records.
- Reports: current database roles, manager denied owner finance JSON/CSV, booking-date/status grouping, expired hold cleanup, price snapshots, exact cent totals, payment/refund dates independent from booking dates, Thai midnight boundaries, negative daily net, monthly/market grouping and outstanding refunds from all dates.
- Dashboard matches public visibility and floor counts; unpaid bookings do not become received revenue. Invalid/overlong ranges return 400. Empty reports have zero totals. Private aggregate JSON/CSV contain no contact details, hashes or slip data. CSV protects formula-like strings while keeping legitimate negative numeric values numeric.

Installed Chrome with Playwright used isolated zonify_browser_phase5. Desktop 1440×1000 and mobile 390×844 passed keyboard advertisement creation → public card/shop deep link → edit → mobile display → deactivation. Dashboard filters and totals passed; an injected 503 hid stale results and retry restored them. Manager booking CSV actually downloaded, finance controls were absent and direct finance calls returned 403. Owner selected monthly financial reports by keyboard and downloaded the expected CSV; customer report calls returned 403. Final workflow had no document overflow, framework overlay, unhandled runtime errors or console warnings. Desktop dashboard/public ads and mobile ads/owner-report screenshots were visually inspected.

QA found that image preloading issued an unused-preload warning after resizing from desktop to mobile. The hero now uses eager loading with high fetch priority; the final browser run passed. Summary-tab navigation also clears unrelated catalog success notices. Synthetic received/refund records were confined to the isolated QA database; no money moved and no customer database financial history was seeded.
