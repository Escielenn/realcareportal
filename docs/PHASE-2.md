# Phase 2: Paperwork and documents

**Window:** Jan 18 to Mar 12, 2027 (8 weeks, about 160 hours)
**Goal:** providers complete the right forms for the people they support, upload documents, and fix only what staff return. Staff review everything in one queue.
**Data in this phase:** PHI enters production for the first time. **T201 and T202 must be finished before any real form, individual record or upload goes into production.**

## Gate to Phase 3

- [ ] The Supabase HIPAA add-on is active and the BAA is signed; the Vercel BAA is signed; HIPAA controls are verified (T201).
- [ ] An outside HIPAA review is complete and its findings are fixed or accepted in writing (T218).
- [ ] A provider sees only the forms and records of individuals they currently support; ending a link removes access the same day.
- [ ] A provider submits a form; staff return one field with a note; the provider sees and fixes only that field; staff accept. The full history shows.
- [ ] A provider uploads a scanned PDF and a phone photo against a requirement, and staff accept them.
- [ ] All 13 Gravity Forms and 8 downloadable forms are live as portal forms, each checked against the original by Real Care.
- [ ] Notification emails contain no form contents or individual names (verified by test).

## Task overview

| ID | Task | Weeks | Est. hours | Depends on |
| --- | --- | --- | --- | --- |
| T201 | HIPAA upgrade and controls | 1 | 4 | Phase 0 T02 |
| T202 | Book the outside HIPAA review | 1 | 2 | none |
| T203 | Form engine: schema and logic | 1 to 2 | 24 | Phase 0 schema |
| T204 | Form renderer for providers | 2 to 3 | 14 | T203 |
| T205 | Form builder for staff | 3 | 12 | T203 |
| T206 | Gravity Forms converter | 3 | 10 | T203 |
| T207 | Convert the 13 Gravity Forms | 3 to 6 | 20 | T204 to T206 |
| T208 | Convert the 8 downloadable forms | 5 to 6 | 10 | T204, T212 |
| T209 | Individuals and provider links admin | 2 | 8 | T201 |
| T210 | Assignments and recurrence | 4 | 12 | T209 |
| T211 | Person-centered pre-fill | 4 | 6 | T209, T204 |
| T212 | Document uploads | 4 to 5 | 10 | T201 |
| T213 | Review workflow and corrections | 5 to 6 | 16 | T204, T212 |
| T214 | PDF archive copies | 6 | 6 | T213 |
| T215 | QR codes and short links | 6 | 3 | T204 |
| T216 | PHI-free notifications | 6 | 3 | T213 |
| T217 | Incident report priority routing | 6 | 3 | T207, T216 |
| T218 | HIPAA review fixes and sign-off | 7 | 6 | T202 |
| T219 | Phase 2 demo and gate review | 8 | 2 | all |
| | **Total** | | **171** | |

About 11 hours over budget. Lowest-risk trim: build the staff form builder (T205) as a JSON editor with live preview only, and add drag and drop later.

---

### T201 HIPAA upgrade and controls
- Upgrade the Real Care Supabase organization to Team, enable the HIPAA add-on, and sign the BAA. Confirm the Vercel BAA covers production.
- Mark the production project as HIPAA in Supabase and turn on the controls it requires: SSL enforcement, point-in-time recovery, network restrictions where practical. Run the security advisors.
- Write `docs/decisions/0020-hipaa-controls.md` listing each control and how it was checked.

**Done when**
- [ ] BAAs filed in Real Care's records; security advisors clean; controls doc reviewed by Real Care's HIPAA contact.

### T202 Book the outside HIPAA review
- Choose a consultant or firm for a focused review of the portal's safeguards, policies and vendor setup. Schedule it for week 6 or 7.

**Done when**
- [ ] Review booked, with scope and cost approved by Real Care.

### T203 Form engine: schema and logic
Define the portal form format (`docs/form-schema.md`) and the engine that validates it.
- Field types: short text, long text, number, currency, date, time, date-time, select, radio, checkboxes, yes/no, grid (rows by columns, matching the Gravity Forms grids), repeater (add another row), signature, file, section heading, instructions block, hidden and staff-only fields.
- Conditional logic: show, hide or require a field based on other answers (all/any rules).
- Validation: required, min and max, patterns, date ranges; one Zod schema generated from each definition so client and server use the same rules.
- Calculations: totals and hours worked (needed for the timesheet).
- Instructions blocks follow the house pattern: collapsible `<details>` sections, first open.
- Versioning: published versions are frozen; submissions keep their version.

**Done when**
- [ ] Unit tests cover every field type, conditional rule and calculation; an invalid definition is rejected with a clear message.

### T204 Form renderer for providers
- Renders any definition on a phone or computer; large touch targets; one section per screen on mobile with a progress bar.
- Drafts autosave to the server every 20 seconds and on leaving a section. Never in browser storage.
- Submit shows a confirmation with date, time and a reference number.
- Signature field captures a drawn signature plus typed name and timestamp.

**Done when**
- [ ] A provider can complete the longest converted form on a phone, lose connection, reconnect and still have their draft.

### T205 Form builder for staff
- Staff edit a definition in a structured JSON editor with live preview, or start from a template.
- Publish creates a new version; old submissions are unaffected.
- Only `super_admin` can publish.

**Done when**
- [ ] A staff member adds a field to a form, previews it and publishes version 2 without touching code.

### T206 Gravity Forms converter
- Script that reads a Gravity Forms JSON export and writes a portal definition, mapping field types, choices, conditional logic and visibility.
- Gravity Forms `visibility: administrative` fields become staff-only fields; `hidden` fields become hidden fields.
- Prints a report of anything it could not convert (custom HTML, unusual calculations).

**Done when**
- [ ] The converter runs on all 13 exports and lists every item that needs hand work.

### T207 Convert the 13 Gravity Forms
Order by how often providers will use them. For each: convert, fix by hand, compare side by side with the original, and get Real Care's sign-off.

| Order | Form | Notes |
| --- | --- | --- |
| 1 | RCI Log Notes | High frequency |
| 2 | Log Notes w/ Medication Verify | Medication fields are PHI; staff-only verification fields |
| 3 | SCC/DSP Timesheet | Hours calculation; routes to timesheets staff |
| 4 | SCC Log Notes | |
| 5 | Residential Tracking Record | Grid layout |
| 6 | Medicaid Residential Attendance Record | Monthly grid |
| 7 | Incident Report | Priority routing (T217) |
| 8 | Standard Goal Tracking | Pre-fill goals (T211) |
| 9 | NMT Trips Tracking | Repeater for trips |
| 10 | Menu | |
| 11 | Fire Disaster Drill | Quarterly recurrence |
| 12 | Community Account Record | Currency fields |
| 13 | Provider Application | Public applicant form before an account exists; needs a separate, rate-limited public route with no access to other data |

**Done when**
- [ ] All 13 published; a sign-off line for each in `docs/form-signoff.md`.

### T208 Convert the 8 downloadable forms
- PRN Med List, Controlled Med Count Sheet, Psych Visit, Physician Visit, Dental Visit, Vision Exam, Annual Physical, Blank Medication Sheet: rebuild as online forms with an optional "upload the signed paper copy" field for forms a clinician signs.
- Vehicle Inspection stays printable and gains an upload requirement.

**Done when**
- [ ] Each form can be completed online or uploaded, and both paths land in the review queue.

### T209 Individuals and provider links admin
- Staff pages to add individuals and link them to providers with start and end dates.
- Individual detail page: linked providers, assigned forms, recent submissions and documents (staff only).

**Done when**
- [ ] Ending a link in the admin removes the provider's access to that individual immediately (RLS test proves it).

### T210 Assignments and recurrence
- Assign a form to a provider, optionally for one individual, with a due date.
- Recurrence: daily, weekly, monthly, quarterly, or on a custom schedule; a nightly job creates the next assignment.
- Default assignments by provider type (for example, every Host Home gets monthly attendance per linked individual).

**Done when**
- [ ] Linking a new individual to a Host Home provider creates the right recurring assignments automatically.

### T211 Person-centered pre-fill
- Definitions can pull individual fields (name, date of birth, Medicaid ID) and the individual's current goals into read-only fields.
- Goals are maintained by staff on the individual page.

**Done when**
- [ ] Standard Goal Tracking opens with the individual's current goals already listed.

### T212 Document uploads
- Private bucket; uploads go through a server-issued signed upload URL to the path `provider_id/individual_id/...`.
- Allowed types: PDF, JPG, PNG, HEIC (converted to JPG), up to 20 MB. Check MIME type and file signature on the server.
- Uploads attach to a requirement or assignment and enter the review queue.

**Done when**
- [ ] A phone photo and a scanned PDF upload from a phone; another provider cannot reach either file.

### T213 Review workflow and corrections
- Staff queue filtered by form, provider type, status and age; oldest first.
- Reviewers flag specific fields or files with a note and return the item, or accept it.
- The provider sees only the flagged fields as editable, with the reviewer's note; resubmitting goes back to the same reviewer.
- Full history on every item: who submitted, returned, changed and accepted, and when.

**Done when**
- [ ] The gate's correction scenario passes in a Playwright test.

### T214 PDF archive copies
- On acceptance, generate a PDF copy of the submission (with signature and version) in private storage for the record and for printing.

**Done when**
- [ ] Every accepted submission has a matching PDF that staff can download.

### T215 QR codes and short links
- Each form template gets a short link and a printable QR code that opens the form after login, solving the agenda's QR reference form request.

**Done when**
- [ ] Scanning a printed QR code on a phone opens the right form after sign-in.

### T216 PHI-free notifications
- Provider alerts: new assignment, item returned, item accepted, due tomorrow. Staff alerts: new submission in queue.
- Templates are fixed text plus counts and a link. A test fails the build if any template contains a form field value or an individual's name.

**Done when**
- [ ] Notification tests pass; a sample email reviewed by Real Care's HIPAA contact.

### T217 Incident report priority routing
- Incident reports alert the on-call staff group immediately by email and in-app ("New incident report submitted, log in to view"), and sit at the top of the queue with an age timer.
- Confirm Real Care's reporting deadlines and show them on the review screen.

**Done when**
- [ ] A test incident report reaches the on-call group within one minute.

### T218 HIPAA review fixes and sign-off
- Walk the reviewer through the system; fix findings or record accepted risks in `docs/decisions/`.

**Done when**
- [ ] Written sign-off or a findings list with every item closed or accepted.

### T219 Phase 2 demo and gate review
- Demo the gate checklist on production with a test provider and test individual.
- Set the date the intranet forms stop being used.

**Done when**
- [ ] Gate signed off; `docs/PHASE-3.md` reviewed with Real Care.
