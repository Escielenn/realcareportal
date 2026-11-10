-- Phase 1 operations (Nov 10, 2026), from Torey Innes' Nov 9 priorities:
--   1. Staff add providers without a login (one at a time or a roster upload); logins are sent later.
--   2. Per-provider course assignment and exemption; invite-only courses; one-time courses stay done.
--   3. Acknowledgment lessons and lesson attachments (for the DCW Notice of Rights).
--   5. Staff permission levels: reviewer < training_admin < super_admin, enforced here.
--   6. A switch to hide client features (people supported, forms, documents) until the HIPAA step.

-------------------------------------------------------------------------------- settings
alter table public.app_settings add column if not exists client_features boolean not null default false; -- production default: off
update public.app_settings set client_features = true where id = 1 and demo_mode;                       -- the demo keeps them on

-------------------------------------------------------------------------------- 5. staff permission levels
alter table public.profiles add column if not exists staff_level text check (staff_level in ('reviewer', 'training_admin', 'super_admin'));
update public.profiles set staff_level = case when role = 'admin' then 'super_admin' else 'training_admin' end
  where role in ('staff', 'admin') and staff_level is null;

-- Security definer: reads the caller's own level without RLS recursion.
create or replace function public.staff_can(p_level text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_staff() and coalesce((
    select case coalesce(p.staff_level, case when p.role = 'admin' then 'super_admin' else 'reviewer' end)
      when 'super_admin' then 3 when 'training_admin' then 2 else 1 end
    from public.profiles p where p.id = auth.uid()), 0)
    >= case p_level when 'super_admin' then 3 when 'training_admin' then 2 else 1 end;
$$;

-- Only a full admin changes a staff member's level.
create or replace function public.set_staff_level(p_profile uuid, p_level text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.staff_can('super_admin') then raise exception 'Only a full admin can change staff permissions.'; end if;
  if p_level not in ('reviewer', 'training_admin', 'super_admin') then raise exception 'unknown level'; end if;
  if p_profile = auth.uid() and p_level <> 'super_admin' then raise exception 'You cannot lower your own level.'; end if;
  if not exists (select 1 from public.profiles where id = p_profile and role in ('staff', 'admin')) then raise exception 'staff member not found'; end if;
  perform set_config('rc.allow_level', 'on', true);
  update public.profiles set staff_level = p_level where id = p_profile;
  perform set_config('rc.allow_level', 'off', true);
end $$;

create or replace function public.trg_profile_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if; -- migrations, seed, jobs
  if new.role is distinct from old.role then raise exception 'roles cannot be changed here'; end if;
  if new.id is distinct from old.id or new.email is distinct from old.email then raise exception 'id and email cannot be changed here'; end if;
  if new.active is distinct from old.active and current_setting('rc.allow_active', true) is distinct from 'on' then
    raise exception 'use set_account_active';
  end if;
  if new.staff_level is distinct from old.staff_level and current_setting('rc.allow_level', true) is distinct from 'on' then
    raise exception 'use set_staff_level';
  end if;
  if new.login_enabled is distinct from old.login_enabled and current_setting('rc.allow_login', true) is distinct from 'on' then
    raise exception 'logins are turned on by accepting an invite';
  end if;
  return new;
end $$;

-- Raise the bar on existing staff functions. Each had the same one-line check; this swaps it for a level check
-- (training_admin, or super_admin for account status), and fails loudly if a function's check isn't found.
do $$
declare f record; v_def text; v_new text; v_level text;
begin
  for f in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.proname in (
      'assign_form', 'commit_import', 'create_form_template', 'create_password_reset', 'extend_due', 'grant_access',
      'grant_program', 'open_cycles', 'publish_form_version', 'refund_order', 'renew_provider', 'run_renewals',
      'set_account_active', 'set_import_match', 'set_program_courses', 'staff_mark_complete', 'stage_import')
  loop
    v_level := case when f.proname = 'set_account_active' then 'super_admin' else 'training_admin' end;
    v_def := pg_get_functiondef(f.oid);
    v_new := replace(v_def, $q$if not public.is_staff() then raise exception 'staff only'; end if;$q$,
      format($q$if not public.staff_can(%L) then raise exception 'Your staff permissions do not allow this.'; end if;$q$, v_level));
    if v_new = v_def then raise exception 'staff check not found in %', f.proname; end if;
    execute v_new;
  end loop;
end $$;

-- Catalog and setup changes need a training admin; reviewers can read everything staff can.
alter policy "staff write" on public.courses with check ((select public.staff_can('training_admin')));
alter policy "staff update" on public.courses using ((select public.staff_can('training_admin'))) with check ((select public.staff_can('training_admin')));
alter policy "staff delete" on public.courses using ((select public.staff_can('training_admin')));
alter policy "staff write" on public.lessons with check ((select public.staff_can('training_admin')));
alter policy "staff update" on public.lessons using ((select public.staff_can('training_admin'))) with check ((select public.staff_can('training_admin')));
alter policy "staff delete" on public.lessons using ((select public.staff_can('training_admin')));
alter policy "staff write" on public.quiz_questions with check ((select public.staff_can('training_admin')));
alter policy "staff update" on public.quiz_questions using ((select public.staff_can('training_admin'))) with check ((select public.staff_can('training_admin')));
alter policy "staff delete" on public.quiz_questions using ((select public.staff_can('training_admin')));
alter policy "staff write" on public.requirements with check ((select public.staff_can('training_admin')));
alter policy "staff delete" on public.requirements using ((select public.staff_can('training_admin')));
alter policy "staff insert" on public.programs with check ((select public.staff_can('training_admin')));
alter policy "staff update" on public.programs using ((select public.staff_can('training_admin'))) with check ((select public.staff_can('training_admin')));
alter policy "staff create" on public.invites with check ((select public.staff_can('training_admin')) and created_by = (select auth.uid()));
alter policy "staff delete" on public.invites using ((select public.staff_can('training_admin')) and accepted_at is null);
alter policy "staff update" on public.profiles using ((select public.staff_can('training_admin'))) with check ((select public.staff_can('training_admin')));

-------------------------------------------------------------------------------- 1. providers without a login
alter table public.profiles add column if not exists login_enabled boolean not null default true;

-- Creates the provider's account with no password, so nobody can sign in to it until staff send an invite.
-- Same approach as accept_invite (a stand-in for Supabase's admin API that keeps the service key out of the app).
-- The first training year starts on the most recent anniversary of p_cycle_start (or the hire date).
create or replace function public.staff_add_provider(p_full_name text, p_email text, p_phone text, p_types text[],
  p_hire_date date default null, p_cycle_start date default null, p_locale text default 'en') returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := gen_random_uuid(); v_email text := lower(trim(coalesce(p_email, ''))); v_anchor date; v_start date; v_years int;
begin
  if not public.staff_can('training_admin') then raise exception 'Your staff permissions do not allow this.'; end if;
  if length(trim(coalesce(p_full_name, ''))) < 2 then raise exception 'Add the provider''s full name.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Add a valid email address.'; end if;
  if coalesce(cardinality(p_types), 0) = 0 or not (p_types <@ array['host_home', 'family_caregiver', 'scc_dsp', 'nmt']) then
    raise exception 'Choose at least one provider type.';
  end if;
  if coalesce(p_locale, 'en') not in ('en', 'es') then raise exception 'Language must be en or es.'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then raise exception 'A person with this email is already in the portal.'; end if;
  v_anchor := coalesce(p_cycle_start, p_hire_date, current_date);
  if v_anchor > current_date + 366 then raise exception 'The training start date is too far in the future.'; end if;
  v_years := greatest(0, extract(year from age(current_date, v_anchor))::int);
  v_start := (v_anchor + make_interval(years => v_years))::date;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email, '',
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', trim(p_full_name)), now(), now(), '', '', '', '');
  insert into public.profiles (id, role, full_name, email, phone, locale, provider_types, hire_date, login_enabled)
  values (v_uid, 'provider', trim(p_full_name), v_email, nullif(trim(coalesce(p_phone, '')), ''), coalesce(p_locale, 'en'), p_types, p_hire_date, false);
  insert into public.training_cycles (provider_id, cycle_number, starts_on, due_on, label)
  values (v_uid, 1, v_start, (v_start + interval '1 year')::date, 'Cycle 1');
  return v_uid;
end $$;

-- Roster upload: one result per row, so a bad row never stops the rest. Rows are prepared by the staff screen.
create or replace function public.staff_import_providers(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb; v_out jsonb := '[]'; v_id uuid; n int := 0;
begin
  if not public.staff_can('training_admin') then raise exception 'Your staff permissions do not allow this.'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then raise exception 'Upload up to 2,000 rows at a time.'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    n := n + 1;
    begin
      v_id := public.staff_add_provider(r->>'full_name', r->>'email', r->>'phone',
        array(select jsonb_array_elements_text(coalesce(r->'provider_types', '[]'))),
        nullif(r->>'hire_date', '')::date, nullif(r->>'cycle_start', '')::date, coalesce(nullif(r->>'locale', ''), 'en'));
      v_out := v_out || jsonb_build_object('row', n, 'ok', true, 'id', v_id);
    exception when others then
      v_out := v_out || jsonb_build_object('row', n, 'ok', false, 'error', sqlerrm);
    end;
  end loop;
  insert into public.audit_log (actor, action, table_name, record_id, details)
  values (auth.uid(), 'import_providers', 'profiles', null,
    jsonb_build_object('rows', n, 'added', (select count(*) from jsonb_array_elements(v_out) x where (x->>'ok')::boolean)));
  return v_out;
end $$;

-- Invite a provider who was added without a login. Replaces any unused invite for them.
create or replace function public.staff_invite_provider(p_provider uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p record; v_token uuid;
begin
  if not public.staff_can('training_admin') then raise exception 'Your staff permissions do not allow this.'; end if;
  select * into p from public.profiles where id = p_provider and role = 'provider';
  if p.id is null then raise exception 'provider not found'; end if;
  if p.login_enabled then raise exception 'This provider already has a login.'; end if;
  if not p.active then raise exception 'Reactivate this provider first.'; end if;
  delete from public.invites where profile_id = p_provider and accepted_at is null;
  insert into public.invites (email, full_name, provider_types, locale, created_by, profile_id)
  values (p.email, p.full_name, p.provider_types, p.locale, auth.uid(), p_provider) returning token into v_token;
  return v_token;
end $$;

-- Accepting an invite either creates a new account (classic invite) or sets the password on an account staff added.
create or replace function public.accept_invite(p_token uuid, p_password text) returns text
language plpgsql security definer set search_path = '' as $$
declare inv record; v_uid uuid := gen_random_uuid();
begin
  select * into inv from public.invites where token = p_token and accepted_at is null and expires_at > now() for update;
  if inv.id is null then raise exception 'This invitation is not valid or has expired.'; end if;
  if length(coalesce(p_password, '')) < 10 then raise exception 'Use at least 10 characters for your password.'; end if;
  if inv.profile_id is not null then
    -- Existing record added by staff: keep its training history, just turn the login on.
    v_uid := inv.profile_id;
    update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = v_uid;
    if not exists (select 1 from auth.identities where user_id = v_uid and provider = 'email') then
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_uid, v_uid, jsonb_build_object('sub', v_uid, 'email', lower(inv.email), 'email_verified', true), 'email', now(), now(), now());
    end if;
    perform set_config('rc.allow_login', 'on', true);
    update public.profiles set login_enabled = true where id = v_uid;
    perform set_config('rc.allow_login', 'off', true);
    update public.invites set accepted_at = now() where id = inv.id;
    perform public.notify(v_uid, 'welcome', '/dashboard', 'welcome:' || v_uid);
    return lower(inv.email);
  end if;
  if exists (select 1 from auth.users where lower(email) = lower(inv.email)) then raise exception 'An account already exists for this email.'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', lower(inv.email),
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', inv.full_name), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_uid, v_uid, jsonb_build_object('sub', v_uid, 'email', lower(inv.email), 'email_verified', true), 'email', now(), now(), now());
  insert into public.profiles (id, role, full_name, email, locale, provider_types, hire_date)
  values (v_uid, 'provider', inv.full_name, lower(inv.email), inv.locale, inv.provider_types, current_date);
  insert into public.training_cycles (provider_id, cycle_number, starts_on, due_on, label)
  values (v_uid, 1, current_date, (current_date + interval '1 year')::date, 'Cycle 1');
  update public.invites set accepted_at = now(), profile_id = v_uid where id = inv.id;
  if inv.created_by is not null then
    insert into public.messages (provider_id, sender_id, body) values (v_uid, inv.created_by,
      case when inv.locale = 'es'
        then '¡Bienvenido a Real Care, ' || split_part(inv.full_name, ' ', 1) || '! Empiece con el curso de bienvenida. Si tiene preguntas, escríbanos aquí.'
        else 'Welcome to Real Care, ' || split_part(inv.full_name, ' ', 1) || '! Start with the Welcome course. If you have questions, message us here.' end);
  end if;
  perform public.notify(v_uid, 'welcome', '/dashboard', 'welcome:' || v_uid);
  return lower(inv.email);
end $$;

-------------------------------------------------------------------------------- 2. per-provider assignment and exemption
alter table public.courses add column if not exists invite_only boolean not null default false;

create table public.provider_course_overrides (
  provider_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  mode text not null check (mode in ('assigned', 'exempt')),
  frequency text not null default 'once' check (frequency in ('annual', 'once')),
  note text check (length(note) <= 500),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider_id, course_id)
);
create index on public.provider_course_overrides (course_id);
create trigger touch before update on public.provider_course_overrides for each row execute function public.touch_updated_at();
create trigger audit after insert or update or delete on public.provider_course_overrides for each row execute function public.audit_trigger();
alter table public.provider_course_overrides enable row level security;
create policy "own or staff" on public.provider_course_overrides for select to authenticated
  using (provider_id = (select auth.uid()) or (select public.is_staff()));
-- No write policies: changes go through set_course_overrides().

-- Invite-only courses are visible only to staff and to providers they're assigned to.
-- Security definer: checks the caller's own assignment without RLS recursion.
create or replace function public.can_see_course(p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_staff() or exists (select 1 from public.courses c where c.id = p_course and not c.invite_only)
    or exists (select 1 from public.provider_course_overrides o where o.course_id = p_course and o.provider_id = auth.uid() and o.mode = 'assigned');
$$;
alter policy "catalog read" on public.courses using ((select public.is_staff()) or not invite_only or public.can_see_course(id));
alter policy "catalog read" on public.lessons using (public.can_see_course(course_id));

-- Assign, exempt, or clear a course for one or many providers at once.
create or replace function public.set_course_overrides(p_providers uuid[], p_course uuid, p_mode text, p_frequency text default 'once', p_note text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare v_count int := 0; v_id uuid;
begin
  if not public.staff_can('training_admin') then raise exception 'Your staff permissions do not allow this.'; end if;
  if p_mode not in ('assigned', 'exempt', 'clear') then raise exception 'unknown choice'; end if;
  if coalesce(p_frequency, 'once') not in ('annual', 'once') then raise exception 'unknown frequency'; end if;
  if p_mode = 'exempt' and coalesce(trim(p_note), '') = '' then raise exception 'Add a note explaining the exemption.'; end if;
  if not exists (select 1 from public.courses where id = p_course) then raise exception 'course not found'; end if;
  if coalesce(cardinality(p_providers), 0) = 0 or cardinality(p_providers) > 2000 then raise exception 'Choose up to 2,000 providers.'; end if;
  foreach v_id in array p_providers loop
    continue when not exists (select 1 from public.profiles where id = v_id and role = 'provider');
    if p_mode = 'clear' then
      delete from public.provider_course_overrides where provider_id = v_id and course_id = p_course;
    else
      insert into public.provider_course_overrides (provider_id, course_id, mode, frequency, note, created_by)
      values (v_id, p_course, p_mode, coalesce(p_frequency, 'once'), nullif(left(trim(coalesce(p_note, '')), 500), ''), auth.uid())
      on conflict (provider_id, course_id) do update set mode = excluded.mode, frequency = excluded.frequency, note = excluded.note, created_by = excluded.created_by;
      if p_mode = 'assigned' then
        perform public.notify(v_id, 'course_assigned', '/training', 'course_assigned:' || v_id || ':' || p_course);
      end if;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- What a provider must complete: their provider types' requirements plus assigned courses, minus exemptions.
-- 'annual' if any source says annual; one-time courses count as done once completed in any year.
create or replace function public.required_courses(p_provider uuid)
returns table (course_id uuid, frequency text) language sql stable set search_path = '' as $$
  select x.course_id, case when bool_or(x.frequency = 'annual') then 'annual' else 'once' end
  from (
    select r.course_id, r.frequency from public.requirements r join public.profiles p on p.id = p_provider where r.provider_type = any (p.provider_types)
    union all
    select o.course_id, o.frequency from public.provider_course_overrides o where o.provider_id = p_provider and o.mode = 'assigned'
  ) x
  where not exists (select 1 from public.provider_course_overrides e where e.provider_id = p_provider and e.course_id = x.course_id and e.mode = 'exempt')
  group by x.course_id;
$$;

create or replace view public.provider_status with (security_invoker = true) as
select p.id as provider_id, p.full_name, p.email, p.provider_types, p.locale, p.active,
  c.id as cycle_id, c.cycle_number, c.starts_on, c.due_on,
  (select count(*) from public.required_courses(p.id))::int as required_count,
  (select count(*) from public.required_courses(p.id) rc
     where exists (select 1 from public.completions cp where cp.provider_id = p.id and cp.course_id = rc.course_id
                   and (cp.cycle_id = c.id or rc.frequency = 'once')))::int as done_count,
  p.login_enabled
from public.profiles p
left join lateral (select * from public.training_cycles tc where tc.provider_id = p.id order by tc.cycle_number desc limit 1) c on true
where p.role = 'provider';

-------------------------------------------------------------------------------- 3. acknowledgment lessons and attachments
alter table public.lessons drop constraint if exists lessons_kind_check;
alter table public.lessons add constraint lessons_kind_check check (kind in ('reading', 'video', 'quiz', 'acknowledgment'));
alter table public.lessons add column if not exists attachment_path text check (attachment_path is null or attachment_path ~ '^courses/[0-9a-f-]{36}/');
alter table public.lessons add column if not exists ack_statement_en text;
alter table public.lessons add column if not exists ack_statement_es text;

create table public.lesson_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  cycle_id uuid not null references public.training_cycles(id) on delete cascade,
  typed_name text not null check (length(typed_name) between 2 and 120),
  statement text not null, -- the exact words they agreed to, kept even if the lesson is edited later
  language text not null default 'en',
  acknowledged_at timestamptz not null default now(),
  unique (provider_id, lesson_id, cycle_id)
);
create trigger audit after insert or update or delete on public.lesson_acknowledgments for each row execute function public.audit_trigger();
alter table public.lesson_acknowledgments enable row level security;
create policy "own or staff" on public.lesson_acknowledgments for select to authenticated
  using (provider_id = (select auth.uid()) or (select public.is_staff()));
-- No write policies: rows come only from acknowledge_lesson().

create or replace function public.acknowledge_lesson(p_lesson uuid, p_typed_name text, p_lang text default 'en') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l record; v_cycle uuid; v_done boolean; v_statement text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into l from public.lessons where id = p_lesson and kind = 'acknowledgment';
  if l.id is null then raise exception 'acknowledgment not found'; end if;
  if not public.can_see_course(l.course_id) or not public.has_course_access(auth.uid(), l.course_id) then raise exception 'You do not have this course.'; end if;
  if length(trim(coalesce(p_typed_name, ''))) < 2 then raise exception 'Type your full name to sign.'; end if;
  v_cycle := public.current_cycle_id(auth.uid());
  if v_cycle is null then raise exception 'no training cycle'; end if;
  v_statement := case when p_lang = 'es' then coalesce(l.ack_statement_es, l.ack_statement_en, l.title_es) else coalesce(l.ack_statement_en, l.title_en) end;
  insert into public.lesson_acknowledgments (provider_id, lesson_id, cycle_id, typed_name, statement, language)
  values (auth.uid(), p_lesson, v_cycle, left(trim(p_typed_name), 120), v_statement, coalesce(p_lang, 'en'))
  on conflict (provider_id, lesson_id, cycle_id) do nothing;
  insert into public.lesson_progress (provider_id, lesson_id, cycle_id) values (auth.uid(), p_lesson, v_cycle) on conflict do nothing;
  v_done := public.maybe_complete_course(auth.uid(), l.course_id, v_cycle, p_lang, null);
  return jsonb_build_object('course_complete', v_done);
end $$;

-- Course media of invite-only courses: only people who can see the course.
drop policy if exists "training media read" on storage.objects;
create policy "training media read" on storage.objects for select to authenticated using (
  bucket_id = 'training-media' and (
    (select public.is_staff())
    or (
      (storage.foldername(name))[1] = 'courses'
      and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
      and public.can_see_course(((storage.foldername(name))[2])::uuid)
      and public.has_course_access((select auth.uid()), ((storage.foldername(name))[2])::uuid)
    )
  )
);

-------------------------------------------------------------------------------- notifications
create or replace function public.notify(p_profile uuid, p_kind text, p_link text, p_dedupe text default null, p_n int default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_en text; v_es text; p record;
begin
  select * into p from public.profiles where id = p_profile;
  if p.id is null or not p.active then return; end if;
  case p_kind
    when 'form_assigned' then v_en := 'You have a new form to complete'; v_es := 'Tiene un formulario nuevo para completar';
    when 'form_returned' then v_en := 'A form was returned for a correction'; v_es := 'Se devolvió un formulario para corregir';
    when 'form_accepted' then v_en := 'Your form was accepted'; v_es := 'Su formulario fue aceptado';
    when 'doc_returned' then v_en := 'A document was returned for a correction'; v_es := 'Se devolvió un documento para corregir';
    when 'doc_accepted' then v_en := 'Your document was accepted'; v_es := 'Su documento fue aceptado';
    when 'message' then v_en := 'You have a new message from Real Care staff'; v_es := 'Tiene un mensaje nuevo del personal de Real Care';
    when 'announcement' then v_en := 'Real Care posted a new announcement'; v_es := 'Real Care publicó un anuncio nuevo';
    when 'cycle_open' then v_en := 'Your annual training is open'; v_es := 'Su capacitación anual está abierta';
    when 'reminder' then v_en := 'Training due in ' || p_n || ' days'; v_es := 'Su capacitación vence en ' || p_n || ' días';
    when 'reminder_manual' then v_en := 'Reminder: please finish your required training'; v_es := 'Recordatorio: termine su capacitación requerida';
    when 'overdue' then v_en := 'Your required training is overdue'; v_es := 'Su capacitación requerida está atrasada';
    when 'course_assigned' then v_en := 'A new training was assigned to you'; v_es := 'Se le asignó una capacitación nueva';
    when 'access_granted' then v_en := 'You have access to a new course'; v_es := 'Tiene acceso a un curso nuevo';
    when 'program_joined' then v_en := 'Your program access is active'; v_es := 'Su acceso al programa está activo';
    when 'program_ending' then v_en := 'Your program access ends in ' || p_n || ' days'; v_es := 'Su acceso al programa termina en ' || p_n || ' días';
    when 'program_renewed' then v_en := 'Your program renewed automatically'; v_es := 'Su programa se renovó automáticamente';
    when 'program_autorenew_soon' then v_en := 'Your program renews automatically in ' || p_n || ' days'; v_es := 'Su programa se renueva automáticamente en ' || p_n || ' días';
    when 'program_ended' then v_en := 'Your program access has ended. You can renew it.'; v_es := 'Su acceso al programa terminó. Puede renovarlo.';
    when 'welcome' then v_en := 'Welcome to the Real Care Portal'; v_es := 'Bienvenido al Portal de Real Care';
    when 'staff_incident' then v_en := 'New incident report submitted. Log in to view.'; v_es := 'Nuevo informe de incidente. Inicie sesión para verlo.';
    when 'staff_application' then v_en := 'New provider application received'; v_es := 'Nueva solicitud de proveedor';
    when 'staff_message' then v_en := 'A provider sent a new message'; v_es := 'Un proveedor envió un mensaje nuevo';
    when 'staff_signin_alert' then v_en := 'Several failed sign-ins on one account. Check the audit log.'; v_es := 'Varios intentos fallidos de inicio de sesión en una cuenta. Revise el registro de auditoría.';
    when 'staff_password_help' then v_en := 'A provider asked for help signing in'; v_es := 'Un proveedor pidió ayuda para iniciar sesión';
    else v_en := 'You have an update in the Real Care Portal'; v_es := 'Tiene una novedad en el Portal de Real Care';
  end case;
  insert into public.notifications (profile_id, kind, title_en, title_es, link, dedupe_key)
  values (p_profile, p_kind, v_en, v_es, coalesce(p_link, '/dashboard'), p_dedupe)
  on conflict (dedupe_key) do nothing;
  if not found then return; end if;
  if p.email_notifications or p_kind in ('form_returned', 'doc_returned', 'overdue', 'welcome', 'staff_incident', 'staff_signin_alert', 'program_ending', 'program_renewed', 'program_autorenew_soon') then
    insert into public.email_outbox (profile_id, to_email, subject, body, kind)
    values (p_profile, p.email,
      case when p.locale = 'es' then v_es else v_en end,
      case when p.locale = 'es'
        then v_es || E'\n\n' || 'Inicie sesión para ver los detalles: https://realcareportal.vercel.app' || coalesce(p_link, '')
        else v_en || E'\n\n' || 'Sign in to see the details: https://realcareportal.vercel.app' || coalesce(p_link, '') end,
      p_kind);
  end if;
end $$;

-------------------------------------------------------------------------------- grants
revoke execute on function public.staff_can(text), public.set_staff_level(uuid, text), public.staff_add_provider(text, text, text, text[], date, date, text)
  from anon, public;
grant execute on function public.staff_can(text), public.set_staff_level(uuid, text),
  public.staff_add_provider(text, text, text, text[], date, date, text), public.staff_import_providers(jsonb),
  public.staff_invite_provider(uuid), public.set_course_overrides(uuid[], uuid, text, text, text),
  public.required_courses(uuid), public.can_see_course(uuid), public.acknowledge_lesson(uuid, text, text) to authenticated;
revoke execute on function public.staff_import_providers(jsonb), public.staff_invite_provider(uuid), public.set_course_overrides(uuid[], uuid, text, text, text),
  public.required_courses(uuid), public.can_see_course(uuid), public.acknowledge_lesson(uuid, text, text) from anon, public;
