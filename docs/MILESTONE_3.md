# Milestone 3: guarded booking and media integration

The cloud transport is implemented and locally tested. **Live staging is not deployed or verified.** No hosted migration, bucket, Worker, account email, payment or message was created by this milestone. AdvisorLink resources remain untouched.

## Working code

- A same-origin Cloudflare Worker verifies provider sessions through Supabase Auth, passes provider JWTs to owner RPCs, and exposes only fixed guest RPC routes using its server secret.
- The booking repository supports availability, requests, provider acceptance, deadlines, blocked/manual bookings, payment reports and provider verification. Cloud failures never fall back to browser storage.
- Owner writes carry a revision. Existing database locks and the capacity exclusion constraint protect reservations across services. Customer reports never verify payments automatically.
- Guest tokens contain 256 bits of entropy. Only their SHA-256 hashes reach the database. An independent random retry proof binds token issuance to one request and canonical payload; knowing a request UUID cannot recover its token. Proofs stay in client memory, so a lost response can be retried within the session. A reload before receiving the link loses that recovery proof; do not promise recovery without a separate customer identity flow.
- Owner DTOs omit customer access tokens and hashes. Public availability omits customer names, contacts, notes, payment details and private block labels. Provider name/public WhatsApp and price estimates are frozen from the published service, rather than trusted from guest input.
- Per-route database rate limits use HMAC identifiers instead of stored raw IPs. Origin checks, bounded streamed request bodies, allowlisted errors and no-store/no-referrer responses protect the API boundary. These are an initial abuse control, not a public-launch anti-bot system.
- Optional media transport compresses in the browser, authenticates uploads, validates/decodes and re-encodes through Cloudflare Images, and stores WebP objects in an independent private R2 bucket. Object keys are never exposed; profile fields contain `/api/media/<asset UUID>.webp` references.
- Draft images are owner-only; published images are anonymously readable while referenced by a publication. Unpublishing revokes new anonymous reads. Already downloaded images cannot be recalled. A payment QR requires its owner or a valid booking token and the permitted booking state.
- Media registry triggers bind each reference to its owner and purpose. Hosted writes reject inline demo images. Limits are 8 gallery pictures, 32 active media objects and 5MB per provider; WebP caps are 135KB portrait/QR, 165KB banner and 90KB gallery. Server transformations strip metadata and flatten animation.
- Owner-only `POST /api/media/cleanup` deletes unreferenced assets older than seven days. It preserves draft/public/settings references and frozen payment snapshots. Cleanup is explicit, not scheduled automatically; retries can finish interrupted deletion. Monitor the quota and invoke cleanup when needed.

The frontend preserves the current local demonstration and shows a visible staging notice in cloud mode. Gallery popup images load when the popup opens. Hosted owners manage phone/manual bookings through their inbox; they do not receive a guest's private customer link.

## Review files

| Area | Files |
| --- | --- |
| HTTP boundary | `app/worker/index.ts`, `booking.ts`, `media.ts` |
| Client transports | `app/src/lib/httpBookingRepository.ts`, `media.ts`, `components/MediaImage.tsx` |
| Booking migration | `supabase/migrations/20261025114351_sl_cloud_booking_api.sql` |
| Media migration | `supabase/migrations/20261025114907_sl_r2_media.sql` |
| Disabled configuration | `app/wrangler.jsonc`, `.dev.vars.example`, `.env.example` |
| Optional binding example | `app/wrangler.media.example.jsonc` |
| Integration tests | `app/tests/cloud-api.test.ts`, `worker.test.ts` |

Both new migrations were generated using Supabase CLI 2.122.0 and must follow the earlier migrations in filename order. They have only been applied in embedded Postgres tests. Media registries and rate-limit tables live in the private schema with RLS and explicit grants; guest wrappers are service-role-only. Earlier unversioned owner-write grants are revoked. No new AdvisorLink code or history was copied; existing provenance and notices remain intact.

## Validation and limits

- TypeScript checks cover both the browser app and Worker. Production build and Wrangler deployment **dry-run** pass; no upload/deployment is performed.
- **37 tests pass**, including the real Worker handler and HTTP client adapter against all migrations in PGlite. Two isolated clients exercise ownership, retry proofs, wrong tokens, booking conflicts, stale revisions, expiry/late reports, image ownership/publication/QR authorization, quotas and cleanup. Guards also cover the actual Worker entrypoint argument contract and disabled media errors.
- Supabase Auth/PostgREST transport, Cloudflare Images and R2 are test doubles. PGlite uses one connection with serialized transactions. This is not a real hosted-auth, image-codec, R2 or simultaneous multi-connection test.
- **375 local browser assertions pass** at 390px, 420px and 1440px. Mobile/public and desktop/editor screenshots were visually checked; no external browser requests or page errors occur. Physical phones and Safari are not covered.
- A local Wrangler runtime smoke attempt could not start because this environment rejects `uv_interface_addresses`. Only bundling/dry-run and handler tests succeeded; runtime routing still needs verification on a supported host or staging.

See [STAGING_SETUP.md](STAGING_SETUP.md) for activation and hosted acceptance checks. Local mode remains the only fully demonstrated browser runtime.

## Actual blockers and next work

Independent Supabase project provisioning was rejected by the account's active-free-project quota. Nothing was paused, deleted or upgraded. Cloudflare CLI is not authenticated and no SL account/target/bucket is configured. Images transformations are a separate usage-billed service; their binding is an example only. Booking/media flags remain off by default.

Next: supply independent SL staging capacity and Cloudflare access, apply/review migrations there, run advisors and verify real Auth, cross-device publication/media, multi-connection booking races and expiry. Then implement the confirmed Refer Me and completed-booking review rules. Membership enforcement and optional gateway integration follow separately; locked pricing is unchanged. Production, paid subscriptions, real payment tests and external messaging still require separate instructions.
