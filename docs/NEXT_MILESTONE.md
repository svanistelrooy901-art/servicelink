# Milestone 2 status and next integration work

Milestone 2 now implements a local demonstration and tested SQL foundation for provider-wide availability across services, booking requests and date-range enquiries, centrally stored reservations, blocked/manual bookings, separate booking/payment status and provider verification of QR/bank payments. Prepare this against an independent SL staging backend, then verify simultaneous booking conflicts.

Confirmed for milestone 2: provider acceptance first; customer name and mobile required, email optional. Provider chooses the payment deadline for each acceptance. The remaining decisions below affect a hosted paid pilot:

1. Scheduling: all current services require acceptance; appointment/date-range is configured per service. Requested state does not reserve capacity; accepted holds reserve until the provider-chosen deadline, and verified bookings remain reserved. Production cancellation/rescheduling/refund terms still need agreement.
2. Customer contacts: name/mobile required and email optional are implemented. Finalize production privacy/consent/retention copy and late-payment reconciliation procedures.
3. Membership: trial activation and repeat-trial rules; trial marketplace/gateway eligibility; expiry and existing-booking access; auto/manual renewal; monthly-to-intro-annual eligibility.
4. Refer Me: observable counter definition/deduplication. Share opens must not be displayed as delivered referrals or verified recommendations. No cash rewards.
5. Reviews: completed-booking eligibility, off-platform testimonials, duplicate prevention and moderation. No invented ratings, qualification/identity badges or Google import.
6. Gateway: supported provider merchant/settlement arrangement and fee bearer. Keep optional customer checkout independent from SL membership billing. Decide these before real payments.

The first milestone's marketplace is a published-snapshot discovery foundation (first 100 cloud rows), without membership eligibility, availability/date filtering, recommendation counters or ratings logic. Pagination/server-side search and live publication/expiry eligibility are required before public-scale discovery. Comparison defaults to up to three within one category; review inclusions/price basis instead of treating headline prices as equivalent.

Production deployment, paid subscriptions, real payment tests and external messaging still require a separate user instruction.

Next technical milestone: create/configure an independent SL backend, integrate guarded booking APIs and R2 assets, and verify multi-device ownership, token privacy, conflict handling and expiry on staging. See [MILESTONE_2.md](MILESTONE_2.md).
