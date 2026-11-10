-- Helpers (security definer so RLS policies can call them without recursion)
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin') and p.active);
$$;
comment on function public.is_staff() is 'Security definer: reads profiles without RLS recursion.';

create or replace function public.provider_supports(p_individual uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.provider_individuals pi
    where pi.provider_id = auth.uid() and pi.individual_id = p_individual
      and pi.starts_on <= current_date and (pi.ends_on is null or pi.ends_on >= current_date));
$$;
comment on function public.provider_supports(uuid) is 'Security definer: true only while the caller has an active link to the individual.';

create or replace function public.current_cycle_id(p_provider uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.training_cycles where provider_id = p_provider order by cycle_number desc limit 1;
$$;

-- RLS on every table
alter table public.profiles enable row level security;
alter table public.individuals enable row level security;
alter table public.provider_individuals enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.requirements enable row level security;
alter table public.training_cycles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.completions enable row level security;
alter table public.form_templates enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_events enable row level security;
alter table public.messages enable row level security;
alter table public.announcements enable row level security;
alter table public.audit_log enable row level security;

create policy "own or staff" on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_staff()));
create policy "staff update" on public.profiles for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "staff or linked provider" on public.individuals for select to authenticated using ((select public.is_staff()) or public.provider_supports(id));
create policy "own links or staff" on public.provider_individuals for select to authenticated using (provider_id = (select auth.uid()) or (select public.is_staff()));

create policy "catalog read" on public.courses for select to authenticated using (true);
create policy "catalog read" on public.lessons for select to authenticated using (true);
create policy "catalog read" on public.quiz_questions for select to authenticated using (true);
create policy "catalog read" on public.requirements for select to authenticated using (true);
create policy "catalog read" on public.form_templates for select to authenticated using (true);
create policy "catalog read" on public.announcements for select to authenticated using (true);

create policy "own or staff" on public.training_cycles for select to authenticated using (provider_id = (select auth.uid()) or (select public.is_staff()));
create policy "own or staff" on public.lesson_progress for select to authenticated using (provider_id = (select auth.uid()) or (select public.is_staff()));
create policy "own or staff" on public.quiz_attempts for select to authenticated using (provider_id = (select auth.uid()) or (select public.is_staff()));
create policy "own or staff" on public.completions for select to authenticated using (provider_id = (select auth.uid()) or (select public.is_staff()));
create policy "own or staff" on public.assignments for select to authenticated using (provider_id = (select auth.uid()) or (select public.is_staff()));
create policy "staff assign" on public.assignments for insert to authenticated with check ((select public.is_staff()));
create policy "own or staff" on public.submissions for select to authenticated using (provider_id = (select auth.uid()) or (select public.is_staff()));
create policy "visible submission" on public.submission_events for select to authenticated using (
  exists (select 1 from public.submissions s where s.id = submission_id and (s.provider_id = (select auth.uid()) or (select public.is_staff()))));
create policy "own thread or staff" on public.messages for select to authenticated using (provider_id = (select auth.uid()) or (select public.is_staff()));
create policy "send in own thread" on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and (provider_id = (select auth.uid()) or (select public.is_staff())));
create policy "staff read" on public.audit_log for select to authenticated using ((select public.is_staff()));

-- Hide quiz answers from clients
revoke select on public.quiz_questions from anon, authenticated;
grant select (id, lesson_id, sort, prompt_en, prompt_es, options_en, options_es) on public.quiz_questions to authenticated;
revoke all on public.audit_log from anon;

-- Compliance view (runs with the caller's permissions)
create or replace view public.provider_status with (security_invoker = true) as
select p.id as provider_id, p.full_name, p.email, p.provider_types, p.locale, p.active,
  c.id as cycle_id, c.cycle_number, c.starts_on, c.due_on,
  (select count(distinct r.course_id) from public.requirements r where r.provider_type = any(p.provider_types))::int as required_count,
  (select count(distinct cp.course_id) from public.completions cp
     where cp.cycle_id = c.id and cp.course_id in (select r.course_id from public.requirements r where r.provider_type = any(p.provider_types)))::int as done_count
from public.profiles p
left join lateral (select * from public.training_cycles tc where tc.provider_id = p.id order by tc.cycle_number desc limit 1) c on true
where p.role = 'provider';

-- AUDIT trigger: records who did what, column names only, never values
create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id text; v_cols jsonb := '[]';
begin
  if tg_op = 'DELETE' then v_id := (to_jsonb(old)->>'id'); else v_id := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'provider_id'); end if;
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(n.key), '[]') into v_cols from jsonb_each(to_jsonb(new)) n
      where n.value is distinct from (to_jsonb(old)->n.key);
  end if;
  insert into public.audit_log(actor, action, table_name, record_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, v_id, jsonb_build_object('changed', v_cols));
  return null;
end $$;

create trigger audit after insert or update or delete on public.profiles for each row execute function public.audit_trigger();
create trigger audit after insert or update or delete on public.training_cycles for each row execute function public.audit_trigger();
create trigger audit after insert or update or delete on public.completions for each row execute function public.audit_trigger();
create trigger audit after insert or update or delete on public.assignments for each row execute function public.audit_trigger();
create trigger audit after insert or update or delete on public.submissions for each row execute function public.audit_trigger();
create trigger audit after insert or delete on public.messages for each row execute function public.audit_trigger();

create or replace function public.log_event(p_action text, p_table text, p_record text) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log(actor, action, table_name, record_id) values (auth.uid(), p_action, p_table, p_record);
$$;

-- TRAINING LOGIC
create or replace function public.maybe_complete_course(p_provider uuid, p_course uuid, p_cycle uuid, p_lang text, p_score int)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.lessons l where l.course_id = p_course
             and not exists (select 1 from public.lesson_progress lp where lp.lesson_id = l.id and lp.provider_id = p_provider and lp.cycle_id = p_cycle)) then
    return false;
  end if;
  insert into public.completions(provider_id, course_id, cycle_id, language, score)
  values (p_provider, p_course, p_cycle, coalesce(p_lang,'en'), p_score)
  on conflict (provider_id, course_id, cycle_id) do nothing;
  return true;
end $$;

create or replace function public.complete_lesson(p_lesson uuid, p_lang text default 'en') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_cycle uuid; v_course uuid; v_kind text; v_done boolean;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select course_id, kind into v_course, v_kind from public.lessons where id = p_lesson;
  if v_course is null then raise exception 'lesson not found'; end if;
  if v_kind = 'quiz' then raise exception 'quizzes are completed by passing them'; end if;
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

-- RENEWAL: never resets or deletes; inserts the next cycle
create or replace function public.run_renewals(p_as_of date default current_date) returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int := 0; r record;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
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

create or replace function public.renew_provider(p_provider uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_num int; v_id uuid;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  select coalesce(max(cycle_number), 0) into v_num from public.training_cycles where provider_id = p_provider;
  insert into public.training_cycles(provider_id, cycle_number, starts_on, due_on, label)
  values (p_provider, v_num + 1, current_date, (current_date + interval '1 year')::date, 'Cycle ' || (v_num + 1))
  returning id into v_id;
  return v_id;
end $$;

-- FORMS LOGIC
create or replace function public.submit_form(p_assignment uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a record; s record; v_merged jsonb; k text;
begin
  select * into a from public.assignments where id = p_assignment;
  if a.id is null or a.provider_id <> auth.uid() then raise exception 'not your assignment'; end if;
  if a.individual_id is not null and not public.provider_supports(a.individual_id) then raise exception 'no active link to this individual'; end if;
  select * into s from public.submissions where assignment_id = p_assignment;
  if s.id is null then
    insert into public.submissions(assignment_id, provider_id, data) values (p_assignment, auth.uid(), p_data) returning * into s;
    insert into public.submission_events(submission_id, actor, action) values (s.id, auth.uid(), 'submitted');
    return s.id;
  end if;
  if s.status <> 'returned' then raise exception 'this form is % and cannot be changed', s.status; end if;
  -- Only flagged fields may change on a returned form
  v_merged := s.data;
  for k in select jsonb_object_keys(s.flags) loop
    v_merged := jsonb_set(v_merged, array[k], coalesce(p_data->k, 'null'::jsonb), true);
  end loop;
  update public.submissions set data = v_merged, status = 'submitted', flags = '{}', submitted_at = now() where id = s.id;
  insert into public.submission_events(submission_id, actor, action, note) values (s.id, auth.uid(), 'resubmitted',
    (select string_agg(x, ', ') from jsonb_object_keys(s.flags) x));
  return s.id;
end $$;

create or replace function public.review_submission(p_submission uuid, p_action text, p_flags jsonb default '{}', p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if p_action = 'return' then
    if p_flags is null or p_flags = '{}'::jsonb then raise exception 'flag at least one field to return a form'; end if;
    update public.submissions set status = 'returned', flags = p_flags, reviewed_at = now(), reviewed_by = auth.uid() where id = p_submission and status = 'submitted';
  elsif p_action = 'accept' then
    update public.submissions set status = 'accepted', flags = '{}', reviewed_at = now(), reviewed_by = auth.uid() where id = p_submission and status = 'submitted';
  else raise exception 'unknown action';
  end if;
  if not found then raise exception 'submission is not waiting for review'; end if;
  insert into public.submission_events(submission_id, actor, action, note) values (p_submission, auth.uid(), p_action || 'ed', p_note);
end $$;

-- Lock down function execution
revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_staff(), public.provider_supports(uuid), public.current_cycle_id(uuid),
  public.complete_lesson(uuid, text), public.submit_quiz(uuid, int[], text), public.run_renewals(date),
  public.renew_provider(uuid), public.submit_form(uuid, jsonb), public.review_submission(uuid, text, jsonb, text),
  public.log_event(text, text, text) to authenticated;
revoke execute on function public.maybe_complete_course(uuid, uuid, uuid, text, int), public.audit_trigger() from authenticated;
