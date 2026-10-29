-- RLS and RPC checks for programs. Runs against seeded demo data inside a transaction and rolls back.
-- Usage: psql -f supabase/tests/programs.sql   (or paste into the SQL editor). Every check raises on failure.
begin;

create temp table results (n serial, check_name text, ok boolean);
grant all on results to authenticated;
grant usage on sequence results_n_seq to authenticated;

-- Maria (provider, host home) --------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"4e6d8d70-2d43-5307-aeeb-664bf5c96898","role":"authenticated","aal":"aal1"}';

insert into results (check_name, ok) select 'provider sees active programs', count(*) >= 1 from public.programs;
insert into results (check_name, ok) select 'provider sees program courses', count(*) >= 1 from public.program_courses;

do $$ begin
  begin insert into public.programs (slug, name_en, name_es) values ('hack', 'Hack', 'Hack');
    insert into results (check_name, ok) values ('provider cannot create programs', false);
  exception when others then insert into results (check_name, ok) values ('provider cannot create programs', true); end;
  begin update public.programs set price_cents = 1 where slug = 'all-access';
    insert into results (check_name, ok) values ('provider cannot change price', (select price_cents from public.programs where slug = 'all-access') <> 1);
  exception when others then insert into results (check_name, ok) values ('provider cannot change price', true); end;
  begin insert into public.program_courses (program_id, course_id) values ('50e88256-f3ac-5e06-b792-4afcf9b4e52f', 'bfaf8f11-e6db-5d53-92a6-a1237b0ed30c');
    insert into results (check_name, ok) values ('provider cannot add courses to a program', false);
  exception when others then insert into results (check_name, ok) values ('provider cannot add courses to a program', true); end;
  begin perform public.set_program_courses('50e88256-f3ac-5e06-b792-4afcf9b4e52f', '{}');
    insert into results (check_name, ok) values ('provider cannot call set_program_courses', false);
  exception when others then insert into results (check_name, ok) values ('provider cannot call set_program_courses', true); end;
  begin perform public.grant_program('4e6d8d70-2d43-5307-aeeb-664bf5c96898', '50e88256-f3ac-5e06-b792-4afcf9b4e52f', 365, 'free');
    insert into results (check_name, ok) values ('provider cannot grant themselves a program', false);
  exception when others then insert into results (check_name, ok) values ('provider cannot grant themselves a program', true); end;
  begin perform public._join_program('4e6d8d70-2d43-5307-aeeb-664bf5c96898', '50e88256-f3ac-5e06-b792-4afcf9b4e52f', 'stripe', 0, 365, null, null);
    insert into results (check_name, ok) values ('provider cannot call internal _join_program', false);
  exception when others then insert into results (check_name, ok) values ('provider cannot call internal _join_program', true); end;
end $$;

insert into results (check_name, ok)
select 'qmap stays locked without a purchase', not public.has_course_access('4e6d8d70-2d43-5307-aeeb-664bf5c96898', 'bfaf8f11-e6db-5d53-92a6-a1237b0ed30c');
insert into results (check_name, ok)
select 'provider cannot ask about another provider', not public.has_course_access('da5c7d56-a9d8-5267-956b-500ba5a379eb', 'c005138d-d318-56d3-8bc4-415fb3e9fd69');

-- Automatic renewal is the provider's own switch.
select public.set_auto_renew('50e88256-f3ac-5e06-b792-4afcf9b4e52f', true);
insert into results (check_name, ok) select 'provider can turn on auto-renew', auto_renew from public.program_auto_renew
  where provider_id = '4e6d8d70-2d43-5307-aeeb-664bf5c96898' and program_id = '50e88256-f3ac-5e06-b792-4afcf9b4e52f';
do $$ begin
  begin insert into public.program_auto_renew (provider_id, program_id, auto_renew) values ('da5c7d56-a9d8-5267-956b-500ba5a379eb', '50e88256-f3ac-5e06-b792-4afcf9b4e52f', true);
    insert into results (check_name, ok) values ('provider cannot write auto-renew rows directly', false);
  exception when others then insert into results (check_name, ok) values ('provider cannot write auto-renew rows directly', true); end;
  begin perform public._program_autorenew(current_date);
    insert into results (check_name, ok) values ('provider cannot run the renewal job', false);
  exception when others then insert into results (check_name, ok) values ('provider cannot run the renewal job', true); end;
end $$;

-- Join the example bundle (host homes are in its audience); respite opens.
select public.join_program('c951f62b-ea6e-5927-a42c-192f313743e9');
insert into results (check_name, ok)
select 'joining a program opens its courses', public.has_course_access('4e6d8d70-2d43-5307-aeeb-664bf5c96898', 'becc0762-5154-5f7a-a940-8428f02a1a20');
do $$ begin
  begin perform public.join_program('c951f62b-ea6e-5927-a42c-192f313743e9');
    insert into results (check_name, ok) values ('renewal blocked more than 60 days early', false);
  exception when others then insert into results (check_name, ok) values ('renewal blocked more than 60 days early', true); end;
end $$;

-- Luis (SCC/DSP) is outside the bundle's audience ---------------------------------------
set local request.jwt.claims = '{"sub":"da5c7d56-a9d8-5267-956b-500ba5a379eb","role":"authenticated","aal":"aal1"}';
do $$ begin
  begin perform public.join_program('c951f62b-ea6e-5927-a42c-192f313743e9');
    insert into results (check_name, ok) values ('audience limits who can join', false);
  exception when others then insert into results (check_name, ok) values ('audience limits who can join', true); end;
end $$;
insert into results (check_name, ok)
select 'provider cannot see another provider''s program terms', count(*) = 0 from public.entitlements where provider_id = '4e6d8d70-2d43-5307-aeeb-664bf5c96898';

-- Staff --------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"eed26bf3-960d-536c-b609-aa71df39f52c","role":"authenticated","aal":"aal1"}';
insert into public.programs (slug, name_en, name_es, active) values ('test-hidden', 'Hidden test', 'Prueba oculta', false);
insert into results (check_name, ok) select 'staff can create programs', exists (select 1 from public.programs where slug = 'test-hidden');
select public.set_program_courses((select id from public.programs where slug = 'test-hidden'), array['bfaf8f11-e6db-5d53-92a6-a1237b0ed30c'::uuid]);
insert into results (check_name, ok) select 'staff can set program courses', count(*) = 1 from public.program_courses pc join public.programs p on p.id = pc.program_id where p.slug = 'test-hidden';
select public.grant_program('da5c7d56-a9d8-5267-956b-500ba5a379eb', (select id from public.programs where slug = 'test-hidden'), 30, 'test grant');
insert into results (check_name, ok)
select 'grant opens the program''s courses', public.has_course_access('da5c7d56-a9d8-5267-956b-500ba5a379eb', 'bfaf8f11-e6db-5d53-92a6-a1237b0ed30c');

-- Hidden programs are invisible to providers --------------------------------------------
set local request.jwt.claims = '{"sub":"4e6d8d70-2d43-5307-aeeb-664bf5c96898","role":"authenticated","aal":"aal1"}';
insert into results (check_name, ok) select 'providers cannot see hidden programs', not exists (select 1 from public.programs where slug = 'test-hidden');

reset role;
-- The nightly job renews Maria's All-Access (ends within 3 days, auto-renew on, demo mode on).
insert into results (check_name, ok) select 'nightly job renewed someone', public._program_autorenew(current_date) >= 1;
insert into results (check_name, ok)
select 'nightly job renews when auto-renew is on', exists (select 1 from public.entitlements where provider_id = '4e6d8d70-2d43-5307-aeeb-664bf5c96898'
              and program_id = '50e88256-f3ac-5e06-b792-4afcf9b4e52f' and starts_on > current_date);
do $$ declare bad text; begin
  select string_agg(check_name, '; ') into bad from results where not ok;
  if bad is not null then raise exception 'FAILED: %', bad; end if;
end $$;
select check_name, ok from results order by n;
rollback;
