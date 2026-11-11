# Phase 1 operations: status and task overview

Updated Nov 10, 2026, after Torey Innes' Nov 9 priorities and Nov 2 DCW Notice request. Everything below is live in the demo with fictional data; nothing uses real provider data yet.

## Built today

| # | Item | Where | Status |
| --- | --- | --- | --- |
| 1 | Add a provider without a login | Admin → Add providers | Done |
| 1 | Upload the whole roster from a spreadsheet (CSV), with row-by-row checks | Admin → Add providers | Done |
| 1 | Send a login later; the invite keeps all training history | Provider page → Login | Done (link shown; emailed in production) |
| 1 | Edit a provider's name, phone, types, hire date, language | Provider page → Details | Done |
| 1 | First training year starts on the latest anniversary of their start date | Automatic | Done |
| 2 | Assign a course to one provider or many at once, one time or every year | Provider page, or select providers → bulk bar | Done |
| 2 | Exempt a provider from a required course, with a required reason | Same | Done |
| 2 | Invite-only courses: only assigned providers can see them | Course settings | Done |
| 2 | One-time courses stay done after the yearly renewal | Automatic | Done |
| 3 | DCW Notice of Rights course: two pages + signed acknowledgment | Courses → DCW Notice of Rights | Built; **waiting for the two pages** to upload |
| 3 | Upload a page (PDF or image) to any reading lesson | Lesson editor | Done |
| 3 | Signed acknowledgment (checkbox + typed name, exact words saved) shown on the printable certificate | Certificate | Done |
| 4 | Core database setup saved to the code repository | `supabase/migrations/` | Done |
| 4 | Production setup guide | `docs/PRODUCTION-SETUP.md` | Done; steps need Jason's accounts |
| 5 | Staff levels: Reviewer, Training admin, Full admin, enforced in the database | Admin → Staff & permissions | Done |
| 6 | Client-features switch (people supported, forms, documents hidden) | `app_settings.client_features` | Done; on in demo, off by default in production |

Checks: 27 database tests for these features pass, the earlier 23 program tests and 4 MFA tests still pass, and the Supabase security advisor shows only the leaked-password setting.

## Added Nov 10–11 (from Jason's notes)

| Item | Where | Status |
| --- | --- | --- |
| Full client record (no login): client #, goes by, status (prospective / active / on hold / discharged), program, county, residence, language, service dates, case manager | Admin → Clients → a client | Done |
| Providers linked to a client as primary, respite, temporary or prospective (prospective can't see the client's forms yet) | Client page | Done |
| Real Care staff assigned to a client (coordinator, nurse, supervisor) | Client page | Done |
| Assign forms from the client's page to that client's providers, one time or repeating | Client page | Done |
| Client list: search, filter by status, program, county, provider, staff; sort; overdue counts | Admin → Clients | Done |
| Form records: every form searchable by client and by provider (and form, status, dates) | Admin → Form records | Done |
| Roster upload reads Wix contact/member exports; nobody is notified or can sign in until an admin sends logins | Add providers | Done |
| Bulk "Send login invites" for selected providers | Providers list | Done |
| DCW Notice of Rights | Paused (built, unpublished, unassigned) | Paused |

The real Wix roster goes into the production site only (never the demo). Two Wix sites are named "Real Care, Inc. Training"; confirm which one is live.

## Needs Jason (accounts and decisions)

1. **Decide:** launch Phase 1 before the HIPAA agreements (provider and training data only, client features off), or sign the agreements first.
2. **Make the GitHub repository private.**
3. **Create the production Supabase project and Vercel project** (paid plans).
4. **Turn on leaked-password protection** in Supabase Auth.
5. **Choose an email service** (Postmark or Resend) so invites and reminders send automatically.
6. **Delete the stray `smoke-hold` branch** on GitHub.

## Needs Real Care

1. Active provider roster in the template.
2. Renewal rule: each provider's anniversary, or one agency date.
3. Confirm the course list for each provider type (All-Access currently has 17 courses; realcaretraining.com says 14).
4. Wix completion exports.
5. Staff list with a level for each person.
6. The two DCW Notice pages as images or a PDF.

## Next build tasks (Claude)

| Task | Size | Notes |
| --- | --- | --- |
| Content-only seed for production (courses without fake people) | Small | Needed before step 5 of the production guide |
| Stand up production once accounts exist; apply migrations; load content and videos | Small–medium | Follow `docs/PRODUCTION-SETUP.md` |
| Send invites and notices by email (Postmark/Resend Edge Function) | Small | Messages stay PHI-free |
| Create staff accounts from the Staff page instead of Supabase | Small | Full admin only, MFA required |
| Course page and profile badges reflect one-time completions after renewal | Small | Training list already correct |
| Ask Torey for the Master Provider Profile & Intake document | — | Shapes Phase 2 |

## Phase 2 and 3 (from Torey's plan)

- **Phase 2, provider compliance (large):** requirement types (Initial, Subsequent, Client-specific, Conditional) and statuses (Required, Not applicable, Pending, Complete); required vs. on file vs. reviewed vs. expiring; follow-up owner and resolution date; documents tied to both a provider and a client; master profile (background checks, insurance, vehicle, contracts); intake, rosters, meet-and-greets, placement readiness. Today's per-provider assignment and exemption model is the start of this: it extends from courses to documents.
- **Phase 3, client-centered system (large, needs HIPAA):** the client record at the center, with care plans, tracking forms (12 converted forms ready), monitoring, meetings, follow-ups and staff assignments, replacing the Excel trackers.
