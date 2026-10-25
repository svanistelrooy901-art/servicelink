# Source assessment and reuse record

Reviewed 25 October 2026 (Malaysia). Access to both repositories was verified through the connected GitHub app, including a complete source package and application instruction file. Target `servicelink` is **public**; source `advisorlink` is **private**. The owner explicitly authorized reuse into Service Link. Visibility was preserved.

## Coherent baseline

Selected AdvisorLink **`761a17834db27b32e7724fd8324d5817faf3fb8c`**, branch `review/basic-v1-production-cutover-20261025`.

Live branch refresh confirmed the handover refs:

| Branch | Refreshed head | Relevant PR / state |
| --- | --- | --- |
| main | `33185c2a39c39e8605cad46fe3ad8ef61b21bf89` | Default source branch |
| infra/cloudflare-staging | `d16dca5a50525ca0d8180c1b5d6e8681937fa94c` | Base for later release work |
| feature/basic-v1-toyyibpay-entitlements | `c919e8fd3880a780f7ea1df24d7ddd63c679de0e` | #19 open |
| review/basic-v1-launch-hardening-20261024 | `1e99dd242f947891d6e20397c8f42e25aa4d21b9` | #23 open |
| review/basic-v1-production-cutover-20261025 | `761a17834db27b32e7724fd8324d5817faf3fb8c` | #24 open |

The selected snapshot is 91 commits ahead of default main. Main has older dependency/auth behavior; later branches include Router 7, owner access/recovery hardening and separate draft/published patterns. PRs #17–24 are still open, and #25's icon expansion is a separate open branch (`df00e716723bf5a02b7969f750e37349ccfda18b`). This selection does not certify those AL branches for production or change their status.

Selected package + lockfile were fetched from the same commit. Source package blob: `834992e663c342d16c7a73d5e66ff772df1f7fca`; lockfile blob: `61b8938c58c9f528de723c43c09f55c5c8899e41`. Resolved baseline: React 18.3.1, React Router 7.18.4, Supabase JS 2.116.0 and Vite 5.4.21. The SL lockfile intentionally changes package identity, pins Supabase exactly, and adds pinned test/format tooling. No branch/package mixing or history import was used.

## Instructions and architecture

Target initially contained only the handover and no AGENTS.md. The source recursive tree contained `app/AGENTS.md` and no root instruction file. The complete app instructions were read: keep product/marketing separate, preserve existing reusable architecture, share public/preview rendering, work on a branch and validate forms/mobile/desktop. Its AL-specific product rules are superseded by the user's SL request and SL handover. Root AL architecture, scope and design specifications were inspected; the sales application was not imported.

## Reused and adapted modules

| Source area | SL implementation / adaptation |
| --- | --- |
| `useAuth.tsx` | Session state, auth-event race handling, sign-in, magic link and sign-out; local mode skips cloud initialization |
| Login/callback/forgot/recovery/reset/set-password pages | SL branding, independent callback origins/storage; retained one-time callback handling and password UX |
| `authCallback`, `safeReturnTo`, `recoveryGrant`, `passwordSetup` | Reviewed account-access helpers; browser keys changed to `servicelink:` |
| `whatsappNumber` | Malaysia mobile normalization and URL safety |
| `utils` | Existing reusable helper functions |
| `useAppStore` / repositories | Adapted draft/saved/public separation to SL's new provider model, local persistence and independent Supabase adapter |
| `ProfilePresentation` | Preserved shared-rendering architecture; replaced AL's advisor/product/enquiry sections with SL identity/services/coverage and neutral review state |
| Package, lockfile, TS/Vite config | Same source snapshot, SL identity plus isolated test tooling |

Original blob SHAs are recorded in [source-manifest.json](source-manifest.json). Copied files were individually reviewed before use. Only application files were copied, with authored SL components around them. No AL Git history was imported.

## Excluded material and gaps

No AL environment files, private mock identity/contact data, logos/portraits, hosted URLs, storage references, user records, gateway code, payment migrations, admin identities, CI credentials, sales app, operational runbooks or deployment workflows were copied. Fresh SL config names and browser storage keys replace source targets. The copied runtime source contains no inherited live AL host or project reference.

AL's enquiry flow is not an SL booking engine. Its membership payment integration does not establish a multi-provider merchant model. Scheduling, booking capacity/conflict rules, manual verification, reviews/Refer Me semantics and membership eligibility still need their own SL modules and policy decisions.

Neither reviewed repository tree supplied a source LICENSE/NOTICE. Owner-authorized reuse is recorded in root NOTICE; no broad open-source license is invented. Dependency license texts/notices are preserved separately in THIRD_PARTY_NOTICES.md.

## Milestone sequence delivered

1. Establish an independent React/TypeScript app and account-access surface.
2. Adapt the builder to a short provider profile and service catalogue.
3. Introduce canonical Malaysia coverage and matching functions.
4. Render live preview/public profiles with the same component.
5. Persist drafts separately and implement publish, slug replacement and unpublish.
6. Exercise SQL ownership/atomicity and mobile/desktop browser flows.
7. Push a review branch and draft PR, with external setup left explicit.
