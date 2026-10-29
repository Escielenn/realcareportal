# UI/UX review: Real Care Portal demo

Date: October 28, 2026. Reviewer: Claude, for Jason D. Batt, Ph.D.
Method: Vercel Web Interface Guidelines (code review of `app/` and `components/`), plus a visual critique of the deployed demo at phone width (390 px) for provider pages and desktop (1280 px) for the staff console. The screenshots come from the automated smoke run.

## Already fixed in this pass

| Area | Change |
| --- | --- |
| Keyboard | "Skip to content" link on every page; `main` landmarks focusable |
| Forms | On submit with missing answers, focus jumps to the first missing field |
| Forms | Warning before leaving a form with unsaved changes |
| Forms | Removing a table row (log notes, timesheets) can be undone |
| Inputs | Email fields no longer spell-check; placeholders end with "…" |
| Motion | `prefers-reduced-motion` respected; no tap delay on phones (`touch-action: manipulation`) |
| Text | Balanced headings, no orphan words in paragraphs, tabular numbers in tables |
| Staff security | Authenticator QR has fixed size (no layout jump); removing an authenticator asks first |
| Training page | Finished courses fold into a "Done (13)" group so the remaining courses sit at the top (on the programs branch) |

## Suggestions, by priority

Status as of Oct 28, 2026 (evening): 13 of 16 done or already in place. Open: Spanish labels on very small phones (#9), dark mode (#13), native-speaker review of Spanish copy (#16).

### High: affects providers every day

1. ✅ **Done.** **Make the logo legible in the header.** At phone width the Real Care mark is a tiny tile and the wordmark is unreadable. Use the mark alone at 32 px and put "Real Care" as text beside it, or use a simplified one-colour mark for small sizes.
2. ✅ **Done.** **Tell people what to do first on the dashboard, and only once.** The dashboard is in good order (Needs attention → Training → Due soon → Submitted → Messages → Announcements). Two refinements: show at most three "Due soon" items with a "See all forms" link, and hide announcements older than 30 days unless pinned.
3. ✅ **Done.** **Larger, clearer status pills.** "To do", "In review", "Accepted" are 11–12 px on pale fills. Raise them to 13–14 px, and add an icon (clock, eye, check) so status is never carried by colour alone (WCAG 1.4.1).
4. ✅ **Done.** **Name who a form is about in bold, the date in grey.** Overdue dates now show in red. On Forms, "Jordan Avery · Due Oct 28" reads as one string. Splitting person and date helps host homes with more than one person supported scan the list.
5. ✅ **Done.** **A "next step" button on every course page.** The course page lists lessons; add one primary "Continue: Lesson 2" button at the top, matching the dashboard's "Continue training" button.
6. ✅ **Already in place** (checked). **Phone keyboard types.** Phone fields should open the number pad (`type="tel"`, `autocomplete="tel"`); money and hours fields should use `inputMode="decimal"`. Several form-engine fields already do; carry it through the profile and application forms.

### Medium: polish and trust

7. ✅ **Done** for Messages. **Empty states that say what happens next.** "No messages yet" → "Questions about training or forms? Send Real Care staff a message here. We usually answer within one business day."
8. ✅ **Done.** **Confirmation after submitting a form.** Show a full-width success panel ("Sent to Real Care staff. You'll get a notice if anything needs a correction.") instead of only a status pill change.
9. Open. **Spanish layout check.** Spanish labels run about 25% longer. The bottom nav fits at 390 px, but "Documentos" and "Mensajes" are tight at 360 px. Consider shorter labels ("Docs") or icons with labels under 9 characters on very small phones.
10. ✅ **Done.** **Profile page order.** Put "My programs & courses" above the settings form; it is what most people open the profile to check. Show the renewal date there in bold.
11. ✅ **Already in place** (checked: every tile links to a filtered list). **Staff overview: link every stat tile.** "2 Training overdue" should open the Providers list filtered to overdue; "1 Unanswered message" should open the inbox. Today some tiles are not links.
12. ✅ **Done.** **Staff tables: sticky header and row hover.** Long tables (Payments, Audit log, Providers) lose their column headings on scroll.

### Low: later phases

13. **Dark mode** is not needed for providers now, but the colour tokens are already in CSS variables, so it is cheap later.
14. ✅ **Done** (web app manifest). **Installable app.** A web app manifest and icons let providers add the portal to their home screen like an app. No app store needed.
15. ✅ **Done.** **Offline draft safety.** Drafts retry automatically when the connection returns. Drafts save to the server every few seconds. If the phone is offline, show "Not saved, no connection" instead of failing silently.
16. **Plain-language pass on Spanish copy** with a native speaker from Real Care before launch.

## Accessibility checks still to run with a person

- Screen reader pass (VoiceOver on iPhone, TalkBack on Android) through: sign in, finish a lesson, fill and submit a log note, upload a document, read a message.
- 200% zoom and large-text settings on a phone.
- Colour contrast on the purple header gradient with the white language toggle (looks fine; confirm with a checker).
