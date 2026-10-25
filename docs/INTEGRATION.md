# Integration preparation

No external resource has been created, linked, purchased, migrated or deployed for this milestone. Configurations are review templates. AdvisorLink was read-only throughout.

## Hosting: Cloudflare

The handover's recommended static assets + Workers architecture is suitable for this Vite application. `app/wrangler.jsonc` uses the independent name `servicelink-review`, SPA routing, no custom domains/account ID, and disables workers.dev/preview URLs until an explicit deployment instruction. No deploy workflow or deploy command runs on commit/PR.

A future SL-only staging deployment needs a Cloudflare account/target, explicit origin, build-time Supabase variables and Auth redirect allowlist. Review direct profile and password callback deep links. Configure HTML and profile-data cache behavior so Unpublish cannot leave a cached private publication visible. Public API data must not be cached indefinitely. The current SPA fetches publication on navigation/focus; already displayed content cannot be recalled from a visitor's browser.

## Authentication and database: Supabase

Create or identify a **new Service Link project**. Do not reuse any AL project. `supabase/config.toml` is an independent local-stack template with a separate project ID and ports. No hosted project link file is present.

Migration: `supabase/migrations/20261025081126_sl_provider_foundation.sql`, created using Supabase CLI 2.122.0 `migration new`, then authored and verified with embedded Postgres (PGlite). It has not been applied to hosted Supabase.

- `sl_workspaces`: owner-only drafts and optimistic revision number.
- `sl_public_profiles`: validated allowlisted snapshots; public SELECT exposes profile, slug and publication timestamp. Anonymous users cannot select owner UUIDs or drafts.
- `sl_geography`: read-only canonical state/territory data and subdivisions seeded from the shared JSON.
- `sl_write_workspace`: SECURITY INVOKER function; RLS applies; transaction + row lock + revision check prevent stale saves and partial publication. Slug uniqueness is global; replacing it retires the previous row/link.
- RLS is enabled on every exposed table. Policies use `auth.uid()`, never editable user metadata. Grants and invoker functions are explicit. No privileged server key is needed in the browser.

Before staging integration, review/apply the migration to the SL project, run Supabase advisors there, generate precise TypeScript database types, and verify actual signup/confirmation/sign-in/recovery/sign-out plus ownership using two test accounts and anonymous browsing. PGlite substitutes `auth.uid()`/`auth.users` for SQL tests; it does not test Supabase Auth, PostgREST, SMTP, rate limits or hosted project settings.

Set these in `app/.env.local` (never commit actual values):

```dotenv
VITE_DATA_BACKEND=supabase
VITE_SUPABASE_URL=https://YOUR_NEW_SL_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_SL_KEY
VITE_SL_PROJECT_REF=YOUR_NEW_SL_REF
```

The client requires a publishable key and verifies URL/ref agreement. It uses `servicelink:auth:v1` and PKCE. Add the exact SL frontend origin as Site URL, and `/auth/callback` and `/auth/recovery` as allowed redirects. Keep email confirmations enabled. Prefer a confirmation email link to `/auth/callback?token_hash={{ .TokenHash }}&type=signup` so a GET/prefetch does not consume a signup token; the retained callback requires a user confirmation click for this route. Verify templates and PKCE flows on staging, including same-browser recovery and invalid/expired links.

No auth emails have been sent by this work. No account/trial/membership payment is activated by opening the demonstration. The signup flow is implemented but needs the new project and email configuration before end-to-end verification.

Supabase documentation and changelog were checked during implementation. The relevant 12 October TLS cipher deprecation affects unsupported legacy clients; this app targets current browsers and needs no special cipher implementation. Password/PKCE and RLS references were checked against current docs.

## Media: R2

R2 remains the preferred home for public profile/portfolio images, following the handover's transfer model. Local portraits are decoded, resized to at most 480px, re-encoded as WebP (metadata stripped), and capped at 180,000 data-URL characters (about 130KB binary). Optional banners use a maximum 1600px longest edge, an 8:3 display crop with a vertical focus point, and a separate 220,000-character cap (about 165KB binary). Both accept JPG/PNG/WebP inputs up to 8MB and up to 40 megapixels. They are stored only in local browser data in demo mode.

**Hosted uploads are deliberately unavailable until R2 integration is ready.** No AL image endpoint/bucket was reused. The current schema accepts compressed inline demo-format images; before a cloud pilot, replace that temporary field with an SL-owned object/version reference and a validated CDN URL projection. Do not run inline media at scale in Supabase JSON.

Required R2 integration: new SL-only bucket, authenticated upload authorization, ownership-bound object keys, server-side image validation/re-encoding, public CDN routing, file quotas, replacement cleanup, cache versions, and deletion/unpublish behavior. Keep signing secrets on the server; browser compression alone is not server validation. Receipts remain outside storage in the agreed WhatsApp handoff unless the owner changes that decision.

## Costs and measurement

The handover's 25 October findings support starting with static hosting, keeping DB/auth/records in Supabase and moving public images to R2. At the modeled 500 providers / 25,000 monthly views, image transfer from Supabase would be about 25GB versus about 1.25GB of page data after offloading images. This is a model, not measured capacity or an exceedance probability.

Planning baseline from the handover: Workers Paid + one Supabase Pro Micro ≈ USD30/month (≈RM135 using its assumed USD1=RM4.50), before email/domain/tax/gateway/extra projects. No paid tier is needed to run this local milestone. No subscription has been started. Recheck prices, account-level quotas, free-project availability and measured payloads before any purchase/deployment. Track requests, egress, DB size, R2 storage/operations and emails; plan upgrades near 70–80% of relevant allowances.

## Payment boundaries

Membership billing and customer-to-freelancer payment require separate tables, references, permissions and integration decisions. No legacy lifetime, gateway add-on, merchant secret, checkout or callback is included. Manual QR/transfer must remain a complete route for providers without gateway accounts. No real checkout, message send or gateway test is part of this milestone.

## References

- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/changelog/cbc-tls-ciphers-deprecated
- https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/
- Pricing/capacity sources: see the complete handover.

## Milestone 2 delta

See [MILESTONE_2.md](MILESTONE_2.md) for the booking schema, roles/constraints, complete demo flow and exact hosted API work remaining. `20261025085204_sl_booking_foundation.sql` is review-only and requires `btree_gist`. Private booking rows are not exposed to anonymous users; guest operations are reserved for a future validated server endpoint. Project inventory was read without changes; no Service Link project was found. Availability/Bookings stay unavailable in cloud mode until that backend is integrated.

## Banner schema delta

`20261025095911_sl_profile_banner.sql` is generated with Supabase CLI 2.122.0 and tested locally in embedded Postgres. It keeps banner/image-position fields optional for legacy public snapshots, rejects external/SVG/oversized image data and invalid positions, and increases the combined draft/public JSON ceiling to 500,000 bytes for bounded portrait plus banner payloads. Owner checks, function invoker mode, unknown-key rejection, grants and RLS remain in force. Apply the migrations in filename order when independent SL staging is authorized.

No hosted migration or advisor run was performed because no SL project is configured. Supabase's current function-security documentation and changelog were checked; the new validator uses `SECURITY INVOKER`, an empty search path and the existing explicit grants. Hosted R2 work must cover banners as well as portraits, replacing temporary inline data with SL-owned media references before pilot scale.
