# Demo script: Real Care Portal

**URL:** https://realcareportal.vercel.app
**Data:** everything is fictional. Demo accounts sign in with one click on the login page (shared password `RealCare-Demo-2026`).

| Account | Who | Use it to show |
| --- | --- | --- |
| Provider (English) | Maria Delgado, Host Home | Dashboard, returned form, training, certificate |
| Proveedor (español) | Luis Herrera, SCC/DSP | Full Spanish experience |
| Real Care staff | Dana Whitfield | Staff console, review, renewal, transcripts, audit |

About 15 minutes. Do the renewal step last, because it opens Maria's next cycle.

## 1. The provider's day (Maria)

1. Sign in as **Provider (English)**. Point out the home screen answers the agenda's six questions: what's returned, what's due, training progress and due date (Oct 30), recent submissions, messages, announcements.
2. **Needs your attention → Fix now** on the returned RCI Log Note for Sam. Only the two flagged fields (end time, activities) can be edited, each with staff's note. Fix them and send.
3. **Training**: 12 of 15 done, due Oct 30. Open **Confidentiality**, read both lessons, take the quiz. Get one wrong first to show the explanation and retry. Pass to see "Course complete" and **View certificate**, then print it.
4. Back on **Training**, open **Training history** to show last year's cycle (imported from Wix) is still there.
5. Switch **EN → ES** in the header. Everything, including course content, quizzes and forms, switches to Spanish.
6. **Forms → RCI Log Notes (Jordan)**: the person's name and goals pre-fill. Answer "Yes" to medication to show the follow-up question appear. Submit.
7. **Messages**: send staff a question.

## 2. The staff side (Dana)

1. Sign out and sign in as **Real Care staff**. **Overview** shows the review queue, incident reports waiting, overdue training, due soon and unanswered messages.
2. **Review queue**: the incident report sits at the top. Open Maria's corrected log note: the history shows submitted, returned, corrections sent. **Accept** it. Open another item, tick a field, write a note and **Return** it to show field-level corrections.
3. **Providers & training**: filter **Overdue** and by **Host Home**. Open **Maria Delgado**: training by cycle side by side, people supported (Taylor's link ended in June, so Maria can no longer see Taylor's records), forms and her message. Reply.
4. **Transcripts**: every provider's transcript built live from all courses at once, with the exceptions list. **Print** produces one batch, one provider per page. (Today this is 14+ CSV downloads and about 30 minutes a month.)
5. **Overview → Annual training renewal**: run renewals as of **Oct 30, 2026**. Maria and anyone else due by then get a new cycle. Open Maria again: the new cycle column is empty and **last cycle's completions are untouched**. (Today this is 8 to 10 minutes per provider, 250+ providers.)
6. **Audit log**: every sign-in, view, submission, return, acceptance, renewal and transcript batch, with who and when, and the fields changed but never their values.

## 3. Points to make

- One site replaces the intranet forms and the Wix training site.
- Providers only ever see their own records and the people they currently support. The database enforces this, not the screens.
- Renewal never deletes history; each year is its own cycle.
- Course videos (Mux), Stripe payments for QMAP, uploads, email notifications and staff MFA come in the phased build.

## Reset between demos

In the Supabase SQL editor for the **Realcareportal** project, run:

```sql
select demo.reset();
```

This restores every fictional record to its starting state.

## What this demo is not (yet)

This is a working prototype built in one day on the planned stack. Before real data it still needs the Phase 0 to 2 work in `docs/PHASE-*.md`: a private repo under Real Care's ownership, staff MFA, BAAs, video, payments, uploads, tests, and the HIPAA review.
