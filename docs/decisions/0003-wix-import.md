# 0003: One-step import from the live Wix site

**Date:** 2026-11-14 · **Decided by:** Jason (for Real Care)

## Decisions
- The live site is realcaretraining.com (Wix site `823d5027-fa74-4041-9281-12c10fed3385`). The draft duplicate was moved to the Wix trash.
- Bring everyone over, but **no logins and no notifications** until admins send invites. `notify()` now stays silent for any provider without a login.
- **Blocked** Wix members are never imported.
- Wix label **FCG = Family Caregiver**. **RCI Provider** is a new, fifth provider type (an alternate contractor status); it starts with the SCC/DSP course list.
- The **course list matches Wix exactly**: All-Access is the 14 core courses (English and Spanish versions count once); Documentation, QMAP,
  Injection Administration and Employee Orientation are invite-only (also visible when a provider's type requires them); Respite is open to all.
- Training history becomes the provider's first year ("Wix history"), starting on their earliest Wix completion. The renewal rule
  (0002) then decides whether the next year is current or already overdue.
- The free "Real Care Providers & Caregivers" plan becomes All-Access paid by Real Care with no end date; a paid All-Access term keeps its Wix dates.

## How it works
1. A full admin opens Import from Wix → Import everyone from Wix and presses Pull. The server reads Wix with a read-only API key
   (`lib/wix-client.ts`), maps it (`lib/wix-import.ts`), and stages it (`stage_wix_import`).
2. The preview sorts people: ready, needs a type, already in the portal, same email twice, no email. Staff can fix types.
3. Add (`commit_wix_import`) creates the accounts, history and access in one transaction.

## Safeguards
- Real Wix data is refused by the database while demo mode is on; the fictional sample (`lib/wix-sample.ts`) is refused outside demo mode.
- Wix credentials exist only in the production Vercel project. Nothing fetched is logged; errors carry the step and HTTP status only.
- Staging tables are read-only to staff through RLS and audited; only full admins can stage, edit types, commit or discard.

## Limits
- Wix keeps only the latest completion per person per course, so earlier years aren't available.
- Single-course purchases made on Wix outside the two plans are not carried over.
