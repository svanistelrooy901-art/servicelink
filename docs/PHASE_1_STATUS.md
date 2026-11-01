# Phase 1 — backend and staging

Reviewed 1 November 2026. This phase is **in progress**, not complete.

| Area | Evidence / next gate |
| --- | --- |
| Current source | BM/EN foundation from PR #5; existing M3 Auth/profile, booking API and media transport retained |
| Supabase account | Digital Sambal remains Free; owner authorized pausing AL staging, now INACTIVE; AL production was verified ACTIVE_HEALTHY and HTTP 200 |
| New provisioning | Service Link Staging created in Singapore: `hiyoujlmarrfxvqeazvj`, ACTIVE_HEALTHY; no upgrade or purchase |
| Cloudflare demo | Owner reported successful browser-local demo deployment; independent of backend staging |
| Staging preparation | Local frontend/Worker checks, forced-cloud build, isolated asset output, generated SL-only config and leak scan |
| Auth + data | Provider foundation and restrictive public-column grants applied; booking and other dependent migrations blocked by an expired tool confirmation; Auth/hosted flow still outstanding |
| Media | R2/Images transport prepared; independent private bucket/binding and account/cost review outstanding; flags off |
| Two-device flow | HTTP/SQL fixtures exercise separate clients; actual hosted devices and simultaneous database connections still outstanding |

## Checks in this change

Browser/Worker TypeScript, normal build and 43 domain/SQL/HTTP/config/grant tests pass. The staged cloud artifact and actual Worker bundle pass compilation/deployment dry-run using fictional configuration. Missing configuration fails closed and emits no values. No browser UI or application behavior changed in this preparation change; existing UI/browser QA remains historical rather than a new hosted certification.

## Hosted provisioning result — 1 November 2026

Project: **Service Link Staging**, ref `hiyoujlmarrfxvqeazvj`, organization Digital Sambal, Singapore. Only the new SL database was modified. AdvisorLink staging was paused after explicit owner approval; production remained healthy. The source comments on old migrations describe their original review-only state; this record describes the actual hosted application.

| Local source | Hosted migration name | Hosted version | Status |
| --- | --- | --- | --- |
| `20261025081126_sl_provider_foundation.sql` | `sl_provider_foundation` | `20261101073732` | Applied |
| `20261101074808_sl_explicit_public_profile_grants.sql` | `sl_explicit_public_profile_grants` | `20261101074850` | Applied |
| Booking foundation, banner, social/gallery, cloud API, R2 | — | — | Not applied |

The booking migration returned `status: expired` / `INVALID_ARGUMENT` on two attempts, with the tool message “This confirmation expired after 2 minutes.” No SQL execution of that migration was confirmed; the database inventory confirms that no booking tables or btree_gist extension exist. Do not bypass the confirmation through a different SQL tool or repeatedly retry it. Resume with a fresh owner-visible Supabase confirmation when available.

Hosted verification: 16 State/Federal Territory seed entries; zero provider workspaces/public profiles; RLS enabled on all three SL tables; anonymous draft access and writes denied. Supabase's new-project defaults had retained table-level anonymous SELECT despite the initial column grant. The corrective migration explicitly revokes table privileges before granting only slug/profile/published_at; hosted verification now denies anonymous owner-ID access while permitting the public profile projection. Security advisors report no lints at this partial stage. This is not certification of the unfinished booking/media schema.

The corrective migration is independent of booking and was deliberately applied early to restrict access before adding any accounts/data. On a fresh project, apply all source migrations in filename order. Supabase MCP assigned its own history versions; reconcile the map above with CLI migration history before any later CLI db push. Do not replay the foundation or blindly repair history as applied.

Remaining: confirmation for the five dependent migrations, advisors after full schema, Auth URL/redirect/email setup, Cloudflare server secrets and deployment, R2/Images, then real two-account/multi-device/concurrent tests. No customer accounts, emails, real payments or cloud application deployment were created.
