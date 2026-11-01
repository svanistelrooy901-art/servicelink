# Independent Service Link staging setup

**Backend staging status (1 November 2026): not provisioned.** The owner-approved organization is Digital Sambal (Free). AL staging has been paused; the new Service Link Staging project is ACTIVE_HEALTHY. See PHASE_1_STATUS.md for the partial schema and confirmation blocker. The browser-local Cloudflare demo is already hosted; that does not supply shared backend data. This workspace has no Cloudflare account authentication. No AdvisorLink project, bucket, Worker, merchant, secret or domain may be reused. This guide describes work still required, not completed configuration.

## Review locally now

From the repository root:

```sh
git fetch origin
git switch feat/sl-phase1-staging-readiness
cd app
npm ci
npm run dev -- --host 127.0.0.1 --port 5178
```

For the first checkout, use `git switch --track origin/feat/sl-phase1-staging-readiness` instead. Open `http://127.0.0.1:5178/login` and choose **Explore the demo**. Commands run inside `app`, where `package.json` lives. The default local mode uses fictional browser data and needs no cloud credentials. Review profile publication, gallery and the complete request → accept → report → verify flow in two tabs of the same browser.

```sh
npm run lint
npm test
npm run build
npm run worker:check
```

`worker:check` is a deploy dry-run. Browser suites are listed in [VALIDATION.md](VALIDATION.md). The cloud API integration tests exercise real SQL with mocked upstream services; they do not connect to an account.

## 1. Supabase resources and migrations

Use a new SL-only project once account capacity is available. Keep production deployment separate. Record the new project reference privately; never put server secrets in Git, `VITE_*` variables, screenshots or support logs.

For a fresh empty project, review and apply **all** `supabase/migrations/*.sql` in filename order. For the existing SL staging project, consult PHASE_1_STATUS.md first: foundation and the independent grant correction already exist, and the remaining migrations have not been applied. The final two migrations add the versioned booking API, private rate limiter and media registry. The booking foundation requires `btree_gist`. Do not cherry-pick only the media migration and do not apply them to AdvisorLink.

Run Supabase security/performance advisors against SL after applying. Check RLS, private-schema exposure, explicit grants and function search paths. Generate database types from this project before broadening direct client queries. Keep public signup email confirmation enabled and configure an appropriate test SMTP/sending policy without contacting real customers.

Auth Site URL must equal the exact frontend origin; allow `/auth/callback` and `/auth/recovery` there. Retain the confirmation-click callback template described in [INTEGRATION.md](INTEGRATION.md). Verify signup, confirmation, PKCE recovery, sign-out and expired links using agreed fictional test accounts before any external email tests.

## 2. Browser configuration

For the guarded cloud build, copy `app/.env.staging.example` to `app/.env.staging.local`, then fill only SL publishable values:

```dotenv
VITE_DATA_BACKEND=supabase
VITE_SUPABASE_URL=https://YOUR_NEW_SL_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_SL_KEY
VITE_SL_PROJECT_REF=YOUR_NEW_SL_REF
VITE_SL_BOOKINGS_ENABLED=false
VITE_SL_MEDIA_ENABLED=false
```

The reference is the exact 20-character project ref. URL and ref must match. These values are embedded at build time; rebuild after changing them. Enable each browser flag only when its server routes and dependencies are ready. A frontend flag does not enable the server gate.

## 3. Worker configuration and secrets

`app/wrangler.jsonc` targets only `servicelink-staging`. API and private booking routes run the Worker first. `workers_dev`, preview URLs, observability and both feature gates are disabled. No deployment workflow exists.

For local cloud-connected review, copy `.dev.vars.example` to `.dev.vars` inside `app` and supply:

| Variable | Value |
| --- | --- |
| `SL_ENVIRONMENT` | `staging` (this Worker rejects production) |
| `SL_APP_ORIGIN` | Exact origin, e.g. `http://localhost:8787`, with no trailing slash |
| `SL_PROJECT_REF`, `SUPABASE_URL` | The new, matching SL project |
| `SUPABASE_PUBLISHABLE_KEY` | SL publishable key |
| `SUPABASE_SECRET_KEY` | Server-only SL secret key; never a browser variable |
| `SL_TOKEN_SECRET`, `SL_RATE_SECRET` | Two independent random secrets, each at least 32 bytes |
| `SL_BOOKINGS_ENABLED`, `SL_MEDIA_ENABLED` | Initially `false`; enable separately after configuration |

Retain the token key for outstanding request retries. Existing customer tokens are stored only as hashes in SQL; changing this key changes the token derived for a retry. Rotating the rate key resets rate identifiers. Manage deployed secrets in the account secret store, not plaintext checked-in configuration.

After configuration, build the cloud bundle and serve assets plus API on one origin:

```sh
npm run build
npm run dev:worker -- --port 8787
```

Open the exact configured origin. Vite's development server has no API proxy; use the Worker for cloud-connected review. `/api/health` reports configured flags, not database/media readiness. A health response alone is not an acceptance test. An unconfigured API must fail closed with a safe error.

For a later staging deployment, set SL-only origin/project/publishable vars and server secrets, configure the exact SL hostname and Auth redirects, then explicitly choose the deployment target. Do not enable a billable tier or publish production as part of filling these files. Cloudflare login/target provisioning and the actual staging upload remain outstanding.

## 4. Optional R2 and Images bindings

Review `wrangler.media.example.jsonc`; it is not the active configuration. Create an independent **private** `servicelink-staging-media` R2 bucket and bind it as `MEDIA` only after account/cost review. Disable public bucket access; all reads go through the authorization Worker. No signed URL or object key belongs in a profile.

The `IMAGES` binding provides server-side image decoding/re-encoding. Transformations have separate usage billing in addition to R2/Workers; confirm account availability/cost before activation. If unavailable, leave uploads disabled. Do not substitute browser-only validation for the server step.

After configuring both bindings, enable `SL_MEDIA_ENABLED` and rebuild with `VITE_SL_MEDIA_ENABLED=true`. Local inline demo photos are intentionally rejected by hosted SQL: upload them anew through the owner's media route. No user-data import or local-to-cloud transfer is implemented. Test batch-failure cleanup, owner-only drafts, publish/unpublish, cached/downloaded-image limitations, quota handling and the owner-only cleanup endpoint.

## 5. Hosted acceptance before pilot

Use two provider accounts, an anonymous customer and separate browser/device sessions with fictional details. Do not send real money, receipts or WhatsApp messages.

1. Verify actual Auth and independent draft/public storage. Anonymous/cross-owner reads must not reveal drafts, contacts, tokens or payment data.
2. Enable bookings on both server and browser. Make a request, retry it, test a wrong proof/token, accept it, report payment and explicitly verify as provider. Owner responses must not include the private customer token.
3. Race two acceptances from genuinely concurrent connections for one slot; exactly one may reserve it. Test buffers, shared services, blocks/manual entries, date ranges, stale revisions, expiry and late payment reports without reactivating capacity.
4. Verify R2/Images with actual JPG/PNG/WebP inputs, invalid/corrupt content, ownership/purpose substitution, eight-picture gallery, private QR access and unpublish. Check response headers and edge caching.
5. Run hosted advisors, inspect redacted logs and measure DB/R2/Images/Worker usage. Never log Authorization headers, request bodies, guest URLs or tokens. Keep staging notices and noindex/private-page headers.

The current embedded tests do not replace this list. Refer Me, reviews, membership lifecycle and optional gateway remain later work; SL membership and customers paying freelancers must stay separate.


## Phase 1 guarded build workflow

The latest configuration/build tooling is in `feat/sl-phase1-staging-readiness`, including the existing BM/EN interface. `npm run staging:check` validates local configuration only and prints field names, never credential values. It rejects demo fallback, project/URL/key mismatch, inconsistent flags, non-staging/demo origins, placeholder or shared secrets and server keys in public configuration. The first rollout uses the exact `https://servicelink-staging.<account>.workers.dev` origin. Custom domains and localhost cloud review need a separate deliberate configuration.

After a new SL project exists and all migrations have been applied, fill `.env.staging.local` and `.dev.vars` (see the tables above). Set booking flags consistently; keep media flags false during the first auth/profile/booking checks.

```sh
cd app
npm run staging:check
npm run build:staging
npx wrangler deploy --config wrangler.staging.generated.json --dry-run
```

`build:staging` uses cloud mode and writes **dist-staging**, without altering **dist-demo**. It generates a gitignored config for **servicelink-staging** with no media bindings and no server secrets, plus noindex and cloud-compatible CSP headers. A failed preparation deletes the generated config and staging output so an old build cannot be mistaken for the new one. Build success is not proof that migrations, Auth redirects or the hosted API work.

After authenticating to the intended owner Cloudflare account, use Wrangler's `secret put --help` guidance to set **SUPABASE_SECRET_KEY**, **SL_TOKEN_SECRET** and **SL_RATE_SECRET** on the generated staging config. `.dev.vars` provides local development values only: it is not uploaded by a deploy. Set secrets without echoing values or committing them. Then deploy explicitly with `npx wrangler deploy --config wrangler.staging.generated.json`. Do not run the demo deploy command for this step. Check that Auth Site URL and redirect URLs use the returned staging origin before enabling signup tests.

Media comes next: private R2 and Images bindings, reviewed cost/account availability, corresponding server/browser flags and actual upload authorization tests. The initial generated config intentionally rejects media=true instead of pretending those bindings exist. No media resource, subscription or external email has been created by this phase.
