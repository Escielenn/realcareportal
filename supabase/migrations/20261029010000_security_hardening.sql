-- Security pass (OWASP Top 10:2025 review, Oct 29, 2026). See docs/security-review.md for findings.

-------------------------------------------------------------------------------- settings that differ between demo and production
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  demo_mode boolean not null default false,          -- production default: off
  staff_mfa_required boolean not null default true,   -- production default: on
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id, demo_mode, staff_mfa_required) values (1, true, false) on conflict (id) do nothing; -- this demo project
alter table public.app_settings enable row level security;
create policy "read" on public.app_settings for select to authenticated using (true);
create trigger audit after update on public.app_settings for each row execute function public.audit_trigger();

-------------------------------------------------------------------------------- OWASP-A07-001: staff MFA enforced in the database
-- When staff_mfa_required is on, a staff session counts as staff only after a second factor (aal2).
-- Every staff RLS policy and staff RPC goes through is_staff(), so this protects the API as well as the screens.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff', 'admin') and p.active)
     and (not coalesce((select staff_mfa_required from public.app_settings where id = 1), true)
          or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2');
$$;

-------------------------------------------------------------------------------- OWASP-A06-001: demo checkout only in demo mode
create or replace function public.demo_checkout(p_course uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c record; v_order uuid; v_amount int; v_desc text; v_days int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not coalesce((select demo_mode from public.app_settings where id = 1), false) then
    raise exception 'Online payment is not available yet. Contact Real Care staff.';
  end if;
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

-------------------------------------------------------------------------------- OWASP-A09-001: app audit events limited to known actions
create or replace function public.log_event(p_action text, p_table text, p_record text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  if p_action not in ('sign_in', 'view_provider', 'view_submission', 'view_document', 'view_individual', 'export_report', 'export_transcripts') then
    raise exception 'unknown audit action';
  end if;
  insert into public.audit_log (actor, action, table_name, record_id)
  values (auth.uid(), p_action, left(coalesce(p_table, ''), 40), left(coalesce(p_record, ''), 120));
end $$;

-------------------------------------------------------------------------------- OWASP-A01-001: helpers answer only about yourself (or staff, or jobs)
create or replace function public.current_cycle_id(p_provider uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.training_cycles
  where provider_id = p_provider and (auth.uid() is null or p_provider = auth.uid() or public.is_staff())
  order by cycle_number desc limit 1;
$$;

create or replace function public.has_course_access(p_provider uuid, p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (auth.uid() is null or p_provider = auth.uid() or public.is_staff()) and coalesce((select c.price_cents = 0 or exists (
      select 1 from public.entitlements e where e.provider_id = p_provider and current_date between e.starts_on and e.ends_on
        and (e.course_id = c.id or (e.course_id is null and c.in_all_access)))
    from public.courses c where c.id = p_course), false);
$$;

-------------------------------------------------------------------------------- MFA status for the staff security page
create or replace function public.my_mfa_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'required', coalesce((select staff_mfa_required from public.app_settings where id = 1), true),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'),
    'verified_factors', (select count(*) from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'));
$$;

grant execute on function public.my_mfa_status() to authenticated;
