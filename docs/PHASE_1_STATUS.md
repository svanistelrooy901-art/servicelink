# Phase 1 — backend and staging

Reviewed 1 November 2026. This phase is **in progress**, not complete.

| Area | Evidence / next gate |
| --- | --- |
| Current source | BM/EN foundation from PR #5; existing M3 Auth/profile, booking API and media transport retained |
| Supabase account | Digital Sambal remains Free; owner authorized pausing AL staging, now INACTIVE; AL production was verified ACTIVE_HEALTHY and HTTP 200 |
| New provisioning | Service Link Staging created in Singapore: `hiyoujlmarrfxvqeazvj`, ACTIVE_HEALTHY; no upgrade or purchase |
| Cloudflare demo | Owner reported successful browser-local demo deployment; independent of backend staging |
| Staging preparation | Local frontend/Worker checks, forced-cloud build, isolated asset output, generated SL-only config and leak scan |
| Auth + data | All eight source migrations are applied/registered; API permission and HTTP checks pass; Auth URL setup and hosted app flow remain outstanding |
| Media | R2/Images transport prepared; independent private bucket/binding and account/cost review outstanding; flags off |
| Two-device flow | HTTP/SQL fixtures exercise separate clients; actual hosted devices and simultaneous database connections still outstanding |

## Checks in this change

Browser/Worker TypeScript, normal build and 43 domain/SQL/HTTP/config/grant tests pass. The staged cloud artifact and actual Worker bundle pass compilation/deployment dry-run using fictional configuration. Missing configuration fails closed and emits no values. No browser UI or application behavior changed in this preparation change; existing UI/browser QA remains historical rather than a new hosted certification.

## Hosted provisioning result — 1 November 2026

Project: **Service Link Staging**, ref `hiyoujlmarrfxvqeazvj`, organization Digital Sambal, Singapore. Only the new SL database was modified. AdvisorLink staging was paused after explicit owner approval; production remained healthy. The source comments on old migrations describe their original review-only state; this record describes the actual hosted application.

## Database verification and migration history

The owner reported all five manual SQL files successful. Catalog verification confirmed the booking/settings/event/capacity/rate-limit/media tables, all expected public RPCs and the slot exclusion constraint. There are nine SL tables with RLS enabled. Private tables have no direct anonymous/authenticated SELECT privileges; service-only RPCs are not executable by those roles. The owner workspace RPCs remain authenticated-only.

The follow-up `20261101080914_sl_extension_schema.sql` moves btree_gist to the non-API extensions schema, indexes booking_events.booking_id and removes the hosted default anon grant from sl_write_workspace (which also rejects a missing auth.uid()). Existing exclusion constraints retain their operator-class OIDs.

On 1 November, after verifying the manual SQL outcome, migration **metadata only** was reconciled in one guarded transaction. The three MCP-assigned history versions were mapped to their source filenames: foundation 20261101073732 → 20261025081126, profile grants 20261101074850 → 20261101074808, extension hardening 20261101081027 → 20261101080914. The five manually executed migrations were registered using their source versions, with empty statement arrays to identify manual registration rather than a tool-executed SQL replay. No schema/data was replayed during reconciliation.

| Version | Name | State |
| --- | --- | --- |
| 20261025081126 | sl_provider_foundation | Applied |
| 20261025085204 | sl_booking_foundation | Owner applied; verified and registered |
| 20261025095911 | sl_profile_banner | Owner applied; verified and registered |
| 20261025102409 | sl_social_gallery | Owner applied; verified and registered |
| 20261025114351 | sl_cloud_booking_api | Owner applied; verified and registered |
| 20261025114907 | sl_r2_media | Owner applied; verified and registered |
| 20261101074808 | sl_explicit_public_profile_grants | Applied |
| 20261101080914 | sl_extension_schema | Applied |

Hosted checks using the project's publishable key: public profile projection GET 200 with no records; private workspace and owner-ID requests both HTTP 401; Auth settings GET 200. No signup/email or session was created by those read-only probes. Geography still has 16 State/Federal Territory entries, with zero provider profiles/workspaces.

After hardening, security advisors report only four INFO “RLS enabled, no policy” notices for sl_private tables. These are intentionally deny-by-default to browser roles and accessed through checked backend functions; do not create permissive policies to silence the notices. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). The extension WARN was resolved. Unused-index INFO notices on an empty project are not a reason to drop the required indexes. The missing booking-events FK index was added.

## Next owner setup

Supabase URL configuration must use the future independent Worker origin `https://servicelink-staging.svanistelrooy901.workers.dev`, with /auth/callback and /auth/recovery allowed. The available connector has no Auth-configuration mutation tool, so the owner must set those in the dashboard. The Worker has not been deployed and this URL is not yet a tested app endpoint. Keep confirmation enabled. Server-only SL credentials must be entered locally/through Wrangler, never in chat or Git.

Remaining: Auth URL/redirect/email setup, server secrets and Cloudflare staging deployment, private R2/Images, then real two-account/multi-device/concurrent tests. No customer accounts, emails, real payments or backend app deployment were created.
