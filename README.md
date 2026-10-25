# Service Link

A Digital Sambal product for independent service providers across Malaysia.

**Milestones 1 and 2 provide a working local demonstration**, with a separate Supabase adapter and SQL migration prepared for review. No Service Link cloud project, Worker, R2 bucket, production deployment or payment connection has been created.

## Run and review

Requires Node 22.18+ (validated on Node 24.22.1).

```sh
cd app
npm ci
npm run dev -- --host 127.0.0.1 --port 5178
```

Open `http://127.0.0.1:5178/login` and choose **Explore the demo**. No credentials are required. The default is local mode; there are no real account, billing or message requests.

1. Edit **My profile**, including category, optional public WhatsApp, theme, photo, banner, social links and work gallery.
2. Add/edit/delete **Services** and choose **Coverage** in one or more states.
3. **Save draft**, then reload to check persistence.
4. **Preview & publish** shows the same profile renderer used at `/p/:slug`. Publication validates required fields.
5. Open the published profile. Further draft saves leave that public snapshot unchanged.
6. Publish updates to replace the snapshot. Changing the slug retires its old URL. **Unpublish** removes the public snapshot and keeps the saved draft.
7. `/marketplace` finds published profiles by category, services and coverage. Compare up to three in the same category.

**Local publication is only visible in the same browser/device. Copying its URL does not share the stored profile with another person.** The demo stores a fictional provider, drafts and compressed photos in browser storage. Clearing site data removes them. No AL records are used.

## What this milestone includes

- SL branding, warm ivory/pastel surfaces, service-category icons, responsive workspace navigation, checklist and locked pricing copy.
- AL-derived account login, callback, recovery and password setup; SL signup entry point.
- Editable provider profile and service catalogue for the five initial categories.
- Shared geography: 16 states/territories and 160 DOSM district/territory entries; whole-state, selected-district and multi-state coverage.
- Shared live preview/public presentation; consent-controlled WhatsApp display.
- Durable local drafts, public snapshots, validation, revision conflicts, atomic cloud publication design.
- Basic published-profile search and comparison as a foundation for later eligibility/availability filters.
- Client-side photo resizing, re-encoding and compression in local demo mode.

## Validation

```sh
cd app
npm run lint
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

If Chromium is already installed, use `CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chromium npm run test:browser`. The browser test starts and stops its own local server, blocks external requests, and writes fictional-data screenshots to `docs/qa/`.

See [validation evidence](docs/VALIDATION.md), [source assessment](docs/SOURCE_ASSESSMENT.md), [integration setup](docs/INTEGRATION.md) and [next milestone](docs/NEXT_MILESTONE.md). The [product handover](ServiceLink_MVP_Development_Handover.md) remains the product source of truth.

## Independent backend

For a new SL Supabase project, use `app/.env.example` and the reviewed migration under `supabase/migrations/`. Set `VITE_DATA_BACKEND=supabase`, its own HTTPS project URL, publishable key and matching `VITE_SL_PROJECT_REF`. Cloud misconfiguration fails visibly and never silently switches to demo storage. The cloud adapter is type-checked and the SQL is exercised in embedded Postgres; hosted Auth and end-to-end cloud persistence still require the new project and verification.

Billing, gateway payments, Refer Me and customer reviews are not activated. Booking/manual-payment simulation is available in local demo mode only. The displayed 14-day trial is the agreed offer; no trial is claimed to have started. No production, paid service, real payment or external message is authorized by this code.

## Milestone 2 update

The local demonstration now includes **Availability** and **Bookings**, service-level appointment/date-range requests, shared capacity, private customer booking links, provider acceptance with amount/deadline, QR/bank instructions, customer payment reporting and explicit provider verification. Phone/WhatsApp bookings and blocked time share the same calendar. See [the full milestone-2 walkthrough and backend limits](docs/MILESTONE_2.md).

Booking records are local-demo data until the independent booking backend is integrated. Cloud mode intentionally keeps booking unavailable. The new booking migration is prepared and tested, not hosted/applied. No real payment or external message is sent.

## Profile banners

**My profile → Your profile banner** offers an automatic service template or your own image. The template icon follows the selected category: baby (nanny), heart/handshake (confinement), book (tutor), brush (makeup), sparkles (cleaning).

Recommended upload: **1600 × 600 px (8:3)**, JPG/PNG/WebP up to 8 MB and up to 40 megapixels. Images are re-encoded as WebP, resized to a maximum 1600px longest edge, and capped at 220,000 data-URL characters (about 165KB binary). Other proportions are cropped to fit; the vertical-position slider adjusts the visible area. Keep important details near the centre. Marketplace thumbnails may crop further.

Use **Save draft**, then **Publish updates** to change the public banner. Replace/Remove or **Use service template** works the same way. Old profiles retain their content and receive empty-banner/centred defaults. Editor, full preview and public profile share the same cover component; marketplace cards use the published image/position.

Uploads work in local demonstration mode. Hosted uploads remain disabled pending the independent SL R2 integration. The additive `20261025095911_sl_profile_banner.sql` migration is prepared for review only; it accepts bounded optional banner fields and preserves existing RLS/ownership.

Run `npm run test:banner-browser` in `app/` for compression, category, persistence, publication and viewport checks. [Mobile banner editor](docs/qa/banners/banner-editor-390.png) · [custom public banner](docs/qa/banners/public-banner-390.png).

## Social links and work gallery

In **My profile**, add optional Facebook, Instagram and Threads profile/page URLs. Use full `https://` links for the matching platform; blank links stay hidden. Public icons open a new tab with opener isolation. Live-preview social actions are disabled. Threads `.com` and legacy `.net` links are accepted.

**Your work, in pictures** accepts at most **8 pictures**, individually or in a batch. JPG/PNG/WebP inputs up to 8MB each are re-encoded as WebP, resized to a maximum 1200px longest edge and capped at 120,000 data-URL characters each (about 90KB binary). A failed batch leaves the previous gallery unchanged. Save/publish/discard controls wait while images are being prepared.

Use the arrows to choose the order; the first **2 pictures** appear as profile thumbnails. Optional captions also provide image descriptions. With more than two pictures, **More** opens a responsive popup containing the complete gallery. Pictures have no individual-view, zoom or image-navigation action. The popup can close through its button, Escape or backdrop; background scrolling is locked while open and focus returns on close. A gallery with one/two pictures needs no More button; an empty gallery is hidden.

**Save draft → Publish updates** applies to links, captions, picture order, additions and removals. Existing public snapshots remain unchanged until publication. Legacy profiles get empty social links and an empty gallery. Hosted uploads are still disabled until the independent SL media integration is ready.

Run `npm run test:social-gallery-browser` for the complete flow at 390px, 420px and 1440px. [Mobile profile](docs/qa/social-gallery/public-390.png) · [mobile popup](docs/qa/social-gallery/gallery-modal-390.png) · [desktop popup](docs/qa/social-gallery/gallery-modal-1440.png).
