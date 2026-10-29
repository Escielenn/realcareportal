# Security review: Real Care Portal (demo)

**Date:** October 29, 2026
**Scope:** the `realcareportal` repository (Next.js 15 App Router on Vercel; Supabase Postgres with row-level security, Auth and Storage), the live Supabase project's policies, functions and grants, and the deployed demo's HTTP headers.
**Standard:** OWASP Top 10:2025, using the OWASP Security Audit skill's method (static review plus read-only database inspection). Severity and confidence are rated separately. Severity is "if real, in production with PHI"; the demo holds fictional data only.
**Not run:** dependency vulnerability scanning (`npm audit` sends the dependency list to the npm registry and needs approval), penetration testing, load testing.

## Summary

The portal's main defense is in the database: every table has row-level security, internal functions can't be called through the API, and every staff function checks the caller's role inside the function. Screens add a second check. No finding lets a provider read another provider's records.

This pass fixed the gaps that mattered most before real records arrive:

| ID | Finding | Severity | Confidence | Status |
| --- | --- | --- | --- | --- |
| OWASP-A07-001 | Staff accounts had no second factor (CLAUDE.md rule 7) | High | High | **Fixed**: authenticator-app MFA, enforced in the database |
| OWASP-A06-001 | Any signed-in user could unlock paid courses with demo checkout | High (prod) | High | **Fixed**: works only when `app_settings.demo_mode` is on |
| OWASP-A01-001 | Internal database helpers (renewal job, notify, trigger functions) were callable through `/rest/v1/rpc` | High | High | **Fixed** (Oct 28): execute revoked; only app RPCs granted |
| OWASP-A01-002 | Staff could change a profile's role (any staff → admin) with a plain update | High | High | **Fixed**: guard trigger blocks role, id and email changes |
| OWASP-A01-003 | `current_cycle_id` / `has_course_access` answered for any provider id | Low | High | **Fixed**: only yourself, staff, or jobs |
| OWASP-A02-001 | No Content-Security-Policy, HSTS or Permissions-Policy | Medium | High | **Fixed**: per-request nonce CSP, HSTS, Permissions-Policy, COOP |
| OWASP-A06-002 | Uploads checked only by the browser-declared type | Low | High | **Fixed**: file signature checked on the server |
| OWASP-A09-001 | Any signed-in user could write arbitrary audit-log rows | Low | High | **Fixed**: known actions only, lengths capped |
| OWASP-A07-002 | Demo password shipped in every browser bundle | Medium (prod) | High | **Fixed**: sent only when demo mode is on |
| OWASP-A07-003 | Leaked-password protection is off in Supabase Auth | Low | High | **Open**: dashboard setting (Auth → Passwords) |
| OWASP-A01-004 | Paid-course lesson text (transcripts) readable before purchase | Low | High | Accepted for now: training content, no PHI; videos are protected |
| OWASP-A01-005 | Older course-editor uploads in `training-media` readable by any signed-in user | Low | High | Open: move to `courses/<id>/` paths |
| OWASP-A03-001 | npm reported 1 high and 1 moderate advisory at install | Medium | Low `[MANUAL VERIFICATION REQUIRED]` | Open: run `npm audit` with approval |
| OWASP-A08-001 | GitHub Actions use tag references (`@v4`), not commit SHAs | Low | High | Open |
| OWASP-A02-002 | The GitHub repository is public | Informational | High | Open: make private before real data |
| OWASP-A09-002 | Failed sign-ins aren't in the portal's audit log | Low | Medium | Open: Supabase Auth logs record them; add alerting before launch |

## Findings

### A01: Broken Access Control

**OWASP-A01-001: Internal database functions callable by any signed-in user** (CWE-285 Improper Authorization)
- Severity High: a provider could call `_run_renewals`, `notify`, `notify_staff` or trigger functions directly. Confidence High: confirmed with `has_function_privilege` and the Supabase security advisor.
- Location: Supabase default privileges granted `EXECUTE` on new functions to `authenticated`; earlier migrations revoked only from `public`.
- Fix (applied Oct 28): `supabase/migrations/20261028210000_function_lockdown.sql` revokes execute from everyone and grants back only the RPCs the app calls; default privileges changed so new functions start locked. The Phase 3 migration repeats the same grant list.

**OWASP-A01-002: Role escalation through profile updates** (CWE-269 Improper Privilege Management)
- Severity High: any staff member could make themselves or anyone an admin, or reactivate an account, with a direct `update profiles`. Confidence High.
- Location: policy `profiles."staff update"` allowed every column.
- Fix (applied): `trg_profile_guard` (Phase 3 migration) rejects role, id and email changes from signed-in users and allows `active` changes only through `set_account_active`, which also signs the account out. Verified: a staff session updating a provider's role raises "roles cannot be changed here".

**OWASP-A01-003: Helper functions answered for any provider** (CWE-639 Authorization Bypass Through User-Controlled Key)
- Severity Low: revealed only another provider's cycle id or whether they had course access. Confidence High.
- Fix (applied): both functions now return nothing unless the id is the caller's own, the caller is staff, or it's a background job. Verified: Maria's session gets `null` for Jordan's cycle and her own cycle normally.

**OWASP-A01-004: Lesson text of paid courses readable before purchase** (CWE-284)
- Severity Low: transcripts and quiz prompts of QMAP/Respite are training content, not PHI. Answer keys stay hidden (column grants), and the videos themselves need course access (storage policy, Oct 28). Accepted for the demo; split lesson bodies into an access-checked view if Real Care considers the content commercial.

**OWASP-A01-005: Older `training-media` uploads readable by any signed-in user** (CWE-284)
- Severity Low. Uploads made in the course editor don't live under `courses/<course_id>/`, so the course-access check doesn't apply to them. Fix: have the course editor upload under the course's folder and drop the fallback clause.

Checked and found sound: every table has RLS; providers see only their own rows and people they currently support (`provider_supports` checks link dates); document files are private, opened through 60-second signed links after an RLS-checked lookup, and staff views are audited; server actions validate ids and rely on RLS/RPC checks rather than hidden fields; the sign-in `next` parameter only accepts `/forms/start/<uuid>` (no open redirect); Next.js server actions check the request origin (CSRF).

### A02: Security Misconfiguration

**OWASP-A02-001: Missing CSP, HSTS and Permissions-Policy** (hardening; no specific CWE)
- Severity Medium for an app that will hold PHI: no second line of defense if a script injection is ever found. Confidence High (response headers).
- Fix (applied): `middleware.ts` sets a per-request nonce Content-Security-Policy (`script-src 'self' 'nonce-…' 'strict-dynamic'`, `frame-ancestors 'none'`, `object-src 'none'`, Supabase as the only outside origin); `next.config.ts` adds HSTS, Permissions-Policy and Cross-Origin-Opener-Policy alongside the existing X-Frame-Options, nosniff and Referrer-Policy. Verified the app still hydrates with no CSP errors (local Playwright check and the 59/59 live smoke test).
- `style-src` still allows inline styles (Tailwind and React style attributes); that's a low-risk, common trade-off.

**OWASP-A02-002: Public repository** (Informational)
- The repo has no secrets (the Supabase publishable key is designed to be public), but it publishes the full schema and policies. Make it private before real data, and keep it that way.

### A03: Software Supply Chain Failures

**OWASP-A03-001: Known advisories in dependencies** `[MANUAL VERIFICATION REQUIRED]`
- npm printed "2 vulnerabilities (1 moderate, 1 high)" during install. The package names weren't checked because `npm audit` contacts the npm registry and wasn't approved in this pass. Next step: run `npm audit`, update or replace the affected packages, and add `npm audit --audit-level=high` to CI. A lockfile (`package-lock.json`) is committed and dependencies are pinned to exact versions.

### A04: Cryptographic Failures

Assessed. Passwords are stored by Supabase Auth (bcrypt); the invite and reset functions hash with `crypt(…, gen_salt('bf'))`. Tokens (invites, password resets) are random UUIDs, single-use, and expire (14 days and 48 hours). TLS everywhere (Vercel, Supabase). No custom cryptography. No findings.

### A05: Injection

Assessed. All database access uses the Supabase client (parameterized) or SQL functions with typed parameters; no SQL is built from strings in the app. React escapes output; the only `dangerouslySetInnerHTML` renders a QR code SVG generated from a server-side constant URL. Course text and form notes render through a text-only Markdown helper. CSV exports quote every cell and neutralize spreadsheet formulas. No findings.

### A06: Insecure Design

**OWASP-A06-001: Self-service paid access in demo checkout** (CWE-840 Business Logic Errors)
- Severity High if it reached production: any provider could grant themselves any paid course. Fix (applied): `demo_checkout` refuses unless `app_settings.demo_mode` is on; production uses Stripe webhooks to create entitlements.

**OWASP-A06-002: Upload type trusted from the browser** (CWE-434 Unrestricted Upload of File with Dangerous Type)
- Severity Low: files are served from Supabase's domain, not the portal's, with `nosniff`. Fix (applied): `recordDocument` reads the first bytes and requires a real PDF/JPEG/PNG/WEBP/HEIC signature, deleting anything else.

Checked: rate limits exist where the public can write (applications: 3 per email per day; password help: 3 per email and 200 total per day; Supabase Auth rate-limits sign-in). Password help doesn't reveal whether an email has an account.

### A07: Authentication Failures

**OWASP-A07-001: No MFA for staff** (CWE-308 Use of Single-factor Authentication)
- Severity High once PHI is present: a phished staff password would expose every provider's records. Confidence High.
- Fix (applied): staff set up an authenticator app at `/staff-security`; anyone with a factor must enter a code (`/mfa`) before the staff console opens. **The database enforces it**: when `app_settings.staff_mfa_required` is on, `is_staff()` is true only for sessions at `aal2`, so every staff policy and RPC refuses a password-only session even if a page check were skipped. The database check was reviewed in code; a live test with the setting switched on is still to run. This demo has the setting off so the shared demo staff login stays one-click (the demo account can't enroll a factor). **Turn it on before real data**: `update app_settings set staff_mfa_required = true;`

**OWASP-A07-002: Demo password in client bundles** (CWE-798 Use of Hard-coded Credentials)
- Severity Medium if demo accounts existed in production. Fix (applied): the demo account list and password now come from a server-only module and are sent to the browser only in demo mode. The production database must be created without the seed (rule 4 in CLAUDE.md).

**OWASP-A07-003: Leaked-password protection off** (CWE-521 Weak Password Requirements)
- Supabase Auth → Passwords → turn on "Prevent use of leaked passwords". The portal already requires 10+ characters where it sets passwords.

Checked: deactivating an account deletes its sessions and refresh tokens; password reset signs the account out everywhere; invites are single-use; there is no public sign-up.

### A08: Software or Data Integrity Failures

**OWASP-A08-001: Actions referenced by tag** (CWE-829 Inclusion of Functionality from Untrusted Control Sphere)
- Severity Low. `actions/checkout@v4` and `actions/setup-node@v4` can move. Pin to commit SHAs. The two one-off workflows used to move brand assets and videos were removed in this pass.

Checked: no deserialization of untrusted formats beyond JSON; no webhooks yet (Stripe and Mux webhooks must verify signatures when added); form definitions and submissions are JSON validated by the database.

### A09: Security Logging and Alerting Failures

**OWASP-A09-001: Audit log could be written with any action** (CWE-117 Improper Output Neutralization for Logs)
- Severity Low. Fix (applied): `log_event` accepts only the portal's known view/export/sign-in actions and caps field lengths.

**OWASP-A09-002: Failed sign-ins not in the portal audit log** (CWE-778 Insufficient Logging)
- Severity Low. Supabase Auth records them in its own logs. Before launch, add alerting on repeated failures and on staff sign-ins from new places (Supabase log drains → email).

Checked: database triggers audit inserts, updates and deletes on sensitive tables (column names only, never values); staff views of submissions, documents, individuals and providers are logged; report and transcript downloads are logged; the audit log has no update or delete policy for anyone.

### A10: Mishandling of Exceptional Conditions

Assessed. Server actions return short messages; some pass through Postgres messages written by our own functions (for example "not your assignment"), which reveal nothing sensitive. Uploads that fail a check are deleted. Database functions run in transactions, so a failed step rolls back. No findings above Informational.

## Coverage

| Category | Coverage |
| --- | --- |
| A01 Broken Access Control | Assessed (all tables, policies, RPCs, storage, routes) |
| A02 Security Misconfiguration | Assessed (headers, cookies via Supabase SSR defaults, repo, settings) |
| A03 Supply Chain | Partially assessed (lockfile and pinning; advisories not looked up) |
| A04 Cryptographic Failures | Assessed |
| A05 Injection | Assessed |
| A06 Insecure Design | Assessed |
| A07 Authentication Failures | Assessed |
| A08 Integrity Failures | Assessed |
| A09 Logging and Alerting | Assessed (alerting infrastructure not yet built) |
| A10 Exceptional Conditions | Assessed |

## Before real data (checklist)

1. Supabase Team + HIPAA add-on and BAA; Vercel BAA (Phase 2, T201).
2. `update app_settings set demo_mode = false, staff_mfa_required = true;` and set `NEXT_PUBLIC_DEMO_MODE=false` in Vercel.
3. Production database without the seed; demo accounts never created there.
4. Turn on leaked-password protection; run `npm audit` and fix high findings; pin GitHub Actions to SHAs.
5. Make the GitHub repository private.
6. Move course-editor uploads under `courses/<course_id>/` (A01-005).
7. Outside HIPAA review (Phase 2, T218).

## Limitations

Static review and read-only database checks, not a penetration test. Deployed Supabase Auth settings (rate limits, session lifetime), Vercel project settings and dependency advisories weren't inspected. Business rules (who may see what) were taken from CLAUDE.md and the phase plans.
