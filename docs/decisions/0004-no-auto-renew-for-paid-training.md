# 0004: Paid training never renews or charges automatically

**Date:** 2026-11-19 · **Requested by:** Real Care (Torey Innes, Nov 16, 2026) · **Recorded by:** Jason's assistant, for Jason's review

## Context
A provider who bought training last year was charged again automatically. The charge came from the live Wix site
(realcaretraining.com), where the All-Access Package was first sold as a yearly subscription. The plan was changed to a
one-time 12-month purchase on Sep 8, 2026, but orders placed before that change kept their recurring terms.

The portal had the same pattern waiting: a per-program "Renew automatically" switch, and a note that production would use a
Stripe subscription for paid programs.

Real Care's rule: "A training purchase should provide access for the applicable period, without automatically renewing or
charging the customer again. Once access expires, the individual should simply lose access until they need the training
again and choose to repurchase it."

## Decision
- Paid programs and paid single courses never renew or charge on their own, in demo mode or production.
- Production payments use one-time Stripe Checkout only. No Stripe subscriptions for training.
- When a term ends, access ends. The provider sees the end date, gets the existing "ending soon" reminders, and can buy again.
- Programs Real Care pays for (price 0) may still renew automatically, because nobody is charged.

## Implementation
`supabase/migrations/20261119150000_no_auto_renew_for_paid_training.sql` turns off saved auto-renew on paid programs,
makes `set_auto_renew()` refuse paid programs, and limits `_program_autorenew()` to free programs.
The Programs page shows "No automatic charges" instead of the switch on paid programs. Checks in `supabase/tests/programs.sql`.

## Still to do outside the portal (needs Jason's yes)
- Wix: stop auto-renewal on the All-Access orders that still carry the old yearly-subscription terms.
- Wix: the plan's one-purchase-per-member lifetime limit would block a provider from buying again after access ends.
