# Demo script: Real Care Portal (Phase 1 preview)

**URL:** https://realcareportal.vercel.app
**Data:** everything is fictional. Demo accounts sign in with one click on the login page (shared password `RealCare-Demo-2026`).

| Account | Who | Use it to show |
| --- | --- | --- |
| Provider (English) | Maria Delgado, Host Home | Dashboard, returned form, training, video, paid course, certificate |
| Proveedor (español) | Luis Herrera, SCC/DSP | Full Spanish experience |
| Real Care staff | Dana Whitfield | Staff console, course builder, import, invites, renewal, transcripts |
| New provider | Riley Morgan (pending invite) | First-time experience from an invitation link |

About 25 minutes. Do the renewal step last, because it opens Maria's next cycle.

## 1. A provider's day (Maria, about 8 minutes)

1. Sign in as **Provider (English)**. The home screen answers the agenda's six questions. The bell shows 2 unread notifications.
2. **Needs your attention → Fix now** on the returned log note for Sam. Only the two flagged fields can change. Fix them and send.
3. **Training**: 12 of 15 done, due Oct 30. QMAP shows a lock ($30).
   - Open **Confidentiality**: read both lessons, take the quiz (get one wrong first to show the explanation), pass, **View certificate**.
   - Open **QMAP**: it's locked. **Buy this course** (demo checkout, no card). It opens with 60 days of access. Show **Profile → Payments**.
4. Open **Welcome to Real Care Training → A quick tour of your portal** (40-second video). Point out the "watched" counter: skipping ahead doesn't count; the lesson completes at 90% of real watch time.
5. Switch **EN → ES**. Everything switches, including courses, quizzes, forms and notifications.
6. **Forms → RCI Log Notes (Jordan)**: name and goals pre-fill; answer "Yes" to medication to show the follow-up question. Submit.
7. **Messages**: send staff a question. **Profile**: language, phone and email preferences.

## 2. The staff side (Dana, about 12 minutes)

1. Sign in as **Real Care staff**. **Overview**: review queue, incidents, overdue, due soon, unanswered messages.
2. **Review queue**: the incident report is on top. Accept Maria's corrected log note; return another form with a field-level note.
3. **Providers & training**: filter **Overdue**, select providers, **Send reminder**, then show the emails in **Email outbox** (fixed templates, no private details, sent in each provider's language).
4. Open **Maria Delgado**: training by cycle, people supported (Taylor's link ended, so access is gone), course access, **Record training done elsewhere** (requires a reason), **Give access paid by Real Care**, and her messages.
5. **Courses**: open **Confidentiality** to show bilingual lessons, the quiz editor with answer key (staff only), and the reading preview. Create a new course, add a reading, a video upload and a quiz, then publish it.
6. **Requirements**: the matrix of which courses each provider type needs. Toggling a box updates every dashboard right away.
7. **Import from Wix**: download the sample Communication CSV, upload it, and review the matches: email matches, a typo'd email matched by name, a duplicate that's skipped, a date outside any cycle, and an unknown person to match by hand or leave out. **Import**, then open Kayla Ortiz to see the imported completion.
8. **Invite providers**: create an invitation and copy the link. Or open Riley Morgan's waiting invitation in a private window: set a password, land on the getting-started checklist with a welcome message and an open training cycle.
9. **Transcripts**: all providers at once, filter by type and reporting period, exceptions list, **Print** as one batch.
10. **Payments & access**: orders, refunds, and grants paid by Real Care.
11. **Overview → Annual training renewal**: run as of **Oct 30, 2026**. Maria's next cycle opens; her history stays. Show the "Your annual training is open" email in the outbox. (Also runs automatically every night at 1:15 AM.)
12. **Audit log**: sign-ins, views, submissions, reviews, imports, grants, renewals, with who and when, never the values.

## 3. Points to make

- One site replaces the intranet forms and the Wix training site.
- Providers only ever see their own records and the people they currently support. The database enforces this, not the screens.
- Renewal never deletes history; each year is its own cycle.
- The 14 Wix CSV downloads become a one-time import, then go away.
- Emails never carry private information, so the portal stays the only place PHI lives.

## Reset between demos

In the Supabase SQL editor for the **Realcareportal** project, run:

```sql
select demo.reset();
```

This restores every fictional record, including Riley's pending invite.

## What's simulated in this demo

| Feature | Demo | Production (Phase 1/2 plan) |
| --- | --- | --- |
| Card payments | Demo checkout, no card | Stripe Checkout + webhooks |
| Emails | Shown in the outbox, not sent | Postmark/Resend, same PHI-free templates |
| Video hosting | Supabase Storage with signed links | Mux streaming with captions |
| Invitations | Link copied by staff | Emailed automatically via Supabase Auth |
| Staff MFA | Not enforced | Required (Phase 0, T14) |
| Forms and uploads with real PHI | Fictional data only | After BAAs and the HIPAA review (Phase 2) |
