# Service Link validation

Validated on 25 October 2026 with Node 24.22.1. No hosted system, real account, payment or message was used. Screenshot content is fictional demonstration data.

| Check | Result |
| --- | --- |
| `npm ci` | Clean dependency install succeeds |
| `npm run lint` | TypeScript passes |
| `npm run build` | TypeScript + Vite production build pass |
| `npm test` | 24 passing domain/database tests |
| `npm run test:browser` | 52 assertions pass across 390px, 420px and 1440px |
| `npm run test:booking-browser` | 54 assertions pass across the same viewports |
| Browser exceptions | None |
| External browser requests | None; test intercepts and rejects them |
| Page horizontal overflow | None on tested workspace/public flows |
| `npm audit --omit=dev` | 0 production dependency vulnerabilities reported at validation time |
| Public-target review | Only reviewed app files, fictional data, sanitized config, source/license records and screenshots included |
| `git diff --check` | Passes |

## Behaviors exercised

Domain tests cover nationwide ID uniqueness and matching, multi-state/whole-state coverage, invalid cross-state subdivisions, publish completeness, quotes versus invalid prices, public field allowlisting, hidden WhatsApp removal, independent draft/public snapshots, storage persistence/failure, concurrent/stale revision writes, slug replacement, unpublish, safe return destinations, recovery grants and callback deduplication.

Embedded Postgres tests apply the complete SQL to a fresh in-memory database and exercise anonymous draft denial, owner-only writes, cross-owner denial, canonical geography seed parity, public column grants, slug collisions/transaction rollback, malformed/unknown public fields, invalid geography, stale revisions, draft/public isolation, slug replacement and unpublish with draft preservation. Authentication roles and `auth.uid()` are test stubs; this does not verify the hosted Supabase Auth/PostgREST service.

Browser tests use a fresh context per viewport. They exercise the protected entry, fictional demo access, live editor, save/reload, add/delete/edit services, multi-state coverage, invalid publish feedback, publication, public snapshot isolation during draft saves, whole-state-to-district search, excluded coverage, comparison, slug retirement and unpublish. The desktop live preview uses the same React component as the public route. The full preview route is available on mobile, where the side preview is hidden to keep editing focused.

The milestone-2 booking scenarios and migration checks are documented in [MILESTONE_2.md](MILESTONE_2.md). The combined checks above were rerun for the visual refresh.

## Visual evidence

The 25 October visual refresh uses ivory surfaces, peach heroes, mint/lavender accents and one shared category-icon component for the five launch services. Primary actions retain the SL logo blue. Preview/public rendering stays shared, with all three provider themes using the same softer palette. Decorative icons are hidden from assistive technology; reduced-motion preferences are respected.

Inspected rendered screenshots for desktop overview/editor/public profile/search/comparison and mobile access/overview/profile/editor/coverage/booking/payment. Text sizing and contrast were adjusted after the first render. All final screenshots are reproducible through the browser test.

- [390px workspace](qa/mobile-overview-390.png)
- [420px demo access](qa/mobile-access-420.png)
- [390px customer payment](qa/m2/mobile-payment-390.png)
- [420px provider booking inbox](qa/m2/mobile-bookings-420.png)
- [Desktop workspace](qa/desktop-overview.png)
- [Desktop editor with live preview](qa/desktop-editor.png)
- [Desktop public profile](qa/desktop-public.png)
- [Desktop marketplace and comparison](qa/desktop-marketplace.png)
- [390px editor](qa/mobile-editor-390.png)
- [390px public profile](qa/mobile-public-390.png)
- [420px public profile](qa/mobile-public-420.png)
- [420px multi-state coverage](qa/mobile-coverage-420.png)

The environment's normal Playwright browser download returned truncated archives. Validation used an existing Chromium distribution extracted into task scratch instead; the repository accepts any installed Chromium through `CHROMIUM_EXECUTABLE_PATH`. No binary is committed. Tests run headless Chromium, not a physical phone or Safari.

## Honest limits

A new SL Supabase project, Auth email settings/redirects and R2 integration are not available/configured. Cloud repository methods are type-checked; migration behavior is tested in embedded Postgres. Hosted signup/recovery, actual cloud data persistence, Supabase advisors and R2 authorization/upload require staging verification. Static Cloudflare configuration is prepared but undeployed. Pricing copy is present; no billing/trial enforcement or real payments are active. Availability, booking and manual-payment status are a local demonstration only; cloud booking explicitly remains unavailable until its independent backend is integrated. Refer Me and actual review rules remain future milestones. This visual refresh adds no hosted configuration or new backend capability.
