# Phase 1 — backend and staging

Reviewed 1 November 2026. This phase is **in progress**, not complete.

| Area | Evidence / next gate |
| --- | --- |
| Current source | BM/EN foundation from PR #5; existing M3 Auth/profile, booking API and media transport retained |
| Supabase account | Digital Sambal is Free; both AdvisorLink projects active; no SL project |
| New provisioning | Not attempted again against the known quota; no project paused/deleted/upgraded |
| Cloudflare demo | Owner reported successful browser-local demo deployment; independent of backend staging |
| Staging preparation | Local frontend/Worker checks, forced-cloud build, isolated asset output, generated SL-only config and leak scan |
| Auth + data | Adapters/migrations prepared; real project, redirects, confirmation/recovery and two-account hosted checks outstanding |
| Media | R2/Images transport prepared; independent private bucket/binding and account/cost review outstanding; flags off |
| Two-device flow | HTTP/SQL fixtures exercise separate clients; actual hosted devices and simultaneous database connections still outstanding |

## Checks in this change

Browser/Worker TypeScript, normal build and 42 domain/SQL/HTTP/config tests pass. The staged cloud artifact and actual Worker bundle pass compilation/deployment dry-run using fictional configuration. Missing configuration fails closed and emits no values. No browser UI or application behavior changed in this preparation change; existing UI/browser QA remains historical rather than a new hosted certification.

## Next infrastructure decision

One independent Supabase slot is needed. Do not pause/delete AdvisorLink automatically. Once capacity is available, confirm the organization before project creation as required by the Supabase connector; obtain any nonzero-cost approval through its cost flow. Apply all six reviewed SL migrations to the new empty project, run hosted advisors, configure Auth and enable booking gates together. Never transfer AL users/keys/configuration.

Only then run the hosted acceptance list in STAGING_SETUP.md. Signup/recovery email tests require agreed test recipients; no external messages or real payments have been sent. Production launch and membership/gateway work remain later phases.
