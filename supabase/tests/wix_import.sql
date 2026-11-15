-- Wix import, renewal rule and course visibility checks (Nov 14, 2026). Runs on seeded demo data (demo_mode on);
-- ends by raising an exception that lists every result, which also rolls everything back. All people are fictional.
create temp table r (n serial, c text, ok boolean);
grant all on r to authenticated, anon; grant usage on sequence r_n_seq to authenticated, anon;

-- Payload: A finished every core course in June 2025 (should be overdue now); B finished last month (current);
-- C has no email; D repeats A's email; E is already a portal provider; F has no type; G did the Spanish versions.
create temp table payload as
with core as (select unnest(array['welcome','system-values','scc','supports-services','respect-dignity','pcp','mane',
  'individual-rights','health-safety','driving-safety','dei','confidentiality','communication','crisis']) slug),
comp as (
  select jsonb_agg(jsonb_build_object('slug', slug, 'lang', 'en', 'on', '2025-06-15')) a,
         jsonb_agg(jsonb_build_object('slug', slug, 'lang', 'en', 'on', to_char(current_date - 30, 'YYYY-MM-DD'))) b,
         jsonb_agg(jsonb_build_object('slug', slug, 'lang', 'es', 'on', '2026-01-20')) g
  from core)
select jsonb_build_array(
  jsonb_build_object('wix_member_id', 'm-a', 'full_name', 'Avery Testwell', 'email', 'avery.testwell@example.com', 'provider_types', '["rci_provider"]'::jsonb,
    'joined_on', '2025-05-01', 'completions', a || '[{"slug":"no-such-course","lang":"en","on":"2025-06-15"}]'::jsonb,
    'access', '{"kind":"real_care"}'::jsonb),
  jsonb_build_object('wix_member_id', 'm-b', 'full_name', 'Blake Current', 'email', 'blake.current@example.com', 'provider_types', '["scc_dsp"]'::jsonb,
    'completions', b, 'access', jsonb_build_object('kind', 'all_access', 'starts_on', to_char(current_date - 30, 'YYYY-MM-DD'), 'ends_on', to_char(current_date + 335, 'YYYY-MM-DD'))),
  jsonb_build_object('wix_member_id', 'm-c', 'full_name', 'Casey Noemail', 'email', '', 'provider_types', '["scc_dsp"]'::jsonb),
  jsonb_build_object('wix_member_id', 'm-d', 'full_name', 'Avery Twice', 'email', 'AVERY.testwell@example.com', 'provider_types', '["scc_dsp"]'::jsonb),
  jsonb_build_object('wix_member_id', 'm-e', 'full_name', 'Already Here', 'email', 'demo.provider@example.com', 'provider_types', '["scc_dsp"]'::jsonb),
  jsonb_build_object('wix_member_id', 'm-f', 'full_name', 'Frankie Notype', 'email', 'frankie.notype@example.com', 'provider_types', '["contractor"]'::jsonb),
  jsonb_build_object('wix_member_id', 'm-g', 'full_name', 'Gabi Espanol', 'email', 'gabi.espanol@example.com', 'provider_types', '["family_caregiver","fcg"]'::jsonb,
    'locale', 'es', 'completions', g)
) p from comp;
grant select on payload to authenticated;

set local role authenticated;

-- Training admin (Dana): can read staging, cannot import ------------------------------------
set local request.jwt.claims = '{"sub":"eed26bf3-960d-536c-b609-aa71df39f52c","role":"authenticated","aal":"aal1"}';
do $$ begin
  begin perform public.stage_wix_import('sample', (select p from payload), '{}');
    insert into r (c, ok) values ('training admin cannot stage a Wix import', false);
  exception when others then insert into r (c, ok) values ('training admin cannot stage a Wix import', true); end;
end $$;

-- Super admin (Avery) ------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"e7749203-b707-5c16-bf3b-77939b7e6ef3","role":"authenticated","aal":"aal1"}';
do $$ begin
  begin perform public.stage_wix_import('wix', (select p from payload), '{}');
    insert into r (c, ok) values ('real Wix data is refused in the demo', false);
  exception when others then insert into r (c, ok) values ('real Wix data is refused in the demo', sqlerrm like '%demo%'); end;
end $$;

create temp table run as select public.stage_wix_import('sample', (select p from payload), '{"members":7}') id;
insert into r (c, ok) select 'staging sorts people by status',
  (select string_agg(wix_member_id || '=' || status, ',' order by wix_member_id) from public.wix_import_people where run_id = (select id from run))
  = 'm-a=ready,m-b=ready,m-c=no_email,m-d=duplicate_email,m-e=existing,m-f=no_type,m-g=ready';
insert into r (c, ok) select 'unknown courses and unknown types are dropped',
  (select jsonb_array_length(completions) = 14 from public.wix_import_people where wix_member_id = 'm-a' and run_id = (select id from run))
  and (select provider_types = array['family_caregiver'] from public.wix_import_people where wix_member_id = 'm-g' and run_id = (select id from run));
select public.set_wix_import_types((select id from public.wix_import_people where wix_member_id = 'm-f' and run_id = (select id from run)), array['host_home']);
insert into r (c, ok) select 'staff can give a person a type before committing',
  exists (select 1 from public.wix_import_people where wix_member_id = 'm-f' and status = 'ready' and provider_types = array['host_home'] and run_id = (select id from run));
do $$ begin
  begin update public.wix_import_people set status = 'ready' where wix_member_id = 'm-e';
    insert into r (c, ok) values ('staging rows cannot be edited directly', not exists (select 1 from public.wix_import_people where wix_member_id = 'm-e' and status = 'ready'));
  exception when others then insert into r (c, ok) values ('staging rows cannot be edited directly', true); end;
end $$;

insert into r (c, ok) select 'commit creates the four ready people', (public.commit_wix_import((select id from run))->>'people')::int = 4;
do $$ begin
  begin perform public.commit_wix_import((select id from run));
    insert into r (c, ok) values ('an import cannot be committed twice', false);
  exception when others then insert into r (c, ok) values ('an import cannot be committed twice', true); end;
end $$;
insert into r (c, ok) select 'imported people have no login and keep their Wix id',
  (select count(*) = 4 from public.profiles where external_ref in ('wix:m-a', 'wix:m-b', 'wix:m-f', 'wix:m-g') and not login_enabled and role = 'provider');
insert into r (c, ok) select 'nobody imported was notified or emailed',
  not exists (select 1 from public.notifications n join public.profiles p on p.id = n.profile_id where p.external_ref like 'wix:m-%')
  and not exists (select 1 from public.email_outbox o join public.profiles p on p.id = o.profile_id where p.external_ref like 'wix:m-%');
insert into r (c, ok) select 'history lands in a Wix history year marked legacy_wix',
  (select count(*) = 14 from public.completions cp join public.profiles p on p.id = cp.provider_id join public.training_cycles tc on tc.id = cp.cycle_id
   where p.external_ref = 'wix:m-a' and cp.source = 'legacy_wix' and tc.label = 'Wix history' and tc.cycle_number = 1);
insert into r (c, ok) select 'June 2025 finisher is overdue (next year was due June 2026)',
  exists (select 1 from public.provider_status s join public.profiles p on p.id = s.provider_id
          where p.external_ref = 'wix:m-a' and s.cycle_number = 2 and s.due_on = date '2026-06-15' and s.done_count < s.required_count);
insert into r (c, ok) select 'last month''s finisher is current with nothing new opened',
  exists (select 1 from public.provider_status s join public.profiles p on p.id = s.provider_id
          where p.external_ref = 'wix:m-b' and s.cycle_number = 1 and s.done_count = s.required_count);
insert into r (c, ok) select 'Spanish completions keep their language',
  (select count(*) = 14 from public.completions cp join public.profiles p on p.id = cp.provider_id where p.external_ref = 'wix:m-g' and cp.language = 'es')
  and (select locale = 'es' from public.profiles where external_ref = 'wix:m-g');
insert into r (c, ok) select 'Real Care plan becomes open-ended All-Access paid by Real Care',
  exists (select 1 from public.entitlements e join public.orders o on o.id = e.order_id join public.programs pr on pr.id = e.program_id
          join public.profiles p on p.id = e.provider_id
          where p.external_ref = 'wix:m-a' and pr.slug = 'all-access' and o.method = 'paid_by_real_care' and e.ends_on = date '2099-12-31');
insert into r (c, ok) select 'All-Access bought on Wix keeps its dates',
  exists (select 1 from public.entitlements e join public.profiles p on p.id = e.provider_id
          where p.external_ref = 'wix:m-b' and e.ends_on = current_date + 335);

-- Renewal rule ------------------------------------------------------------------------------
reset role;
select public._run_renewals((now() at time zone 'America/Denver')::date);
insert into r (c, ok) select 'an unfinished overdue year never rolls over',
  (select count(*) = 2 from public.training_cycles tc join public.profiles p on p.id = tc.provider_id where p.external_ref = 'wix:m-a');
select public._run_renewals(current_date + 300);
insert into r (c, ok) select 'next year opens 60 days before it is due, a year after finishing',
  exists (select 1 from public.training_cycles tc join public.profiles p on p.id = tc.provider_id
          where p.external_ref = 'wix:m-b' and tc.cycle_number = 2 and tc.due_on = current_date - 30 + 365 and tc.starts_on = tc.due_on - 60);
insert into r (c, ok) select 'RCI Provider is a valid type with requirements',
  'rci_provider' = any (public.provider_type_list()) and exists (select 1 from public.requirements where provider_type = 'rci_provider');
insert into r (c, ok) select 'All-Access is exactly the 14 core courses',
  (select count(*) = 14 from public.program_courses pc join public.programs p on p.id = pc.program_id where p.slug = 'all-access')
  and not exists (select 1 from public.program_courses pc join public.programs p on p.id = pc.program_id join public.courses c on c.id = pc.course_id
                  where p.slug = 'all-access' and c.slug in ('qmap', 'respite', 'documentation', 'injection-admin', 'employee-orientation'));

-- Provider (Maria, Host Home) -----------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"4e6d8d70-2d43-5307-aeeb-664bf5c96898","role":"authenticated","aal":"aal1"}';
insert into r (c, ok) select 'provider cannot read Wix staging', not exists (select 1 from public.wix_import_people) and not exists (select 1 from public.wix_import_runs);
insert into r (c, ok) select 'invite-only QMAP is visible when the provider''s type requires it', exists (select 1 from public.courses where slug = 'qmap');
insert into r (c, ok) select 'invite-only Employee Orientation stays hidden', not exists (select 1 from public.courses where slug = 'employee-orientation');
insert into r (c, ok) select 'Respite is open to everyone', exists (select 1 from public.courses where slug = 'respite');
do $$ begin
  begin perform public.commit_wix_import(gen_random_uuid());
    insert into r (c, ok) values ('provider cannot commit an import', false);
  exception when others then insert into r (c, ok) values ('provider cannot commit an import', true); end;
end $$;

reset role;
do $$ declare x text; begin
  select string_agg(case when ok then 'PASS ' else 'FAIL ' end || c, ' | ' order by n) into x from r;
  raise exception 'RESULTS (rolled back): %', x;
end $$;
