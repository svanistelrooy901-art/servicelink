# Milestone 2: availability, booking requests and manual payments

Historical M2 record. M3 now implements the cloud transport behind disabled flags; see [MILESTONE_3.md](MILESTONE_3.md) and [STAGING_SETUP.md](STAGING_SETUP.md) for current status. Live staging remains unavailable.

Implemented on top of milestone 1, commit `17974e7`, in `feat/sl-m2-booking-manual-payments`. The PR is stacked on the milestone-1 branch so its booking changes can be reviewed separately. Neither PR is merged by this work.

## Confirmed direction and supporting choices

The owner said “proceed” after the proposed flow: provider acceptance before payment; customer name and Malaysian mobile required; email optional. One solo provider shares availability across every service. The existing one-plan membership prices are unchanged and are unrelated to amounts paid for services.

Supporting implementation choices are visible and adjustable: minimum notice, an after-service buffer, weekly working hours, appointment versus date-range mode per service, and a payment deadline chosen by the provider when accepting. There is no globally locked 24-hour expiry policy; the acceptance form pre-fills a suggested deadline that the provider reviews and can change. Draft profile publication does not publish payment settings or customer details.

- **Requested:** no capacity reserved and no money due.
- **Accepted:** final amount and payment instructions frozen; the full interval is reserved until the chosen deadline.
- **Customer reported payment:** still unverified; reporting/receipt sharing does not confirm the booking.
- **Provider verified:** the provider explicitly confirms checking the full amount due in their bank/wallet; booking becomes confirmed and its hold no longer expires.
- **Expired:** an unpaid/unverified acceptance past deadline releases the slot. A late report cannot silently reactivate it. Already-paid customers are directed to manual reconciliation.
- **Declined/cancelled/completed:** states remain recorded. Paid or payment-reported cancellations keep a manual follow-up flag; no automated refund is claimed. Completion is available after a confirmed booking ends.

Working hours, notice and buffer are Malaysia time (`Asia/Kuala_Lumpur`), irrespective of the viewer’s device timezone. Intervals are start-inclusive/end-exclusive. Each accepted booking keeps its own after-service buffer even if the provider changes the default later. Date-range enquiries use an exclusive end/departure date and reserve the continuous range only when accepted; they are not instant confirmations or recurring appointments.

## Try the complete demonstration

From the repository’s `app/` directory:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5178
```

1. Open `http://127.0.0.1:5178/login` → **Explore the demo**.
2. Publish a profile with at least one service and coverage. If desired, add a public WhatsApp number in My profile first.
3. Open **Availability**. Enable booking requests, set weekly hours/notice/buffer, choose per-service modes and add fictional bank details and/or a demo QR. Click **Save availability & payment details**. Profile Save draft is a separate operation and is hidden on operational pages to avoid confusion.
4. Add time off using **Block time**. Notes are private; blocks cannot overwrite an accepted/confirmed booking.
5. Open the public profile → **Request booking** on a service. Choose an available time/district, enter fictional name/mobile and optional email/note, and consent to sharing with this provider.
6. Keep the resulting **private booking link**. Open **Bookings** in another tab in the same browser, refresh, and accept the request with the final amount and a future deadline no later than the service start.
7. Refresh the customer page. It now shows the frozen QR/bank instructions and amount/reference. Use **I have paid** to simulate a customer payment report; status remains unverified.
8. Refresh the provider inbox, check the explicit bank/wallet acknowledgment and choose **Verify money received**. The booking becomes confirmed and appears in the provider’s daily agenda.
9. Use **Add phone / WhatsApp booking** to enter an already-agreed booking. It is accepted atomically and reserves the same calendar. Test a conflicting request or private block to see the rejection.

**Use fictional details only. Do not send real money.** Customer access uses a random token in the URL fragment, scoped to one booking. In local mode it is a navigation/access-control demonstration, not a server security boundary: browser storage and the demo owner session remain under that browser user’s control. Private links do not work on a second device.

Receipt sharing builds a WhatsApp draft containing the booking reference and amount. Receipt attachments are not stored in SL, and the customer must attach/send a receipt themselves. The demo disables the external WhatsApp receipt action; its encoded draft URL is unit-tested without opening WhatsApp or sending a message.

## Backend preparation and exact limits

The new review-only migration `supabase/migrations/20261025085204_sl_booking_foundation.sql` has been tested with the milestone-1 schema in PGlite/Postgres and `btree_gist`:

- Owner-only settings and booking records with explicit grants and RLS.
- Private provider-wide capacity across every service and blocked interval, with a GiST exclusion constraint as a database conflict guard.
- Provider row locking before acceptance/expiry/verification and immutable payment/service snapshots.
- Internal definer routines live in a non-exposed `sl_private` schema, use an empty search path and explicit ownership checks for owner operations. Public wrappers are invoker functions.
- Guest request, token-based read and customer payment-report/cancel routines are server-role-only, not anonymous browser RPCs. They resolve published service/coverage, require consent, bound input, reject request-ID reuse with different fingerprint/token, and do not return the stored token hash in a customer projection.
- Owner accept/decline/verify/cancel/complete, private blocks and manual-entry routines are prepared. Authenticated browser roles have SELECT only on their own booking/settings rows and cannot directly mutate status/capacity.
- Expiry is checked when requests/actions reserve time; customer projection also derives effective expiry. A future scheduled cleanup can materialize expired rows, but expiry correctness must not depend on a cron running on time.

**Not yet integrated or deployed:** the hosted booking repository, owner settings-save/read APIs, sanitized public availability endpoint, authenticated guest/owner Edge endpoints, token hashing/issuance, rate limiting/abuse controls, hosted Supabase advisors and actual multi-device/multi-connection staging QA. Cloud mode deliberately reports booking as unavailable rather than persisting customer records to local storage as a fallback. The connected project inventory was checked; no project named Service Link was found and no new project was created.

For future guest endpoints, generate at least 256-bit random access tokens, hash them on the server, validate the request body and canonical fingerprint server-side (never trust a client-supplied hash), use a correct idempotency/replay strategy for private-link issuance, and keep server credentials out of VITE variables. Never place token-bearing URLs in logs, analytics, query strings, screenshots or outbound receipt text. Add no-store/referrer protections and verify anonymous/cross-owner denial with real Supabase roles before a pilot.

No production cancellation/refund policy, recurring booking system, automated WhatsApp notification, gateway checkout or SL membership billing is introduced. Those remain separate work. R2 integration is still required for hosted image/QR assets; the demo compresses inline images for browser storage.

## Validation

- TypeScript and production build pass.
- **24** domain/database tests pass: 14 new booking/domain/database checks plus the existing 10 checks. Cases cover idempotent retry, concurrent/stale owner writes, coverage/contact/consent, private tokens, status separation, expiry/late payment, buffer snapshots, cross-service conflicts, private blocks, manual entry, date ranges, RLS/grants and database exclusion constraints.
- Existing profile/publish/browser regression: **52** assertions at 390px, 420px and 1440px.
- Booking browser suite: **54** assertions pass; it covers the complete request/accept/report/verify flow, QR preparation, private-link denial, manual entry/cancel, persistence and responsive layouts at those same viewports. External requests are intercepted and rejected.
- Embedded Postgres demonstrates schema/constraint behavior. It does not substitute for hosted Auth/PostgREST/SMTP or a real multi-connection load test.

```sh
cd app
npm run lint
npm run build
npm test
npm run test:browser
npm run test:booking-browser
```

For an installed Chromium, prefix browser tests with `CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chromium`. No browser binary is committed.

Visual evidence:

- [Desktop availability](qa/m2/desktop-availability.png)
- [Desktop booking inbox and agenda](qa/m2/desktop-bookings.png)
- [390px booking request](qa/m2/mobile-request-390.png)
- [390px accepted booking and payment report](qa/m2/mobile-payment-390.png)
- [420px availability](qa/m2/mobile-availability-420.png)
- [420px booking inbox](qa/m2/mobile-bookings-420.png)
