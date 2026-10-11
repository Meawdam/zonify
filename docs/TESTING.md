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

Booking, payments, ads and reports are not implemented yet and have no completed verification. Docker runtime, HTTPS cookie behavior through a real HTTPS proxy, backup/restore and full system concurrency checks remain for the later delivery phase. Human UAT and acceptance have not occurred and are not represented by automated tests.
