# Merchant workspace implementation plan

**Goal:** Complete the approved merchant journey: manage multiple owned shops, reserve a stall for a selected shop, pay, follow review and see history.
**Architecture:** Extend the existing customer account and Shop collection, preserving market owner/manager roles and existing booking/payment state machines. Execute inline in the current workspace; do not commit, push or deploy this work without a new request.
**User decision:** Multiple shops per account, confirmed 2026-10-16.

## Constraints and compatibility
- Existing catalog shops have no owner. Add nullable ownerId; never infer ownership from names or contact details. Existing records remain admin-managed.
- A shop belongs to one market, consistent with current catalog. An account can create shops in multiple markets. Market membership is immutable; a booking must use an owned active shop in the stall's market.
- New holds require shopId. Keep old bookings readable with shop=null; their payment/cancellation flow remains available. Preserve shop identity/name snapshot in new bookings so later edits do not rewrite history.
- Customer editing cannot set ownerId, stallId, active or market membership. Admin retains moderation; disabled shops cannot be restored by merchant edits. Public locations must come from confirmed reservations for the selected date, never a merchant's unverified stall claim.
- Existing 10-minute holds, 30-minute payment deadlines, rejection/resubmission and refund rules remain authoritative.
- Private endpoints use session authentication, same-origin mutation checks and no-store. Filter ownership on every read/write; use optimistic version checks to prevent lost edits.
- Shop images are uploaded, decoded/re-encoded with sharp and size-limited, stored separately in MongoDB following existing slip storage patterns. Only approved raster types; no external image fetching.

## Tasks and acceptance
- [x] 1. Merchant shop API and images: add /api/merchant/shops list/create and /:id read/patch plus photo upload/read. Validate active market/category, scoped ownership, contact fields and optimistic version. Test two users, multiple shops, malicious fields, inactive refs, stale edits, malformed/oversized images and public visibility.
- [x] 2. Booking integration: require shopId for new hold HTTP requests; verify ownership/market/activity, preserve snapshot and retry identity. Expose shop in customer/admin booking responses; add shop filter to history. Tests cover cross-user shop IDs, market mismatch, same-shop retry, different-shop retry conflict, slot concurrency and legacy bookings.
- [x] 3. Merchant UI at /merchant: overview with exact server counts and outstanding actions; accessible shop creation/editing and image forms; public shop image/contact display; account navigation and safe login return paths. Keep local draft on errors and warn on dirty navigation.
- [x] 4. Reservation/history UI: select own shop for the current market before hold, link to creation when empty, preserve intended floor URL after creation, show shop on booking/payment/admin views; URL-backed history filters and current/history groups.
- [x] 5. Verification: integration tests for create/edit shop → hold → pay → reject/resubmit → approve; expiry/cancel/concurrency/auth and image tests; frontend lint/typecheck/helpers/build, backend full suite/build; real browser mobile/keyboard/history/network checks and independent review.
- [x] 6. Delivery: update API docs and user/admin guides with compatibility and image backup requirements. Start isolated real-API preview with merchant/admin demo accounts and open it. Report evidence and limitations; no deployment or push.

## Evidence ledger
- Inspected existing catalog, admin CRUD, booking service/routes/schema, payment routes, auth middleware and frontend booking entry point.
- Existing Shop has no ownership, photo or contact fields. Existing Booking links user and stall only. Existing public shops have an admin-assigned stallId.
- Baseline working tree contains unrelated README.md and untracked design/research assets; preserve these.
- Implemented merchant list/create/read/patch with strict fields, server-owned ownerId, version conflicts and same-origin sessions. Added bounded JPEG/PNG upload with decode/re-encode, separate ShopPhoto collection and public moderation-aware image route. Added shopphotos to backup allowlist and startup indexes.
- Implemented required shopId on HTTP hold requests, ownership/market/category checks, immutable booking shop snapshots, same-shop retries and history shop filter. Existing internal service calls without shopId currently retained for legacy tests; revisit to remove test-only compatibility and migrate fixtures to explicit owned shops while testing old records separately.
- TDD evidence: initial merchant tests returned 404; photo test returned 404; hold test accepted missing shop (201). After implementation all five merchant tests pass. Photo regression caught lean BSON Binary being serialized as text; hydrated image document fixes it and sharp decodes downloaded JPEG.
- Latest backend full suite: 76/76 pass, no skips. Backend build passed before final backup/index/test-fixture additions; rerun at next verification.
- Still incomplete: additional wrong-market/inactive-shop and concurrency tests, public photo/contact fields, date-aware confirmed shop locations, exact dashboard aggregates, merchant UI/forms, shop selection in booking UI, history URL filters, API docs and backup image round-trip assertion, browser validation and preview delivery.
- Current running preview is the previous production build; new merchant functionality has NOT been shown or claimed complete. No commits/pushes made.
- Next: implement frontend merchant workspace and booking shop selector using existing shell, usePublicData, fieldAccessibility and unsaved guard. Next local layouts/pages docs read. React/UI/testing skills read; Browser plugin absent, use existing Playwright tooling for QA. Preserve unrelated baseline work.

## Completion audit — 2026-10-17
All six tasks verified; earlier incomplete ledger entries above are historical. Strict shop ownership is now required in the service and HTTP route; old records are tested explicitly rather than created through a test-only compatibility path. Backend build and 81 tests, frontend lint/typecheck/4 tests/webpack production build, real-browser merchant flow, photo backup round-trip and independent re-review passed. Final preview refreshed and merchant page opening requested through Codex. Requirement-to-evidence mapping and limitations: docs/MERCHANT-DELIVERY-2026-10-17.md. No commit/push/deploy performed.
