# Integration status and architecture

The M3 booking/media transport is ready for review behind disabled flags. **Live staging has not been deployed or verified.** Independent SL project creation hit the account free-project quota; Cloudflare CLI has no authenticated target. No existing project was paused, deleted or upgraded. No hosted resource, migration, payment or message was created. AdvisorLink stayed read-only.

Use [STAGING_SETUP.md](STAGING_SETUP.md) for the current configuration sequence and [MILESTONE_3.md](MILESTONE_3.md) for exact behavior, tests and limitations. Earlier milestone documents describe their historical state.

## Cloudflare

`app/wrangler.jsonc` defines the independent `servicelink-staging` Worker with static Vite assets. API/private-booking paths run the Worker first; workers.dev, preview URLs, observability and booking/media flags are off. No deploy-on-commit workflow exists. `npm run worker:check` only bundles a deployment dry-run.

APIs use same-origin requests, verified provider sessions, fixed RPC routes and safe error projections. Private booking HTML and all API/media responses use no-store/no-referrer headers. Anonymous media reads check the current publication on every request. Already downloaded or displayed content cannot be recalled after Unpublish. A supported-host/staging runtime smoke test is still required: this container could not start Wrangler local runtime because `uv_interface_addresses` is unavailable.

## Supabase

Use only an independent Service Link project. `supabase/config.toml` is an independent local-stack template, with no hosted link file. Apply all migrations in filename order after review:

| Migration | Purpose |
| --- | --- |
| `20261025081126_sl_provider_foundation.sql` | Owner drafts, allowlisted public snapshots, canonical geography, atomic publication and revisions |
| `20261025085204_sl_booking_foundation.sql` | Private booking/settings/capacity, provider/server routines and `btree_gist` exclusion constraint |
| `20261025095911_sl_profile_banner.sql` | Optional banner/focus and legacy defaults |
| `20261025102409_sl_social_gallery.sql` | Optional platform links and eight-picture gallery |
| `20261025114351_sl_cloud_booking_api.sql` | Versioned owner APIs, sanitized availability, snapshots, safe DTOs and private rate limiting |
| `20261025114907_sl_r2_media.sql` | Private asset registry, ownership/purpose checks, reference-based hosted media and cleanup |

The final media migration rejects inline images for hosted writes and limits profile JSON to 64KB; earlier larger inline ceilings remain only historical/local-demo design. Upload pictures through the owner media API instead. Existing demo data is not automatically imported.

RLS and explicit grants protect exposed tables. Owner RPCs use `auth.uid()` from a verified JWT, never editable metadata; guest/media wrappers require the server role. Security-definer functions have empty search paths and explicit ownership checks. Old unversioned owner-write grants are revoked. Server keys never reach the browser. Run hosted advisors and real concurrent/two-account checks before a pilot. Embedded SQL tests substitute Auth and serialize one connection; they are not hosted certification.

The client requires a publishable key and verifies URL/ref agreement. It uses `servicelink:auth:v1` and PKCE. Add the exact SL frontend origin as Site URL, and `/auth/callback` and `/auth/recovery` as allowed redirects. Keep email confirmations enabled. Prefer a confirmation email link to `/auth/callback?token_hash={{ .TokenHash }}&type=signup` so a GET/prefetch does not consume a signup token; the retained callback requires a user confirmation click for this route. Verify templates and PKCE flows on staging, including same-browser recovery and invalid/expired links.

Supabase documentation/changelog were checked during M3. No change required a different Auth protocol; the Worker verifies provider identity through `/auth/v1/user` with the provider bearer token and publishable API key. Hosted email templates, SMTP and redirects still need SL-only configuration. No auth emails were sent by this work.

## R2 and Images

`wrangler.media.example.jsonc` is a review-only binding example. The default config activates neither a bucket nor image transformations. R2 remains private; profiles carry canonical opaque API references instead of bucket URLs or owner IDs. Server-side decoding/re-encoding uses the optional Cloudflare Images binding, whose transformations have separate usage billing. Confirm account availability/cost before enabling it; leave uploads disabled otherwise.

Portrait/QR, banner and gallery processing retains the documented frontend size guidance. Server byte limits, purpose/ownership-bound references, publication-aware reads and seven-day unreferenced cleanup are detailed in [MILESTONE_3.md](MILESTONE_3.md). Receipts remain outside storage in the WhatsApp handoff; no receipt-upload feature was added.

## Costs and measurement

The handover's 25 October findings support starting with static hosting, keeping DB/auth/records in Supabase and moving public images to R2. At the modeled 500 providers / 25,000 monthly views, image transfer from Supabase would be about 25GB versus about 1.25GB of page data after offloading images. This is a model, not measured capacity or an exceedance probability.

Planning baseline from the handover: Workers Paid + one Supabase Pro Micro ≈ USD30/month (≈RM135 using its assumed USD1=RM4.50), before email/domain/tax/gateway/extra projects. No paid tier is needed to run this local milestone. No subscription has been started. Recheck prices, account-level quotas, free-project availability and measured payloads before any purchase/deployment. Track requests, egress, DB size, R2 storage/operations and emails; plan upgrades near 70–80% of relevant allowances.

## Payment and release boundaries

Membership billing and customer-to-freelancer payment remain separate domains. Locked pricing is unchanged: 14-day trial, RM9.90 monthly, RM49 first annual year, RM99 annual renewal. Optional gateway access is included; transaction charges are separate. No lifetime/add-on offer, gateway merchant or real checkout is implemented. Manual QR/bank transfer remains the complete MVP payment route for providers without gateway accounts.

Refer Me, reviews, membership enforcement and optional gateway integration remain later milestones. Production deployment, paid subscriptions, real payment tests and external messaging require separate instructions.

## References

- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/jwts
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/changelog
- https://developers.cloudflare.com/workers/static-assets/routing/advanced/serving-spa/
- https://developers.cloudflare.com/images/transform-images/bindings/
- Pricing/capacity assumptions: see the complete product handover.
