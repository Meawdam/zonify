# Market operations and in-app notifications

Approved scope: market weekly opening days and dated exceptions; inclusive stall closures; reject closures conflicting with live reservations; actionable admin queues; durable private notifications; integrated API/browser verification. No production deployment or external messaging.

## Implementation ledger

- [x] Calendar API and shared booking/floor availability
- [x] Admin calendar and exact work queues
- [x] Atomic booking outbox and private notification UI
- [x] Integration, concurrency, restart and browser checks
- [x] README, user/admin documentation and final review

Defaults: Asia/Bangkok dates; existing markets open every weekday; exceptions override weekly days; existing active/enabled flags override schedule. Manager and owner retain current scope. Reminder at five minutes, only pending payment with no submitted slip. Poll visible pages every 30 seconds and on return.

Ruling: implement in the existing non-main frameeiei checkout, preserving unrelated untracked material and avoiding changing the user's preview path. No automatic push is part of this implementation request.

Concurrency design: prepare a hidden booking document before registering a hold against an atomic schedule revision. Schedule edits inspect live/preparing bookings then compare-and-swap that same revision. A hold can become visible only after revision registration and only while its preparation remains valid. This preserves standalone MongoDB support without process-local locks or unsafe expiring distributed locks. Public statuses and exclusive active-slot index remain unchanged. Abandoned preparing documents are removed after expiry.

Interfaces: GET/PUT /api/admin/markets/:id/schedule; POST /api/admin/markets/:id/closures; DELETE /api/admin/markets/:id/closures/:closureId; schedule mutations use version. GET /api/admin/work-queue returns paymentReview,pendingPayment,pendingRefund counts. Booking list accepts refund=pending. GET /api/notifications and private read operations.

Delegation: notifications agent owns notification module, embedded event schema/payment hooks and notification UI; admin_ui agent owns calendar/queue UI; root owns scheduling backend, booking integration, public floor and final verification.

Review fixes: final hold/confirmation/slip writes compare expiry to MongoDB $$NOW, preventing queued requests from resurrecting expired claims after closure. Current merchant counts exclude preparing. Calendar conflict links open a new tab so the retained draft does not intercept navigation. Past completed dates do not block prospective weekly changes. Independent scoped re-review found no remaining material issues.

Final smoke on the rebuilt preview also verified immediate notification refresh on visibilitychange and navigation from the confirmed shop location to its selected booked floor-plan stall. Documentation UTF-8/local links and git diff whitespace checks passed. The user subsequently requested upload to GitHub on the existing frameeiei branch. No deployment or real-money operation is part of this delivery.

Verification: final backend full suite 93/93, including cancellation/count regression and backup round-trip of calendars/notifications. Frontend lint/typecheck, six helper tests and webpack production build passed. scripts/operations-browser.mjs passed against real disposable API + background worker in Chrome, at widths360/390/768/1440 with no page errors: shop create, hold, conflicting closure popup, closure range, exception keyboard save, reject/resubmit/approve, notification delivery/read-one/read-all, confirmed public location, queue filters reload/back. Polling listens to both focus and visibilitychange. Browser plugin unavailable; installed Playwright used. Screenshots/result stored outside checkout in the system temp zonify-operations-qa directory. Human UAT, other browsers and real bank transfers not claimed.
