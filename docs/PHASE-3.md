# Phase 3: Communication and dashboards

**Window:** Mar 15 to Apr 9, 2027 (4 weeks, about 80 hours)
**Goal:** the portal becomes the one place providers and staff talk, and both sides can see at a glance what is done and what is owed.

## Gate to Phase 4

- [ ] The full test table from the October 21 agenda passes end to end on a phone and on a computer: account access, welcome and instructions, individualized paperwork, document submission, corrections, training, annual renewal, QMAP payment, communication, automated transcripts, mobile access, security.
- [ ] A provider can answer the agenda's six dashboard questions from the home screen without calling: what to complete, what paperwork is available, what was submitted, what was returned, what training is due, and whether Real Care sent a message.
- [ ] Messages and notifications reach the right provider and can be reviewed later.
- [ ] Staff reports match a manual count for one sample month.

## Task overview

| ID | Task | Weeks | Est. hours | Depends on |
| --- | --- | --- | --- | --- |
| T301 | Provider home dashboard | 1 | 10 | Phases 1 and 2 |
| T302 | Secure messaging | 1 to 2 | 16 | Phase 2 T212 |
| T303 | Announcements | 2 | 6 | none |
| T304 | Notification center and preferences | 2 | 8 | T302, T303 |
| T305 | Welcome automation | 2 | 3 | T304 |
| T306 | Staff reporting | 3 | 14 | Phases 1 and 2 |
| T307 | Staff home dashboard | 3 | 6 | T306 |
| T308 | Performance, accessibility and mobile pass | 4 | 8 | all above |
| T309 | Full acceptance test run | 4 | 5 | all above |
| T310 | Phase 3 demo and gate review | 4 | 2 | all |
| | **Total** | | **78** | |

---

### T301 Provider home dashboard
- One screen with cards in this order: Needs your attention (returned items, overdue), Due soon (forms and training with dates), Messages, Recently submitted (with status), Announcements.
- Each card links to the full list. Empty states say what "all done" looks like.
- Bilingual, mobile first.

**Done when**
- [ ] A pilot provider answers the six agenda questions from the home screen in a short usability check.

### T302 Secure messaging
- Threads between one provider and Real Care staff. Staff see a shared inbox with assignment to a staff member and a status (open, waiting, closed).
- Attachments use the Phase 2 document upload path and permissions.
- Read receipts, search within a provider's history, messages never deleted (hidden at most, audited).
- Carries over the useful ideas from the Real Care Private Exchange plugin; the old messages are archived as PDFs in Phase 4.
- Optional: staff can open a thread from a submission review ("Question about your log note").

**Done when**
- [ ] A provider sends a message from a phone; an assigned staff member replies; both see the history later; another provider cannot see it.

### T303 Announcements
- Staff post announcements to everyone or to chosen provider types, in English and Spanish, with optional pin and expiry date.
- Providers see unread announcements on the dashboard.

**Done when**
- [ ] An announcement to Host Home providers only appears for Host Home providers.

### T304 Notification center and preferences
- In-app bell with all notifications (assignments, returns, messages, announcements, training reminders).
- Providers choose email on or off per category; some (returned items, overdue training) cannot be turned off.
- All email stays PHI-free (Phase 2 tests apply).

**Done when**
- [ ] Turning off announcement emails stops them; returned-item emails still arrive.

### T305 Welcome automation
- On first login, a personalized welcome message from Real Care in the provider's language, posted to their inbox, with links to training and forms.
- Staff can edit the welcome text.

**Done when**
- [ ] Every newly activated provider receives the welcome message once.

### T306 Staff reporting
- Training compliance by provider type and by month; providers overdue; courses with the lowest completion.
- Paperwork: submissions by form and month, average time to review, items returned more than once, overdue assignments by provider.
- Filters by provider type, date range and status. CSV export is audited and excludes PHI fields unless the user is a super admin and confirms.

**Done when**
- [ ] One month of figures matches a manual count from the database.

### T307 Staff home dashboard
- Cards for: review queue size and oldest item, incident reports waiting, overdue training count, unanswered messages, renewals opening this week.

**Done when**
- [ ] A reviewer can see their day's work on one screen.

### T308 Performance, accessibility and mobile pass
- Lighthouse on key pages (dashboard, course player, form renderer): performance 85 or more on mobile, accessibility 95 or more.
- Screen reader check of login, dashboard and one form. Test on an older Android phone and an iPhone.

**Done when**
- [ ] Results logged in `docs/qa-phase-3.md`; serious issues fixed.

### T309 Full acceptance test run
- Run the agenda's test table with a test provider in each provider type, in both languages, on a phone and a computer. Record pass or fail for each row.

**Done when**
- [ ] Every row passes or has a fix scheduled before cutover.

### T310 Phase 3 demo and gate review
- Demo the complete provider journey from invite to accepted paperwork, training completion and a message reply.

**Done when**
- [ ] Gate signed off; cutover dates in `docs/PHASE-4.md` confirmed with Real Care.
