# Next milestone: availability, booking and manual payment

Milestone 1 establishes profile/catalogue/coverage publication. Next implement provider-wide availability across services, booking requests and date-range enquiries, centrally stored reservations, blocked/manual bookings, separate booking/payment status and provider verification of QR/bank payments. Prepare this against an independent SL staging backend, then verify simultaneous booking conflicts.

These policy decisions are **not needed to review milestone 1**, but materially affect paid bookings and need owner decisions before that implementation is finalized:

1. Scheduling: which services allow instant booking versus provider acceptance/date-range requests; which states reserve capacity; unpaid hold/payment deadline; cancellation/rescheduling rules.
2. Customer contacts: required booking name/email/phone fields and notice/consent copy.
3. Membership: trial activation and repeat-trial rules; trial marketplace/gateway eligibility; expiry and existing-booking access; auto/manual renewal; monthly-to-intro-annual eligibility.
4. Refer Me: observable counter definition/deduplication. Share opens must not be displayed as delivered referrals or verified recommendations. No cash rewards.
5. Reviews: completed-booking eligibility, off-platform testimonials, duplicate prevention and moderation. No invented ratings, qualification/identity badges or Google import.
6. Gateway: supported provider merchant/settlement arrangement and fee bearer. Keep optional customer checkout independent from SL membership billing. Decide these before real payments.

The first milestone's marketplace is a published-snapshot discovery foundation (first 100 cloud rows), without membership eligibility, availability/date filtering, recommendation counters or ratings logic. Pagination/server-side search and live publication/expiry eligibility are required before public-scale discovery. Comparison defaults to up to three within one category; review inclusions/price basis instead of treating headline prices as equivalent.

Production deployment, paid subscriptions, real payment tests and external messaging still require a separate user instruction.
