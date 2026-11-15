# 0002: Annual training is due a year after finishing

**Date:** 2026-11-14 · **Decided by:** Jason (for Real Care)

## Context
The first renewal job opened a new training year on the old year's due date whether or not the old year was finished.
"Overdue" lasted about one night before the next year replaced it, so a provider who last trained in June 2025 looked current in November 2026.

## Decision
- A training year is **finished** on the day the provider completes the last of its required courses
  (annual courses in that year; one-time courses count from any year).
- The next year is **due 12 months after that day**. It opens 60 days before it is due, so reminders and early completions land in it.
- An **unfinished year never rolls over**. It stays overdue until it is done, then the next year is due 12 months later.
- History is never deleted: every year stays as its own `training_cycles` row.

## Implementation
`public.cycle_finished_on(provider, cycle)` and `public._run_renewals(date)` in
`supabase/migrations/20261114210000_wix_import_and_renewals.sql`. Checks in `supabase/tests/wix_import.sql`.

## Options not chosen
- Fixed hire-date anniversary that stays overdue: simpler calendar, but doesn't match how Real Care described renewals.
- Each course expiring on its own date: most precise, but a larger model change. Can be revisited later.
