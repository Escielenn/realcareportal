-- DEMO ONLY: restores the fake demo dataset. Never apply this migration to the production project.
create schema if not exists demo;
revoke all on schema demo from public, anon, authenticated;
create table demo.seed (id int primary key default 1, sql text not null, md5 text not null);
insert into demo.seed (sql, md5)
select content, md5(content) from net._http_response where id = 1 and md5(content) = '63402fcab3c51d6076f513ef56d89007';

-- Restores the fake demo dataset. Not exposed to the API (schema demo is private).
create or replace function demo.reset() returns void language plpgsql security definer set search_path = '' as $$
declare v_sql text;
begin
  select sql into v_sql from demo.seed where id = 1;
  delete from auth.users where email like '%@example.com';
  truncate public.audit_log, public.announcements, public.form_templates, public.individuals, public.courses restart identity cascade;
  v_sql := replace(replace(v_sql, E'begin;\n', ''), E'commit;', '');
  execute v_sql;
end $$;
revoke all on function demo.reset() from public, anon, authenticated;