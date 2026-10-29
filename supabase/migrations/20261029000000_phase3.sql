-- Phase 3: messaging inbox, announcements admin, form drafts, password help, account status, staff guardrails.

-------------------------------------------------------------------------------- message threads (one per provider)
create table public.message_threads (
  provider_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'waiting', 'closed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz,
  last_sender uuid references public.profiles(id) on delete set null,
  provider_last_read timestamptz,
  staff_last_read timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.message_threads enable row level security;
create policy "own or staff" on public.message_threads for select to authenticated
  using (provider_id = (select auth.uid()) or (select public.is_staff()));
create trigger audit after insert or update on public.message_threads for each row execute function public.audit_trigger();

-- Every message updates its thread: a provider message reopens it (waiting on staff = "open"),
-- a staff reply sets it to "waiting" on the provider. Runs as definer so providers never write threads directly.
create or replace function public.trg_message_thread() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.message_threads (provider_id, status, last_message_at, last_sender, provider_last_read, staff_last_read)
  values (new.provider_id, case when new.sender_id = new.provider_id then 'open' else 'waiting' end, new.created_at, new.sender_id,
          case when new.sender_id = new.provider_id then new.created_at end,
          case when new.sender_id <> new.provider_id then new.created_at end)
  on conflict (provider_id) do update set
    status = case when new.sender_id = new.provider_id then 'open' else 'waiting' end,
    last_message_at = new.created_at, last_sender = new.sender_id, updated_at = now(),
    provider_last_read = case when new.sender_id = new.provider_id then new.created_at else public.message_threads.provider_last_read end,
    staff_last_read = case when new.sender_id <> new.provider_id then new.created_at else public.message_threads.staff_last_read end;
  return null;
end $$;
create trigger thread_update after insert on public.messages for each row execute function public.trg_message_thread();

insert into public.message_threads (provider_id, status, last_message_at, last_sender, provider_last_read, staff_last_read)
select distinct on (m.provider_id) m.provider_id,
  case when m.sender_id = m.provider_id then 'open' else 'waiting' end, m.created_at, m.sender_id, m.created_at, m.created_at
from public.messages m order by m.provider_id, m.created_at desc
on conflict do nothing;

create or replace function public.mark_thread_read(p_provider uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() = p_provider then
    update public.message_threads set provider_last_read = now() where provider_id = p_provider;
  elsif public.is_staff() then
    update public.message_threads set staff_last_read = now() where provider_id = p_provider;
  else
    raise exception 'not allowed';
  end if;
end $$;

create or replace function public.set_thread(p_provider uuid, p_status text, p_assigned uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if p_status is not null and p_status not in ('open', 'waiting', 'closed') then raise exception 'unknown status'; end if;
  if p_assigned is not null and not exists (select 1 from public.profiles where id = p_assigned and role in ('staff', 'admin') and active) then
    raise exception 'assign to an active staff member';
  end if;
  insert into public.message_threads (provider_id) values (p_provider) on conflict do nothing;
  update public.message_threads set status = coalesce(p_status, status), assigned_to = p_assigned, updated_at = now() where provider_id = p_provider;
end $$;

-------------------------------------------------------------------------------- announcements (staff managed)
alter table public.announcements add column if not exists pinned boolean not null default false;
alter table public.announcements add column if not exists expires_on date;
alter table public.announcements add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.announcements add column if not exists archived boolean not null default false;
create policy "staff insert" on public.announcements for insert to authenticated with check ((select public.is_staff()) and created_by = (select auth.uid()));
create policy "staff update" on public.announcements for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create trigger audit after insert or update on public.announcements for each row execute function public.audit_trigger();

-- Tell each matching provider there's a new announcement (fixed text; the content stays in the portal).
create or replace function public.trg_announcement_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  for p in select id from public.profiles where role = 'provider' and active
    and (coalesce(array_length(new.audience, 1), 0) = 0 or provider_types && new.audience) loop
    perform public.notify(p.id, 'announcement', '/dashboard', 'announcement:' || new.id || ':' || p.id);
  end loop;
  return null;
end $$;
create trigger announcement_notify after insert on public.announcements for each row execute function public.trg_announcement_notify();

-------------------------------------------------------------------------------- form drafts (saved on the server, never in the browser)
create table public.form_drafts (
  assignment_id uuid primary key references public.assignments(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.form_drafts enable row level security;
create policy "own" on public.form_drafts for select to authenticated using (provider_id = (select auth.uid()));

create or replace function public.save_draft(p_assignment uuid, p_data jsonb) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare a record; v timestamptz := now();
begin
  select * into a from public.assignments where id = p_assignment;
  if a.id is null or a.provider_id <> auth.uid() then raise exception 'not your assignment'; end if;
  if a.individual_id is not null and not public.provider_supports(a.individual_id) then raise exception 'no active link to this individual'; end if;
  if exists (select 1 from public.submissions where assignment_id = p_assignment) then raise exception 'already submitted'; end if;
  if pg_column_size(p_data) > 262144 then raise exception 'draft is too large'; end if;
  insert into public.form_drafts (assignment_id, provider_id, data, updated_at) values (p_assignment, auth.uid(), p_data, v)
  on conflict (assignment_id) do update set data = excluded.data, updated_at = v;
  return v;
end $$;

-- Submitting removes the draft.
create or replace function public.trg_clear_draft() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.form_drafts where assignment_id = new.assignment_id;
  return null;
end $$;
create trigger clear_draft after insert on public.submissions for each row execute function public.trg_clear_draft();

-------------------------------------------------------------------------------- password help
-- Providers who forget their password ask Real Care; staff send a one-time reset link (no email enumeration:
-- the request always looks the same whether or not the email exists).
create table public.password_resets (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '48 hours',
  used_at timestamptz
);
alter table public.password_resets enable row level security;
create policy "staff read" on public.password_resets for select to authenticated using ((select public.is_staff()));
create trigger audit after insert or update on public.password_resets for each row execute function public.audit_trigger();

create table public.password_help_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  profile_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
alter table public.password_help_requests enable row level security;
create policy "staff read" on public.password_help_requests for select to authenticated using ((select public.is_staff()));

create or replace function public.request_password_help(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_profile uuid; v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then return; end if;
  -- at most 3 requests per email per day, and 200 per day overall
  if (select count(*) from public.password_help_requests where email = v_email and created_at > now() - interval '1 day') >= 3 then return; end if;
  if (select count(*) from public.password_help_requests where created_at > now() - interval '1 day') >= 200 then return; end if;
  select id into v_profile from public.profiles where lower(email) = v_email and active;
  insert into public.password_help_requests (email, profile_id) values (v_email, v_profile);
  if v_profile is not null then
    perform public.notify_staff('staff_password_help', '/admin/providers/' || v_profile, 'pwhelp:' || v_profile || ':' || current_date);
  end if;
end $$;

create or replace function public.create_password_reset(p_profile uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_token uuid; p record;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  select * into p from public.profiles where id = p_profile;
  if p.id is null then raise exception 'person not found'; end if;
  if p.role <> 'provider' and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'only an admin can reset a staff password';
  end if;
  update public.password_resets set expires_at = now() where profile_id = p_profile and used_at is null and expires_at > now();
  insert into public.password_resets (profile_id, created_by) values (p_profile, auth.uid()) returning token into v_token;
  update public.password_help_requests set handled_at = now() where profile_id = p_profile and handled_at is null;
  return v_token;
end $$;

create or replace function public.get_password_reset(p_token uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('full_name', split_part(p.full_name, ' ', 1), 'locale', p.locale)
  from public.password_resets r join public.profiles p on p.id = r.profile_id
  where r.token = p_token and r.used_at is null and r.expires_at > now() and p.active;
$$;

create or replace function public.use_password_reset(p_token uuid, p_password text) returns text
language plpgsql security definer set search_path = '' as $$
declare r record; v_email text;
begin
  select * into r from public.password_resets where token = p_token and used_at is null and expires_at > now() for update;
  if r.id is null then raise exception 'This link is not valid or has expired.'; end if;
  if length(coalesce(p_password, '')) < 10 then raise exception 'Use at least 10 characters for your password.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = r.profile_id returning email into v_email;
  update public.password_resets set used_at = now() where id = r.id;
  -- sign out every existing session for this account
  delete from auth.refresh_tokens where user_id = r.profile_id::text;
  delete from auth.sessions where user_id = r.profile_id;
  return v_email;
end $$;

-------------------------------------------------------------------------------- account status and staff guardrails

-- Staff can correct a provider's details, but nobody changes roles or active status through a plain update:
-- roles change only in a migration or by an admin in the database; active only through set_account_active.
create or replace function public.trg_profile_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if; -- migrations, seed, jobs
  if new.role is distinct from old.role then raise exception 'roles cannot be changed here'; end if;
  if new.id is distinct from old.id or new.email is distinct from old.email then raise exception 'id and email cannot be changed here'; end if;
  if new.active is distinct from old.active and current_setting('rc.allow_active', true) is distinct from 'on' then
    raise exception 'use set_account_active';
  end if;
  return new;
end $$;
create trigger profile_guard before update on public.profiles for each row execute function public.trg_profile_guard();

-- set_account_active is allowed through the guard
create or replace function public.set_account_active(p_profile uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if p_profile = auth.uid() then raise exception 'you cannot deactivate yourself'; end if;
  select * into p from public.profiles where id = p_profile;
  if p.id is null then raise exception 'person not found'; end if;
  if p.role <> 'provider' and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'only an admin can change a staff account';
  end if;
  perform set_config('rc.allow_active', 'on', true);
  update public.profiles set active = p_active where id = p_profile;
  perform set_config('rc.allow_active', 'off', true);
  if not p_active then
    delete from auth.refresh_tokens where user_id = p_profile::text;
    delete from auth.sessions where user_id = p_profile;
  end if;
end $$;

-------------------------------------------------------------------------------- new notice types
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
  if p.email_notifications or p_kind in ('form_returned', 'doc_returned', 'overdue', 'welcome', 'staff_incident') then
    insert into public.email_outbox (profile_id, to_email, subject, body, kind)
    values (p_profile, p.email,
      case when p.locale = 'es' then v_es else v_en end,
      case when p.locale = 'es'
        then v_es || E'\n\n' || 'Inicie sesión para ver los detalles: https://realcareportal.vercel.app' || coalesce(p_link, '')
        else v_en || E'\n\n' || 'Sign in to see the details: https://realcareportal.vercel.app' || coalesce(p_link, '') end,
      p_kind);
  end if;
end $$;

-------------------------------------------------------------------------------- grants (internal helpers stay locked)
revoke execute on all functions in schema public from authenticated, anon, public;
grant execute on function
  public.is_staff(), public.provider_supports(uuid), public.current_cycle_id(uuid), public.has_course_access(uuid, uuid),
  public.complete_lesson(uuid, text), public.submit_quiz(uuid, int[], text), public.report_video_progress(uuid, numeric, numeric, text),
  public.run_renewals(date), public.renew_provider(uuid), public.submit_form(uuid, jsonb), public.review_submission(uuid, text, jsonb, text),
  public.log_event(text, text, text), public.quiz_for_edit(uuid), public.demo_checkout(uuid), public.grant_access(uuid, uuid, int, text),
  public.refund_order(uuid), public.mark_notifications_read(uuid[]), public.set_my_profile(text, text, boolean),
  public.send_reminders_now(uuid[]), public.open_cycles(uuid[]), public.extend_due(uuid[], date),
  public.staff_mark_complete(uuid, uuid, date, text), public.stage_import(uuid, text, jsonb), public.set_import_match(bigint, uuid),
  public.commit_import(uuid), public.create_form_template(text, text, text, boolean, boolean, jsonb), public.publish_form_version(uuid, jsonb, text),
  public.assign_form(uuid, uuid[], uuid, date, text), public.start_form(uuid, uuid), public.review_document(uuid, text, text),
  public.mark_thread_read(uuid), public.set_thread(uuid, text, uuid), public.save_draft(uuid, jsonb),
  public.create_password_reset(uuid), public.set_account_active(uuid, boolean)
to authenticated;
grant execute on function public.get_invite(uuid), public.accept_invite(uuid, text), public.submit_application(text, text, text, text, text[], jsonb),
  public.request_password_help(text), public.get_password_reset(uuid), public.use_password_reset(uuid, text) to anon, authenticated;
