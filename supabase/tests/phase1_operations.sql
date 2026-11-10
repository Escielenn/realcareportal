-- Phase 1 operations checks (Nov 10, 2026). Runs on seeded demo data; ends by raising an exception that lists every
-- result, which also rolls everything back. Usage: paste into the SQL editor or run with psql.
create temp table r (n serial, c text, ok boolean);
grant all on r to authenticated, anon; grant usage on sequence r_n_seq to authenticated, anon;
set local role authenticated;

-- Reviewer (Sam) -----------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"8c1acc10-d870-54e7-931d-68e42ead7027","role":"authenticated","aal":"aal1"}';
insert into r (c, ok) select 'reviewer is staff', public.is_staff();
insert into r (c, ok) select 'reviewer can read providers', count(*) > 0 from public.profiles where role = 'provider';
do $$ begin
  begin perform public.staff_add_provider('Test Person', 'test.person@example.com', null, array['host_home'], null, null, 'en');
    insert into r (c, ok) values ('reviewer cannot add providers', false);
  exception when others then insert into r (c, ok) values ('reviewer cannot add providers', true); end;
  begin perform public.open_cycles(array['4e6d8d70-2d43-5307-aeeb-664bf5c96898'::uuid]);
    insert into r (c, ok) values ('reviewer cannot open training years', false);
  exception when others then insert into r (c, ok) values ('reviewer cannot open training years', true); end;
  begin perform public.set_course_overrides(array['4e6d8d70-2d43-5307-aeeb-664bf5c96898'::uuid], 'baa431f8-aa21-5eae-a477-0d945585f10e', 'exempt', 'once', 'x');
    insert into r (c, ok) values ('reviewer cannot assign or exempt', false);
  exception when others then insert into r (c, ok) values ('reviewer cannot assign or exempt', true); end;
  begin update public.requirements set frequency = 'once' where true;
    insert into r (c, ok) values ('reviewer cannot change requirements', not exists (select 1 from public.requirements where frequency = 'once'));
  exception when others then insert into r (c, ok) values ('reviewer cannot change requirements', true); end;
end $$;

-- Training admin (Dana) ----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"eed26bf3-960d-536c-b609-aa71df39f52c","role":"authenticated","aal":"aal1"}';
insert into r (c, ok) select 'training admin adds a provider without a login',
  public.staff_add_provider('Test Person', 'Test.Person@example.com', '303-555-0199', array['host_home', 'nmt'], '2023-04-10', null, 'en') is not null;
insert into r (c, ok) select 'added provider has no login and a current training year',
  exists (select 1 from public.provider_status s where s.email = 'test.person@example.com' and not s.login_enabled
          and s.starts_on <= current_date and s.due_on > current_date and s.required_count > 0);
insert into r (c, ok) select 'roster import adds good rows and reports bad ones',
  (select count(*) filter (where (x->>'ok')::boolean) = 1 and count(*) filter (where not (x->>'ok')::boolean) = 2
   from jsonb_array_elements(public.staff_import_providers('[
     {"full_name":"Roster One","email":"roster.one@example.com","provider_types":["scc_dsp"],"hire_date":"2025-01-06"},
     {"full_name":"Dup","email":"test.person@example.com","provider_types":["scc_dsp"]},
     {"full_name":"No Type","email":"no.type@example.com","provider_types":[]}]'::jsonb)) x);
do $$ begin
  begin update public.profiles set login_enabled = true where email = 'test.person@example.com';
    insert into r (c, ok) values ('staff cannot switch a login on directly', false);
  exception when others then insert into r (c, ok) values ('staff cannot switch a login on directly', true); end;
  begin perform public.set_staff_level('8c1acc10-d870-54e7-931d-68e42ead7027', 'super_admin');
    insert into r (c, ok) values ('training admin cannot change staff levels', false);
  exception when others then insert into r (c, ok) values ('training admin cannot change staff levels', true); end;
end $$;
insert into r (c, ok) select 'bulk exempt works', public.set_course_overrides(
  array(select id from public.profiles where email in ('test.person@example.com', 'roster.one@example.com')),
  (select id from public.courses where slug = 'driving-safety'), 'exempt', 'annual', 'Does not drive') = 2;
insert into r (c, ok) select 'exemption lowers the required count',
  (select required_count from public.provider_status where email = 'roster.one@example.com') = 13;
create temp table tok as select public.staff_invite_provider((select id from public.profiles where email = 'test.person@example.com')) as t;
grant select on tok to anon;

-- The provider accepts the invite (signed out) ---------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
insert into r (c, ok) select 'invite sets a password on the existing record', public.accept_invite((select t from tok), 'a-long-test-password') = 'test.person@example.com';
set local role authenticated;
set local request.jwt.claims = '{"sub":"eed26bf3-960d-536c-b609-aa71df39f52c","role":"authenticated","aal":"aal1"}';
insert into r (c, ok) select 'login is on and history kept', exists (select 1 from public.provider_status where email = 'test.person@example.com' and login_enabled and cycle_number = 1);

-- Full admin (Avery) ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"e7749203-b707-5c16-bf3b-77939b7e6ef3","role":"authenticated","aal":"aal1"}';
select public.set_staff_level('8c1acc10-d870-54e7-931d-68e42ead7027', 'training_admin');
insert into r (c, ok) select 'full admin changes a staff level', (select staff_level from public.profiles where id = '8c1acc10-d870-54e7-931d-68e42ead7027') = 'training_admin';

-- Provider (Maria, assigned the DCW notice) ----------------------------------------------------------
set local request.jwt.claims = '{"sub":"4e6d8d70-2d43-5307-aeeb-664bf5c96898","role":"authenticated","aal":"aal1"}';
insert into r (c, ok) select 'assigned provider sees the invite-only course', exists (select 1 from public.courses where slug = 'dcw-notice-of-rights');
insert into r (c, ok) select 'assigned provider sees its lessons', count(*) = 3 from public.lessons where course_id = 'baa431f8-aa21-5eae-a477-0d945585f10e';
insert into r (c, ok) select 'DCW notice is required for Maria', exists (select 1 from public.required_courses('4e6d8d70-2d43-5307-aeeb-664bf5c96898') where course_id = 'baa431f8-aa21-5eae-a477-0d945585f10e' and frequency = 'once');
do $$ begin
  begin perform public.acknowledge_lesson('b69909c0-c608-5a80-8664-20e05582a98a', '', 'en');
    insert into r (c, ok) values ('signing needs a typed name', false);
  exception when others then insert into r (c, ok) values ('signing needs a typed name', true); end;
  begin insert into public.provider_course_overrides (provider_id, course_id, mode) values ('4e6d8d70-2d43-5307-aeeb-664bf5c96898', 'baa431f8-aa21-5eae-a477-0d945585f10e', 'exempt');
    insert into r (c, ok) values ('provider cannot exempt themselves', false);
  exception when others then insert into r (c, ok) values ('provider cannot exempt themselves', true); end;
end $$;
select public.complete_lesson('e7f89a2d-e930-51d6-a99e-4b6af5c2eee2', 'en');
select public.complete_lesson('ec3c941b-1b77-5d15-882b-2b0b0952c83c', 'en');
insert into r (c, ok) select 'signing the acknowledgment completes the course',
  (public.acknowledge_lesson('b69909c0-c608-5a80-8664-20e05582a98a', 'Maria Delgado', 'en')->>'course_complete')::boolean;
insert into r (c, ok) select 'the signed words are saved', exists (select 1 from public.lesson_acknowledgments where provider_id = '4e6d8d70-2d43-5307-aeeb-664bf5c96898' and typed_name = 'Maria Delgado' and statement like 'I received%');

-- Provider (Luis, not assigned) -----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"da5c7d56-a9d8-5267-956b-500ba5a379eb","role":"authenticated","aal":"aal1"}';
insert into r (c, ok) select 'unassigned provider cannot see the invite-only course', not exists (select 1 from public.courses where slug = 'dcw-notice-of-rights');
insert into r (c, ok) select 'unassigned provider cannot see its lessons', not exists (select 1 from public.lessons where course_id = 'baa431f8-aa21-5eae-a477-0d945585f10e');
insert into r (c, ok) select 'provider cannot see others'' acknowledgments', not exists (select 1 from public.lesson_acknowledgments where provider_id <> 'da5c7d56-a9d8-5267-956b-500ba5a379eb');
do $$ begin
  begin perform public.acknowledge_lesson('b69909c0-c608-5a80-8664-20e05582a98a', 'Luis Herrera', 'es');
    insert into r (c, ok) values ('unassigned provider cannot sign it', false);
  exception when others then insert into r (c, ok) values ('unassigned provider cannot sign it', true); end;
end $$;

reset role;
do $$ declare x text; begin
  select string_agg(case when ok then 'PASS ' else 'FAIL ' end || c, ' | ' order by n) into x from r;
  raise exception 'RESULTS (rolled back): %', x;
end $$;
