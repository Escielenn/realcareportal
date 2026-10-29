-- Programs: annual packages providers opt into (e.g. the All-Access Package from realcaretraining.com).
-- A program bundles courses, has a price per term (default 12 months), and an optional audience (provider types).
-- Joining or renewing creates an order and an entitlement tied to the program. Course access follows program membership.
-- Designed so Stripe Checkout can replace demo checkout later: a Stripe webhook would call the same _join_program() helper.

-------------------------------------------------------------------------------- tables
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  name_en text not null check (length(name_en) between 2 and 120),
  name_es text not null check (length(name_es) between 2 and 120),
  description_en text not null default '',
  description_es text not null default '',
  price_cents int not null default 0 check (price_cents between 0 and 1000000),
  duration_days int not null default 365 check (duration_days between 1 and 730),
  audience text[] not null default '{}' check (audience <@ array['host_home', 'family_caregiver', 'scc_dsp', 'nmt']), -- empty = everyone
  active boolean not null default true,
  is_example boolean not null default false, -- sample program shown in the demo
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger touch before update on public.programs for each row execute function public.touch_updated_at();

create table public.program_courses (
  program_id uuid not null references public.programs(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (program_id, course_id)
);
create index on public.program_courses (course_id);

alter table public.programs enable row level security;
alter table public.program_courses enable row level security;
-- Catalog data, no PHI. Providers see active programs; staff see all. Only staff change them, through RLS or RPCs.
create policy "read active or staff" on public.programs for select to authenticated using (active or (select public.is_staff()));
create policy "staff insert" on public.programs for insert to authenticated with check ((select public.is_staff()));
create policy "staff update" on public.programs for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "read" on public.program_courses for select to authenticated
  using (exists (select 1 from public.programs p where p.id = program_id and (p.active or (select public.is_staff()))));
-- No insert/delete policies on program_courses: staff change the list only through set_program_courses().
create trigger audit after insert or update or delete on public.programs for each row execute function public.audit_trigger();

-------------------------------------------------------------------------------- orders and entitlements point at a program
alter table public.orders add column program_id uuid references public.programs(id) on delete restrict;
alter table public.entitlements add column program_id uuid references public.programs(id) on delete restrict;
alter table public.entitlements add constraint entitlement_target check (course_id is null or program_id is null);
create index on public.entitlements (program_id, ends_on);

-------------------------------------------------------------------------------- the All-Access Package becomes a program
insert into public.programs (id, slug, name_en, name_es, description_en, description_es, price_cents, duration_days, sort)
values ('50e88256-f3ac-5e06-b792-4afcf9b4e52f', 'all-access', 'All-Access Package', 'Paquete de acceso completo',
  'Every core Real Care course for 12 months, with certificates. Covers your annual required training.',
  'Todos los cursos básicos de Real Care por 12 meses, con certificados. Cubre su capacitación anual requerida.',
  7500, 365, 1)
on conflict (id) do nothing;
insert into public.program_courses (program_id, course_id)
select '50e88256-f3ac-5e06-b792-4afcf9b4e52f', id from public.courses where in_all_access
on conflict do nothing;
update public.entitlements set program_id = '50e88256-f3ac-5e06-b792-4afcf9b4e52f' where course_id is null and program_id is null;
update public.orders set program_id = '50e88256-f3ac-5e06-b792-4afcf9b4e52f' where course_id is null and program_id is null;

-- Example only: shows how a second program could bundle specialty courses.
insert into public.programs (id, slug, name_en, name_es, description_en, description_es, price_cents, duration_days, audience, is_example, sort)
values ('c951f62b-ea6e-5927-a42c-192f313743e9', 'specialty-bundle', 'Specialty Bundle (example)', 'Paquete especializado (ejemplo)',
  'Respite, injection administration and documentation training for 12 months. A sample program to show how bundles work.',
  'Relevo, administración de inyecciones y documentación por 12 meses. Un programa de ejemplo para mostrar cómo funcionan los paquetes.',
  2500, 365, array['host_home', 'family_caregiver'], true, 2)
on conflict (id) do nothing;
insert into public.program_courses (program_id, course_id)
select 'c951f62b-ea6e-5927-a42c-192f313743e9', id from public.courses where slug in ('respite', 'injection-admin', 'documentation')
on conflict do nothing;

-------------------------------------------------------------------------------- course access now follows program membership
create or replace function public.has_course_access(p_provider uuid, p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (auth.uid() is null or p_provider = auth.uid() or public.is_staff()) and coalesce((select c.price_cents = 0 or exists (
      select 1 from public.entitlements e where e.provider_id = p_provider and current_date between e.starts_on and e.ends_on
        and (e.course_id = c.id
             or exists (select 1 from public.program_courses pc where pc.program_id = e.program_id and pc.course_id = c.id)))
    from public.courses c where c.id = p_course), false);
$$;

-------------------------------------------------------------------------------- join / renew
-- Internal helper (not granted to anyone). Renewing early stacks: the new term starts the day after the current one ends.
create or replace function public._join_program(p_provider uuid, p_program uuid, p_method text, p_amount int, p_days int, p_note text, p_actor uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare pr record; v_order uuid; v_start date; v_days int;
begin
  select * into pr from public.programs where id = p_program;
  if pr.id is null then raise exception 'program not found'; end if;
  v_days := greatest(1, least(coalesce(p_days, pr.duration_days), 730));
  select greatest(current_date, coalesce(max(e.ends_on) + 1, current_date)) into v_start
  from public.entitlements e where e.provider_id = p_provider and e.program_id = p_program and e.ends_on >= current_date;
  insert into public.orders (provider_id, program_id, description, amount_cents, method, note, created_by)
  values (p_provider, p_program, pr.name_en || ' (' || v_days || ' days)', p_amount, p_method, p_note, p_actor) returning id into v_order;
  insert into public.entitlements (provider_id, program_id, order_id, starts_on, ends_on)
  values (p_provider, p_program, v_order, v_start, v_start + v_days - 1);
  return v_order;
end $$;

-- Provider opts in. Free programs work any time; paid ones use demo checkout only while demo mode is on.
create or replace function public.join_program(p_program uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pr record; v_types text[]; v_order uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into pr from public.programs where id = p_program and active;
  if pr.id is null then raise exception 'This program is not available.'; end if;
  select provider_types into v_types from public.profiles where id = auth.uid() and role = 'provider' and active;
  if v_types is null then raise exception 'Only providers can join programs.'; end if;
  if cardinality(pr.audience) > 0 and not (pr.audience && v_types) then
    raise exception 'This program is for other provider types. Contact Real Care staff.';
  end if;
  if pr.price_cents > 0 and not coalesce((select demo_mode from public.app_settings where id = 1), false) then
    raise exception 'Online payment is not available yet. Contact Real Care staff.';
  end if;
  if exists (select 1 from public.entitlements e where e.provider_id = auth.uid() and e.program_id = p_program and e.ends_on > current_date + 60) then
    raise exception 'You can renew within 60 days of your end date.';
  end if;
  v_order := public._join_program(auth.uid(), p_program, case when pr.price_cents > 0 then 'demo_checkout' else 'paid_by_real_care' end,
    pr.price_cents, pr.duration_days, case when pr.price_cents = 0 then 'Free program' end, auth.uid());
  perform public.notify(auth.uid(), 'program_joined', '/programs');
  return v_order;
end $$;

-- Staff gives a program at no charge (Real Care pays).
create or replace function public.grant_program(p_provider uuid, p_program uuid, p_days int, p_note text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_order uuid;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'add a note explaining the grant'; end if;
  if not exists (select 1 from public.profiles where id = p_provider and role = 'provider') then raise exception 'provider not found'; end if;
  v_order := public._join_program(p_provider, p_program, 'paid_by_real_care', 0, p_days, left(trim(p_note), 500), auth.uid());
  perform public.notify(p_provider, 'program_joined', '/programs');
  return v_order;
end $$;

-- Staff replaces a program's course list in one step.
create or replace function public.set_program_courses(p_program uuid, p_courses uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if not exists (select 1 from public.programs where id = p_program) then raise exception 'program not found'; end if;
  delete from public.program_courses where program_id = p_program and course_id <> all (coalesce(p_courses, '{}'));
  insert into public.program_courses (program_id, course_id)
  select p_program, c.id from public.courses c where c.id = any (coalesce(p_courses, '{}'))
  on conflict do nothing;
  insert into public.audit_log (actor, action, table_name, record_id)
  values (auth.uid(), 'set_program_courses', 'program_courses', p_program::text);
end $$;

-- Demo checkout for a single course only (programs go through join_program).
create or replace function public.demo_checkout(p_course uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c record; v_order uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not coalesce((select demo_mode from public.app_settings where id = 1), false) then
    raise exception 'Online payment is not available yet. Contact Real Care staff.';
  end if;
  if p_course is null then
    return public.join_program('50e88256-f3ac-5e06-b792-4afcf9b4e52f');
  end if;
  select * into c from public.courses where id = p_course and published;
  if c.id is null then raise exception 'course not found'; end if;
  insert into public.orders (provider_id, course_id, description, amount_cents, method, created_by)
  values (auth.uid(), p_course, c.title_en, c.price_cents, 'demo_checkout', auth.uid()) returning id into v_order;
  insert into public.entitlements (provider_id, course_id, order_id, ends_on)
  values (auth.uid(), p_course, v_order, current_date + c.access_days);
  return v_order;
end $$;

-- Staff course grants: a null course now means the All-Access program.
create or replace function public.grant_access(p_provider uuid, p_course uuid, p_days int, p_note text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_order uuid;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'add a note explaining the grant'; end if;
  if p_course is null then
    return public.grant_program(p_provider, '50e88256-f3ac-5e06-b792-4afcf9b4e52f', p_days, p_note);
  end if;
  insert into public.orders (provider_id, course_id, description, amount_cents, method, note, created_by)
  values (p_provider, p_course, coalesce((select title_en from public.courses where id = p_course), 'Course'), 0, 'paid_by_real_care', p_note, auth.uid())
  returning id into v_order;
  insert into public.entitlements (provider_id, course_id, order_id, ends_on)
  values (p_provider, p_course, v_order, current_date + greatest(1, least(coalesce(p_days, 365), 730)));
  perform public.notify(p_provider, 'access_granted', '/training');
  return v_order;
end $$;

-------------------------------------------------------------------------------- PHI-free notifications for programs
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
    when 'access_granted' then v_en := 'You have access to a new course'; v_es := 'Tiene acceso a un curso nuevo';
    when 'program_joined' then v_en := 'Your program access is active'; v_es := 'Su acceso al programa está activo';
    when 'program_ending' then v_en := 'Your program access ends in ' || p_n || ' days'; v_es := 'Su acceso al programa termina en ' || p_n || ' días';
    when 'program_ended' then v_en := 'Your program access has ended. You can renew it.'; v_es := 'Su acceso al programa terminó. Puede renovarlo.';
    when 'welcome' then v_en := 'Welcome to the Real Care Portal'; v_es := 'Bienvenido al Portal de Real Care';
    when 'staff_incident' then v_en := 'New incident report submitted. Log in to view.'; v_es := 'Nuevo informe de incidente. Inicie sesión para verlo.';
    when 'staff_application' then v_en := 'New provider application received'; v_es := 'Nueva solicitud de proveedor';
    when 'staff_message' then v_en := 'A provider sent a new message'; v_es := 'Un proveedor envió un mensaje nuevo';
    when 'staff_password_help' then v_en := 'A provider asked for help signing in'; v_es := 'Un proveedor pidió ayuda para iniciar sesión';
    else v_en := 'You have an update in the Real Care Portal'; v_es := 'Tiene una novedad en el Portal de Real Care';
  end case;
  insert into public.notifications (profile_id, kind, title_en, title_es, link, dedupe_key)
  values (p_profile, p_kind, v_en, v_es, coalesce(p_link, '/dashboard'), p_dedupe)
  on conflict (dedupe_key) do nothing;
  if not found then return; end if;
  if p.email_notifications or p_kind in ('form_returned', 'doc_returned', 'overdue', 'welcome', 'staff_incident', 'program_ending') then
    insert into public.email_outbox (profile_id, to_email, subject, body, kind)
    values (p_profile, p.email,
      case when p.locale = 'es' then v_es else v_en end,
      case when p.locale = 'es'
        then v_es || E'\n\n' || 'Inicie sesión para ver los detalles: https://realcareportal.vercel.app' || coalesce(p_link, '')
        else v_en || E'\n\n' || 'Sign in to see the details: https://realcareportal.vercel.app' || coalesce(p_link, '') end,
      p_kind);
  end if;
end $$;

-------------------------------------------------------------------------------- nightly: remind before a program term ends
create or replace function public._program_reminders(p_as_of date) returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int := 0; r record; v_days int;
begin
  for r in
    select distinct on (e.provider_id, e.program_id) e.* from public.entitlements e
    join public.programs pr on pr.id = e.program_id
    where e.program_id is not null and e.starts_on <= p_as_of
    order by e.provider_id, e.program_id, e.ends_on desc
  loop
    v_days := r.ends_on - p_as_of;
    if v_days in (30, 7) then
      perform public.notify(r.provider_id, 'program_ending', '/programs', 'program_ending:' || r.id || ':' || v_days, v_days);
      v_count := v_count + 1;
    elsif v_days = -1 then
      perform public.notify(r.provider_id, 'program_ended', '/programs', 'program_ended:' || r.id);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

create or replace function public._nightly_training() returns void
language plpgsql security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'America/Denver')::date;
begin
  perform public._run_renewals(v_today);
  perform public._send_reminders(v_today);
  perform public._generate_recurring(v_today);
  perform public._program_reminders(v_today);
end $$;

-------------------------------------------------------------------------------- grants (internal helpers stay ungranted)
revoke execute on function public._join_program(uuid, uuid, text, int, int, text, uuid), public._program_reminders(date), public.touch_updated_at() from authenticated, anon, public;
grant execute on function public.join_program(uuid), public.grant_program(uuid, uuid, int, text), public.set_program_courses(uuid, uuid[]) to authenticated;
