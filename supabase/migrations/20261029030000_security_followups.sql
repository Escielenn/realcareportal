-- Security follow-ups from docs/security-review.md (Oct 28, 2026).

-------------------------------------------------------------------------------- OWASP-A01-005: course media only under courses/<course_id>/
-- The course editor now uploads to courses/<course_id>/lessons/<lesson_id>/. Nothing remains outside courses/
-- (checked before this migration), so the old "any signed-in user can read older uploads" branch is removed.
drop policy if exists "training media read" on storage.objects;
create policy "training media read" on storage.objects for select to authenticated using (
  bucket_id = 'training-media' and (
    (select public.is_staff())
    or (
      (storage.foldername(name))[1] = 'courses'
      and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
      and public.has_course_access((select auth.uid()), ((storage.foldername(name))[2])::uuid)
    )
  )
);

-------------------------------------------------------------------------------- OWASP-A09-002: failed sign-ins in the audit log, with staff alerts
-- Only a SHA-256 of the email is stored, never the address or password.
create table public.sign_in_failures (
  id bigint generated always as identity primary key,
  email_hash text not null,
  created_at timestamptz not null default now()
);
create index on public.sign_in_failures (email_hash, created_at);
alter table public.sign_in_failures enable row level security;
create policy "staff read" on public.sign_in_failures for select to authenticated using ((select public.is_staff()));
-- No insert/update/delete policies: rows come only from log_failed_sign_in().

-- Called by the sign-in screen after a failed attempt (anon allowed: the person is not signed in).
-- Always returns nothing, so it can't be used to learn whether an email has an account.
-- Alerts staff once per hour per account at 5 failures in 15 minutes (3 for staff accounts).
create or replace function public.log_failed_sign_in(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_hash text; v_recent int; v_role text;
begin
  if coalesce(trim(p_email), '') = '' or length(p_email) > 200 then return; end if;
  -- Flood guard: stop recording if the table is being spammed.
  if (select count(*) from public.sign_in_failures where created_at > now() - interval '1 minute') > 300 then return; end if;
  v_hash := encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex');
  insert into public.sign_in_failures (email_hash) values (v_hash);
  insert into public.audit_log (actor, action, table_name, record_id) values (null, 'sign_in_failed', 'auth', left(v_hash, 16));
  select role into v_role from public.profiles where lower(email) = lower(trim(p_email));
  if v_role is not null then
    select count(*) into v_recent from public.sign_in_failures where email_hash = v_hash and created_at > now() - interval '15 minutes';
    if v_recent >= case when v_role in ('staff', 'admin') then 3 else 5 end then
      perform public.notify_staff('staff_signin_alert', '/admin/audit', 'signin_alert:' || left(v_hash, 16) || ':' || to_char(now(), 'YYYYMMDDHH24'));
    end if;
  end if;
  delete from public.sign_in_failures where created_at < now() - interval '30 days';
end $$;

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

revoke execute on function public.log_failed_sign_in(text) from public;
grant execute on function public.log_failed_sign_in(text) to anon, authenticated;
