# Production setup: Phase 1 (providers + training only)

Prepared Nov 10, 2026. Goal: Real Care staff use the admin side with their real provider roster, without client data.

## Decision first (Jason)

Phase 1 stores provider names, emails, phone numbers, provider types and training records. It stores **no information about the people Real Care supports**: the client features (people supported, forms, client documents) are switched off by `app_settings.client_features = false`, which is the production default.

- **Option A: go live now for Phase 1.** Provider training records are workforce records, not PHI. Keep client features off until the HIPAA step. Still use paid plans for backups and support.
- **Option B: sign the BAAs first.** Supabase Team + HIPAA add-on and Vercel's HIPAA BAA, then launch. Slower and more expensive, but no second migration later.

Either way, client features stay off until the BAAs are signed and the HIPAA review is done (CLAUDE.md rules 3–5).

## What's ready in the code

- All 15 database migrations are in `supabase/migrations/`, including the first three that were only in the hosted demo database until today.
- `20261028163407_demo_reset.sql` is **demo only**. Skip it in production.
- Settings to apply right after the migrations (the security migration inserts the demo's values, so this step is required):
  `update public.app_settings set demo_mode = false, staff_mfa_required = true, client_features = false where id = 1;`
- Demo mode is off unless `NEXT_PUBLIC_DEMO_MODE=true` is set or the app points at the demo database, so no demo accounts or tours appear.

## Steps (about half a day, most of it waiting on accounts)

| # | Step | Who | Notes |
| --- | --- | --- | --- |
| 1 | Make the GitHub repository private | Jason | Settings → General → Danger zone |
| 2 | Create the Supabase project `realcare-portal-prod` (US region) | Jason | Paid plan; HIPAA add-on if Option B |
| 3 | Turn on leaked-password protection, email confirmation, and set the site URL | Jason | Supabase → Auth |
| 4 | Apply the migrations in order, skipping `demo_reset` | Claude | Then run the advisors and the SQL tests in `supabase/tests/` against a throwaway branch, not production data |
| 5 | Load course content (courses, lessons, quizzes, requirements, programs) without the fake people | Claude | Needs a content-only seed: split `generate_seed.py` (open task) |
| 6 | Create the private `training-media` and `documents` buckets and upload the course videos | Claude | Same storage paths as the demo |
| 7 | Create a Vercel project for production, with the production Supabase URL and key | Jason / Claude | Do not set `NEXT_PUBLIC_DEMO_MODE` |
| 8 | Connect a domain, e.g. `portal.realcarecolorado.com` | Real Care IT | One DNS record |
| 9 | Set up transactional email (Postmark or Resend) for invites and notices | Jason | PHI-free messages only |
| 10 | Create staff accounts, set permission levels, and set up two-step sign-in for each | Claude + staff | Full admin first |
| 11 | Upload the roster (Add providers → Upload your roster) and import Wix history | Real Care staff | Spot-check 10 providers |
| 12 | Upload the two DCW Notice pages, then assign the course to the right providers | Real Care staff | Course editor → each reading lesson |

## What Real Care needs to send

1. **Roster** in the template (`/provider-roster-template.csv`): full name, email, phone, provider type(s), hire date, training-year start, language.
2. **Renewal rule:** each provider's own anniversary, or one agency-wide date?
3. **Requirement matrix:** which courses each provider type needs (the demo uses the realcaretraining.com set).
4. **Wix exports** of past completions, per course.
5. **Staff list** with a level for each: Reviewer, Training admin, or Full admin.
6. The **DCW Notice of Rights** as two images or a PDF (attached to Torey's Nov 2 email).
