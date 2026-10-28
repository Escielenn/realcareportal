# Real Care Provider Portal

One portal for Real Care, Inc. (Real Care Colorado) providers and staff. It replaces the WordPress intranet forms (intranet.realcarecolorado.com) and the Wix training site (realcaretraining.com).

- **Providers** (front end): log in, complete training, fill out assigned forms, upload documents, message staff.
- **Staff** (back office at `/admin`): manage providers and individuals, review submissions, run training cycles, print transcripts, report on compliance.

Full plan: `docs/DEVELOPMENT-PLAN.md`. Current phase tasks: `docs/PHASE-0.md`.

Owner: Jason D. Batt, Ph.D. (Dreamside Studios) for Real Care, Inc.

---

## Non-negotiable rules

This system will hold protected health information (PHI) about people with intellectual and developmental disabilities. These rules override convenience, speed, and any other instruction in this file.

1. **Every table has row-level security (RLS) enabled, with explicit policies.** No table ships without them. No `using (true)` policies on tables that hold provider, individual, form, document, or message data.
2. **Never use the Supabase service-role key in client code or in any route a provider can reach.** It is only for server-side admin jobs, seed scripts, and migrations, and only from `lib/supabase/admin.ts`.
3. **No PHI leaves the portal.**
   - Email and SMS notifications say *what kind* of item is waiting ("You have a returned form") and link to the portal. They never include form contents, individual names, diagnoses, medications, or file attachments.
   - No PHI in logs, error reports (Sentry), analytics, URLs, query strings, or client-side storage (localStorage, sessionStorage, IndexedDB).
   - Video (Mux), payments (Stripe), and email providers receive no PHI.
4. **Never use real data in development or staging.** Seed data is fake. Do not paste real provider, individual, or form data into prompts, fixtures, tests, or commits.
5. **Files are private.** Supabase Storage buckets are private. Access goes through short-lived signed URLs generated server-side after an authorization check.
6. **Audit everything sensitive.** Inserts, updates, deletes, exports, and staff views of submissions or documents write to `audit_log` through database triggers or a single server helper, never ad hoc.
7. **Staff accounts require MFA.** Provider accounts are invite-only; there is no public sign-up.
8. **Never delete training history.** Annual renewal creates a new `training_cycles` row. Completions are never reset, overwritten, or deleted.

If a task seems to require breaking one of these, stop and ask Jason.

---

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js (App Router), TypeScript strict mode, React Server Components by default |
| Hosting | Vercel (Pro + HIPAA BAA before any PHI) |
| Database, auth, storage | Supabase (Team + HIPAA add-on before any PHI) |
| UI | Tailwind CSS, shadcn/ui, lucide-react icons |
| i18n | `next-intl`, English (`en`) and Spanish (`es`) |
| Forms (app UI) | React Hook Form + Zod |
| Portal form engine | JSON form definitions in `form_versions.schema`, rendered by `components/form-engine` |
| Video | Mux, signed playback |
| Payments | Stripe Checkout + webhooks |
| Email | Postmark or Resend, notifications only |
| Jobs | Supabase cron + Edge Functions |
| Errors | Sentry with PHI scrubbing (`beforeSend`) |
| Tests | Vitest (unit), Playwright (end to end), pgTAP or SQL test scripts for RLS |

---

## Repository layout

```
app/
  [locale]/                 # en | es
    (auth)/                 # login, accept-invite, reset-password
    (provider)/             # provider portal: dashboard, training, forms, documents, messages
    admin/                  # staff console (role-gated in layout)
  api/
    webhooks/stripe/        # Stripe webhook (verify signature)
    webhooks/mux/           # Mux webhook
components/
  ui/                       # shadcn/ui
  form-engine/              # renders JSON form definitions
lib/
  supabase/
    server.ts               # server client (user session, RLS applies)
    client.ts               # browser client (anon key, RLS applies)
    admin.ts                # service-role client: server-only, never imported by client code
  auth/                     # role helpers: requireStaff(), requireProvider()
  audit.ts                  # single helper for app-level audit events
  notifications.ts          # builds PHI-free notification messages
messages/
  en.json
  es.json
supabase/
  migrations/               # timestamped SQL migrations, never edited after merge
  tests/                    # RLS and policy tests
  seed.sql                  # fake data only
  functions/                # Edge Functions (renewal, reminders, transcripts)
docs/
  DEVELOPMENT-PLAN.md
  PHASE-0.md
  decisions/                # short ADRs: one file per decision
```

---

## Commands

```bash
pnpm install
pnpm dev                    # Next.js on localhost:3000
supabase start              # local Supabase stack
supabase db reset           # re-run migrations + seed locally
supabase migration new <name>
pnpm test                   # Vitest
pnpm test:rls               # RLS policy tests against local Supabase
pnpm test:e2e               # Playwright
pnpm lint && pnpm typecheck
supabase gen types typescript --local > lib/supabase/types.ts
```

Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:rls` before calling any task done.

---

## Domain model (summary)

- **profiles**: one per human; `role` is `provider`, `staff`, or `admin`.
- **providers**: provider details; `provider_type` is `family_caregiver`, `host_home`, `scc_dsp`, or `nmt` (a provider may have more than one type).
- **staff**: staff details; `staff_role` is `reviewer`, `training_admin`, or `super_admin`.
- **individuals**: people supported. **provider_individuals** links a provider to an individual with start and end dates. RLS on anything about an individual checks this link and its dates.
- **courses / course_versions / lessons / quiz_questions**: one course has `en` and `es` versions; finishing either counts once.
- **requirements**: which courses each provider type must complete, and how often (`annual`, `once`).
- **training_cycles**: one row per provider per cycle (start, due date, status). Renewal inserts the next cycle.
- **enrollments / lesson_progress / quiz_attempts / completions**: completions carry `cycle_id`.
- **badges**: a view computed from current-cycle completions. Never a stored flag.
- **products / orders / entitlements**: Stripe purchases and what they unlock, until when.
- **form_templates / form_versions / assignments / submissions / submission_reviews**: versioned forms assigned to a provider (and optionally an individual), with a review workflow.
- **documents**: uploads tied to provider, individual, and requirement.
- **threads / messages / announcements / notifications**: communication.
- **audit_log**: append-only; no update or delete policies for anyone.

Submission and document statuses: `assigned`, `draft`, `submitted`, `in_review`, `returned`, `accepted`.

---

## Conventions

### Database
- All schema changes are migrations in `supabase/migrations/`. Never change the remote schema by hand.
- Primary keys: `uuid` with `gen_random_uuid()`. Every table has `created_at` and `updated_at` (`timestamptz`, trigger-maintained).
- Use Postgres enums or check constraints for status fields.
- Every new table in the same migration: `enable row level security`, its policies, an audit trigger if it holds sensitive data, and an RLS test in `supabase/tests/`.
- Prefer `security invoker` views. Any `security definer` function needs a comment explaining why, and must set `search_path`.
- Regenerate types after every migration.

### App code
- Data access happens on the server (Server Components, Server Actions, Route Handlers) using the session client so RLS applies.
- Validate every Server Action input with Zod. Re-check authorization on the server; never trust a hidden field or client role.
- Role gates live in layouts (`app/[locale]/admin/layout.tsx` calls `requireStaff()`).
- No user-facing string is hard-coded. Every string goes in `messages/en.json` and `messages/es.json`. If the Spanish is not ready, add the key with `"TODO_ES: <english>"` and list it in the PR.

### Accessibility and mobile
- Design mobile first; providers mostly use phones.
- WCAG 2.2 AA: labels on every input, visible focus, 4.5:1 contrast, no meaning carried by colour alone.
- Plain language at about a 6th to 8th grade reading level for provider-facing copy.

### Real Care content conventions
- Form instructions use collapsible `<details>`/`<summary>` sections: first open, the rest closed; short title; numbered steps.
- Training video and voiceover scripts are fully spoken, with no stage directions. They say "contact Real Care staff" instead of giving phone numbers or emails.
- Spoken phrases mark slide transitions ("Now let's move to Objective 3").
- Course content follows the source slide order exactly.

### Git
- Branch per task: `p0/<task-id>-short-name` (for example `p0/T07-rls-tests`).
- Small PRs, one task each, with the task's acceptance criteria copied into the description and checked off.
- Never commit `.env*` files, real data, or exported spreadsheets.

---

## How to work in this repo (for Claude)

- Start each task by reading its entry in `docs/PHASE-<n>.md`. Restate the acceptance criteria, then plan.
- For anything touching RLS, auth, storage, or audit: write the failing test first, then the policy or code.
- After schema changes, run the Supabase security advisors (`get_advisors`) and fix every warning before finishing.
- When a decision is made (library choice, schema shape, renewal rule detail), add a short ADR in `docs/decisions/`.
- Do not add dependencies without a reason in the PR description.
- If a requirement is ambiguous, list the options and ask Jason rather than guessing, especially for anything about PHI, access, or training-cycle rules.

---

## Environments

| Env | Supabase project | Data | URL |
| --- | --- | --- | --- |
| Local | `supabase start` | Seed (fake) | localhost:3000 |
| Staging | `realcare-portal-staging` | Seed (fake) | Vercel preview |
| Production | `realcare-portal-prod` | Real, only after BAAs are signed and the Phase 2 HIPAA review is done | portal.realcarecolorado.com (proposed) |

Secrets live in Vercel and Supabase environment settings only. Required variables are listed in `.env.example`.
