# Prototype Demo Implementation Plan

**Goal:** Deliver the seven approved prototype improvements with no deployment.
**Architecture:** Preserve the existing booking/payment state machine. A loopback-only demo profile uses its own ephemeral MongoDB, synthetic QR/slips and clearly labelled UI. Normal operation keeps its existing configuration. Execute inline in the current checkout, preserving unrelated untracked artifacts.
**Tech Stack:** Express, MongoDB/Mongoose, Next.js/React, Playwright.

- [x] Demo profile: validate isolated configuration; seed three roles, merchant shops and representative bookings; provide launcher and authenticated reset command.
- [x] Payments: generic non-bank QR and generated demo evidence reuse ownership, expiry, review, rejection and confirmation rules. Display simulation labels on customer and manager screens.
- [x] Fonts: bundle cached Noto Sans Thai subsets with OFL licence; use next/font/local and verify offline build.
- [x] UX: separate booking/shop discovery entrypoints; describe booking steps; group admin navigation and default to work queue, preserving URL and unsaved-form handling.
- [x] Resilience: bounded requests including response bodies, cancellation and retry without losing form state. Do not automatically retry writes.
- [x] Verification: focused config/payment/reset and timeout checks, existing suites, desktop/mobile real-API booking flow including rejection/resubmission and competing hold.
- [x] Documentation: demo startup/reset/accounts, limitations and verification evidence.

Acceptance: demo can run from one command on 127.0.0.1:3001/4001, reset only its own DB, finish a booking with no real payment configuration, and display meaningful recovery when API requests time out. Fonts require no network during build. No deployment or external bank calls.
