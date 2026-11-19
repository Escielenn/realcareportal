# 0004: Program members renew yearly by default

**Date:** 2026-11-19 · **Decided by:** Jason (for Real Care), after the Nov 19 meeting with Torey and Rene

## Context
Real Care wants members, paying and free, to continue "without us having to do anything" as they move from the Wix
training site into the portal. Earlier (Nov 16) Real Care reported a member who was charged again and was surprised.
The portal had an auto-renew switch per program, but it was off unless the provider turned it on.

## Decision
- Joining a program turns automatic renewal on, whether the provider bought it, staff gave it, or it came over from Wix.
- Providers can turn it off on the Programs page at any time; a choice to turn it off is never overwritten.
- Members with auto-renew on get notice 30 days and 7 days before the renewal, so a yearly charge is not a surprise.
- Members who turn it off get the existing "ending soon" reminders and lose access on the end date.

## Implementation
`supabase/migrations/20261119190000_yearly_auto_renew_default.sql`: a trigger on `entitlements` sets the default,
existing members without a saved choice are switched on, and `_program_reminders()` adds the 30-day notice.
Checks in `supabase/tests/programs.sql`.

## Still open
- Paid renewals in production need Stripe saving the card and charging it each year (planned; not built). Until then
  the nightly job renews paid programs only in demo mode.
- On the live Wix site, the 38 All-Access orders from before Sep 8, 2026 still renew yearly, which now matches this
  decision. Members who bought after Sep 8 hold one-time 12-month plans that will not renew on Wix.
