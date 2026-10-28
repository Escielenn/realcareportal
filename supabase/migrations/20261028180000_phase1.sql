-- Phase 1 features for the demo: course builder, video tracking, course access and payments,
-- notifications and reminders, staff bulk actions, Wix import, invite-only onboarding.

-------------------------------------------------------------------------------- catalog changes
alter table public.courses
  add column if not exists published boolean not null default true,
  add column if not exists in_all_access boolean not null default true,
  add column if not exists access_days int not null default 365;
update public.courses set in_all_access = false, access_days = 60 where slug = 'qmap';
update public.courses set in_all_access = false where slug = 'respite';

alter table public.lessons
  add column if not exists video_url text,
  add column if not exists video_seconds int;
alter table public.completions add column if not exists note text;
alter table public.profiles add column if not exists email_notifications boolean not null default true;
alter table public.profiles alter column hire_date set default current_date;

drop policy if exists "catalog read" on public.courses;
create policy "catalog read" on public.courses for select to authenticated using (published or (select public.is_staff()));
create policy "staff write" on public.courses for insert to authenticated with check ((select public.is_staff()));
create policy "staff update" on public.courses for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff delete" on public.courses for delete to authenticated using ((select public.is_staff()));
create policy "staff write" on public.lessons for insert to authenticated with check ((select public.is_staff()));
create policy "staff update" on public.lessons for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff delete" on public.lessons for delete to authenticated using ((select public.is_staff()));
grant insert, update, delete on public.quiz_questions to authenticated;
create policy "staff write" on public.quiz_questions for insert to authenticated with check ((select public.is_staff()));
create policy "staff update" on public.quiz_questions for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff delete" on public.quiz_questions for delete to authenticated using ((select public.is_staff()));
create policy "staff write" on public.requirements for insert to authenticated with check ((select public.is_staff()));
create policy "staff delete" on public.requirements for delete to authenticated using ((select public.is_staff()));

create trigger audit after insert or update or delete on public.courses for each row execute function public.audit_trigger();
create trigger audit after insert or update or delete on public.lessons for each row execute function public.audit_trigger();
create trigger audit after insert or update or delete on public.quiz_questions for each row execute function public.audit_trigger();
create trigger audit after insert or delete on public.requirements for each row execute function public.audit_trigger();

-- Staff need the answer key to edit quizzes; providers never see it.
create or replace function public.quiz_for_edit(p_lesson uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  return coalesce((select jsonb_agg(to_jsonb(q) order by q.sort) from public.quiz_questions q where q.lesson_id = p_lesson), '[]'::jsonb);
end $$;
comment on function public.quiz_for_edit(uuid) is 'Security definer: returns correct answers to staff only.';

-------------------------------------------------------------------------------- media storage (training content, not PHI)
insert into storage.buckets (id, name, public) values ('training-media', 'training-media', false) on conflict (id) do nothing;
create policy "training media read" on storage.objects for select to authenticated using (bucket_id = 'training-media');
create policy "training media staff insert" on storage.objects for insert to authenticated with check (bucket_id = 'training-media' and (select public.is_staff()));
create policy "training media staff update" on storage.objects for update to authenticated using (bucket_id = 'training-media' and (select public.is_staff()));
create policy "training media staff delete" on storage.objects for delete to authenticated using (bucket_id = 'training-media' and (select public.is_staff()));

-------------------------------------------------------------------------------- access and payments
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  description text not null,
  amount_cents int not null,
  method text not null check (method in ('demo_checkout','stripe','paid_by_real_care','wix')),
  status text not null default 'paid' check (status in ('paid','refunded')),
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade, -- null = All-Access
  order_id uuid references public.orders(id) on delete set null,
  starts_on date not null default current_date,
  ends_on date not null,
  created_at timestamptz not null default now()
);
create index on public.entitlements (provider_id, ends_on);
alter table public.orders enable row level security;
alter table public.entitlements enable row level security;
create policy "own or staff" on public.orders for select to authenticated using (provider_id = (select auth.uid()) or (select public.is_staff()));
create policy "own or staff" on public.entitlements for select to authenticated using (provider_id = (select auth.uid()) or (select public.is_staff()));
create trigger audit after insert or update or delete on public.orders for each row execute function public.audit_trigger();
create trigger audit after insert or update or delete on public.entitlements for each row execute function public.audit_trigger();

create or replace function public.has_course_access(p_provider uuid, p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.price_cents = 0 or exists (
      select 1 from public.entitlements e where e.provider_id = p_provider and current_date between e.starts_on and e.ends_on
        and (e.course_id = c.id or (e.course_id is null and c.in_all_access)))
    from public.courses c where c.id = p_course), false);
$$;

-------------------------------------------------------------------------------- notifications (PHI-free by construction)
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title_en text not null, title_es text not null,
  link text not null default '/dashboard',
  dedupe_key text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (profile_id, created_at desc);
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  to_email text not null,
  subject text not null,
  body text not null,
  kind text not null,
  status text not null default 'not sent (demo)',
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
alter table public.email_outbox enable row level security;
create policy "own" on public.notifications for select to authenticated using (profile_id = (select auth.uid()));
create policy "staff read" on public.email_outbox for select to authenticated using ((select public.is_staff()));

-- Fixed templates only: never form contents, individual names, diagnoses or medications.
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
    when 'message' then v_en := 'You have a new message from Real Care staff'; v_es := 'Tiene un mensaje nuevo del personal de Real Care';
    when 'cycle_open' then v_en := 'Your annual training is open'; v_es := 'Su capacitación anual está abierta';
    when 'reminder' then v_en := 'Training due in ' || p_n || ' days'; v_es := 'Su capacitación vence en ' || p_n || ' días';
    when 'reminder_manual' then v_en := 'Reminder: please finish your required training'; v_es := 'Recordatorio: termine su capacitación requerida';
    when 'overdue' then v_en := 'Your required training is overdue'; v_es := 'Su capacitación requerida está atrasada';
    when 'access_granted' then v_en := 'You have access to a new course'; v_es := 'Tiene acceso a un curso nuevo';
    when 'welcome' then v_en := 'Welcome to the Real Care Portal'; v_es := 'Bienvenido al Portal de Real Care';
    else v_en := 'You have an update in the Real Care Portal'; v_es := 'Tiene una novedad en el Portal de Real Care';
  end case;
  insert into public.notifications (profile_id, kind, title_en, title_es, link, dedupe_key)
  values (p_profile, p_kind, v_en, v_es, coalesce(p_link, '/dashboard'), p_dedupe)
  on conflict (dedupe_key) do nothing;
  if not found then return; end if;
  if p.email_notifications or p_kind in ('form_returned', 'overdue', 'welcome') then
    insert into public.email_outbox (profile_id, to_email, subject, body, kind)
    values (p_profile, p.email,
      case when p.locale = 'es' then v_es else v_en end,
      case when p.locale = 'es'
        then v_es || '.' || E'\n\n' || 'Inicie sesión para ver los detalles: https://realcareportal.vercel.app' || coalesce(p_link, '')
        else v_en || '.' || E'\n\n' || 'Sign in to see the details: https://realcareportal.vercel.app' || coalesce(p_link, '') end,
      p_kind);
  end if;
end $$;

create or replace function public.trg_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'assignments' then
    perform public.notify(new.provider_id, 'form_assigned', '/forms/' || new.id, 'asg:' || new.id);
  elsif tg_table_name = 'submissions' then
    if new.status is distinct from old.status and new.status in ('returned', 'accepted') then
      perform public.notify(new.provider_id, 'form_' || new.status, '/forms/' || new.assignment_id);
    end if;
  elsif tg_table_name = 'messages' then
    if new.sender_id <> new.provider_id then perform public.notify(new.provider_id, 'message', '/messages'); end if;
  elsif tg_table_name = 'training_cycles' then
    if new.cycle_number > 1 then perform public.notify(new.provider_id, 'cycle_open', '/training', 'cycle:' || new.id); end if;
  end if;
  return null;
end $$;
create trigger notify after insert on public.assignments for each row execute function public.trg_notify();
create trigger notify after update of status on public.submissions for each row execute function public.trg_notify();
create trigger notify after insert on public.messages for each row execute function public.trg_notify();
create trigger notify after insert on public.training_cycles for each row execute function public.trg_notify();

create or replace function public.mark_notifications_read(p_ids uuid[] default null) returns void
language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
  where profile_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
$$;

create or replace function public.set_my_profile(p_locale text, p_phone text, p_email_notifications boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.profiles set locale = case when p_locale = 'es' then 'es' else 'en' end,
    phone = nullif(left(trim(coalesce(p_phone, '')), 30), ''), email_notifications = coalesce(p_email_notifications, true)
  where id = auth.uid();
end $$;

-------------------------------------------------------------------------------- training logic with access checks and video
create table public.video_progress (
  provider_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  cycle_id uuid not null references public.training_cycles(id) on delete cascade,
  watched_seconds numeric not null default 0,
  last_position numeric not null default 0,
  duration numeric,
  updated_at timestamptz not null default now(),
  primary key (provider_id, lesson_id, cycle_id)
);
alter table public.video_progress enable row level security;
create policy "own or staff" on public.video_progress for select to authenticated using (provider_id = (select auth.uid()) or (select public.is_staff()));

create or replace function public.complete_lesson(p_lesson uuid, p_lang text default 'en') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_cycle uuid; v_course uuid; v_kind text; v_done boolean;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select course_id, kind into v_course, v_kind from public.lessons where id = p_lesson;
  if v_course is null then raise exception 'lesson not found'; end if;
  if v_kind <> 'reading' then raise exception 'this lesson is completed by watching or passing it'; end if;
  if not public.has_course_access(auth.uid(), v_course) then raise exception 'payment required'; end if;
  v_cycle := public.current_cycle_id(auth.uid());
  if v_cycle is null then raise exception 'no training cycle'; end if;
  insert into public.lesson_progress(provider_id, lesson_id, cycle_id) values (auth.uid(), p_lesson, v_cycle) on conflict do nothing;
  v_done := public.maybe_complete_course(auth.uid(), v_course, v_cycle, p_lang, null);
  return jsonb_build_object('course_complete', v_done);
end $$;

create or replace function public.submit_quiz(p_lesson uuid, p_answers int[], p_lang text default 'en') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_cycle uuid; v_course uuid; v_pass int; v_total int := 0; v_right int := 0; v_score int; v_passed boolean;
  v_results jsonb := '[]'; q record; i int := 0; v_done boolean := false;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select course_id, pass_percent into v_course, v_pass from public.lessons where id = p_lesson and kind = 'quiz';
  if v_course is null then raise exception 'quiz not found'; end if;
  if not public.has_course_access(auth.uid(), v_course) then raise exception 'payment required'; end if;
  v_cycle := public.current_cycle_id(auth.uid());
  if v_cycle is null then raise exception 'no training cycle'; end if;
  for q in select * from public.quiz_questions where lesson_id = p_lesson order by sort loop
    i := i + 1; v_total := v_total + 1;
    if p_answers[i] = q.correct then v_right := v_right + 1; end if;
    v_results := v_results || jsonb_build_object('correct', p_answers[i] = q.correct, 'correct_index', q.correct,
      'explanation', case when p_lang = 'es' then q.explanation_es else q.explanation_en end);
  end loop;
  v_score := case when v_total = 0 then 100 else round(100.0 * v_right / v_total) end;
  v_passed := v_score >= v_pass;
  insert into public.quiz_attempts(provider_id, lesson_id, cycle_id, score, passed) values (auth.uid(), p_lesson, v_cycle, v_score, v_passed);
  if v_passed then
    insert into public.lesson_progress(provider_id, lesson_id, cycle_id) values (auth.uid(), p_lesson, v_cycle) on conflict do nothing;
    v_done := public.maybe_complete_course(auth.uid(), v_course, v_cycle, p_lang, v_score);
  end if;
  return jsonb_build_object('score', v_score, 'passed', v_passed, 'pass_percent', v_pass, 'results', v_results, 'course_complete', v_done);
end $$;

-- Watched time can only grow as fast as real time passes, so skipping to the end does not count.
create or replace function public.report_video_progress(p_lesson uuid, p_position numeric, p_duration numeric, p_lang text default 'en') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_cycle uuid; v_course uuid; v record; v_delta numeric; v_watched numeric; v_done boolean := false; v_complete boolean := false;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select course_id into v_course from public.lessons where id = p_lesson and kind = 'video';
  if v_course is null then raise exception 'video lesson not found'; end if;
  if not public.has_course_access(auth.uid(), v_course) then raise exception 'payment required'; end if;
  v_cycle := public.current_cycle_id(auth.uid());
  if v_cycle is null then raise exception 'no training cycle'; end if;
  if p_duration is null or p_duration <= 0 or p_position < 0 or p_position > p_duration + 1 then raise exception 'invalid progress'; end if;
  select * into v from public.video_progress where provider_id = auth.uid() and lesson_id = p_lesson and cycle_id = v_cycle;
  if v.provider_id is null then
    v_delta := least(p_position, 20);
  else
    v_delta := greatest(0, least(p_position - v.last_position, extract(epoch from now() - v.updated_at) * 1.1 + 2));
  end if;
  insert into public.video_progress (provider_id, lesson_id, cycle_id, watched_seconds, last_position, duration, updated_at)
  values (auth.uid(), p_lesson, v_cycle, v_delta, p_position, p_duration, now())
  on conflict (provider_id, lesson_id, cycle_id) do update
    set watched_seconds = least(public.video_progress.watched_seconds + v_delta, excluded.duration),
        last_position = excluded.last_position, duration = excluded.duration, updated_at = now()
  returning watched_seconds into v_watched;
  if v_watched >= 0.9 * p_duration then
    v_complete := true;
    insert into public.lesson_progress(provider_id, lesson_id, cycle_id) values (auth.uid(), p_lesson, v_cycle) on conflict do nothing;
    v_done := public.maybe_complete_course(auth.uid(), v_course, v_cycle, p_lang, null);
  end if;
  return jsonb_build_object('watched', round(v_watched), 'duration', round(p_duration), 'lesson_complete', v_complete, 'course_complete', v_done);
end $$;

-------------------------------------------------------------------------------- payments RPCs
create or replace function public.demo_checkout(p_course uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c record; v_order uuid; v_amount int; v_desc text; v_days int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_course is null then
    v_amount := 7500; v_desc := 'All-Access Package (12 months)'; v_days := 365;
  else
    select * into c from public.courses where id = p_course and published;
    if c.id is null then raise exception 'course not found'; end if;
    v_amount := c.price_cents; v_desc := c.title_en; v_days := c.access_days;
  end if;
  insert into public.orders (provider_id, course_id, description, amount_cents, method, created_by)
  values (auth.uid(), p_course, v_desc, v_amount, 'demo_checkout', auth.uid()) returning id into v_order;
  insert into public.entitlements (provider_id, course_id, order_id, ends_on)
  values (auth.uid(), p_course, v_order, current_date + v_days);
  return v_order;
end $$;

create or replace function public.grant_access(p_provider uuid, p_course uuid, p_days int, p_note text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_order uuid; v_desc text;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'add a note explaining the grant'; end if;
  v_desc := coalesce((select title_en from public.courses where id = p_course), 'All-Access Package');
  insert into public.orders (provider_id, course_id, description, amount_cents, method, note, created_by)
  values (p_provider, p_course, v_desc, 0, 'paid_by_real_care', p_note, auth.uid()) returning id into v_order;
  insert into public.entitlements (provider_id, course_id, order_id, ends_on)
  values (p_provider, p_course, v_order, current_date + greatest(1, least(coalesce(p_days, 365), 730)));
  perform public.notify(p_provider, 'access_granted', '/training');
  return v_order;
end $$;

create or replace function public.refund_order(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  update public.orders set status = 'refunded' where id = p_order and status = 'paid';
  if not found then raise exception 'order not found or already refunded'; end if;
  update public.entitlements set ends_on = current_date - 1 where order_id = p_order;
end $$;

-------------------------------------------------------------------------------- renewal, reminders, staff bulk actions
create or replace function public._run_renewals(p_as_of date) returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int := 0; r record;
begin
  for r in
    select distinct on (tc.provider_id) tc.* from public.training_cycles tc
    join public.profiles p on p.id = tc.provider_id and p.active and p.role = 'provider'
    order by tc.provider_id, tc.cycle_number desc
  loop
    if r.due_on <= p_as_of then
      insert into public.training_cycles(provider_id, cycle_number, starts_on, due_on, label)
      values (r.provider_id, r.cycle_number + 1, r.due_on, (r.due_on + interval '1 year')::date, 'Cycle ' || (r.cycle_number + 1))
      on conflict do nothing;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

create or replace function public.run_renewals(p_as_of date default current_date) returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  return public._run_renewals(p_as_of);
end $$;

create or replace function public._send_reminders(p_as_of date) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_days int; v_count int := 0;
begin
  for r in select * from public.provider_status where active and cycle_id is not null and done_count < required_count loop
    v_days := r.due_on - p_as_of;
    if v_days in (30, 14, 3) then
      perform public.notify(r.provider_id, 'reminder', '/training', 'rem:' || r.cycle_id || ':' || v_days, v_days);
      v_count := v_count + 1;
    elsif v_days = -1 then
      perform public.notify(r.provider_id, 'overdue', '/training', 'over:' || r.cycle_id);
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
end $$;

create or replace function public.send_reminders_now(p_providers uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare v uuid; v_count int := 0;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  foreach v in array p_providers loop
    perform public.notify(v, 'reminder_manual', '/training');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create or replace function public.open_cycles(p_providers uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare v uuid; v_count int := 0;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  foreach v in array p_providers loop
    perform public.renew_provider(v);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create or replace function public.extend_due(p_providers uuid[], p_due date) returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  update public.training_cycles tc set due_on = p_due
  where tc.id in (select public.current_cycle_id(x) from unnest(p_providers) x) and p_due > tc.starts_on;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.staff_mark_complete(p_provider uuid, p_course uuid, p_date date, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_cycle uuid;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'a reason is required'; end if;
  select id into v_cycle from public.training_cycles where provider_id = p_provider and p_date >= starts_on and p_date < due_on order by cycle_number desc limit 1;
  v_cycle := coalesce(v_cycle, public.current_cycle_id(p_provider));
  insert into public.completions (provider_id, course_id, cycle_id, completed_at, source, note)
  values (p_provider, p_course, v_cycle, p_date + interval '12 hours', 'staff_override', p_note)
  on conflict (provider_id, course_id, cycle_id) do nothing;
  if not found then raise exception 'already complete for that cycle'; end if;
  insert into public.lesson_progress (provider_id, lesson_id, cycle_id, completed_at)
  select p_provider, l.id, v_cycle, p_date + interval '12 hours' from public.lessons l where l.course_id = p_course on conflict do nothing;
end $$;

-------------------------------------------------------------------------------- legacy Wix import
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  filename text not null,
  status text not null default 'staged' check (status in ('staged','committed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  committed_at timestamptz
);
create table public.import_rows (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_num int not null,
  raw_name text, raw_email text, completed_on date,
  provider_id uuid references public.profiles(id) on delete set null,
  match_method text,
  status text not null check (status in ('matched','unmatched','duplicate','no_cycle','bad_date','imported'))
);
alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;
create policy "staff" on public.import_batches for select to authenticated using ((select public.is_staff()));
create policy "staff" on public.import_rows for select to authenticated using ((select public.is_staff()));
create trigger audit after insert or update on public.import_batches for each row execute function public.audit_trigger();

create or replace function public._classify_import_row(p_row bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare r record; v_course uuid; v_cycle uuid;
begin
  select ir.*, b.course_id into r from public.import_rows ir join public.import_batches b on b.id = ir.batch_id where ir.id = p_row;
  if r.status = 'imported' then return; end if;
  if r.completed_on is null then update public.import_rows set status = 'bad_date' where id = p_row; return; end if;
  if r.provider_id is null then update public.import_rows set status = 'unmatched' where id = p_row; return; end if;
  select id into v_cycle from public.training_cycles where provider_id = r.provider_id and r.completed_on >= starts_on and r.completed_on < due_on order by cycle_number desc limit 1;
  if v_cycle is null then update public.import_rows set status = 'no_cycle' where id = p_row; return; end if;
  if exists (select 1 from public.completions where provider_id = r.provider_id and course_id = r.course_id and cycle_id = v_cycle) then
    update public.import_rows set status = 'duplicate' where id = p_row; return;
  end if;
  update public.import_rows set status = 'matched' where id = p_row;
end $$;

create or replace function public.stage_import(p_course uuid, p_filename text, p_rows jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_batch uuid; x jsonb; i int := 0; v_pid uuid; v_method text; v_date date; v_row bigint;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if jsonb_array_length(p_rows) > 5000 then raise exception 'too many rows'; end if;
  insert into public.import_batches (course_id, filename, created_by) values (p_course, left(p_filename, 200), auth.uid()) returning id into v_batch;
  for x in select * from jsonb_array_elements(p_rows) loop
    i := i + 1; v_pid := null; v_method := null;
    begin v_date := (x->>'completed')::date; exception when others then v_date := null; end;
    select id into v_pid from public.profiles where role = 'provider' and lower(email) = lower(trim(x->>'email'));
    if v_pid is not null then v_method := 'email';
    else
      select id into v_pid from public.profiles where role = 'provider' and lower(full_name) = lower(trim(x->>'name'))
        and (select count(*) from public.profiles p2 where p2.role = 'provider' and lower(p2.full_name) = lower(trim(x->>'name'))) = 1;
      if v_pid is not null then v_method := 'name'; end if;
    end if;
    insert into public.import_rows (batch_id, row_num, raw_name, raw_email, completed_on, provider_id, match_method, status)
    values (v_batch, i, left(x->>'name', 200), left(x->>'email', 200), v_date, v_pid, v_method, 'unmatched') returning id into v_row;
    perform public._classify_import_row(v_row);
  end loop;
  return v_batch;
end $$;

create or replace function public.set_import_match(p_row bigint, p_provider uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  update public.import_rows set provider_id = p_provider, match_method = case when p_provider is null then null else 'staff' end
  where id = p_row and status <> 'imported';
  perform public._classify_import_row(p_row);
end $$;

create or replace function public.commit_import(p_batch uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_course uuid; v_cycle uuid; v_count int := 0;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  select course_id into v_course from public.import_batches where id = p_batch and status = 'staged';
  if v_course is null then raise exception 'batch not found or already committed'; end if;
  for r in select * from public.import_rows where batch_id = p_batch and status = 'matched' loop
    select id into v_cycle from public.training_cycles where provider_id = r.provider_id and r.completed_on >= starts_on and r.completed_on < due_on order by cycle_number desc limit 1;
    insert into public.completions (provider_id, course_id, cycle_id, completed_at, language, source, note)
    values (r.provider_id, v_course, v_cycle, r.completed_on + interval '12 hours', 'en', 'legacy_wix', 'Imported from Wix')
    on conflict (provider_id, course_id, cycle_id) do nothing;
    insert into public.lesson_progress (provider_id, lesson_id, cycle_id, completed_at)
    select r.provider_id, l.id, v_cycle, r.completed_on + interval '12 hours' from public.lessons l where l.course_id = v_course on conflict do nothing;
    update public.import_rows set status = 'imported' where id = r.id;
    v_count := v_count + 1;
  end loop;
  update public.import_batches set status = 'committed', committed_at = now() where id = p_batch;
  return v_count;
end $$;

-------------------------------------------------------------------------------- invite-only onboarding
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  email text not null,
  full_name text not null,
  provider_types text[] not null default '{}',
  locale text not null default 'en' check (locale in ('en','es')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  profile_id uuid references public.profiles(id) on delete set null
);
alter table public.invites enable row level security;
create policy "staff read" on public.invites for select to authenticated using ((select public.is_staff()));
create policy "staff create" on public.invites for insert to authenticated with check ((select public.is_staff()) and created_by = (select auth.uid()));
create policy "staff delete" on public.invites for delete to authenticated using ((select public.is_staff()) and accepted_at is null);
create trigger audit after insert or update or delete on public.invites for each row execute function public.audit_trigger();

create or replace function public.get_invite(p_token uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('full_name', full_name, 'email', email, 'locale', locale)
  from public.invites where token = p_token and accepted_at is null and expires_at > now();
$$;

-- Demo stand-in for Supabase's admin invite API: creates the account once, from a valid unexpired token.
create or replace function public.accept_invite(p_token uuid, p_password text) returns text
language plpgsql security definer set search_path = '' as $$
declare inv record; v_uid uuid := gen_random_uuid();
begin
  select * into inv from public.invites where token = p_token and accepted_at is null and expires_at > now() for update;
  if inv.id is null then raise exception 'This invitation is not valid or has expired.'; end if;
  if length(coalesce(p_password, '')) < 10 then raise exception 'Use at least 10 characters for your password.'; end if;
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
  public.commit_import(uuid)
to authenticated;
grant execute on function public.get_invite(uuid), public.accept_invite(uuid, text) to anon, authenticated;

-------------------------------------------------------------------------------- nightly job (01:15 Mountain)
create extension if not exists pg_cron;
select cron.schedule('nightly-training', '15 7 * * *', 'select public._nightly_training()');
