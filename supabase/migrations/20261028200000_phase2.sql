-- Phase 2: paperwork and documents. Form versions and builder, self-started forms (QR), staff assignments
-- with recurrence, individuals admin, document uploads with review, staff alerts, public provider applications,
-- external video links for course videos.

-------------------------------------------------------------------------------- lessons: external video links
alter table public.lessons add column if not exists video_source text not null default 'file' check (video_source in ('file', 'embed'));

-------------------------------------------------------------------------------- form templates and versions
alter table public.form_templates
  add column if not exists category text not null default 'Daily documentation',
  add column if not exists self_start boolean not null default false,
  add column if not exists active boolean not null default true,
  add column if not exists description_en text not null default '',
  add column if not exists description_es text not null default '',
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.form_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.form_templates(id) on delete cascade,
  version int not null,
  schema jsonb not null,
  note text,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  unique (template_id, version)
);
insert into public.form_versions (template_id, version, schema)
select id, version, schema from public.form_templates on conflict do nothing;
alter table public.form_versions enable row level security;
create policy "staff read" on public.form_versions for select to authenticated using ((select public.is_staff()));
alter table public.submissions add column if not exists version int not null default 1;

create policy "staff update" on public.form_templates for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create trigger audit after insert or update or delete on public.form_templates for each row execute function public.audit_trigger();
create trigger audit after insert on public.form_versions for each row execute function public.audit_trigger();

create or replace function public._valid_form_schema(p jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(p) = 'object' and jsonb_typeof(p->'sections') = 'array' and jsonb_array_length(p->'sections') > 0
    and not exists (select 1 from jsonb_array_elements(p->'sections') s where jsonb_typeof(s->'fields') <> 'array');
$$;

create or replace function public.create_form_template(p_title_en text, p_title_es text, p_category text, p_per_individual boolean, p_self_start boolean, p_schema jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_slug text;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if not public._valid_form_schema(p_schema) then raise exception 'The form needs at least one section with a fields list.'; end if;
  v_slug := trim(both '-' from regexp_replace(lower(coalesce(p_title_en, 'form')), '[^a-z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 4);
  insert into public.form_templates (slug, title_en, title_es, schema, per_individual, self_start, category, version)
  values (v_slug, left(p_title_en, 200), left(coalesce(nullif(p_title_es, ''), p_title_en), 200), p_schema, coalesce(p_per_individual, true), coalesce(p_self_start, false), left(coalesce(p_category, 'Daily documentation'), 60), 1)
  returning id into v_id;
  insert into public.form_versions (template_id, version, schema, note, published_by) values (v_id, 1, p_schema, 'Created', auth.uid());
  return v_id;
end $$;

-- Publishing creates a new version; submissions keep the version they were filled on.
create or replace function public.publish_form_version(p_template uuid, p_schema jsonb, p_note text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_next int;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if not public._valid_form_schema(p_schema) then raise exception 'The form needs at least one section with a fields list.'; end if;
  select coalesce(max(version), 0) + 1 into v_next from public.form_versions where template_id = p_template;
  insert into public.form_versions (template_id, version, schema, note, published_by) values (p_template, v_next, p_schema, left(p_note, 300), auth.uid());
  update public.form_templates set schema = p_schema, version = v_next, updated_at = now() where id = p_template;
  return v_next;
end $$;

-- Submissions record the form version they were completed on.
create or replace function public.trg_submission_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    select t.version into new.version from public.assignments a join public.form_templates t on t.id = a.template_id where a.id = new.assignment_id;
  end if;
  return new;
end $$;
create trigger set_version before insert on public.submissions for each row execute function public.trg_submission_version();

-------------------------------------------------------------------------------- individuals and links (staff managed)
alter table public.individuals add column if not exists active boolean not null default true;
alter table public.individuals add column if not exists notes text not null default '';
create policy "staff insert" on public.individuals for insert to authenticated with check ((select public.is_staff()));
create policy "staff update" on public.individuals for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff insert" on public.provider_individuals for insert to authenticated with check ((select public.is_staff()));
create policy "staff update" on public.provider_individuals for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create trigger audit after insert or update or delete on public.individuals for each row execute function public.audit_trigger();
create trigger audit after insert or update or delete on public.provider_individuals for each row execute function public.audit_trigger();

-------------------------------------------------------------------------------- assignments: staff assign, recurrence, self-start
alter table public.assignments add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.assignments add column if not exists recurring_id uuid;
create policy "staff delete open" on public.assignments for delete to authenticated
  using ((select public.is_staff()) and not exists (select 1 from public.submissions s where s.assignment_id = assignments.id));

create table public.recurring_assignments (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.form_templates(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  individual_id uuid references public.individuals(id) on delete cascade,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'quarterly')),
  next_due date not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.recurring_assignments enable row level security;
create policy "staff read" on public.recurring_assignments for select to authenticated using ((select public.is_staff()));
create policy "staff update" on public.recurring_assignments for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create trigger audit after insert or update or delete on public.recurring_assignments for each row execute function public.audit_trigger();

create or replace function public._advance(p_date date, p_freq text) returns date language sql immutable as $$
  select (p_date + case p_freq when 'daily' then interval '1 day' when 'weekly' then interval '7 days'
    when 'monthly' then interval '1 month' else interval '3 months' end)::date;
$$;

-- Creates assignments up to 7 days ahead for each active schedule; stops if the person is no longer supported.
create or replace function public._generate_recurring(p_as_of date) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_count int := 0; v_due date;
begin
  for r in select * from public.recurring_assignments where active loop
    v_due := r.next_due;
    while v_due <= p_as_of + 7 loop
      if r.individual_id is not null and not exists (
        select 1 from public.provider_individuals pi where pi.provider_id = r.provider_id and pi.individual_id = r.individual_id
          and pi.starts_on <= v_due and (pi.ends_on is null or pi.ends_on >= v_due)) then
        update public.recurring_assignments set active = false where id = r.id;
        exit;
      end if;
      if not exists (select 1 from public.assignments a where a.recurring_id = r.id and a.due_on = v_due) then
        insert into public.assignments (template_id, provider_id, individual_id, due_on, recurring_id, created_by)
        values (r.template_id, r.provider_id, r.individual_id, v_due, r.id, r.created_by);
        v_count := v_count + 1;
      end if;
      v_due := public._advance(v_due, r.frequency);
    end loop;
    update public.recurring_assignments set next_due = v_due where id = r.id and active;
  end loop;
  return v_count;
end $$;

create or replace function public.assign_form(p_template uuid, p_providers uuid[], p_individual uuid, p_due date, p_frequency text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare v uuid; v_count int := 0; v_rec uuid; t record;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  select * into t from public.form_templates where id = p_template and active;
  if t.id is null then raise exception 'form not found'; end if;
  if t.per_individual and p_individual is null then raise exception 'This form is completed for a specific person. Choose who it is for.'; end if;
  if p_frequency is not null and p_frequency not in ('daily', 'weekly', 'monthly', 'quarterly') then raise exception 'unknown frequency'; end if;
  foreach v in array p_providers loop
    if p_individual is not null and not exists (select 1 from public.provider_individuals pi where pi.provider_id = v and pi.individual_id = p_individual
         and pi.starts_on <= p_due and (pi.ends_on is null or pi.ends_on >= p_due)) then
      continue;
    end if;
    v_rec := null;
    if p_frequency is not null then
      insert into public.recurring_assignments (template_id, provider_id, individual_id, frequency, next_due, created_by)
      values (p_template, v, case when t.per_individual then p_individual end, p_frequency, public._advance(p_due, p_frequency), auth.uid())
      returning id into v_rec;
    end if;
    insert into public.assignments (template_id, provider_id, individual_id, due_on, recurring_id, created_by)
    values (p_template, v, case when t.per_individual then p_individual end, p_due, v_rec, auth.uid());
    v_count := v_count + 1;
  end loop;
  if v_count = 0 then raise exception 'No one was assigned. Check that the provider currently supports this person.'; end if;
  return v_count;
end $$;

-- Providers can start some forms themselves (incident reports, log notes), e.g. from a QR code.
create or replace function public.start_form(p_template uuid, p_individual uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare t record; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into t from public.form_templates where id = p_template and active and self_start;
  if t.id is null then raise exception 'This form must be assigned by Real Care staff.'; end if;
  if t.per_individual then
    if p_individual is null or not public.provider_supports(p_individual) then raise exception 'Choose a person you currently support.'; end if;
  end if;
  insert into public.assignments (template_id, provider_id, individual_id, due_on, created_by)
  values (p_template, auth.uid(), case when t.per_individual then p_individual end, (now() at time zone 'America/Denver')::date, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-------------------------------------------------------------------------------- documents
create table public.document_types (
  code text primary key,
  name_en text not null,
  name_es text not null,
  per_individual boolean not null default true,
  sort int not null default 0
);
insert into public.document_types (code, name_en, name_es, per_individual, sort) values
  ('physician_visit', 'Physician visit form', 'Formulario de visita médica', true, 1),
  ('dental_visit', 'Dental visit form', 'Formulario de visita dental', true, 2),
  ('vision_exam', 'Vision exam form', 'Formulario de examen de la vista', true, 3),
  ('psych_visit', 'Psych visit form', 'Formulario de visita psiquiátrica', true, 4),
  ('annual_physical', 'Annual physical', 'Examen físico anual', true, 5),
  ('prn_med_list', 'PRN medication list', 'Lista de medicamentos PRN', true, 6),
  ('controlled_med_count', 'Controlled medication count sheet', 'Hoja de conteo de medicamentos controlados', true, 7),
  ('mar', 'Medication administration record (MAR)', 'Registro de administración de medicamentos (MAR)', true, 8),
  ('vehicle_inspection', 'Vehicle inspection', 'Inspección del vehículo', false, 9),
  ('form_attachment', 'Form attachment', 'Archivo adjunto de formulario', false, 10),
  ('other', 'Other document', 'Otro documento', false, 11)
on conflict (code) do nothing;
alter table public.document_types enable row level security;
create policy "catalog read" on public.document_types for select to authenticated using (true);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  individual_id uuid references public.individuals(id) on delete set null,
  type_code text not null references public.document_types(code),
  storage_path text not null unique,
  filename text not null,
  mime text not null,
  size_bytes bigint not null,
  note text,
  submission_id uuid references public.submissions(id) on delete set null,
  status text not null default 'submitted' check (status in ('submitted', 'returned', 'accepted')),
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.documents (provider_id, created_at desc);
create index on public.documents (status);
alter table public.documents enable row level security;
create policy "own or staff" on public.documents for select to authenticated using (
  (provider_id = (select auth.uid()) and (individual_id is null or public.provider_supports(individual_id))) or (select public.is_staff()));
create policy "provider upload" on public.documents for insert to authenticated with check (
  provider_id = (select auth.uid()) and status = 'submitted'
  and storage_path like (select auth.uid())::text || '/%'
  and (individual_id is null or public.provider_supports(individual_id))
  and mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp')
  and size_bytes between 1 and 20971520);
create trigger audit after insert or update or delete on public.documents for each row execute function public.audit_trigger();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'])
on conflict (id) do nothing;
create policy "documents own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "documents own or staff read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_staff())));

create or replace function public.review_document(p_document uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare d record;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if p_action not in ('return', 'accept') then raise exception 'unknown action'; end if;
  if p_action = 'return' and coalesce(trim(p_note), '') = '' then raise exception 'Say what needs to change.'; end if;
  update public.documents set status = case when p_action = 'return' then 'returned' else 'accepted' end,
    review_note = left(p_note, 1000), reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_document and status = 'submitted' returning * into d;
  if d.id is null then raise exception 'document is not waiting for review'; end if;
  perform public.notify(d.provider_id, 'doc_' || d.status, '/documents');
end $$;

-------------------------------------------------------------------------------- staff alerts and new notice types
create or replace function public.notify(p_profile uuid, p_kind text, p_link text, p_dedupe text default null, p_n int default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_en text; v_es text; p record;
begin
  select * into p from public.profiles where id = p_profile;
  if p.id is null then return; end if;
  case p_kind
    when 'form_assigned' then v_en := 'You have a new form to complete'; v_es := 'Tiene un formulario nuevo para completar';
    when 'form_returned' then v_en := 'A form was returned for a correction'; v_es := 'Se devolvió un formulario para corregir';
    when 'form_accepted' then v_en := 'Your form was accepted'; v_es := 'Su formulario fue aceptado';
    when 'doc_returned' then v_en := 'A document was returned for a correction'; v_es := 'Se devolvió un documento para corregir';
    when 'doc_accepted' then v_en := 'Your document was accepted'; v_es := 'Su documento fue aceptado';
    when 'message' then v_en := 'You have a new message from Real Care staff'; v_es := 'Tiene un mensaje nuevo del personal de Real Care';
    when 'cycle_open' then v_en := 'Your annual training is open'; v_es := 'Su capacitación anual está abierta';
    when 'reminder' then v_en := 'Training due in ' || p_n || ' days'; v_es := 'Su capacitación vence en ' || p_n || ' días';
    when 'reminder_manual' then v_en := 'Reminder: please finish your required training'; v_es := 'Recordatorio: termine su capacitación requerida';
    when 'overdue' then v_en := 'Your required training is overdue'; v_es := 'Su capacitación requerida está atrasada';
    when 'access_granted' then v_en := 'You have access to a new course'; v_es := 'Tiene acceso a un curso nuevo';
    when 'welcome' then v_en := 'Welcome to the Real Care Portal'; v_es := 'Bienvenido al Portal de Real Care';
    when 'staff_incident' then v_en := 'New incident report submitted. Log in to view.'; v_es := 'Nuevo informe de incidente. Inicie sesión para verlo.';
    when 'staff_application' then v_en := 'New provider application received'; v_es := 'Nueva solicitud de proveedor';
    when 'staff_message' then v_en := 'A provider sent a new message'; v_es := 'Un proveedor envió un mensaje nuevo';
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

create or replace function public.notify_staff(p_kind text, p_link text, p_dedupe text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  for s in select id from public.profiles where role in ('staff', 'admin') and active loop
    perform public.notify(s.id, p_kind, p_link, case when p_dedupe is null then null else p_dedupe || ':' || s.id end);
  end loop;
end $$;

create or replace function public.trg_staff_alerts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_slug text;
begin
  if tg_table_name = 'submissions' then
    if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
      select t.slug into v_slug from public.assignments a join public.form_templates t on t.id = a.template_id where a.id = new.assignment_id;
      if v_slug = 'incident-report' then perform public.notify_staff('staff_incident', '/admin/review/' || new.id); end if;
    end if;
  elsif tg_table_name = 'messages' then
    if new.sender_id = new.provider_id then perform public.notify_staff('staff_message', '/admin/providers/' || new.provider_id || '#messages'); end if;
  end if;
  return null;
end $$;
create trigger staff_alerts after insert or update of status on public.submissions for each row execute function public.trg_staff_alerts();
create trigger staff_alerts after insert on public.messages for each row execute function public.trg_staff_alerts();

-- Staff can read their own notifications too (the policy is already "own"); add a helper for the staff bell.

-------------------------------------------------------------------------------- public provider applications
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  locale text not null default 'en',
  provider_types text[] not null default '{}',
  data jsonb not null default '{}',
  status text not null default 'new' check (status in ('new', 'invited', 'declined')),
  invite_id uuid references public.invites(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.applications enable row level security;
create policy "staff read" on public.applications for select to authenticated using ((select public.is_staff()));
create policy "staff update" on public.applications for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create trigger audit after insert or update on public.applications for each row execute function public.audit_trigger();

create or replace function public.submit_application(p_full_name text, p_email text, p_phone text, p_locale text, p_types text[], p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if coalesce(trim(p_full_name), '') = '' or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter your name and a valid email.'; end if;
  if length(p_data::text) > 20000 then raise exception 'Application is too long.'; end if;
  if (select count(*) from public.applications where lower(email) = lower(p_email) and created_at > now() - interval '1 day') >= 3 then
    raise exception 'We already received your application. Real Care staff will contact you.';
  end if;
  insert into public.applications (full_name, email, phone, locale, provider_types, data)
  values (left(trim(p_full_name), 200), lower(left(trim(p_email), 200)), left(p_phone, 40), case when p_locale = 'es' then 'es' else 'en' end,
    (select coalesce(array_agg(t), '{}') from unnest(coalesce(p_types, '{}')) t where t in ('host_home', 'family_caregiver', 'scc_dsp', 'nmt')), p_data)
  returning id into v_id;
  perform public.notify_staff('staff_application', '/admin/applications/' || v_id);
end $$;

-------------------------------------------------------------------------------- nightly job now also creates recurring forms
create or replace function public._nightly_training() returns void
language plpgsql security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'America/Denver')::date;
begin
  perform public._run_renewals(v_today);
  perform public._send_reminders(v_today);
  perform public._generate_recurring(v_today);
end $$;

-------------------------------------------------------------------------------- video lessons waiting for a link don't block completion
create or replace function public.maybe_complete_course(p_provider uuid, p_course uuid, p_cycle uuid, p_lang text, p_score int)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.lessons l where l.course_id = p_course
             and not (l.kind = 'video' and l.video_url is null)
             and not exists (select 1 from public.lesson_progress lp where lp.lesson_id = l.id and lp.provider_id = p_provider and lp.cycle_id = p_cycle)) then
    return false;
  end if;
  insert into public.completions(provider_id, course_id, cycle_id, language, score)
  values (p_provider, p_course, p_cycle, coalesce(p_lang,'en'), p_score)
  on conflict (provider_id, course_id, cycle_id) do nothing;
  return true;
end $$;

-------------------------------------------------------------------------------- linked (embed) videos
-- Videos hosted outside the portal (Dropbox today, Mux in production) can't report watch time,
-- so the provider confirms they watched. Uploaded videos still use report_video_progress (90% rule).
create or replace function public.complete_lesson(p_lesson uuid, p_lang text default 'en') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_cycle uuid; v_course uuid; v_kind text; v_source text; v_done boolean;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select course_id, kind, video_source into v_course, v_kind, v_source from public.lessons where id = p_lesson;
  if v_course is null then raise exception 'lesson not found'; end if;
  if not (v_kind = 'reading' or (v_kind = 'video' and v_source = 'embed')) then
    raise exception 'this lesson is completed by watching or passing it';
  end if;
  if not public.has_course_access(auth.uid(), v_course) then raise exception 'payment required'; end if;
  v_cycle := public.current_cycle_id(auth.uid());
  if v_cycle is null then raise exception 'no training cycle'; end if;
  insert into public.lesson_progress(provider_id, lesson_id, cycle_id) values (auth.uid(), p_lesson, v_cycle) on conflict do nothing;
  v_done := public.maybe_complete_course(auth.uid(), v_course, v_cycle, p_lang, null);
  return jsonb_build_object('course_complete', v_done);
end $$;

-- Remove the temporary helpers used once to bring brand images and course scripts into the repo.
drop function if exists public._brand_get(text);
drop function if exists public._brand_drop(text, text);
drop table if exists demo.brand_drop;

-------------------------------------------------------------------------------- grants
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.is_staff(), public.provider_supports(uuid), public.current_cycle_id(uuid), public.has_course_access(uuid, uuid),
  public.complete_lesson(uuid, text), public.submit_quiz(uuid, int[], text), public.report_video_progress(uuid, numeric, numeric, text),
  public.run_renewals(date), public.renew_provider(uuid), public.submit_form(uuid, jsonb), public.review_submission(uuid, text, jsonb, text),
  public.log_event(text, text, text), public.quiz_for_edit(uuid), public.demo_checkout(uuid), public.grant_access(uuid, uuid, int, text),
  public.refund_order(uuid), public.mark_notifications_read(uuid[]), public.set_my_profile(text, text, boolean),
  public.send_reminders_now(uuid[]), public.open_cycles(uuid[]), public.extend_due(uuid[], date),
  public.staff_mark_complete(uuid, uuid, date, text), public.stage_import(uuid, text, jsonb), public.set_import_match(bigint, uuid),
  public.commit_import(uuid), public.create_form_template(text, text, text, boolean, boolean, jsonb), public.publish_form_version(uuid, jsonb, text),
  public.assign_form(uuid, uuid[], uuid, date, text), public.start_form(uuid, uuid), public.review_document(uuid, text, text)
to authenticated;
grant execute on function public.get_invite(uuid), public.accept_invite(uuid, text), public.submit_application(text, text, text, text, text[], jsonb) to anon, authenticated;
