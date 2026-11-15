-- Nov 14, 2026 (Jason's answers after the Wix inventory):
--   1. "RCI Provider" is an alternate contractor status: a fifth provider type. FCG = Family Caregiver.
--   2. The course list matches the live Wix site exactly: All-Access is the 14 core courses; Documentation, QMAP,
--      Injection Administration and Employee Orientation are invite-only; Respite is open to everyone.
--   3. Renewal: annual training is due 12 months after the provider finishes the year's courses. A missed year stays
--      overdue until it is finished (the old job rolled over on the due date, so "overdue" vanished overnight).
--   4. People added without a login get no notifications or emails until they accept an invite.
--   5. One-step import of members, training history and plan access from the live Wix site (production only).
-- See docs/decisions/0002-renewal-rule.md and docs/decisions/0003-wix-import.md.

-------------------------------------------------------------------------------- 1. provider types
create or replace function public.provider_type_list() returns text[]
language sql immutable set search_path = '' as $$
  select array['host_home', 'family_caregiver', 'scc_dsp', 'nmt', 'rci_provider']::text[];
$$;
grant execute on function public.provider_type_list() to authenticated;

-- Functions that list the four types inline get the fifth. Fails loudly if none are found.
do $$
declare f record; v_def text; v_new text; n int := 0;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.prokind = 'f' and p.proname <> 'provider_type_list'
  loop
    v_def := pg_get_functiondef(f.oid);
    continue when position('''scc_dsp'', ''nmt''' in v_def) = 0;
    v_new := replace(replace(v_def, '''scc_dsp'', ''nmt'']', '''scc_dsp'', ''nmt'', ''rci_provider'']'),
                     '''scc_dsp'', ''nmt'')', '''scc_dsp'', ''nmt'', ''rci_provider'')');
    if v_new <> v_def then execute v_new; n := n + 1; end if;
  end loop;
  if n = 0 then raise exception 'no provider type lists found to update'; end if;
end $$;

do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'public.programs'::regclass and contype = 'c'
           and pg_get_constraintdef(oid) like '%audience%' loop
    execute format('alter table public.programs drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.programs add constraint programs_audience_check check (audience <@ public.provider_type_list());

-- Starting point for RCI Providers: the same courses as SCC/DSP. Staff can change it on the Requirements page.
insert into public.requirements (provider_type, course_id, frequency)
select 'rci_provider', course_id, frequency from public.requirements where provider_type = 'scc_dsp'
on conflict do nothing;

-------------------------------------------------------------------------------- 2. course list matches Wix
update public.courses set invite_only = true where slug in ('documentation', 'qmap', 'injection-admin', 'employee-orientation');
update public.courses set invite_only = false where slug = 'respite';
update public.courses set in_all_access = false where slug in ('documentation', 'qmap', 'injection-admin', 'employee-orientation', 'respite');
update public.courses set price_cents = 1000 where slug = 'employee-orientation' and price_cents = 0;
delete from public.program_courses pc using public.programs p, public.courses c
where pc.program_id = p.id and p.slug = 'all-access' and pc.course_id = c.id and not c.in_all_access;

-- Invite-only courses are also visible to providers whose type requires them (QMAP for Host Homes, for example).
create or replace function public.can_see_course(p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_staff() or exists (select 1 from public.courses c where c.id = p_course and not c.invite_only)
    or exists (select 1 from public.provider_course_overrides o where o.course_id = p_course and o.provider_id = auth.uid() and o.mode = 'assigned')
    or (auth.uid() is not null and exists (select 1 from public.required_courses(auth.uid()) rc where rc.course_id = p_course));
$$;
comment on function public.can_see_course(uuid) is 'Security definer: reads overrides and requirements for the caller only.';

-------------------------------------------------------------------------------- 3. renewal: a year after finishing
-- The day a provider finished a training year: the latest completion among the year's annual courses, once every
-- required course is done (one-time courses count from any year). Null while anything is missing.
create or replace function public.cycle_finished_on(p_provider uuid, p_cycle uuid) returns date
language sql stable security definer set search_path = '' as $$
  with req as (select course_id, frequency from public.required_courses(p_provider)),
  done as (
    select r.course_id, r.frequency,
      (select max((cp.completed_at at time zone 'America/Denver')::date) from public.completions cp
        where cp.provider_id = p_provider and cp.course_id = r.course_id and (cp.cycle_id = p_cycle or r.frequency = 'once')) as d
    from req r)
  select case when exists (select 1 from req) and not exists (select 1 from done where d is null)
    then (select max(d) from done where frequency = 'annual') end;
$$;
comment on function public.cycle_finished_on(uuid, uuid) is 'Security definer: internal helper for renewals and staff views.';
revoke execute on function public.cycle_finished_on(uuid, uuid) from public, anon, authenticated;

-- The next year opens 60 days before it is due, so reminders and early completions land in it.
-- An unfinished year never rolls over: it stays overdue until it is done.
create or replace function public._run_renewals(p_as_of date) returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int := 0; r record; v_fin date; v_due date;
begin
  for r in
    select distinct on (tc.provider_id) tc.* from public.training_cycles tc
    join public.profiles p on p.id = tc.provider_id and p.active and p.role = 'provider'
    order by tc.provider_id, tc.cycle_number desc
  loop
    v_fin := public.cycle_finished_on(r.provider_id, r.id);
    continue when v_fin is null;
    v_due := (v_fin + interval '1 year')::date;
    if p_as_of >= v_due - 60 then
      insert into public.training_cycles (provider_id, cycle_number, starts_on, due_on, label)
      values (r.provider_id, r.cycle_number + 1, v_due - 60, v_due, 'Cycle ' || (r.cycle_number + 1))
      on conflict do nothing;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

-------------------------------------------------------------------------------- 4. no notifications without a login
do $$
declare v_def text; v_new text;
begin
  select pg_get_functiondef('public.notify(uuid, text, text, text, int)'::regprocedure) into v_def;
  v_new := replace(v_def, 'if p.id is null or not p.active then return; end if;',
    'if p.id is null or not p.active then return; end if;' || chr(10) ||
    '  if p.role = ''provider'' and not p.login_enabled then return; end if; -- added without a login: quiet until invited');
  if v_new = v_def then raise exception 'notify(): guard line not found'; end if;
  execute v_new;
end $$;

-------------------------------------------------------------------------------- 5. Wix import
alter table public.profiles add column if not exists external_ref text;
create unique index if not exists profiles_external_ref_key on public.profiles (external_ref) where external_ref is not null;

create table public.wix_import_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'staged' check (status in ('staged', 'committed', 'discarded')),
  source text not null check (source in ('wix', 'sample')),
  summary jsonb not null default '{}',
  result jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  committed_at timestamptz
);

create table public.wix_import_people (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.wix_import_runs(id) on delete cascade,
  wix_member_id text not null,
  full_name text not null,
  email text,
  phone text,
  locale text not null default 'en' check (locale in ('en', 'es')),
  provider_types text[] not null default '{}',
  joined_on date,
  completions jsonb not null default '[]', -- [{slug, lang, on}], latest per course
  access jsonb,                            -- {kind: real_care | all_access, starts_on, ends_on}
  status text not null check (status in ('ready', 'existing', 'no_email', 'duplicate_email', 'no_type', 'imported')),
  provider_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, wix_member_id)
);
create index on public.wix_import_people (run_id, status);

alter table public.wix_import_runs enable row level security;
alter table public.wix_import_people enable row level security;
-- Read-only for staff; every write goes through the functions below.
create policy "staff read" on public.wix_import_runs for select to authenticated using ((select public.staff_can('training_admin')));
create policy "staff read" on public.wix_import_people for select to authenticated using ((select public.staff_can('training_admin')));
create trigger audit after insert or update or delete on public.wix_import_runs for each row execute function public.audit_trigger();
create trigger audit after insert or update or delete on public.wix_import_people for each row execute function public.audit_trigger();
create trigger touch before update on public.wix_import_runs for each row execute function public.touch_updated_at();
create trigger touch before update on public.wix_import_people for each row execute function public.touch_updated_at();

-- Stage a pull for review. Real Wix data is refused in the demo, and the fictional sample is refused outside it.
create or replace function public.stage_wix_import(p_source text, p_people jsonb, p_summary jsonb default '{}') returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_run uuid; x jsonb; v_email text; v_types text[]; v_status text; v_demo boolean; v_comp jsonb; v_lang text;
begin
  if not public.staff_can('super_admin') then raise exception 'Only a super admin can import from Wix.'; end if;
  v_demo := coalesce((select demo_mode from public.app_settings where id = 1), false);
  if p_source = 'wix' and v_demo then raise exception 'Real Wix data cannot be imported into the demo site.'; end if;
  if p_source = 'sample' and not v_demo then raise exception 'The sample import is only for the demo site.'; end if;
  if p_source not in ('wix', 'sample') then raise exception 'unknown source'; end if;
  if jsonb_typeof(p_people) <> 'array' or jsonb_array_length(p_people) > 3000 then raise exception 'Up to 3,000 people per import.'; end if;

  update public.wix_import_runs set status = 'discarded' where status = 'staged';
  insert into public.wix_import_runs (source, summary, created_by)
  values (p_source, coalesce(p_summary, '{}'), auth.uid()) returning id into v_run;

  for x in select * from jsonb_array_elements(p_people) loop
    v_email := lower(trim(coalesce(x->>'email', '')));
    v_types := array(select t from jsonb_array_elements_text(coalesce(x->'provider_types', '[]')) t where t = any (public.provider_type_list()));
    -- Keep the latest completion per course, only for courses the portal has.
    select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'lang', lang, 'on', d) order by slug), '[]') into v_comp
    from (
      select distinct on (c->>'slug') c->>'slug' as slug, case when c->>'lang' = 'es' then 'es' else 'en' end as lang, (c->>'on')::date as d
      from jsonb_array_elements(coalesce(x->'completions', '[]')) c
      where exists (select 1 from public.courses k where k.slug = c->>'slug') and (c->>'on') ~ '^\d{4}-\d{2}-\d{2}$'
      order by c->>'slug', (c->>'on')::date desc
    ) z;
    v_status := case
      when v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then 'no_email'
      when exists (select 1 from public.wix_import_people w where w.run_id = v_run and w.email = v_email) then 'duplicate_email'
      when exists (select 1 from public.profiles p where lower(p.email) = v_email or p.external_ref = 'wix:' || (x->>'wix_member_id'))
        or exists (select 1 from auth.users u where lower(u.email) = v_email) then 'existing'
      when coalesce(cardinality(v_types), 0) = 0 then 'no_type'
      else 'ready' end;
    v_lang := case when x->>'locale' = 'es' then 'es' else 'en' end;
    insert into public.wix_import_people (run_id, wix_member_id, full_name, email, phone, locale, provider_types, joined_on, completions, access, status)
    values (v_run, left(x->>'wix_member_id', 64), left(coalesce(nullif(trim(x->>'full_name'), ''), '(no name)'), 200),
      nullif(v_email, ''), nullif(left(trim(coalesce(x->>'phone', '')), 40), ''), v_lang, v_types,
      case when (x->>'joined_on') ~ '^\d{4}-\d{2}-\d{2}$' then (x->>'joined_on')::date end, v_comp,
      case when x->'access' ? 'kind' and x->'access'->>'kind' in ('real_care', 'all_access') then x->'access' end, v_status)
    on conflict (run_id, wix_member_id) do nothing;
  end loop;
  return v_run;
end $$;

-- Staff can fix a person's provider types before committing (also clears "no_type").
create or replace function public.set_wix_import_types(p_person uuid, p_types text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_types text[];
begin
  if not public.staff_can('super_admin') then raise exception 'Only a super admin can import from Wix.'; end if;
  v_types := array(select t from unnest(coalesce(p_types, '{}')) t where t = any (public.provider_type_list()));
  if cardinality(v_types) = 0 then raise exception 'Choose at least one provider type.'; end if;
  update public.wix_import_people w set provider_types = v_types,
    status = case when w.status = 'no_type' then 'ready' else w.status end
  where w.id = p_person and w.status in ('ready', 'no_type')
    and exists (select 1 from public.wix_import_runs r where r.id = w.run_id and r.status = 'staged');
  if not found then raise exception 'This person can no longer be changed.'; end if;
end $$;

create or replace function public.discard_wix_import(p_run uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.staff_can('super_admin') then raise exception 'Only a super admin can import from Wix.'; end if;
  update public.wix_import_runs set status = 'discarded' where id = p_run and status = 'staged';
end $$;

-- Create everyone marked ready. Nobody gets a login or a notification; staff send invites later.
-- Training history goes into a first "Wix history" year starting on the earliest completion. The renewal rule then
-- decides whether the next year is already open or overdue.
create or replace function public.commit_wix_import(p_run uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare w record; v_uid uuid; v_start date; v_cycle uuid; c jsonb; v_course uuid; v_prog uuid; v_order uuid;
  v_people int := 0; v_comps int := 0; v_access int := 0; v_today date := (now() at time zone 'America/Denver')::date; v_result jsonb;
begin
  if not public.staff_can('super_admin') then raise exception 'Only a super admin can import from Wix.'; end if;
  if not exists (select 1 from public.wix_import_runs where id = p_run and status = 'staged') then
    raise exception 'This import was already committed or discarded.';
  end if;
  select id into v_prog from public.programs where slug = 'all-access';

  for w in select * from public.wix_import_people where run_id = p_run and status = 'ready' order by full_name loop
    -- A person may have been added by hand since staging.
    if exists (select 1 from auth.users u where lower(u.email) = w.email) then
      update public.wix_import_people set status = 'existing' where id = w.id;
      continue;
    end if;
    v_uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', w.email, '',
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', w.full_name), now(), now(), '', '', '', '');
    insert into public.profiles (id, role, full_name, email, phone, locale, provider_types, login_enabled, external_ref)
    values (v_uid, 'provider', w.full_name, w.email, w.phone, w.locale, w.provider_types, false, 'wix:' || w.wix_member_id);

    select min((x->>'on')::date) into v_start from jsonb_array_elements(w.completions) x;
    insert into public.training_cycles (provider_id, cycle_number, starts_on, due_on, label)
    values (v_uid, 1, coalesce(v_start, w.joined_on, v_today), (coalesce(v_start, w.joined_on, v_today) + interval '1 year')::date,
      case when v_start is null then 'Cycle 1' else 'Wix history' end)
    returning id into v_cycle;

    for c in select * from jsonb_array_elements(w.completions) loop
      select id into v_course from public.courses where slug = c->>'slug';
      continue when v_course is null;
      insert into public.completions (provider_id, course_id, cycle_id, completed_at, language, source, note)
      values (v_uid, v_course, v_cycle, ((c->>'on')::date + time '12:00') at time zone 'America/Denver', c->>'lang', 'legacy_wix', 'Imported from Wix')
      on conflict (provider_id, course_id, cycle_id) do nothing;
      insert into public.lesson_progress (provider_id, lesson_id, cycle_id, completed_at)
      select v_uid, l.id, v_cycle, ((c->>'on')::date + time '12:00') at time zone 'America/Denver' from public.lessons l where l.course_id = v_course
      on conflict do nothing;
      v_comps := v_comps + 1;
    end loop;

    if w.access is not null and v_prog is not null then
      insert into public.orders (provider_id, program_id, description, amount_cents, method, note, created_at)
      values (v_uid, v_prog,
        case when w.access->>'kind' = 'real_care' then 'Real Care provider access (from Wix)' else 'All-Access Package (bought on Wix)' end,
        case when w.access->>'kind' = 'real_care' then 0 else 7500 end,
        case when w.access->>'kind' = 'real_care' then 'paid_by_real_care' else 'wix' end,
        'Imported from Wix', coalesce((w.access->>'starts_on')::timestamptz, now()))
      returning id into v_order;
      insert into public.entitlements (provider_id, program_id, order_id, starts_on, ends_on)
      values (v_uid, v_prog, v_order, coalesce((w.access->>'starts_on')::date, v_today),
        coalesce((w.access->>'ends_on')::date, case when w.access->>'kind' = 'real_care' then date '2099-12-31' else v_today + 365 end));
      v_access := v_access + 1;
    end if;

    update public.wix_import_people set status = 'imported', provider_id = v_uid where id = w.id;
    v_people := v_people + 1;
  end loop;

  perform public._run_renewals(v_today);
  v_result := jsonb_build_object('people', v_people, 'completions', v_comps, 'access', v_access);
  update public.wix_import_runs set status = 'committed', committed_at = now(), result = v_result where id = p_run;
  insert into public.audit_log (actor, action, table_name, record_id, details)
  values (auth.uid(), 'wix_import', 'profiles', p_run::text, v_result);
  return v_result;
end $$;

comment on function public.stage_wix_import(text, jsonb, jsonb) is 'Security definer: super admin only; writes staging rows that RLS keeps read-only.';
comment on function public.commit_wix_import(uuid) is 'Security definer: super admin only; creates login-less accounts (auth.users) like staff_add_provider.';
revoke execute on function public.stage_wix_import(text, jsonb, jsonb), public.commit_wix_import(uuid),
  public.set_wix_import_types(uuid, text[]), public.discard_wix_import(uuid) from public, anon;
grant execute on function public.stage_wix_import(text, jsonb, jsonb), public.commit_wix_import(uuid),
  public.set_wix_import_types(uuid, text[]), public.discard_wix_import(uuid) to authenticated;
