# Service Link validation

Validated on 25 October 2026 with Node 24.22.1. No hosted system, real account, payment or message was used. Screenshot content is fictional demonstration data.

| Check | Result |
| --- | --- |
| `npm ci` | Clean dependency install succeeds |
| `npm run lint` | TypeScript passes |
| `npm run build` | TypeScript + Vite production build pass |
| `npm test` | 31 passing domain/database tests |
| `npm run test:browser` | 52 assertions pass across 390px, 420px and 1440px |
| `npm run test:booking-browser` | 54 assertions pass across the same viewports |
| `npm run test:banner-browser` | 111 banner assertions pass across the same viewports |
| `npm run test:social-gallery-browser` | 158 social/gallery assertions pass across the same viewports |
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

## Optional banners

The banner increment adds three domain tests for legacy defaults, draft/public image and focus separation, removal and format/position validation. Embedded Postgres verifies legacy snapshots, the combined payload ceiling, invalid image URLs/types/sizes/positions, unknown-key rejection, and draft/snapshot mismatch denial with the additive banner migration installed. Existing ownership/privacy/atomicity and booking SQL tests continue to pass.

The dedicated browser flow checks all five category icons, unsupported MIME, corrupt and oversized uploads, real PNG-to-WebP re-encoding/resizing/size cap, the 8:3 display ratio, position changes, save/reload, preview/public parity, marketplace images, explicit publication/removal, repeated upload of the same file, unpublish and mobile overflow. All 217 browser assertions (52 profile + 54 booking + 111 banner) pass at 390px, 420px and 1440px. Screenshots use a generated fictional banner, with no external assets or personal data.

- [390px banner editor](qa/banners/banner-editor-390.png)
- [Desktop banner editor](qa/banners/banner-editor-1440.png)
- [390px custom public banner](qa/banners/public-banner-390.png)
- [Desktop custom public banner](qa/banners/public-banner-1440.png)
- [Tutor service template](qa/banners/tutor-template-420.png)
- [Marketplace banner](qa/banners/marketplace-banner.png)

Hosted banner storage, staging migration and hosted advisors remain pending the independent Service Link integration; the local demonstration is the verified runtime.

## Social links and eight-picture gallery

Four new domain tests cover matching-platform HTTPS URLs, hostile schemes/hosts/credentials, zero/eight/nine-picture and caption/media limits, ordering, legacy defaults, public metadata allowlisting, persistence, snapshot isolation and removal. Embedded Postgres also rejects invalid social URLs, unknown/private object keys, duplicate IDs, a ninth picture, oversized/non-WebP media and long captions while accepting a complete bounded portrait/banner/eight-picture payload. All **31 domain/database tests** pass.

**158 new browser assertions** verify social link validation/attributes and persistence, disabled preview links, rejected ninth-file/SVG/corrupt batches, real resize/compression of eight PNG uploads, unfinished-upload save protection, captions and first-two ordering, reload, public publication, two thumbnails, eight-picture popup, noninteractive images with no individual views/tabs, Escape/button/backdrop closing, scroll restoration, focus return, removals, hidden empty sections and unpublish. No real social link was visited and no external request was permitted.

Together with the profile (52), booking (54) and banner (111) suites, **375 browser assertions** pass at 390px, 420px and 1440px. The main flow and popup were visually reviewed on mobile and desktop. All images and account links in evidence are fictional test fixtures. Native modal behavior is tested in Chromium; physical phones and Safari remain outside this local validation.

- [Mobile social icons and gallery preview](qa/social-gallery/public-390.png)
- [390px gallery popup](qa/social-gallery/gallery-modal-390.png)
- [420px gallery popup](qa/social-gallery/gallery-modal-420.png)
- [Desktop popup](qa/social-gallery/gallery-modal-1440.png)
- [Mobile gallery editor](qa/social-gallery/editor-390.png)
- [Desktop gallery editor](qa/social-gallery/editor-1440.png)

The migration and hosted-media limits are detailed in [INTEGRATION.md](INTEGRATION.md). Hosted storage remains unconfigured and no external infrastructure was changed.
