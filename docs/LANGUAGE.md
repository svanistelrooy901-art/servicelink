# BM / EN interface

BM is the initial interface language. The global BM | EN buttons appear in normal document flow on every route, including demo access, provider workspace, public profiles, marketplace and customer booking pages. The choice persists in `sl.language` browser storage and propagates to other open tabs. When storage is unavailable, switching still works for the current page. The HTML language is `ms` or `en`.

System copy, category labels, weekdays, price units, local validation messages and booking/payment status labels are localized. Presentation dates use the selected Malaysian locale and remain in Asia/Kuala_Lumpur. Route slugs, category IDs, geography IDs, database values, payment amounts and MYT scheduling rules remain canonical. Provider-written names, headlines, biographies, services, captions, notes and payment instructions are never translated automatically. Existing demo/sample provider content therefore remains in English.

English system strings are translation keys in `app/src/i18n/bm.json`. `t()` supports named placeholders; interpolate provider values through its values argument rather than translating those values. Domain/Worker rules continue to return canonical messages and receive no browser-language dependency. Presentation adapters live in `app/src/i18n/format.ts`. Existing backend error messages without a local translation fall back to their original text.

## Review and update the Cloudflare demo

The language implementation is on `feat/sl-bm-en`, based on `feat/sl-cloudflare-demo`. From an authenticated owner machine:

```powershell
cd C:\Users\safwa\Documents\servicelink
git fetch origin
git switch feat/sl-bm-en
git pull --ff-only
cd app
npm ci
npm run deploy:demo
```

This rebuilds the browser-local demo and updates only the existing `servicelink-demo` Worker. No database/auth/media/payment resources are enabled. The previous hosted demo stays unchanged until deployment succeeds.

## Validation

Run `npm run lint`, `npm test`, `npm run build`, `npm run build:demo`, `npm run demo:check`, and `npm run test:demo-browser`. The latter includes the English profile/booking/banner/gallery regressions and `tests/language-browser.mjs`. English regression tests explicitly select EN; language tests use a fresh browser's BM default and exercise 390px, 420px and 1440px layouts, toggling, reload persistence, cross-tab preference, blocked storage, unchanged draft inputs, save/publish, marketplace/public profile, and booking-form inputs in both languages. QA screenshots are in `docs/qa/language/`.

Validated locally on 29 October 2026: build/type checks, deployment dry-run, 37 domain/SQL/HTTP tests, 375 English browser assertions and 184 language browser checks. Browser tests use the compiled demo with its CSP headers applied. Mobile dimensions were simulated in Chromium; physical-device and live-edge verification follow owner redeployment.
