# Phase 1: Accounts and training

**Window:** Nov 23, 2026 to Jan 15, 2027 (8 weeks including Thanksgiving and the winter holidays, about 160 hours)
**Goal:** providers take all required training in the portal, renewal happens automatically on each provider's due date, and staff print transcripts in one batch. Wix stops being needed for training.
**Data in this phase:** real provider names, emails and training records go into production. Training records are not PHI. Forms, individuals' details and uploads do not enter production until Phase 2.

## Assumptions from Phase 0 decisions (confirm against `docs/decisions/`)

- Renewal is an individual due date. Placeholder rule until T03 confirms it: the next cycle opens 12 months after the provider's previous cycle start, with a 30-day grace period.
- Provider types: Family Caregiver, Host Home, SCC/DSP, NMT. One provider may hold several.
- The requirements matrix in `docs/decisions/requirements-matrix.md` lists which courses each type needs.
- Fees: QMAP $30 for 60 days of access, single course $10, All-Access $75 for 12 months. Real Care can mark a provider as "paid by Real Care".

## Gate to Phase 2 (the agenda's acceptance test)

- [ ] On a test provider's renewal date, the next cycle opens automatically, all required courses show as due, badges reflect only the current cycle, and last year's completions are still on the record and transcript.
- [ ] No manual course-by-course or badge-by-badge reset is needed for any provider.
- [ ] A test month of transcripts for all providers prints as one PDF batch. Missing and unmatched data appear in an exceptions list instead of being dropped.
- [ ] QMAP and course fees display and charge correctly in Stripe test mode, then in live mode with one real purchase refunded.
- [ ] Course activity, progress and completion show accurately for a provider in the staff console.
- [ ] Five pilot providers finish at least one course each, including one in Spanish, and their feedback is logged.
- [ ] Legacy Wix completions are imported and match the transcript program for a sample of 20 providers.

## Task overview

| ID | Task | Weeks | Est. hours | Depends on |
| --- | --- | --- | --- | --- |
| T101 | Production project and environments | 1 | 2 | Phase 0 |
| T102 | Course content admin | 1 to 2 | 12 | T101 |
| T103 | Video pipeline with progress tracking | 1 to 2 | 14 | T102 |
| T104 | Course player for providers | 2 to 3 | 14 | T103 |
| T105 | Quiz engine | 3 | 10 | T102 |
| T106 | Completions and certificates | 3 | 8 | T104, T105 |
| T107 | Requirements and training cycles engine | 3 to 4 | 14 | T106 |
| T108 | Due-date reminders | 4 | 6 | T107 |
| T109 | Provider training dashboard and badges | 4 | 8 | T107 |
| T110 | Payments and entitlements | 4 to 5 | 14 | T102 |
| T111 | Staff training console | 5 | 12 | T107 |
| T112 | Transcripts and exceptions | 5 to 6 | 12 | T111 |
| T113 | Course content migration | 2 to 6 | 16 | T102 to T105 |
| T114 | Legacy identity and completion import | 6 to 7 | 14 | T107, T019 |
| T115 | Onboarding flow | 6 | 6 | Phase 0 T14 |
| T116 | Respite and specialty course visibility | 6 | 2 | T107 |
| T117 | Pilot with five providers | 7 to 8 | 8 | all above |
| T118 | Phase 1 demo and gate review | 8 | 2 | all |
| | **Total** | | **174** | |

174 hours runs about 14 over budget. If needed, move the full T113 migration of Spanish videos into the first week of Phase 2. English courses and QMAP must be in place for the gate.

---

### T101 Production project and environments
- Create `realcare-portal-prod` in the Real Care Supabase organization (Pro for now). Enable point-in-time recovery and daily backups.
- Production Vercel environment and domain (`portal.realcarecolorado.com` or the chosen address), with HTTPS.
- Copy migrations only. Production never gets seed data.

**Done when**
- [ ] Production migrates from the repo and serves the app at its domain; staging and production use separate keys.

### T102 Course content admin
- Staff console pages for courses, English and Spanish versions, lessons (video, reading, quiz), ordering by drag and drop, and publish or unpublish.
- Reading lessons use a safe rich-text editor that stores sanitized HTML.
- Only `training_admin` and `super_admin` can edit; every change is audited.

**Done when**
- [ ] A training admin can build a course with two languages and three lesson types and preview it as a provider.

### T103 Video pipeline with progress tracking
- Direct upload from the staff console to Mux; webhook stores the asset and playback IDs.
- Signed playback tokens issued by the server only to enrolled providers.
- The player reports progress every 15 seconds and on pause or end. A lesson counts as watched at 90 percent or more (adjustable in settings).
- Captions: upload `.vtt` files for English and Spanish.

**Done when**
- [ ] Watching a video to 90 percent marks the lesson complete; skipping to the end without watching does not.

### T104 Course player for providers
- Course page: lessons in order, progress bar, resume where the provider left off, language toggle that keeps progress.
- Mobile first, readable at 375 px, works on a slow connection.
- Readings show "Mark as read" after the provider scrolls to the end.

**Done when**
- [ ] A provider can start a course on a phone, stop, and resume on a computer at the same lesson.

### T105 Quiz engine
- Question types: single choice and multiple select, with explanations shown after answering.
- Pass mark per quiz (default 80 percent), unlimited retakes unless set otherwise, question order shuffled.
- Attempts stored in `quiz_attempts`; staff can view scores.
- Quiz banks load from the existing QMAP and course quiz files.

**Done when**
- [ ] A failed attempt shows what to review; a passing attempt unlocks course completion.

### T106 Completions and certificates
- A course completes when every required lesson is done and the quiz is passed. Write `completions` with the current `cycle_id`, language and score.
- Generate a PDF certificate (Real Care branding, provider name, course, date, cycle) to private storage; providers download it with a signed link.

**Done when**
- [ ] Completing a course creates exactly one completion for that cycle and a downloadable certificate.

### T107 Requirements and training cycles engine
- On activation, create the provider's first cycle with a due date set by the renewal rule.
- A nightly Edge Function finds providers whose next cycle should open, inserts the new cycle, and sets new enrollments for every required course. It must be **idempotent**: running it twice changes nothing.
- When provider types change, requirements update for the current cycle.
- Statuses: `current`, `due_soon`, `overdue`, `complete`.
- Tests cover a renewal crossing a year end, a leap day, a provider with two types, and an overdue provider.

**Done when**
- [ ] Time-travel tests show a provider moving from cycle 1 to cycle 2 on the right date with cycle 1 untouched.

### T108 Due-date reminders
- Email and in-app reminders at 30, 14 and 3 days before the due date and on the overdue date, in the provider's language.
- Messages name the course count and link to the portal, nothing more.
- Respect quiet hours (no sends between 9 pm and 7 am Mountain).

**Done when**
- [ ] A seeded provider due in 14 days receives exactly one reminder in their language.

### T109 Provider training dashboard and badges
- "My training" view: due, in progress, complete this cycle, with the due date shown prominently.
- Badges come from the `current_badges` view; past cycles appear under "History".

**Done when**
- [ ] A provider can answer "What training do I need, and by when?" from the home screen.

### T110 Payments and entitlements
- Stripe products for QMAP, single courses and All-Access; Stripe Checkout from the course page.
- Verified webhook writes `orders` and `entitlements`; enrollment checks entitlements before opening paid courses.
- Staff can grant a "paid by Real Care" entitlement with a reason (audited).
- Refunds in Stripe remove the entitlement.

**Done when**
- [ ] Test-mode purchases open the right access for the right length of time; QMAP shows $30 and charges $30.

### T111 Staff training console
- Compliance table: every provider with type, cycle due date, required count, completed count, status; filters and search.
- Provider training tab: courses this cycle, lesson progress, quiz attempts, history by cycle.
- Bulk actions: open a new cycle for selected providers (with confirmation and a count), extend due dates, resend reminders.
- Manual completion override (for training done offline) requires a reason and is audited.

**Done when**
- [ ] A staff member can find every overdue Host Home provider and resend their reminders in under a minute.

### T112 Transcripts and exceptions
- Transcript per provider: every course, completion date, cycle, language, score; "Data as of" timestamp.
- Batch generation for a reporting period and a provider filter, one combined PDF ready to print, saved in `transcript_runs`.
- Exceptions list: providers missing required courses, legacy records that did not match, duplicate-looking names.

**Done when**
- [ ] A monthly batch for all providers finishes in under two minutes and matches the handwritten version for a sample month.

### T113 Course content migration
- Download every Wix course's videos, slides and text. Upload the videos to Mux with captions.
- Load the 14 core courses and QMAP in English and Spanish; quiz banks from existing files.
- Follow the content rules in CLAUDE.md: slide order matches the source; voiceover scripts are fully spoken.
- Checklist per course: lessons, video, captions, quiz, Spanish version, previewed by Real Care.

**Done when**
- [ ] All 15 courses are published in English; Spanish versions are published or listed with a date.

### T114 Legacy identity and completion import
- Real data only in production, through a staff-only import screen. Never in the repo, never in prompts.
- Reuse the CSV parsing from `wix-transcript-creator`.
- Step 1, identities: upload Wix member and WordPress user exports; match by email, then name plus phone; staff review screen to confirm, merge or reject matches.
- Step 2, completions: upload course participant CSVs; load as completions in a "Legacy (Wix)" cycle with original dates and `source = legacy_wix`.
- Step 3, current cycle: set each provider's due date from their most recent Wix completions per the renewal rule.
- Active All-Access plans carry over as entitlements with their end dates.

**Done when**
- [ ] Twenty sampled providers match the transcript program exactly; unmatched rows appear in the exceptions list.

### T115 Onboarding flow
- Staff send invites singly or in a batch from a selection. The invite email is bilingual.
- First login: set language, confirm name and phone, short welcome screen, "Start your training" checklist.
- Help page with a short how-to in English and Spanish and a "Contact Real Care staff" message link (placeholder until Phase 3 messaging).

**Done when**
- [ ] A new provider goes from invite email to their first lesson in under three minutes on a phone.

### T116 Respite and specialty course visibility
- Specialty courses (respite and others in the matrix) show to the provider types that need them and in a "More training" list for others.

**Done when**
- [ ] The respite module appears on the dashboard for every provider type that requires it.

### T117 Pilot with five providers
- Invite the five pilot providers in production. Watch the first sessions with them if possible.
- Log every confusion point and bug; fix the blocking ones before the gate.

**Done when**
- [ ] Pilot feedback is logged in `docs/pilot-phase-1.md` and blocking issues are closed.

### T118 Phase 1 demo and gate review
- Demo the gate checklist live: renewal by time-travel on staging, a transcript batch, a QMAP purchase, a Spanish course.
- Record sign-off; agree on the date training moves off Wix for new enrollments.

**Done when**
- [ ] Gate signed off; `docs/PHASE-2.md` reviewed with Real Care.
