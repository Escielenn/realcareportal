# ADR 0001: Programs (annual packages)

Date: 2026-10-28. Status: built on branch `p3/programs`, waiting for the migration to be applied.

## Context
realcaretraining.com sells one plan, the All-Access Package ($75, 12 months, the core courses with certificates), plus single courses ($10; QMAP $30). Real Care wants more programs like it: yearly packages people opt into that unlock a set of courses.

## Decision
- New `programs` and `program_courses` tables. A program has a price per term, a term length (default 365 days), an optional audience (provider types), and an "offered" switch.
- `orders` and `entitlements` gain `program_id`. Course access (`has_course_access`) = free course, or a single-course entitlement, or an active program that includes the course.
- The All-Access Package becomes a program with a fixed id. Existing All-Access entitlements were moved onto it.
- Joining or renewing goes through `join_program()` (provider) or `grant_program()` (staff, Real Care pays). Both call one internal helper, `_join_program()`, which a Stripe webhook will also call later.
- Renewing early stacks: the new term starts the day after the current one ends. Providers can renew from 60 days before the end date.
- Reminders 30 and 7 days before the end, and the day after. Notifications are PHI-free.
- Paid checkout only works while `app_settings.demo_mode` is on. Free programs can always be joined.
- Programs are never deleted (no delete policy); staff hide them instead, so order history keeps its reference.

## Not decided (ask Jason)
- Do programs auto-renew with a saved card (Stripe subscription) or does each provider renew by hand each year (Stripe one-time Checkout)? The schema supports both.
- Should a program's price differ by provider type?
