# Phase 4: Migration and cutover

**Window:** Apr 12 to Apr 30, 2027 (3 weeks, about 60 hours), followed by about one month of running beside the old sites, ending in late May 2027.
**Goal:** every provider is in the portal, staff are confident using it, the old sites are read-only, and Real Care has what it needs to run and support the system.

## Gate: project complete

- [ ] All active providers invited; at least 90 percent have signed in and are current on training or have a due date.
- [ ] Final legacy import reconciled; the exceptions list is empty or every item has a decision.
- [ ] Staff trained; runbook and admin guide handed over.
- [ ] realcaretraining.com and the intranet form links redirect to the portal; both old systems are read-only; exports archived.
- [ ] Wix subscription cancelled at the end of the parallel month.
- [ ] Support arrangement signed.

## Task overview

| ID | Task | Weeks | Est. hours | Depends on |
| --- | --- | --- | --- | --- |
| T401 | Final legacy import and reconciliation | 1 | 8 | Phase 1 T114 |
| T402 | Production hardening | 1 | 8 | Phases 1 to 3 |
| T403 | Runbook and admin guide | 1 to 2 | 8 | all |
| T404 | Staff training sessions | 2 | 6 | T403 |
| T405 | Provider guides and how-to videos | 1 to 2 | 8 | Phase 3 |
| T406 | Invitation waves and launch support | 2 to 3 | 8 | T401, T405 |
| T407 | Parallel run and fixes | 3 + one month | 8 | T406 |
| T408 | Redirects, read-only and archives | after T407 | 4 | T407 |
| T409 | Retire Wix and decide the intranet's future | after T408 | 1 | T408 |
| T410 | Handoff and support agreement | 3 | 2 | all |
| | **Total** | | **61** | |

---

### T401 Final legacy import and reconciliation
- Fresh exports from Wix (members, all course participants, pricing plans) and WordPress (users), taken after the last Wix enrollments.
- Re-run the Phase 1 import for anything new since the first import; staff review new matches.
- Compare totals per course with Wix; sample 30 transcripts against the old transcript program.

**Done when**
- [ ] Course totals match Wix within known, explained differences; sample transcripts match.

### T402 Production hardening
- Rate limits on login, invite, the public Provider Application and file uploads.
- Restore test: restore a production backup to a scratch project, confirm it works, then delete the scratch project.
- Dependency audit, Supabase security and performance advisors clean, secrets rotated.
- Light security test: try to reach another provider's data, files and messages with a test account; try the public routes for abuse.

**Done when**
- [ ] Results recorded in `docs/hardening.md`; no open high-severity items.

### T403 Runbook and admin guide
- Runbook (for whoever supports the system): architecture, environments, deploys, migrations, backups and restore, rotating keys, cron jobs, the nightly renewal job, what to do when a provider is locked out, incident response for a suspected data exposure.
- Admin guide (for Real Care staff): inviting and deactivating providers, linking individuals, assigning forms, reviewing and returning items, running transcripts, managing courses, reading reports.
- Both stored in the repo and in the Real Care project.

**Done when**
- [ ] A Real Care staff member follows the admin guide to invite a provider and run transcripts without help.

### T404 Staff training sessions
- Two 60-minute sessions: one for reviewers (queue, corrections, messages, incident reports), one for training admins (courses, cycles, transcripts, payments, reports). Record both.

**Done when**
- [ ] Recordings saved; every staff user has logged in with MFA.

### T405 Provider guides and how-to videos
- One-page guide in English and Spanish: signing in, the dashboard, training, forms, uploads, messages.
- Short how-to videos (about 2 minutes each) in both languages, scripted to the house voiceover rules: fully spoken, no stage directions, "contact Real Care staff" instead of phone numbers or emails.
- Put both in the portal's help page and in the invite email.

**Done when**
- [ ] Guides and videos published in the help page in both languages.

### T406 Invitation waves and launch support
- Waves of about 50 providers, grouped by provider type, two or three days apart. Pilot providers can help others in their group.
- Daily check of sign-in rates, invite bounces and support messages; resend or fix contact details for anyone not signed in after 5 days.

**Done when**
- [ ] All active providers invited; sign-in rate tracked in `docs/launch-log.md`.

### T407 Parallel run and fixes
- For one billing month: new enrollments and all new paperwork only in the portal; Wix and the intranet kept for lookup.
- Weekly check-in with Real Care; triage and fix issues.

**Done when**
- [ ] Two consecutive weeks with no blocking issues.

### T408 Redirects, read-only and archives
- Redirect realcaretraining.com pages and the intranet form links to the matching portal pages.
- Set the intranet forms to closed with a notice and link; archive the Gravity Forms entries (17 at last count) and the Real Care Private Exchange messages as PDFs to Real Care's records.
- Keep final Wix exports for the retention period.

**Done when**
- [ ] Old links land in the portal; archives stored and listed in `docs/archives.md`.

### T409 Retire Wix and decide the intranet's future
- Cancel the Wix plan at the end of the parallel month.
- Decide with Real Care whether the WordPress intranet stays for staff-only tools (leave, org chart, bookings, directory) or retires. If it retires, export and archive, then cancel hosting.

**Done when**
- [ ] Decision recorded in `docs/decisions/`; cancellations confirmed.

### T410 Handoff and support agreement
- Agree on a support retainer: response times, monthly hours, what counts as a fix and what is new work, and a yearly review.
- Confirm Real Care owns every account (GitHub, Vercel, Supabase, Stripe, Mux, email, domain) with at least two Real Care owners.

**Done when**
- [ ] Agreement signed; ownership checklist complete.
