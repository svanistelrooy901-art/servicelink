# Service Link — MVP development handover

Prepared for Mamu (Mohd Safwan), Digital Sambal, on 25 October 2026, Malaysia time.

## 1. Purpose and current status

The product brainstorm is complete at the feature level. Mamu has created the GitHub repository **svanistelrooy901-art/servicelink** and will start a new Work chat for development. This document carries the decisions into that chat.

**No Service Link application code, deployment, database, gateway connection or hosting subscription was created or changed during this brainstorm.** On 25 October 2026, the owner reported repository creation and explicitly requested this Markdown handover be pushed. Repository metadata and write access were verified; the repository was empty before this documentation commit, with `main` as the default branch. No root AGENTS.md existed in that empty repository.

Target repository: https://github.com/svanistelrooy901-art/servicelink . Its visibility was **public** when checked. AdvisorLink is private. This handover publishes planning documentation only, without private source code, credentials or user data. Consider the target's visibility when planning any later source port, and do not change repository visibility as part of routine setup without an owner instruction.

Use AdvisorLink as a source-code backbone, with an independent Service Link repository and backend/deployment resources. The original attached `Service_Link_Work_Handover.md` supplied the source-review guidance; the essential instructions are repeated here so this note can stand alone.

Distinguish the confirmed decisions below from suggested implementation defaults and unresolved rules. The latter are not extra approved requirements.

## 2. Product and audience — confirmed

**Service Link is a service-provider profile, booking and discovery SaaS for freelancers and individual service providers.**

Initial focus categories:
- Private nanny.
- Confinement lady.
- Private tutor.
- Makeup artist.
- Cleaning service.

The product is open to **all Malaysia**. It is not restricted to Penang.

Two main customer journeys:
1. Open a freelancer's shared profile link, examine services and credibility, then book.
2. Find providers through the marketplace, filter by service and coverage, compare providers, then open a profile and book.

A provider's profile and marketplace listing should use the same underlying service, coverage and credibility data.

## 3. Commercial model — latest confirmed decision

There is **one Service Link version with all MVP features**.

| Billing choice | Price |
| --- | --- |
| Monthly | **RM9.90 per month**, paid monthly |
| Annual, first year | **RM49**, paid for the first 12 months |
| Annual renewal | **RM99 per year**, starting with the second annual year |
| Free trial | **14 days** |

The introductory annual price is RM49, not RM49.90. Show both the first-year price and the RM99 annual renewal price clearly before purchase.

**This replaces the earlier brainstorm proposals of RM49.90 lifetime, and lifetime plus an RM9.90 gateway add-on.** Do not implement those superseded offers.

Payment-gateway functionality is included in the single plan, but using or connecting a gateway is optional. A freelancer can operate through QR/manual payment alone and connect an available supported gateway later without buying a different Service Link tier.

Gateway transaction charges are separate from the SL membership price. The selected gateway, merchant arrangement and who bears charges still need to be decided.

Not yet decided:
- Whether membership renewal is automatic or requires a new payment.
- Eligibility for the RM49 introduction after previously paying monthly.
- Exact trial activation, repeat-trial prevention, cancellation and membership-refund rules.
- Trial marketplace visibility and whether live gateway payments are enabled during a trial.
- Behavior when membership expires, including the period of access for fulfilling existing bookings.

Recommended starting behavior, subject to owner confirmation: no card required for the trial; prevent new bookings after expiry while allowing existing commitments and payment records to be managed. Do not silently abandon already accepted bookings.

## 4. MVP feature scope

### Confirmed product features

| Area | Required behavior |
| --- | --- |
| Provider profile | Adapt AL's editable public profile to freelancer identity, services and credibility |
| Service catalogue | Present offerings and the information needed to choose/book them |
| Availability and booking | Customer can see availability and book/request a suitable service slot |
| Manual payment | Provider QR/bank details, WhatsApp receipt handoff, provider payment verification in SL |
| Optional online payment | Included gateway connection and customer checkout when the provider enables it |
| Refer Me | Customer can share provider information and a profile link through WhatsApp; a referral-related counter is wanted |
| Stars and reviews | Google Business-style ratings and testimony/review presentation |
| Marketplace | Search and browse eligible published provider accounts by service and coverage |
| Compare | Compare service providers from marketplace results |
| Coverage | Shared state and district/zone choices in provider setup and marketplace filters |

### Inherited backbone to preserve and adapt

Use the working AL implementations where practical:
- Authentication, account recovery and owner access patterns.
- Provider profile builder, service cards, images and credibility sections.
- Appearance/theme controls and supported section settings.
- Matching live preview and public rendering; draft/published separation.
- Publish/unpublish, public profile URL, genuine QR and sharing.
- Contact/WhatsApp actions and enquiry patterns.

The handover describes AL's architecture; it does not prove every legacy component is production-ready. Review actual source before copying.

### Useful defaults proposed during the brainstorm, not independently confirmed

- Start with one individual provider per account; multi-staff scheduling is outside the initial plan unless Mamu changes it.
- Guest booking without a mandatory customer account.
- Compare up to three providers in the same category.
- Shortlist providers.
- Show service duration, inclusions, location, price basis, deposit and balance.
- Provider manual entry of bookings received through WhatsApp/phone, so availability stays accurate.
- Buffer time, booking notice, days off and temporary slot holds.
- Basic dashboard for upcoming/pending bookings, payment verification and status.
- Basic admin tools for listings, reports and review moderation.

Use judgment to implement necessary supporting mechanics for agreed features, but discuss materially different product policies rather than treating every brainstorm suggestion as locked.

Not approved as initial requirements: multi-staff, recurring-booking engines, session-credit packages, waitlists, loyalty, referral cash rewards, native mobile apps, Google Calendar sync, group classes or automatic refunds.

## 5. Geographic coverage — confirmed

Use **one canonical geography list** for both provider coverage and customer marketplace filters.

Structure: **State/Federal Territory → District or Zone**, with district/zone subdivisions where useful, especially for larger states.

Provider choices:
- Entire state/territory, or selected districts/zones.
- Multiple districts/zones.
- Multiple states if they serve across state boundaries.

Marketplace:
- Choose state/territory, then a district/zone from the same list.
- Allow search across the whole selected state.
- A provider covering an entire state matches searches for its subdivisions.
- Match against the provider's service coverage, not only their home/base address.
- Use the same coverage data in comparison.

Exact district/zone taxonomy, canonical IDs and administrative maintenance still need to be defined. Avoid free-text place variants and overlapping zone definitions. Do not publish private customer addresses in marketplace/profile content.

## 6. Booking modes and category differences

Booking and calendar are confirmed. Detailed scheduling semantics remain to be finalized.

Recommended service-level modes:
- **Instant booking** when price, duration, location and availability are sufficiently defined.
- **Request booking** when the provider must assess suitability, location or job scope first.
- **Date-range request** for confinement or care spanning multiple days.

Do not force all five categories into one fixed-hour appointment model. A confinement enquiry with requested dates is not the same as a confirmed multi-day reservation.

For request bookings, a proposed flow is provider acceptance before payment, followed by a time-limited payment opportunity. Decide which states actually reserve capacity and when holds expire.

Important supporting behavior:
- A solo provider's availability must be shared across their services.
- Persist reservations centrally and prevent conflicting bookings, including simultaneous checkouts.
- Keep booking status separate from payment status.
- Make manual bookings and blocked time affect availability.
- Define pending/request/accepted/confirmed/completed/cancelled/no-show states only as needed.
- Define cancellation, rescheduling, provider decline and refund handling before paid public bookings.
- Decide the required customer contact fields. AL's inherited enquiry requires Name and Email, with optional Phone. This is not automatically the right SL booking rule; phone was recommended as important for local services but its required status was not explicitly finalized.

Category information suggested during discussion:

| Category | Example information |
| --- | --- |
| Nanny | Child age range accepted, minimum hours, languages, relevant experience, location of care |
| Confinement lady | Live-in/day care, package length, included duties, requested date range |
| Tutor | Subject, education level, session duration, online/in-person |
| Makeup artist | Occasion, portfolio, studio/home service, travel charges, required ready time |
| Cleaning | Home/job type, hours, number of workers, equipment and materials included |

These are suggested templates, not a finalized questionnaire. Keep setup and booking forms short and relevant.

## 7. Manual and gateway payments — confirmed direction

### Manual QR / transfer

Intended journey:
1. Customer selects a service and date/time, subject to the service's approval flow.
2. SL records a booking/reference and shows the amount due, provider QR and/or bank instructions.
3. Customer pays the provider using their banking/e-wallet application.
4. A button opens WhatsApp with the booking reference and relevant details prefilled.
5. Customer attaches the receipt in WhatsApp and sends it to the freelancer.
6. Freelancer checks money actually received, then marks the payment as verified in SL.

A receipt image or a customer's “I have paid” action is not automatic bank verification. Clearly label provider-verified manual payments.

The discussed low-storage option sends receipt attachments through WhatsApp without also storing copies in SL. Storing receipts inside SL would be an additional storage/privacy decision.

**WhatsApp click-to-chat opens a draft; the customer sends it.** It does not automatically deliver a message when a booking is created and does not attach a receipt automatically. Automatic WhatsApp notifications would require an appropriate integration and a separate cost/consent decision; they are not established by the current scope.

Use temporary reservation expiry where applicable so unpaid bookings cannot block a provider indefinitely. Agree how pending requests affect capacity.

### Optional gateway

- Included in the same SL membership.
- Provider can use manual payment only; gateway setup must not block profile publication, marketplace eligibility or manual booking.
- When enabled, customer pays through the integrated checkout.
- Verify status through the gateway's server-side confirmation; a browser redirect alone must not mark a payment successful.
- Keep payment references, amounts and booking/provider ownership consistent.
- Handle failure, duplicate callbacks, expiry and late success without double-booking or silently losing a payment.
- Do not promise automated refunds or direct-to-provider settlement until the selected gateway supports the agreed merchant model.

The AL gateway code concerns **selling AL membership**. SL needs separate flows for **selling SL membership** and **customers buying freelancer services**. One existing AL merchant integration is not proof that payments to many independent freelancers are supported.

Mamu explicitly noted that some freelancers do not have gateway accounts. Preserve manual QR as a complete usable route. Choose a provider onboarding and merchant/payment arrangement deliberately.

## 8. Refer Me, ratings and discovery

### Refer Me

Confirmed:
- A profile action opens WhatsApp sharing with freelancer information and their profile link.
- Customer selects recipients and sends the message.
- A referral-related public counter is desired and should be visible for marketplace evaluation.

**Counter semantics are unresolved.** A button click does not establish a sent message, recipient count, endorsement or successful referral.

Suggested separation:
- Share-button opens/clicks for activity analytics.
- Explicit customer recommendations, counted under a defined deduplication rule.
- Bookings attributed to referral links, where attribution is observable.

Label counters truthfully. Do not show share attempts as verified customer endorsements or confirmed delivered referrals. Do not carry AL cash referral rewards into SL without a separate instruction.

### Stars and reviews

Confirmed: use a familiar Google Business-style layout.

Suggested behavior:
- Average stars with the number of reviews; dated customer comments and service context.
- Review sorting, provider replies and report/moderation flow.
- Booking-based reviews after completion.
- Separate provider-entered legacy testimonials from booking-linked reviews.
- Show a neutral “New on Service Link” state for providers without reviews.

Rules for former/off-platform customers, review eligibility, duplicate reviews and moderation remain to be finalized. No Google review import/integration has been requested.

Do not equate a paid SL account with identity, background or qualification verification. Only show verification badges that describe checks actually performed.

### Marketplace and comparison

List eligible, published and discoverable provider profiles. Exact treatment of trial/expired accounts still needs agreement.

Common comparison fields proposed:
- Service scope/inclusions and duration.
- Price basis; known travel or extra charges.
- Availability for the selected date.
- Coverage, experience, stars plus review count, clearly defined recommendation count.
- Deposit/payment method and cancellation policy.
- Category-specific information.

A suggested default is a maximum of three providers in the same category, with a mobile-friendly comparison and a clear route to each profile/booking. Do not assume different package durations or inclusions are equivalent just because one headline price is lower.

## 9. Infrastructure findings — planning evidence, not a capacity guarantee

Official pricing was checked during this conversation on 25 October 2026. Recheck before purchases or deployment.

Approximate RM figures used **an assumed USD1 = RM4.50**, not a live exchange-rate quote.

| Component | Free allowance / base | Paid basis |
| --- | --- | --- |
| Cloudflare Workers | 100,000 dynamic requests/day/account; 10 ms CPU/request | USD5/month minimum; 10m requests + 30m CPU-ms/month included; overage USD0.30/m requests and USD0.02/m CPU-ms |
| Direct Workers static assets | Free/unlimited requests, subject to product limits and routing | Routing through a Worker can incur Worker usage |
| Supabase | 500 MB database; 1 GB file storage; separate 5 GB uncached + 5 GB cached egress/month | Pro from USD25/month for one basic Micro project |
| Supabase Pro allowance | — | 8 GB database; 100 GB files; separate 250 GB uncached + 250 GB cached egress |
| Supabase Edge Functions | 500k invocations/month | 2m included, then USD2/m |
| R2 Standard | 10 GB-month, 1m Class A operations, 10m Class B operations/month; free egress | USD0.015/GB-month, USD4.50/m Class A, USD0.36/m Class B beyond allowance |
| Email example: Resend | 3,000/month, max 100/day | Pro USD20/month for 50,000 emails |

Supabase Pro includes USD10/month compute credits, covering one Micro instance. Larger compute or extra projects add cost. Some quotas are pooled across an organization. The two-free-project limit applies across organizations where the account is an owner/admin. Availability in Mamu's actual accounts has not been inspected.

Standalone base scenarios:
- Cloudflare Paid + Supabase Pro Micro: **USD30 ≈ RM135/month**.
- Same with Resend Pro: **USD50 ≈ RM225/month**.
- These exclude domain, taxes, gateway fees, WhatsApp API, higher usage, additional staging compute and labor.

Recommended architecture for evaluation: Cloudflare for app/static assets, Supabase for auth/records, **R2 for compressed public profile/portfolio images**. This is a recommendation from research, not an implementation already performed.

Illustrative assumptions: 2 MB media/provider; each public page transfers 950 KB images + 50 KB data.

| Providers | Monthly page views | Stored media | Monthly transfer if all served from Supabase |
| --- | --- | --- | --- |
| 100 | 5,000 | 0.2 GB | 5 GB |
| 500 | 25,000 | 1 GB | 25 GB |
| 1,000 | 100,000 | 2 GB | 100 GB |

At 500–1,000 providers under those assumptions, Supabase Free media/transfer allowances are exceeded even without a gateway. With images moved to R2, modeled Supabase public-page data transfer becomes 0.25/1.25/5 GB respectively, before booking/dashboard/auth overhead. Database records also accumulate over time.

No statistical exceedance probability can be established without real traffic, payload, cache and query measurements. Counts of registered providers alone do not establish capacity.

Use measured usage and performance to plan upgrades around 70–80% of relevant quotas. A Supabase Spend Cap covers certain usage items, can restrict service at quota, and does not cover all costs such as compute.

Sources:
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/r2/pricing/
- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/manage-your-usage/egress
- https://supabase.com/docs/guides/platform/manage-your-usage/compute
- https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/cost-control
- https://resend.com/pricing
- https://faq.whatsapp.com/5913398998672934
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing

## 10. AdvisorLink source access and baseline

Source: **svanistelrooy901-art/advisorlink**, private repository.
- https://github.com/svanistelrooy901-art/advisorlink
- Clone: https://github.com/svanistelrooy901-art/advisorlink.git

Access was verified in the originating handover chat, **not in this brainstorm**. The new Work chat must verify its own connection and permissions. Never claim to have reviewed/copied source until it has actually been fetched.

Initial read-only sequence:
1. Verify source repository metadata and fetch a complete source file such as `app/package.json`.
2. Discover/read all applicable `AGENTS.md`, including `app/AGENTS.md`.
3. Refresh branch heads and PR status and compare coherent source candidates.
4. Report the selected SHA, reusable modules and material gaps before adapting source.

Historical inspection refs from the original handover, not verified live heads or an approved SL baseline:

| Ref | Previously observed SHA |
| --- | --- |
| main | 33185c2a39c39e8605cad46fe3ad8ef61b21bf89 |
| infra/cloudflare-staging | d16dca5a50525ca0d8180c1b5d6e8681937fa94c |
| feature/basic-v1-toyyibpay-entitlements | c919e8fd3880a780f7ea1df24d7ddd63c679de0e |
| review/basic-v1-launch-hardening-20261024 | 1e99dd242f947891d6e20397c8f42e25aa4d21b9 |
| review/basic-v1-production-cutover-20261025 | 761a17834db27b32e7724fd8324d5817faf3fb8c |

Do not copy an old default branch without comparing later work. The original inspection found dependency differences, including React Router 6 versus 7. Copy a coherent snapshot and lockfile.

Source review map:
- Specs: root `ADVISORLINK_ARCHITECTURE_v1.2.md`, `ADVISORLINK_V1_SCOPE.md`, `ADVISORLINK_DESIGN_SPEC_v1.1.md`.
- Build/dependencies: `app/package.json`, `app/package-lock.json`, `app/vite.config.ts`.
- Routes: `app/src/App.tsx`.
- Shared presentation: `app/src/components/profile/ProfilePresentation.tsx`, sibling profile components.
- Pages: `PublicProfilePage.tsx`, `PreviewPage.tsx`, `ProfileEditorPage.tsx`, `AppearancePage.tsx`, `QRSharingPage.tsx`.
- State: `app/src/hooks/useAppStore.tsx`; dashboard components.
- Data: `app/src/types/index.ts`; repository and Supabase repository modules in `app/src/lib/`.
- Auth: `app/src/hooks/useAuth.tsx`; protected dashboard, callback/recovery code.
- Enquiries: `app/src/lib/publicEnquiry.ts`, `LeadCaptureCard.tsx`, `supabase/functions/basic-enquiry/`, `docs/BASIC_V1_ENQUIRIES.md`.
- Media: profile/company/product-image utilities and related functions.
- Billing reference: `app/src/lib/billing.ts`, `BillingPage.tsx`, `supabase/functions/toyyibpay-*`, relevant docs.
- Schema: `supabase/migrations/`.
- Validation: root `tests/`, `tests/signup/`, `app/tests/`; discover actual commands.
- Hosting: `app/wrangler*.jsonc`, workflows.
- Marketing: separate `sales-page/`, only when SL marketing work requires it.

AL uses React, TypeScript, Vite, Tailwind, Supabase, Lucide and a QR library. Its data abstraction has local and Supabase modes; local mode is not automatically a complete backend/payment sandbox. The inspected package exposed dev/build/preview/lint; lint ran TypeScript checking. Discover current commands instead of assuming `npm test`.

AL Basic's email enquiry flow is not proof of a working CRM inbox. Preview must never send real enquiries or trigger real checkouts.

## 11. Independence and delivery expectations

- Keep AdvisorLink source and infrastructure read-only.
- Develop in the new servicelink repository and working tree.
- Record source SHA and copied modules; preserve licenses/notices.
- Inspect copied scripts, CI and hosting targets before execution.
- Replace branding, app origins, QR/public URLs, browser-storage IDs, callback/email/metadata references.
- Use separate SL backend/deployment resources and test data.
- Never reuse AL users, secrets, storage objects, orders or entitlements.
- Never apply copied migrations to an AL project.
- Copied Wrangler configuration may target the existing AL Worker; change the target before deployment.
- Do not inherit AL's lifetime prices or features from legacy/mock code.
- Do not send customer messages, make purchases, accept real customer payments or deploy merely because a configuration exists. Follow the new chat's explicit owner instruction and scope.

Suggested development sequence:
1. Verify both repositories; inspect source and choose a baseline.
2. Produce a reuse/gap assessment and a short implementation plan. Resolve material booking/payment policies while independent source review continues.
3. Establish an isolated SL project; validate inherited auth/profile/preview/publish journey.
4. Add shared geography and service templates, then marketplace/compare.
5. Build calendar, booking and QR/manual verification flow.
6. Add ratings/Refer Me using agreed measurement rules.
7. Add the included optional gateway and SL membership billing as distinct payment flows.
8. Validate ownership/privacy, booking conflicts, payment integrity, expiry and mobile/desktop behavior.
9. Prepare the release and report remaining dependencies before any production action.

Preserve shared preview/public rendering and AL's mobile attention around 390–420 px. Validate meaningful new behavior; previous AL QA is not evidence that copied SL code works.

## 12. Copy-paste starter for the new Work chat

> We are starting Service Link MVP development under Digital Sambal. Read ServiceLink_MVP_Development_Handover.md in svanistelrooy901-art/servicelink as the product and technical handover.
>
> I own svanistelrooy901-art/advisorlink and the new target repository svanistelrooy901-art/servicelink. Verify access to both. Use my connected GitHub access to review and copy suitable AdvisorLink code, keeping AdvisorLink source and infrastructure read-only. Work in servicelink with separate backend, test data and deployment targets.
>
> First read applicable AGENTS.md files, refresh relevant source branches/PRs, select a coherent source SHA and report the reusable modules, gaps and implementation sequence. Then proceed with local MVP implementation in the new repository, resolving material open product policies with me while continuing independent work.
>
> Locked commercial rules: one plan, all MVP features; 14-day free trial; RM9.90 monthly; RM49 for the first annual year; RM99 annual renewal. Gateway functionality is included and optional. QR/manual payment must work for freelancers without gateway accounts. The lifetime and separate gateway-add-on proposals are superseded.
>
> Scope: service profiles, availability/booking, manual and optional online payment, Refer Me, stars/reviews, marketplace search, provider comparison, and nationwide coverage using the same state/district/zone selections for providers and marketplace customers.
>
> Distinguish confirmed features from suggested defaults in the handover. No production deployment, spending, real customer payment test or external messaging is authorized by this starter alone.

