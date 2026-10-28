# Phase 0: Foundation

**Window:** Nov 2 to Nov 20, 2026 (3 weeks, about 60 hours)
**Goal:** a deployed, empty-but-secure portal: schema, row-level security, audit, auth, roles, bilingual shell, staff console skeleton, and every Real Care decision Phase 1 depends on.
**No PHI and no real provider data enters any environment in this phase.**

## Gate to Phase 1

- [ ] Real Care owns the GitHub org, Vercel team and Supabase org (billing in Real Care's name).
- [ ] Vercel HIPAA BAA signed; Supabase HIPAA add-on quote received and budget approved. (The Supabase Team upgrade and BAA are required before Phase 2, when forms and uploads arrive.)
- [ ] All RLS tests pass in CI; Supabase security advisors show zero warnings.
- [ ] Staff can log in with MFA on staging; a seeded provider can log in and sees only their own record.
- [ ] Real Care signs off on the data model and the decisions in T03.

## Task overview

| ID | Task | Week | Est. hours | Depends on |
| --- | --- | --- | --- | --- |
| T01 | Accounts and ownership | 1 | 2 | none |
| T02 | BAAs and HIPAA quotes | 1 to 3 | 2 | T01 |
| T03 | Decisions workshop with Real Care | 1 | 4 | none |
| T04 | Repo scaffold and CI | 1 | 4 | T01 |
| T05 | Supabase projects and migration workflow | 1 | 2 | T01 |
| T06 | Bilingual routing (en/es) | 1 | 2 | T04 |
| T07 | Design system and layout shells | 1 to 2 | 5 | T04, T06 |
| T08 | Schema: people and individuals | 2 | 4 | T05, T03 |
| T09 | Schema: training and cycles | 2 | 5 | T08 |
| T10 | Schema: forms, documents, communication, payments, audit | 2 | 5 | T08 |
| T11 | RLS policies | 2 | 6 | T08 to T10 |
| T12 | RLS test suite | 2 | 5 | T11 |
| T13 | Audit triggers and helper | 2 | 3 | T10 |
| T14 | Auth: invites, login, MFA, role gates | 2 to 3 | 5 | T08, T11 |
| T15 | Fake seed data | 2 | 2 | T08 to T10 |
| T16 | Staff console skeleton | 3 | 4 | T07, T14 |
| T17 | Observability with PHI scrubbing | 3 | 2 | T04 |
| T18 | Staging deploy and domain | 3 | 2 | T04, T05 |
| T19 | Legacy data discovery (structure only) | 3 | 3 | T03 |
| T20 | Phase 0 demo and gate review | 3 | 2 | all |
| | **Total** | | **69** | |

69 hours is slightly over the 60-hour budget. If time runs short, trim T07 (move polish into Phase 1) and T19 (finish in Phase 1, week 1).

---

## Week 1: set up and decide

### T01 Accounts and ownership
- Create a GitHub organization owned by Real Care (Jason as admin). Create the `realcare-portal` repo there.
- Create a Vercel team (Pro) and a Supabase organization, both billed to Real Care.
- Store credentials in a Real Care-controlled password manager, not personal accounts.

**Done when**
- [ ] Repo, Vercel team and Supabase org exist under Real Care ownership.
- [ ] At least one Real Care leader has owner access to all three.

### T02 BAAs and HIPAA quotes
- Sign the Vercel BAA from the team billing dashboard (Pro HIPAA add-on).
- Contact Supabase sales for the Team plan + HIPAA add-on price and BAA; share the quote with Real Care.
- Confirm in writing which vendors will never receive PHI (Mux, Stripe, email provider, Sentry) and why.
- Ask Real Care whether the current Bluehost / Gravity Forms setup is covered by any BAA. Record the answer.

**Done when**
- [ ] Vercel BAA signed (PDF saved to Real Care's records).
- [ ] Supabase quote received and approved or scheduled for approval.
- [ ] `docs/decisions/0001-hipaa-vendors.md` lists each vendor, PHI yes/no, BAA status.

### T03 Decisions workshop with Real Care (60 to 90 minutes)
Bring the plan's "Decisions needed" list. Capture each answer as an ADR in `docs/decisions/`.

- **Renewal rule:** individual due date. Based on hire date, first completion date, or last cycle's completion? What grace period before a provider is "overdue"? What happens to access when overdue?
- **Provider types:** confirm Family Caregiver, Host Home, SCC/DSP, NMT. Can one person hold several types?
- **Requirements matrix:** for each provider type, which of the 14 core courses, QMAP and respite are required, and how often.
- **Fees:** who pays for QMAP ($30 listed) and courses ($10 or All-Access $75/12 months)? Does Real Care pay for some providers? Does All-Access continue?
- **Portal address:** confirm `portal.realcarecolorado.com` or alternative.
- **HIPAA contact** and **records retention** periods for training records, forms and messages.
- **Pilot group:** 5 providers (mix of types and languages) for Phase 1 testing.

**Done when**
- [ ] One ADR per decision in `docs/decisions/`, each with the date and who decided.
- [ ] Requirements matrix saved as `docs/decisions/requirements-matrix.md`.

### T04 Repo scaffold and CI
- `create-next-app` with TypeScript strict, App Router, Tailwind, ESLint; add Prettier, shadcn/ui, Vitest, Playwright.
- GitHub Actions: lint, typecheck, unit tests, RLS tests against a Supabase container on every PR.
- `.env.example` listing every variable (no values). `.gitignore` covers `.env*`, `*.csv`, `*.xlsx`, `exports/`.
- Copy `CLAUDE.md` and `docs/DEVELOPMENT-PLAN.md` into the repo.
- Branch protection on `main`: PR + passing CI required.

**Done when**
- [ ] `pnpm dev` runs; CI is green on an empty PR; `main` is protected.

### T05 Supabase projects and migration workflow
- Create `realcare-portal-staging` (Pro is fine for now) and a placeholder for production (not created until Phase 1 launch).
- `supabase init`, link the CLI to staging, confirm `supabase db reset` works locally.
- Enable point-in-time recovery on whichever project will hold real data later; note it in the runbook.

**Done when**
- [ ] Local and staging migrate from an empty migration; types generate to `lib/supabase/types.ts`.

### T06 Bilingual routing
- `next-intl` with `/en` and `/es` routes, a language switcher, and the user's saved preference on `profiles.locale`.
- `messages/en.json` and `messages/es.json` with the shell strings.

**Done when**
- [ ] Every shell string renders in both languages; a lint check or test fails on a missing key.

### T07 Design system and layout shells
- Pull Real Care colours and logo from realcarecolorado.com and the training site; define Tailwind tokens and a light theme (dark optional).
- Provider shell: mobile-first bottom navigation (Home, Training, Forms, Messages, Profile).
- Staff shell: sidebar navigation (Providers, Individuals, Training, Forms, Reports, Audit, Settings).
- Accessible components from shadcn/ui; check focus states and contrast.

**Done when**
- [ ] Both shells render at 375 px and 1280 px wide with no horizontal scroll; axe check shows no serious issues.

---

## Week 2: schema, security, auth

### T08 Schema: people and individuals
Migration `0001_people.sql`:
- Enums: `user_role`, `provider_type`, `staff_role`, `record_status`.
- Tables: `profiles` (id = `auth.users.id`, role, first/last name, email, phone, locale, active), `providers` (profile_id, types array or join table, hire_date, status), `staff` (profile_id, staff_role), `individuals` (name, DOB, Medicaid ID placeholder column marked sensitive, active), `provider_individuals` (provider_id, individual_id, starts_on, ends_on).
- Helper SQL functions: `current_role()`, `is_staff()`, `is_staff_role(text)`, `provider_supports(individual_id)` (checks the link is active today). All `security definer` with fixed `search_path` and comments.

**Done when**
- [ ] Migration applies cleanly; types regenerated; helpers covered by tests in T12.

### T09 Schema: training and cycles
Migration `0002_training.sql`:
- `courses`, `course_versions` (language), `lessons` (kind: video, reading, quiz; order; mux_playback_id), `quiz_questions` (options JSON, correct index, explanation), `requirements` (provider_type, course_id, frequency).
- `training_cycles` (provider_id, cycle_number, starts_on, due_on, status), `enrollments`, `lesson_progress` (percent watched, completed_at), `quiz_attempts` (score, passed), `completions` (provider_id, course_id, cycle_id, completed_at, language, score, certificate_path, source: `portal` or `legacy_wix`).
- View `current_badges` computed from the provider's current cycle and requirements.
- Unique constraint: one completion per provider, course and cycle.

**Done when**
- [ ] A SQL test inserts two cycles for one provider and shows the first cycle's completions are untouched after the second begins.

### T10 Schema: forms, documents, communication, payments, audit
Migration `0003_operations.sql` (tables only; behaviour comes in later phases):
- `form_templates`, `form_versions` (schema JSON, published_at), `assignments` (template, provider, optional individual, due_on, recurrence), `submissions` (assignment, version, data JSON, status), `submission_reviews` (field flags JSON, note, reviewer).
- `documents` (storage path, mime type, provider, optional individual, requirement, status).
- `threads`, `messages`, `announcements` (audience provider_types), `notifications` (channel, status, sent_at).
- `products`, `orders` (stripe ids), `entitlements` (provider, product, starts_on, ends_on).
- `audit_log` (actor, action, table_name, record_id, at, ip, details JSON without PHI values).

**Done when**
- [ ] All tables exist with RLS enabled (policies in T11); types regenerated.

### T11 RLS policies
Write policies for every table. Pattern:
- **Providers** read and write only their own rows (`provider_id = auth.uid()` via `providers.profile_id`), and rows about individuals only while `provider_supports(individual_id)` is true.
- **Reviewers** read all provider and submission data; update review fields only.
- **Training admins** manage courses, requirements, cycles, entitlements.
- **Super admins** everything except updating or deleting `audit_log`.
- `audit_log`: insert only via trigger or server helper; select for super admins; no update or delete for anyone.
- Storage policies mirror table policies (bucket paths begin with `provider_id/`).

**Done when**
- [ ] Every table has select, insert, update and delete policies decided (an absent policy is deliberate and commented).
- [ ] `get_advisors` (security) reports zero issues.

### T12 RLS test suite
Tests run in CI against local Supabase with seeded users:
- Provider A cannot select, update or delete Provider B's profile, cycles, completions, submissions, documents, messages.
- Provider A can read Individual X only while the link is active; after `ends_on`, access disappears.
- Anonymous users read nothing.
- Reviewer cannot change courses; training admin cannot read messages; nobody can delete `audit_log` rows.
- Storage: Provider A cannot create a signed URL for Provider B's file path.

**Done when**
- [ ] At least one passing test per policy; the suite fails if RLS is disabled on any table (meta-test over `pg_tables`).

### T13 Audit triggers and helper
- Generic trigger function writing to `audit_log` on insert, update and delete for sensitive tables, storing changed column names, not values.
- `lib/audit.ts` for app-level events (staff viewed a submission, exported a transcript, signed in).

**Done when**
- [ ] Tests show an update to a submission creates an audit row with actor and changed fields, and no PHI values.

### T14 Auth: invites, login, MFA, role gates
- Disable public sign-up. Staff invite users from the console (server action using the admin client) which creates `profiles` with role and sends the Supabase invite.
- Login with magic link and optional password; reset password flow; bilingual auth emails.
- Enforce TOTP MFA for staff: a staff session below AAL2 is redirected to enrol or verify.
- `requireProvider()` and `requireStaff(role?)` helpers; middleware refreshes sessions; inactive profiles are signed out.

**Done when**
- [ ] Playwright: invited provider accepts invite, logs in, sees dashboard; staff without MFA cannot reach `/admin`; deactivated user is signed out on next request.

### T15 Fake seed data
- `supabase/seed.sql`: 3 staff (one per staff role), 12 providers across all four types (some Spanish-preferring), 8 individuals with overlapping and ended links, the 14 core courses + QMAP as placeholders, a requirements matrix sample.
- Names and details clearly fake (for example "Test Provider Alpha").

**Done when**
- [ ] `supabase db reset` produces a usable demo dataset; no real names or data anywhere in the repo.

---

## Week 3: console, deploy, discovery, gate

### T16 Staff console skeleton
- Provider list with search and filter by type and status (read only), provider detail page (profile, types, linked individuals, placeholder tabs for Training, Forms, Messages).
- Audit log viewer for super admins.
- Invite provider form (from T14).

**Done when**
- [ ] A reviewer can find a seeded provider in under three clicks; audit entries appear for views of provider detail pages.

### T17 Observability with PHI scrubbing
- Sentry for Next.js with `beforeSend` that strips request bodies, form data and query strings.
- Confirm Vercel logs do not print request bodies; no `console.log` of user data (ESLint rule).

**Done when**
- [ ] A test error thrown inside a form action shows in Sentry with no field values.

### T18 Staging deploy and domain
- Vercel project linked to the repo; preview deploys per PR; staging environment variables set.
- DNS for the portal subdomain prepared (staging subdomain now, production later).

**Done when**
- [ ] Staging URL serves the app over HTTPS with the seeded dataset.

### T19 Legacy data discovery (structure only)
Real data stays out of the repo and out of AI prompts. Work on exports in Real Care's secure storage.
- Export from Wix: member list, one participant CSV per course (14 English, 14 Spanish, QMAP), pricing plan subscribers.
- Export from WordPress: users list with roles.
- Record **column names, formats and counts only**: how dates are written, which IDs exist, how many members appear in both systems, typical duplicate patterns.
- Draft the matching rules (email first, then name + phone) and the legacy-cycle mapping.

**Done when**
- [ ] `docs/decisions/0010-legacy-import.md` documents the columns, counts and matching rules with no personal data in it.

### T20 Phase 0 demo and gate review
- 30-minute demo on staging: staff login with MFA, invite a fake provider, provider logs in on a phone in Spanish, show RLS test run and audit log.
- Walk through the gate checklist above; record sign-off.

**Done when**
- [ ] Gate checklist complete and signed off by Real Care; Phase 1 tasks file (`docs/PHASE-1.md`) drafted.
