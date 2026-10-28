# Cloudflare demonstration hosting

The demo deployment target is **`servicelink-demo`**, separate from `servicelink-staging` and all AdvisorLink resources. It hosts the existing browser-local demonstration. It has no database, Auth, R2, billing, email or payment binding. No shared cloud persistence is claimed.

## What visitors can do

Open `/login` and choose **Explore the demo**. Edit a fictional profile, services, coverage, banner, social links and up to eight gallery pictures; save/publish; explore marketplace/comparison; try availability, booking and manual-payment status. The full flow works within one browser's storage.

Each browser/device has its own data. A public-profile or private-booking URL copied to another browser cannot transfer its local records. Clearing site data removes demo changes. Use fictional details only. Receipt messaging stays disabled. A later Supabase integration will be separately configured and tested; this deployment does not require pausing or deleting any AL project.

## Build and review

From the repository root, use Node 24 and run:

```sh
cd app
npm ci
npm run build:demo
npm run demo:check
```

`build:demo` explicitly forces local mode and clears all known Supabase browser variables, even if environment files or build settings contain cloud values. It writes `dist-demo`, separate from the regular `dist` cloud build, plus Cloudflare `_headers` and `robots.txt`. Headers request no indexing, prevent referrer leaks/framing and limit scripts/connections to the same origin. Images permit local data/blob URLs. Private booking HTML is marked no-store. These instructions are not authentication or access control; the demo URL is publicly reachable once deployed.

`demo:check` is a dry-run using only `wrangler.demo.jsonc`. The config serves static assets with SPA deep-link fallback, enables the demo workers.dev address, disables version previews/logging, and declares no resources or custom-domain routes. It never deploys the M3 backend Worker.

## Deploy to the owner's Cloudflare account

On a machine authenticated to the intended Cloudflare account:

```sh
npx wrangler login
npx wrangler whoami
npm run deploy:demo
```

Check the account shown by `whoami` before deploying. The command builds the forced-local artifact and deploys only `servicelink-demo`. Use the URL actually returned by Cloudflare; do not infer an account subdomain. No paid tier, temporary account, production domain or AL deployment is needed.

Alternatively connect the GitHub repository through **Workers & Pages → Create application → Import repository**. Use these settings:

| Setting | Value |
| --- | --- |
| Repository | `svanistelrooy901-art/servicelink` |
| Worker/project name | `servicelink-demo` |
| Branch | `feat/sl-cloudflare-demo` |
| Root directory | `app` |
| Build command | `npm ci && npm run build:demo` |
| Deploy command | `npx wrangler deploy --config wrangler.demo.jsonc` |
| Node build version | `24.22.1` (`NODE_VERSION` build variable if needed) |
| Supabase/secrets/bindings | None |

Use the branch containing the complete app; `main` currently contains only initial handover/brand material. If the branch is merged later, update the build branch deliberately. GitHub access grants may require the owner's confirmation; limit new access to this repository.

## Validation

Validated locally on 28 October 2026: browser/Worker TypeScript, normal production build, forced-demo build, deployment dry-run and 37 domain/SQL/HTTP tests. A deliberately poisoned cloud build environment did not enter the demo artifact. All 375 browser assertions run against the compiled `dist-demo` through `npm run test:demo-browser`, with the artifact's global response headers applied by the browser test harness so CSP is enforced; no page errors, external requests or tested horizontal overflow at 390px, 420px or 1440px. Chromium only; not a physical-phone/Safari test.

Deployment still needs authenticated Cloudflare access. After deployment, verify `/login`, a direct workspace deep link, save/reload, publication, booking, gallery and a separate clean browser. Confirm the noindex/referrer/CSP/private-page headers on Cloudflare itself. Local preview cannot prove account provisioning, edge headers or a live URL.
