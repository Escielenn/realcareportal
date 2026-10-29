# Demo script: Real Care Portal (Phase 1 + Phase 2 preview)

**URL:** https://realcareportal.vercel.app
**Data:** everything is fictional. Demo accounts sign in with one click on the login page (shared password `RealCare-Demo-2026`).

| Account | Who | Use it to show |
| --- | --- | --- |
| Provider (English) | Maria Delgado, Host Home | Dashboard, returned form, training, video, paid course, certificate |
| Proveedor (español) | Luis Herrera, SCC/DSP | Full Spanish experience |
| Real Care staff | Dana Whitfield | Staff console, course builder, import, invites, renewal, transcripts |
| New provider | Riley Morgan (pending invite) | First-time experience from an invitation link |

About 35 minutes. Do the renewal step last, because it opens Maria's next cycle.

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
8. **Training → Documentation Submissions & Compliance**: one of Real Care's own trainings. The video plays right in the lesson (the watch counter only counts real viewing; the lesson completes at 90%), the full transcript is underneath (Spanish too), and the 10-question quiz uses the real answer key. Respite, RCI Injection Administration, Employee Orientation and the three-part QMAP are built the same way.
9. **Documents**: send a photo of a physician visit form for Jordan. On a phone, the file button opens the camera.
10. **Forms → Start a form → Incident Report**: the same page a QR code opens.

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

## 3. Paperwork and documents (Phase 2, about 10 minutes)

1. **Alerts**: incident reports, provider messages and new applications arrive here. The alert emails say only what kind of item is waiting.
2. **Documents**: accept Maria's upload, or return it with a note. Each open uses a 60-second private link and is logged.
3. **People supported**: open Jordan Avery. Links to providers have start and end dates; ending a link removes the provider's access to Jordan's forms and documents from that day.
4. **Forms & assignments**:
   - **Assign a form**: pick Standard Goal Tracking for Jordan, repeat **every week**. Only providers currently linked to Jordan are offered. The nightly job creates each new copy on its due date.
   - **Form library → Incident Report**: edit the form definition on the left and watch the live preview on the right, in English or Spanish. **Publish new version** keeps a history; forms already started keep their version.
   - **Converted intranet forms**: the library also holds the 12 Gravity Forms from the intranet, converted automatically and marked **Draft**. Open **DSP/SCC Provider Timesheet** to show rows that calculate hours (an overnight shift counts correctly) with totals, or **Medicaid Residential Attendance Record** to show the month grid with the special codes. Turning on **Active** makes a draft assignable. `docs/forms-conversion-report.md` lists what each one needs checked.
   - The **QR code** prints as a sign. Scanning it asks the provider to sign in, then opens a new copy of the form.
5. **Applications**: two people applied on the public **/apply** page. **Invite** creates their portal invitation link.

## 4. Programs, messages and security (Phase 3, about 8 minutes)

1. **As Maria → Training → Programs & pricing**: the All-Access Package ($75 for 12 months) ends tomorrow. Press **Renew · $75** (demo checkout); the new term starts the day after the old one ends, so renewing early loses nothing. Turn **Renew automatically** on or off; it's her choice, per program.
2. Open **QMAP**: it isn't in a program, so it's sold on its own. Respite is in the example **Specialty Bundle**.
3. **As Dana → Programs**: one price for everyone, the course list, who can join, active members and who's ending in 30 days. Open **All-Access Package** to see members (with "auto-renew on" where they chose it) and **Give this program** at no charge.
4. **Messages**: the staff inbox has Open / Mine / Waiting / Closed tabs, assignment, and "Seen by provider".
5. **Announcements**: post one to Host Homes only, pin it, set it to hide after a date.
6. **Reports**: compliance, forms and payments, each downloadable as CSV (logged in the audit log).
7. **Sign-in help**: on a provider's page, **Sign-in help** makes a one-time reset link. Five wrong passwords in 15 minutes on one account alerts staff (three for staff accounts).
8. **Two-step sign-in**: staff set up an authenticator app under **Two-step sign-in**. In production it's required and enforced by the database.

## 5. Points to make

- One site replaces the intranet forms and the Wix training site.
- Providers only ever see their own records and the people they currently support. The database enforces this, not the screens.
- Renewal never deletes history; each year is its own cycle.
- The 14 Wix CSV downloads become a one-time import, then go away.
- Emails never carry private information, so the portal stays the only place PHI lives.
- The look matches realcarecolorado.com: same purple and cyan, Raleway and Open Sans, the Real Care logo and Colorado mountains.

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
| Program auto-renewal | Nightly job renews with demo checkout | Stripe subscription charges the saved card; its webhook records the renewal |
| Emails | Shown in the outbox, not sent | Postmark/Resend, same PHI-free templates |
| Video hosting | Real Care's videos as 720p MP4 in private Supabase Storage, streamed through short-lived signed links; only providers with access to the course can stream it | Same, or Mux if adaptive streaming and captions are needed |
| Invitations | Link copied by staff | Emailed automatically via Supabase Auth |
| Staff MFA | Available, not required (`app_settings.staff_mfa_required = false`) | Required; one setting turns it on, enforced in the database |
| Forms and uploads with real PHI | Fictional data only | After BAAs and the HIPAA review (Phase 2) |
| QMAP in Spanish | English text shown, marked as pending | Spanish transcripts and quizzes once translated |
